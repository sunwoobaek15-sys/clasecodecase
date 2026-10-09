package com.jarvis.assistant.services

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.time.LocalDateTime
import javax.inject.Inject
import javax.inject.Singleton

/** Open-Meteo (API 키 불필요) */
@Singleton
class WeatherService @Inject constructor(
    private val http: OkHttpClient,
    private val json: Json,
) {
    @Serializable
    data class Forecast(
        val current: Current? = null,
        val hourly: Hourly? = null,
        val daily: Daily? = null,
    )

    @Serializable
    data class Current(
        val time: String = "",
        @SerialName("temperature_2m") val temperature: Double = 0.0,
        @SerialName("apparent_temperature") val apparent: Double = 0.0,
        @SerialName("relative_humidity_2m") val humidity: Int = 0,
        @SerialName("weather_code") val code: Int = 0,
        @SerialName("wind_speed_10m") val wind: Double = 0.0,
        @SerialName("is_day") val isDay: Int = 1,
    )

    @Serializable
    data class Hourly(
        val time: List<String> = emptyList(),
        @SerialName("temperature_2m") val temperature: List<Double?> = emptyList(),
        @SerialName("precipitation_probability") val precipProb: List<Int?> = emptyList(),
        @SerialName("weather_code") val code: List<Int?> = emptyList(),
    )

    @Serializable
    data class Daily(
        val time: List<String> = emptyList(),
        @SerialName("temperature_2m_max") val max: List<Double?> = emptyList(),
        @SerialName("temperature_2m_min") val min: List<Double?> = emptyList(),
        @SerialName("precipitation_probability_max") val precipMax: List<Int?> = emptyList(),
        @SerialName("weather_code") val code: List<Int?> = emptyList(),
    )

    @Serializable
    private data class GeoResponse(val results: List<GeoResult> = emptyList())

    @Serializable
    data class GeoResult(
        val name: String,
        val latitude: Double,
        val longitude: Double,
        val country: String? = null,
        val admin1: String? = null,
    )

    data class HourPoint(val label: String, val temp: Double, val precipProb: Int, val code: Int)

    data class Report(
        val current: Current,
        val next12h: List<HourPoint>,
        val todayMax: Double,
        val todayMin: Double,
        val todayPrecipMax: Int,
        val tomorrowMax: Double?,
        val tomorrowMin: Double?,
        val tomorrowPrecipMax: Int?,
        val tomorrowCode: Int?,
    )

    suspend fun forecast(lat: Double, lon: Double): Report = withContext(Dispatchers.IO) {
        val url = "https://api.open-meteo.com/v1/forecast".toHttpUrl().newBuilder()
            .addQueryParameter("latitude", "%.4f".format(java.util.Locale.US, lat))
            .addQueryParameter("longitude", "%.4f".format(java.util.Locale.US, lon))
            .addQueryParameter("current", "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day")
            .addQueryParameter("hourly", "temperature_2m,precipitation_probability,weather_code")
            .addQueryParameter("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code")
            .addQueryParameter("timezone", "auto")
            .addQueryParameter("forecast_days", "2")
            .build()
        val body = http.newCall(Request.Builder().url(url).build()).execute().use { r ->
            if (!r.isSuccessful) throw IOException("날씨 서버 오류 ${r.code}")
            r.body?.string() ?: throw IOException("빈 응답")
        }
        val f = json.decodeFromString(Forecast.serializer(), body)
        val current = f.current ?: throw IOException("현재 날씨 정보 없음")
        val hourly = f.hourly ?: Hourly()
        val nowKey = runCatching { LocalDateTime.parse(current.time).withMinute(0) }.getOrNull()
        val startIdx = hourly.time.indexOfFirst { t ->
            nowKey == null || runCatching { !LocalDateTime.parse(t).isBefore(nowKey) }.getOrDefault(false)
        }.coerceAtLeast(0)
        val points = (startIdx until minOf(startIdx + 12, hourly.time.size)).map { i ->
            HourPoint(
                label = hourly.time[i].substringAfter('T').substringBefore(':'),
                temp = hourly.temperature.getOrNull(i) ?: current.temperature,
                precipProb = hourly.precipProb.getOrNull(i) ?: 0,
                code = hourly.code.getOrNull(i) ?: current.code,
            )
        }
        val d = f.daily ?: Daily()
        Report(
            current = current,
            next12h = points,
            todayMax = d.max.getOrNull(0) ?: current.temperature,
            todayMin = d.min.getOrNull(0) ?: current.temperature,
            todayPrecipMax = d.precipMax.getOrNull(0) ?: 0,
            tomorrowMax = d.max.getOrNull(1),
            tomorrowMin = d.min.getOrNull(1),
            tomorrowPrecipMax = d.precipMax.getOrNull(1),
            tomorrowCode = d.code.getOrNull(1),
        )
    }

    /** 도시 이름 → 좌표 (Open-Meteo geocoding) */
    suspend fun geocode(name: String): GeoResult? = withContext(Dispatchers.IO) {
        val url = "https://geocoding-api.open-meteo.com/v1/search".toHttpUrl().newBuilder()
            .addQueryParameter("name", name)
            .addQueryParameter("count", "1")
            .addQueryParameter("language", "ko")
            .build()
        val body = http.newCall(Request.Builder().url(url).build()).execute().use { r ->
            if (!r.isSuccessful) return@withContext null
            r.body?.string() ?: return@withContext null
        }
        json.decodeFromString(GeoResponse.serializer(), body).results.firstOrNull()
    }

    companion object {
        /** WMO weather code → 한국어 */
        fun describe(code: Int): String = when (code) {
            0 -> "맑음"
            1 -> "대체로 맑음"
            2 -> "구름 조금"
            3 -> "흐림"
            45, 48 -> "안개"
            51, 53, 55 -> "이슬비"
            56, 57 -> "어는 이슬비"
            61 -> "약한 비"
            63 -> "비"
            65 -> "강한 비"
            66, 67 -> "어는 비"
            71 -> "약한 눈"
            73 -> "눈"
            75 -> "강한 눈"
            77 -> "싸락눈"
            80, 81 -> "소나기"
            82 -> "강한 소나기"
            85, 86 -> "소낙눈"
            95 -> "뇌우"
            96, 99 -> "우박을 동반한 뇌우"
            else -> "알 수 없음"
        }

        enum class Kind { CLEAR, PARTLY, CLOUDY, FOG, RAIN, SNOW, STORM }

        fun kind(code: Int): Kind = when (code) {
            0, 1 -> Kind.CLEAR
            2 -> Kind.PARTLY
            3 -> Kind.CLOUDY
            45, 48 -> Kind.FOG
            in 51..67, 80, 81, 82 -> Kind.RAIN
            in 71..77, 85, 86 -> Kind.SNOW
            95, 96, 99 -> Kind.STORM
            else -> Kind.CLOUDY
        }
    }
}
