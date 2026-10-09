package com.jarvis.assistant.voice

import android.Manifest
import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.jarvis.assistant.MainActivity
import com.jarvis.assistant.R
import com.jarvis.assistant.notifications.Notifications
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.vosk.Model
import org.vosk.Recognizer
import org.vosk.android.RecognitionListener
import org.vosk.android.SpeechService
import javax.inject.Inject

/**
 * "자비스 호출 대기" 모드. Foreground Service 에서 Vosk 오프라인 인식으로 호출어를 감지한다.
 * 마이크를 계속 쓰므로 배터리를 소모한다 (설정 화면에서 경고).
 */
@AndroidEntryPoint
class WakeWordService : LifecycleService() {

    @Inject lateinit var models: VoskModelManager
    @Inject lateinit var controller: WakeWordController

    private var model: Model? = null
    private var speech: SpeechService? = null
    private var lastDetection = 0L

    override fun onCreate() {
        super.onCreate()
        startAsForeground()
        controller.setRunning(true)
        lifecycleScope.launch {
            controller.paused.collect { paused -> if (paused) stopListening() else startListening() }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    private fun startAsForeground() {
        val stop = PendingIntent.getService(
            this, 1, Intent(this, WakeWordService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val n: Notification = NotificationCompat.Builder(this, Notifications.CHANNEL_WAKE)
            .setSmallIcon(R.drawable.ic_stat_jarvis)
            .setColor(0xFF00E5FF.toInt())
            .setContentTitle("J.A.R.V.I.S. STANDBY")
            .setContentText("\"자비스\" 라고 부르면 응답합니다")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(Notifications.openAppIntent(this))
            .addAction(0, "호출 대기 끄기", stop)
            .build()
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else 0
        ServiceCompat.startForeground(this, Notifications.ID_WAKE_SERVICE, n, type)
    }

    private fun startListening() {
        if (speech != null) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED ||
            !models.isReady()
        ) {
            stopSelf()
            return
        }
        lifecycleScope.launch {
            val svc = withContext(Dispatchers.IO) {
                runCatching {
                    val m = model ?: Model(models.modelDir.absolutePath).also { model = it }
                    SpeechService(Recognizer(m, SAMPLE_RATE), SAMPLE_RATE)
                }.getOrNull()
            }
            if (svc == null) {
                stopSelf()
                return@launch
            }
            if (controller.paused.value) {
                svc.shutdown()
                return@launch
            }
            speech = svc
            svc.startListening(listener)
        }
    }

    private fun stopListening() {
        speech?.let {
            runCatching { it.stop() }
            runCatching { it.shutdown() }
        }
        speech = null
    }

    private val listener = object : RecognitionListener {
        override fun onPartialResult(hypothesis: String?) = check(hypothesis, "partial")
        override fun onResult(hypothesis: String?) = check(hypothesis, "text")
        override fun onFinalResult(hypothesis: String?) = check(hypothesis, "text")
        override fun onError(exception: Exception?) {
            stopListening()
            lifecycleScope.launch { kotlinx.coroutines.delay(2_000); if (!controller.paused.value) startListening() }
        }
        override fun onTimeout() {}
    }

    private fun check(hypothesis: String?, key: String) {
        val text = hypothesis?.let {
            runCatching { Json.parseToJsonElement(it).jsonObject[key]?.jsonPrimitive?.content }.getOrNull()
        } ?: return
        if (text.isBlank() || !WakeWordController.matches(text)) return
        val now = System.currentTimeMillis()
        if (now - lastDetection < 3_000) return
        lastDetection = now
        speech?.reset()
        onWake()
    }

    private fun onWake() {
        if (controller.uiForeground) {
            controller.detected()
            return
        }
        controller.pause("wake")
        val intent = Intent(this, MainActivity::class.java)
            .setAction(MainActivity.ACTION_LISTEN)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        // 백그라운드 액티비티 시작은 "다른 앱 위에 표시" 권한이 있을 때만 허용된다. 없으면 헤드업 알림으로 대신한다.
        val started = Settings.canDrawOverlays(this) && runCatching { startActivity(intent) }.isSuccess
        if (!started) postWakeNotification()
        controller.resume("wake")
    }

    private fun postWakeNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val n = NotificationCompat.Builder(this, Notifications.CHANNEL_REMINDER)
            .setSmallIcon(R.drawable.ic_stat_jarvis)
            .setColor(0xFF00E5FF.toInt())
            .setContentTitle("◆ JARVIS")
            .setContentText("부르셨나요? 탭해서 말씀하세요.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setTimeoutAfter(15_000)
            .setAutoCancel(true)
            .setContentIntent(Notifications.openAppIntent(this, MainActivity.ACTION_LISTEN, requestCode = 9))
            .build()
        NotificationManagerCompat.from(this).notify(Notifications.ID_WAKE_SERVICE + 1, n)
    }

    override fun onDestroy() {
        stopListening()
        runCatching { model?.close() }
        model = null
        controller.setRunning(false)
        super.onDestroy()
    }

    companion object {
        private const val SAMPLE_RATE = 16_000f
        const val ACTION_STOP = "com.jarvis.assistant.WAKE_STOP"

        fun startIfAllowed(context: Context): Boolean {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return false
            return runCatching {
                ContextCompat.startForegroundService(context, Intent(context, WakeWordService::class.java))
            }.isSuccess
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, WakeWordService::class.java))
        }
    }
}
