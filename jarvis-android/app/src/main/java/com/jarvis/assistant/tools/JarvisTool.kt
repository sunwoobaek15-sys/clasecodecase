package com.jarvis.assistant.tools

import kotlinx.serialization.json.JsonObject

/** HUD에서 도구 실행 카드에 쓰이는 분류. 아이콘과 색이 여기에 따라 정해진다. */
enum class ToolCategory { ALARM, CALENDAR, MEMO, TODO, WEATHER, NEWS, COMMS, DEVICE, NETWORK, SYSTEM }

/**
 * Claude 가 호출할 수 있는 하나의 도구.
 * 새 기능은 이 인터페이스를 구현하고 [ToolProvider] 묶음에 넣기만 하면 된다.
 */
interface JarvisTool {
    /** API 에 노출되는 도구 이름 (snake_case) */
    val name: String
    val description: String
    /** JSON Schema: {"type":"object","properties":{...},"required":[...]} */
    val inputSchema: JsonObject
    val category: ToolCategory
    /** HUD 표시용 라벨. 예: "CALENDAR SYNC" → `EXECUTING: CALENDAR SYNC` */
    val hudLabel: String

    /** 실행 전 필요한 런타임 권한 (android.permission.*) */
    val requiredPermissions: List<String> get() = emptyList()
    /** 권한 요청 전에 보여줄 이유 설명 */
    val permissionRationale: String get() = ""

    /** true 면 설정과 무관하게 실행 전에 반드시 사용자 확인을 받는다 (전화, 문자, 일정 삭제 등). */
    val alwaysConfirm: Boolean get() = false

    /** 확인 다이얼로그/음성 확인에 쓸 문구. null 이면 기본 문구를 쓴다. */
    fun confirmationPrompt(input: JsonObject): String? = null

    suspend fun execute(input: JsonObject): ToolResult
}

/** 도구 실행 결과. [content] 는 Claude 에게 tool_result 로 돌아가고, [card] 는 HUD 홀로그램 카드로 그려진다. */
data class ToolResult(
    val content: String,
    val isError: Boolean = false,
    val card: ResultCard? = null,
) {
    companion object {
        fun error(message: String) = ToolResult(message, isError = true)
    }
}

/** 텍스트 대신 전용 홀로그램 카드로 펼쳐지는 결과 데이터. */
sealed interface ResultCard {
    data class Weather(
        val place: String,
        val temperature: Double,
        val apparent: Double,
        val weatherCode: Int,
        val humidity: Int,
        val windKmh: Double,
        val hourlyTemps: List<Double>,
        val hourlyPrecipProb: List<Int>,
        val hourlyLabels: List<String>,
        val todayMax: Double,
        val todayMin: Double,
        val isDay: Boolean,
    ) : ResultCard

    data class Events(val title: String, val events: List<EventItem>) : ResultCard

    data class News(val topic: String, val items: List<NewsItem>) : ResultCard

    data class Files(val title: String, val entries: List<FileEntry>) : ResultCard
}

data class EventItem(
    val id: Long,
    val title: String,
    val startMillis: Long,
    val endMillis: Long,
    val allDay: Boolean,
    val location: String?,
)

data class NewsItem(val title: String, val source: String, val link: String, val publishedMillis: Long?)

data class FileEntry(val code: String, val text: String, val meta: String, val done: Boolean = false, val highlight: Boolean = false)
