package com.jarvis.assistant.briefing

import com.jarvis.assistant.data.db.TodoDao
import com.jarvis.assistant.data.settings.SettingsRepository
import com.jarvis.assistant.services.CalendarRepository
import com.jarvis.assistant.services.LocationService
import com.jarvis.assistant.services.NewsService
import com.jarvis.assistant.services.WeatherService
import com.jarvis.assistant.tools.EventItem
import com.jarvis.assistant.tools.NewsItem
import com.jarvis.assistant.tools.TimeText
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.Serializable
import java.time.LocalTime
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.roundToInt

@Serializable
data class Briefing(
    val createdAt: Long,
    val headline: String,
    val spoken: String,
    val weatherLine: String?,
    val temperature: Int?,
    val weatherCode: Int?,
    val events: List<BriefEvent>,
    val todos: List<String>,
    val news: List<BriefNews>,
)

@Serializable
data class BriefEvent(val title: String, val startMillis: Long, val allDay: Boolean)

@Serializable
data class BriefNews(val title: String, val source: String, val link: String)

/** 날씨 + 오늘 일정 + 할 일 + 주요 뉴스 3개 → 음성용 요약. API 호출 없이 로컬에서 만든다. */
@Singleton
class BriefingComposer @Inject constructor(
    private val weather: WeatherService,
    private val news: NewsService,
    private val calendar: CalendarRepository,
    private val location: LocationService,
    private val todoDao: TodoDao,
    private val settings: SettingsRepository,
) {
    suspend fun compose(): Briefing = coroutineScope {
        val s = settings.current()
        val weatherJob = async {
            runCatching {
                val loc = (if (location.hasPermission()) location.current() else location.cached()) ?: return@runCatching null
                (loc.place ?: "현재 위치") to weather.forecast(loc.lat, loc.lon)
            }.getOrNull()
        }
        val eventsJob = async { runCatching { calendar.today() }.getOrDefault(emptyList()) }
        val newsJob = async { runCatching { news.headlines(null, 3) }.getOrDefault(emptyList()) }
        val todos = runCatching { todoDao.pending() }.getOrDefault(emptyList())

        val w = weatherJob.await()
        val events: List<EventItem> = eventsJob.await()
        val headlines: List<NewsItem> = newsJob.await()

        val name = s.userName.trim().ifBlank { null }?.let { if (it.endsWith("님")) it else "${it}님" } ?: "님"
        val greeting = when (LocalTime.now().hour) {
            in 4..10 -> "좋은 아침입니다"
            in 11..16 -> "좋은 오후입니다"
            in 17..21 -> "좋은 저녁입니다"
            else -> "늦은 시간이네요"
        }

        val spoken = buildString {
            append("$greeting, $name. ")
            if (w != null) {
                val (place, r) = w
                append("$place 현재 기온은 ${r.current.temperature.roundToInt()}도, ${WeatherService.describe(r.current.code)}입니다. ")
                append("오늘 최고 ${r.todayMax.roundToInt()}도, 최저 ${r.todayMin.roundToInt()}도")
                if (r.todayPrecipMax >= 40) append(", 강수확률이 ${r.todayPrecipMax}퍼센트이니 우산을 챙기세요. ") else append("입니다. ")
            }
            val timed = events.filter { !it.allDay && it.endMillis > System.currentTimeMillis() }
            when {
                events.isEmpty() -> append("오늘 등록된 일정은 없습니다. ")
                timed.isNotEmpty() -> append("오늘 일정은 ${events.size}건이고, 다음 일정은 ${TimeText.spokenTime(timed.first().startMillis)} ${timed.first().title}입니다. ")
                else -> append("오늘 일정은 ${events.size}건입니다. ")
            }
            if (todos.isNotEmpty()) append("남은 할 일은 ${todos.size}건, 가장 먼저 할 일은 ${todos.first().text}입니다. ")
            if (headlines.isNotEmpty()) {
                append("주요 뉴스입니다. ")
                headlines.take(3).forEachIndexed { i, n -> append("${listOf("첫째", "둘째", "셋째")[i]}, ${n.title}. ") }
            }
            append("오늘도 좋은 하루 되세요.")
        }

        val headline = listOfNotNull(
            w?.let { "${it.second.current.temperature.roundToInt()}° ${WeatherService.describe(it.second.current.code)}" },
            "일정 ${events.size}",
            "할 일 ${todos.size}",
        ).joinToString(" · ")

        Briefing(
            createdAt = System.currentTimeMillis(),
            headline = headline,
            spoken = spoken,
            weatherLine = w?.let { (p, r) -> "$p  ${r.todayMin.roundToInt()}° / ${r.todayMax.roundToInt()}°  ☂ ${r.todayPrecipMax}%" },
            temperature = w?.second?.current?.temperature?.roundToInt(),
            weatherCode = w?.second?.current?.code,
            events = events.take(4).map { BriefEvent(it.title, it.startMillis, it.allDay) },
            todos = todos.take(3).map { it.text },
            news = headlines.take(3).map { BriefNews(it.title, it.source, it.link) },
        )
    }
}
