package com.jarvis.assistant.interaction

import com.jarvis.assistant.ai.ContextProvider
import com.jarvis.assistant.ai.EngineSettings
import com.jarvis.assistant.data.db.TodoDao
import com.jarvis.assistant.data.settings.SecureKeyStore
import com.jarvis.assistant.data.settings.SettingsRepository
import com.jarvis.assistant.services.CalendarRepository
import com.jarvis.assistant.services.LocationService
import com.jarvis.assistant.tools.TimeText
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class JarvisEngineSettings @Inject constructor(
    private val keyStore: SecureKeyStore,
    private val settings: SettingsRepository,
) : EngineSettings {
    override suspend fun apiKey(): String? = keyStore.apiKey()
    override suspend fun userName(): String = settings.current().userName
}

/** 매 발화마다 붙는 변동 정보: 현재 시각, 위치, 오늘 일정, 남은 할 일. 권한 요청은 하지 않는다. */
@Singleton
class JarvisContextProvider @Inject constructor(
    private val location: LocationService,
    private val calendar: CalendarRepository,
    private val todoDao: TodoDao,
) : ContextProvider {
    private val fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm (yyyy년 M월 d일 EEEE a h시 m분)", Locale.KOREAN)

    override suspend fun currentContext(): String = buildString {
        append("현재 시각: ").append(LocalDateTime.now().format(fmt)).append('\n')
        val loc = location.cached()
        append("위치: ").append(
            when {
                loc == null -> "알 수 없음"
                loc.place != null -> "${loc.place} (%.3f, %.3f)".format(loc.lat, loc.lon)
                else -> "%.3f, %.3f".format(loc.lat, loc.lon)
            },
        ).append('\n')
        if (calendar.canRead()) {
            val events = runCatching { calendar.today() }.getOrDefault(emptyList())
            if (events.isEmpty()) append("오늘 일정: 없음\n") else {
                append("오늘 일정:\n")
                events.take(8).forEach { e ->
                    val time = if (e.allDay) "종일" else "${TimeText.iso(e.startMillis).substring(11, 16)}~${TimeText.iso(e.endMillis).substring(11, 16)}"
                    append("- [id=${e.id}] $time ${e.title}").append(e.location?.let { " @$it" } ?: "").append('\n')
                }
            }
        } else {
            append("오늘 일정: 캘린더 권한 없음\n")
        }
        val todos = runCatching { todoDao.pending() }.getOrDefault(emptyList())
        append("남은 할 일: ${todos.size}건")
        if (todos.isNotEmpty()) append(" (" + todos.take(3).joinToString(", ") { it.text } + ")")
    }.trim()
}
