package com.jarvis.assistant.tools

import kotlinx.serialization.json.JsonObject
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** 람다 하나로 도구를 정의하는 헬퍼. */
class SimpleTool(
    override val name: String,
    override val description: String,
    override val inputSchema: JsonObject,
    override val category: ToolCategory,
    override val hudLabel: String,
    override val requiredPermissions: List<String> = emptyList(),
    override val permissionRationale: String = "",
    override val alwaysConfirm: Boolean = false,
    private val confirm: ((JsonObject) -> String?)? = null,
    private val block: suspend (JsonObject) -> ToolResult,
) : JarvisTool {
    override fun confirmationPrompt(input: JsonObject): String? = confirm?.invoke(input)
    override suspend fun execute(input: JsonObject): ToolResult = block(input)
}

object TimeText {
    private val zone: ZoneId get() = ZoneId.systemDefault()

    /** "2026-10-09T15:30:00", "2026-10-09T15:30", "2026-10-09 15:30", "2026-10-09"(→ 09:00), 오프셋 포함 형식 허용 */
    fun parse(text: String, defaultTime: LocalTime = LocalTime.of(9, 0)): LocalDateTime {
        val s = text.trim().replace(' ', 'T')
        runCatching { return OffsetDateTime.parse(s).atZoneSameInstant(zone).toLocalDateTime() }
        runCatching { return LocalDateTime.parse(s) }
        runCatching { return LocalDate.parse(s).atTime(defaultTime) }
        throw IllegalArgumentException("날짜/시각 형식을 이해할 수 없습니다: $text (ISO 8601 로 보내 주세요)")
    }

    fun toMillis(t: LocalDateTime): Long = t.atZone(zone).toInstant().toEpochMilli()

    fun fromMillis(ms: Long): LocalDateTime = java.time.Instant.ofEpochMilli(ms).atZone(zone).toLocalDateTime()

    private val spoken = DateTimeFormatter.ofPattern("M월 d일 (E) a h시 mm분", Locale.KOREAN)
    private val spokenTime = DateTimeFormatter.ofPattern("a h시 mm분", Locale.KOREAN)
    private val iso = DateTimeFormatter.ISO_LOCAL_DATE_TIME

    fun spoken(ms: Long): String = fromMillis(ms).format(spoken).replace(" 00분", "")
    fun spokenTime(ms: Long): String = fromMillis(ms).format(spokenTime).replace(" 00분", "")
    fun iso(ms: Long): String = fromMillis(ms).withNano(0).format(iso)
}
