package com.jarvis.assistant.interaction

import com.jarvis.assistant.data.settings.SettingsRepository
import com.jarvis.assistant.tools.ConfirmationGate
import com.jarvis.assistant.tools.ConfirmationPolicy
import com.jarvis.assistant.tools.JarvisTool
import com.jarvis.assistant.tools.ToolCategory
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import javax.inject.Inject
import javax.inject.Singleton

/** 위험 작업 확인 요청. UI 는 HUD 경고 다이얼로그를 띄우고 음성으로도 "네/아니요" 를 받는다. */
@Singleton
class ConfirmationBroker @Inject constructor() : ConfirmationGate {

    class Request(
        val title: String,
        val prompt: String,
        val category: ToolCategory,
        val danger: Boolean,
        internal val result: CompletableDeferred<Boolean> = CompletableDeferred(),
    )

    private val _pending = MutableStateFlow<Request?>(null)
    val pending: StateFlow<Request?> = _pending.asStateFlow()

    private val mutex = Mutex()

    @Volatile
    var uiAttached: Boolean = false

    override suspend fun confirm(tool: JarvisTool, prompt: String): Boolean {
        if (!uiAttached) return false
        return mutex.withLock {
            val request = Request(tool.hudLabel, prompt, tool.category, tool.alwaysConfirm)
            _pending.value = request
            try {
                withTimeoutOrNull(TIMEOUT_MS) { request.result.await() } ?: false
            } finally {
                _pending.value = null
            }
        }
    }

    fun resolve(request: Request, approved: Boolean) {
        request.result.complete(approved)
    }

    private companion object {
        const val TIMEOUT_MS = 60_000L
    }
}

@Singleton
class SettingsConfirmationPolicy @Inject constructor(
    private val settings: SettingsRepository,
) : ConfirmationPolicy {
    override suspend fun requiresConfirmation(tool: JarvisTool): Boolean =
        tool.name in settings.current().confirmTools
}
