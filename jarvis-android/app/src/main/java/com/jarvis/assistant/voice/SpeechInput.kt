package com.jarvis.assistant.voice

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognitionService
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import javax.inject.Inject
import javax.inject.Singleton

/** Android SpeechRecognizer (ko-KR) 를 Flow 로 감싼다. 반드시 메인 스레드에서 수집된다. */
@Singleton
class SpeechInput @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    sealed interface Event {
        data object Ready : Event
        data object SpeechStarted : Event
        /** 0..1 로 정규화된 입력 음량 */
        data class Level(val value: Float) : Event
        data class Partial(val text: String) : Event
        data class Final(val text: String) : Event
        data class Error(val code: Int, val message: String) : Event
    }

    fun isAvailable(): Boolean = SpeechRecognizer.isRecognitionAvailable(context)

    fun listen(promptLanguage: String = "ko-KR", shortForm: Boolean = false): Flow<Event> = callbackFlow {
        val component = pickRecognizer()
        val recognizer = if (component != null) {
            SpeechRecognizer.createSpeechRecognizer(context, component)
        } else {
            SpeechRecognizer.createSpeechRecognizer(context)
        }
        var finished = false
        recognizer.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) { trySend(Event.Ready) }
            override fun onBeginningOfSpeech() { trySend(Event.SpeechStarted) }
            override fun onRmsChanged(rmsdB: Float) {
                // 대략 -2 ~ 10 dB 범위를 0..1 로
                trySend(Event.Level(((rmsdB + 2f) / 12f).coerceIn(0f, 1f)))
            }
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onError(error: Int) {
                if (finished) return
                finished = true
                trySend(Event.Error(error, describe(error)))
                close()
            }
            override fun onResults(results: Bundle?) {
                if (finished) return
                finished = true
                val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                if (text.isBlank()) trySend(Event.Error(SpeechRecognizer.ERROR_NO_MATCH, describe(SpeechRecognizer.ERROR_NO_MATCH)))
                else trySend(Event.Final(text))
                close()
            }
            override fun onPartialResults(partialResults: Bundle?) {
                partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                    ?.takeIf { it.isNotBlank() }?.let { trySend(Event.Partial(it)) }
            }
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, promptLanguage)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, promptLanguage)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
            if (shortForm) {
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 900L)
            }
        }
        recognizer.startListening(intent)
        awaitClose {
            runCatching { recognizer.cancel() }
            runCatching { recognizer.destroy() }
        }
    }.flowOn(Dispatchers.Main)

    /**
     * 이 앱이 기본 어시스턴트로 지정되면 시스템 기본 인식기가 우리 스텁 서비스가 될 수 있으므로,
     * 다른 앱(가능하면 Google)의 RecognitionService 를 직접 고른다.
     */
    private fun pickRecognizer(): ComponentName? {
        val services = runCatching {
            @Suppress("DEPRECATION")
            context.packageManager.queryIntentServices(Intent(RecognitionService.SERVICE_INTERFACE), 0)
        }.getOrDefault(emptyList())
            .map { ComponentName(it.serviceInfo.packageName, it.serviceInfo.name) }
            .filter { it.packageName != context.packageName }
        return services.firstOrNull { it.packageName == "com.google.android.googlequicksearchbox" }
            ?: services.firstOrNull { it.packageName.contains("google") }
            ?: services.firstOrNull()
    }

    companion object {
        fun describe(code: Int): String = when (code) {
            SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "음성을 인식하지 못했습니다"
            SpeechRecognizer.ERROR_AUDIO -> "마이크 오류"
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "마이크 권한이 없습니다"
            SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "음성 인식 네트워크 오류"
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "음성 인식기가 사용 중입니다"
            SpeechRecognizer.ERROR_CLIENT -> "음성 인식 취소"
            else -> "음성 인식 오류 ($code)"
        }

        fun isSilence(code: Int) = code == SpeechRecognizer.ERROR_NO_MATCH || code == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
    }
}
