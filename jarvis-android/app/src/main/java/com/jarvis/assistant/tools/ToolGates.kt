package com.jarvis.assistant.tools

/** 런타임 권한 확보. UI 가 붙어 있으면 이유를 설명하고 요청, 없으면 false. */
interface PermissionGate {
    fun isGranted(permissions: List<String>): Boolean
    suspend fun ensure(permissions: List<String>, rationale: String): Boolean
}

/** 위험 작업 실행 전 사용자 확인 (다이얼로그 + 음성). */
interface ConfirmationGate {
    suspend fun confirm(tool: JarvisTool, prompt: String): Boolean
}

/** 설정의 "확인 필요 작업 목록". */
interface ConfirmationPolicy {
    suspend fun requiresConfirmation(tool: JarvisTool): Boolean
}
