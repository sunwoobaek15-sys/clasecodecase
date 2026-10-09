package com.jarvis.assistant.assistant

import android.content.Intent
import android.os.Bundle
import android.service.voice.VoiceInteractionService
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService
import android.speech.RecognitionService
import android.speech.SpeechRecognizer
import com.jarvis.assistant.MainActivity

/**
 * 기본 어시스턴트 앱으로 등록되기 위한 서비스 묶음.
 * 홈 버튼 길게 누르기 / 어시스턴트 제스처 → 세션 → 자비스 화면을 듣기 모드로 연다.
 */
class JarvisVoiceInteractionService : VoiceInteractionService()

class JarvisVoiceSessionService : VoiceInteractionSessionService() {
    override fun onNewSession(args: Bundle?): VoiceInteractionSession = JarvisVoiceSession(this)
}

class JarvisVoiceSession(service: VoiceInteractionSessionService) : VoiceInteractionSession(service) {
    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        val intent = Intent(context, MainActivity::class.java)
            .setAction(MainActivity.ACTION_LISTEN)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        startAssistantActivity(intent)
        hide()
    }
}

/**
 * VoiceInteractionService 메타데이터가 요구하는 인식 서비스.
 * 자비스는 다른 앱의 인식기를 직접 골라 쓰므로(SpeechInput 참고) 여기서는 요청을 처리하지 않는다.
 */
class JarvisRecognitionService : RecognitionService() {
    override fun onStartListening(recognizerIntent: Intent?, listener: Callback?) {
        runCatching { listener?.error(SpeechRecognizer.ERROR_RECOGNIZER_BUSY) }
    }
    override fun onCancel(listener: Callback?) {}
    override fun onStopListening(listener: Callback?) {}
}
