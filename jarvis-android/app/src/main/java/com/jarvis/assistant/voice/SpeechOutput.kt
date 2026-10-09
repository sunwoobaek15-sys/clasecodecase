package com.jarvis.assistant.voice

import android.content.Context
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.Locale
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * TextToSpeech (ko-KR).
 * [envelope] 는 말하는 동안 음절 단위로 튀었다 감쇠하는 0..1 값으로, 리액터 코어 펄스에 쓰인다.
 */
@Singleton
class SpeechOutput @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var tts: TextToSpeech? = null
    private var ready: CompletableDeferred<Boolean>? = null

    private val _speaking = MutableStateFlow(false)
    val speaking: StateFlow<Boolean> = _speaking.asStateFlow()

    /** 음절 펄스 엔벨로프 0..1 (고빈도 갱신; 그리기 단계에서만 읽을 것) */
    private val _envelope = MutableStateFlow(0f)
    val envelope: StateFlow<Float> = _envelope.asStateFlow()

    private var lastRangeAt = 0L
    private var envelopeJob: Job? = null
    private var current: CompletableDeferred<Unit>? = null

    private suspend fun ensure(): Boolean {
        tts?.let { return ready?.await() ?: false }
        val deferred = CompletableDeferred<Boolean>()
        ready = deferred
        tts = TextToSpeech(context) { status ->
            val ok = status == TextToSpeech.SUCCESS
            if (ok) {
                val r = tts?.setLanguage(Locale.KOREAN) ?: TextToSpeech.LANG_NOT_SUPPORTED
                deferred.complete(r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED)
            } else {
                deferred.complete(false)
            }
        }.also { it.setOnUtteranceProgressListener(listener) }
        return deferred.await()
    }

    private val listener = object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String?) {
            _speaking.value = true
            pulse(0.8f)
        }
        override fun onDone(utteranceId: String?) { finish() }
        @Deprecated("Deprecated in Java")
        override fun onError(utteranceId: String?) { finish() }
        override fun onError(utteranceId: String?, errorCode: Int) { finish() }
        override fun onStop(utteranceId: String?, interrupted: Boolean) { finish() }
        override fun onRangeStart(utteranceId: String?, start: Int, end: Int, frame: Int) {
            lastRangeAt = System.currentTimeMillis()
            pulse(0.65f + 0.35f * ((end - start).coerceAtMost(4) / 4f))
        }
    }

    private fun pulse(v: Float) {
        _envelope.value = maxOf(_envelope.value, v)
    }

    private fun finish() {
        _speaking.value = false
        current?.complete(Unit)
    }

    /** 말하기가 끝날 때까지 대기. 코루틴 취소 시 즉시 중단. */
    suspend fun speak(text: String, rate: Float = 1f, pitch: Float = 1f): Boolean {
        val clean = text.replace(Regex("[*_#`>|]"), "").trim()
        if (clean.isEmpty()) return true
        if (!ensure()) return false
        val engine = tts ?: return false
        stop()
        engine.setSpeechRate(rate)
        engine.setPitch(pitch)
        val done = CompletableDeferred<Unit>()
        current = done
        startEnvelope()
        val id = UUID.randomUUID().toString()
        val params = Bundle().apply { putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1f) }
        if (engine.speak(clean, TextToSpeech.QUEUE_FLUSH, params, id) != TextToSpeech.SUCCESS) {
            current = null
            return false
        }
        return try {
            done.await()
            true
        } catch (e: CancellationException) {
            stop()
            throw e
        } finally {
            envelopeJob?.cancel()
            _envelope.value = 0f
        }
    }

    fun stop() {
        runCatching { tts?.stop() }
        _speaking.value = false
        current?.complete(Unit)
        current = null
    }

    /**
     * 엔벨로프 감쇠 + onRangeStart 를 지원하지 않는 엔진을 위한 합성 음절 펄스 (~7Hz).
     */
    private fun startEnvelope() {
        envelopeJob?.cancel()
        lastRangeAt = 0L
        envelopeJob = scope.launch {
            var t = 0
            while (isActive) {
                delay(16)
                t += 16
                _envelope.value = (_envelope.value * 0.86f).coerceAtLeast(0f)
                val engineDrivesPulse = System.currentTimeMillis() - lastRangeAt < 600
                if (_speaking.value && !engineDrivesPulse && t % 144 < 16) {
                    pulse(0.5f + (Math.random().toFloat() * 0.5f))
                }
            }
        }
    }

    fun shutdown() {
        stop()
        tts?.shutdown()
        tts = null
        ready = null
    }
}
