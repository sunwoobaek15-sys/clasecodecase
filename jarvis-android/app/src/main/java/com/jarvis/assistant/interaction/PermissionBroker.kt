package com.jarvis.assistant.interaction

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.jarvis.assistant.tools.PermissionGate
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 도구가 처음 쓰일 때 이유를 설명하고 권한을 요청한다.
 * UI(MainActivity)가 [pending] 을 관찰해 HUD 다이얼로그 → 시스템 권한 창을 띄우고 [resolve] 로 결과를 돌려준다.
 * 화면이 없으면(백그라운드) 바로 false.
 */
@Singleton
class PermissionBroker @Inject constructor(
    @ApplicationContext private val context: Context,
) : PermissionGate {

    class Request(
        val permissions: List<String>,
        val rationale: String,
        internal val result: CompletableDeferred<Boolean> = CompletableDeferred(),
    )

    private val _pending = MutableStateFlow<Request?>(null)
    val pending: StateFlow<Request?> = _pending.asStateFlow()

    private val mutex = Mutex()

    @Volatile
    var uiAttached: Boolean = false

    override fun isGranted(permissions: List<String>): Boolean =
        permissions.filter(::applicable).all {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        }

    override suspend fun ensure(permissions: List<String>, rationale: String): Boolean {
        val needed = permissions.filter(::applicable).filterNot { isGranted(listOf(it)) }
        if (needed.isEmpty()) return true
        if (!uiAttached) return false
        return mutex.withLock {
            if (isGranted(needed)) return@withLock true
            val request = Request(needed, rationale)
            _pending.value = request
            try {
                withTimeoutOrNull(REQUEST_TIMEOUT_MS) { request.result.await() } ?: false
            } finally {
                _pending.value = null
            }
        }
    }

    fun resolve(request: Request, granted: Boolean) {
        request.result.complete(granted && isGranted(request.permissions))
    }

    private fun applicable(permission: String): Boolean = when (permission) {
        Manifest.permission.POST_NOTIFICATIONS -> Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
        else -> true
    }

    private companion object {
        const val REQUEST_TIMEOUT_MS = 120_000L
    }
}
