package com.jarvis.assistant.tools

import android.Manifest
import com.jarvis.assistant.services.LocationService
import com.jarvis.assistant.services.NewsService
import com.jarvis.assistant.services.WeatherService
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.roundToInt

/** 날씨·뉴스 */
@Singleton
class InfoTools @Inject constructor(
    private val weather: WeatherService,
    private val news: NewsService,
    private val location: LocationService,
    private val permissionGate: PermissionGate,
) : ToolProvider {

    override val bundleId = "20_info"

    override val tools: List<JarvisTool> = listOf(
        SimpleTool(
            name = "get_weather",
            description = "현재 날씨와 12시간 예보, 오늘/내일 기온과 강수확률을 조회한다. 좌표나 도시를 주지 않으면 현재 위치를 쓴다.",
            inputSchema = Schema.obj(
                "city" to Schema.string("도시나 지역 이름 (예: 부산, 도쿄)"),
                "lat" to Schema.number("위도"),
                "lon" to Schema.number("경도"),
                required = emptyList(),
            ),
            category = ToolCategory.WEATHER,
            hudLabel = "ATMOSPHERIC SCAN",
        ) { input -> weatherFor(input.str("city"), input.double("lat"), input.double("lon")) },
        SimpleTool(
            name = "get_news",
            description = "구글 뉴스 한국판에서 주요 헤드라인 또는 주제별 뉴스를 가져온다. 제목, 출처, 링크를 돌려준다.",
            inputSchema = Schema.obj(
                "topic" to Schema.string("검색 주제 (생략하면 주요 뉴스)"),
                "count" to Schema.integer("가져올 개수", 1, 10),
                required = emptyList(),
            ),
            category = ToolCategory.NEWS,
            hudLabel = "NEWS UPLINK",
        ) { input ->
            val topic = input.str("topic")
            val items = news.headlines(topic, input.int("count")?.coerceIn(1, 10) ?: 5)
            if (items.isEmpty()) return@SimpleTool ToolResult("뉴스를 찾지 못했습니다.")
            ToolResult(
                items.mapIndexed { i, n -> "${i + 1}. ${n.title} (${n.source}) ${n.link}" }.joinToString("\n"),
                card = ResultCard.News(topic?.uppercase() ?: "HEADLINES", items),
            )
        },
    )

    suspend fun weatherFor(city: String?, lat: Double?, lon: Double?): ToolResult {
        val (la, lo, place) = when {
            lat != null && lon != null -> Triple(lat, lon, location.reverseGeocode(lat, lon) ?: "%.2f, %.2f".format(lat, lon))
            city != null -> {
                val g = weather.geocode(city) ?: return ToolResult.error("'$city' 위치를 찾지 못했습니다.")
                Triple(g.latitude, g.longitude, listOfNotNull(g.admin1, g.name).distinct().joinToString(" "))
            }
            else -> {
                val granted = permissionGate.ensure(
                    listOf(Manifest.permission.ACCESS_COARSE_LOCATION),
                    "현재 위치의 날씨를 알려 드리려면 대략적인 위치 권한이 필요합니다.",
                )
                val loc = (if (granted) location.current() else location.cached())
                    ?: return ToolResult.error(
                        if (granted) "현재 위치를 확인하지 못했습니다. 도시 이름을 말해 달라고 안내하세요."
                        else "위치 권한이 없어 현재 위치 날씨를 알 수 없습니다. 도시 이름을 말해 달라고 안내하세요.",
                    )
                Triple(loc.lat, loc.lon, loc.place ?: "현재 위치")
            }
        }
        val r = weather.forecast(la, lo)
        val c = r.current
        val card = ResultCard.Weather(
            place = place,
            temperature = c.temperature,
            apparent = c.apparent,
            weatherCode = c.code,
            humidity = c.humidity,
            windKmh = c.wind,
            hourlyTemps = r.next12h.map { it.temp },
            hourlyPrecipProb = r.next12h.map { it.precipProb },
            hourlyLabels = r.next12h.map { it.label },
            todayMax = r.todayMax,
            todayMin = r.todayMin,
            isDay = c.isDay == 1,
        )
        val text = buildString {
            append("장소: $place\n")
            append("현재: ${WeatherService.describe(c.code)}, ${c.temperature.roundToInt()}°C (체감 ${c.apparent.roundToInt()}°C), 습도 ${c.humidity}%, 바람 ${c.wind.roundToInt()}km/h\n")
            append("오늘: 최고 ${r.todayMax.roundToInt()}°C / 최저 ${r.todayMin.roundToInt()}°C, 최대 강수확률 ${r.todayPrecipMax}%\n")
            if (r.tomorrowMax != null) {
                append("내일: ${r.tomorrowCode?.let(WeatherService::describe) ?: ""}, 최고 ${r.tomorrowMax.roundToInt()}°C / 최저 ${r.tomorrowMin?.roundToInt()}°C, 강수확률 ${r.tomorrowPrecipMax ?: 0}%\n")
            }
            append("12시간: " + r.next12h.joinToString(", ") { "${it.label}시 ${it.temp.roundToInt()}° 비${it.precipProb}%" })
        }
        return ToolResult(text, card = card)
    }
}
