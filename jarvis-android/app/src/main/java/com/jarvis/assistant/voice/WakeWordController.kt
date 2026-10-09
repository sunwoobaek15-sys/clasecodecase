package com.jarvis.assistant.voice

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/** 호출어 서비스와 앱 화면 사이의 조정자. 앱이 마이크를 쓰는 동안 호출어 감지를 멈춘다. */
@Singleton
class WakeWordController @Inject constructor() {
    private val pauseReasons = mutableSetOf<String>()
    private val _paused = MutableStateFlow(false)
    val paused: StateFlow<Boolean> = _paused.asStateFlow()

    private val _running = MutableStateFlow(false)
    val running: StateFlow<Boolean> = _running.asStateFlow()

    private val _detections = MutableSharedFlow<Long>(extraBufferCapacity = 1)
    val detections: SharedFlow<Long> = _detections.asSharedFlow()

    /** 화면이 앞에 있어 바로 처리할 수 있는지 */
    @Volatile
    var uiForeground: Boolean = false

    @Synchronized
    fun pause(reason: String) {
        pauseReasons += reason
        _paused.value = true
    }

    @Synchronized
    fun resume(reason: String) {
        pauseReasons -= reason
        _paused.value = pauseReasons.isNotEmpty()
    }

    fun setRunning(v: Boolean) { _running.value = v }

    fun detected() { _detections.tryEmit(System.currentTimeMillis()) }

    companion object {
        /** "자비스" 와 흔한 오인식 변형 */
        private val variants = listOf("자비스", "재비스", "쟈비스", "자빗", "자비 스", "javis", "jarvis", "자 비스")

        fun matches(text: String): Boolean {
            val t = text.lowercase()
            val compact = t.replace(" ", "")
            return variants.any { t.contains(it) || compact.contains(it.replace(" ", "")) }
        }
    }
}
