package com.jarvis.assistant.data.settings

enum class HudTheme(val label: String) { CYAN("청록"), AMBER("앰버"), RED("레드"), WHITE("화이트") }

data class AppSettings(
    val userName: String = "",
    val briefingEnabled: Boolean = true,
    val briefingHour: Int = 7,
    val briefingMinute: Int = 0,
    val ttsRate: Float = 1.0f,
    val ttsPitch: Float = 0.95f,
    val wakeWordEnabled: Boolean = false,
    /** 확인이 필요한 도구 이름 목록 (전화/문자/일정 삭제는 항상 확인) */
    val confirmTools: Set<String> = DEFAULT_CONFIRM_TOOLS,
    val bootSequence: Boolean = true,
    val sfxEnabled: Boolean = true,
    val sfxVolume: Float = 0.7f,
    val haptics: Boolean = true,
    val theme: HudTheme = HudTheme.CYAN,
    val liteMode: Boolean = false,
    val onboarded: Boolean = false,
) {
    companion object {
        val DEFAULT_CONFIRM_TOOLS = setOf("create_calendar_event", "open_url")
    }
}
