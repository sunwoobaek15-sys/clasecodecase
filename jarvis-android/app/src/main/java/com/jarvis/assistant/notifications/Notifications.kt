package com.jarvis.assistant.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.jarvis.assistant.MainActivity

object Notifications {
    const val CHANNEL_REMINDER = "reminders"
    const val CHANNEL_BRIEFING = "briefing"
    const val CHANNEL_WAKE = "wake_word"

    const val ID_WAKE_SERVICE = 1001
    const val ID_BRIEFING = 1002
    const val ID_REMINDER_BASE = 20_000

    fun createChannels(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannels(
            listOf(
                NotificationChannel(CHANNEL_REMINDER, "리마인더", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "자비스가 등록한 리마인더 알림"
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 60, 80, 60, 80, 200)
                    lightColor = 0xFF00E5FF.toInt()
                    enableLights(true)
                },
                NotificationChannel(CHANNEL_BRIEFING, "아침 브리핑", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "매일 아침 날씨, 일정, 할 일, 뉴스 요약"
                    lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                },
                NotificationChannel(CHANNEL_WAKE, "호출 대기", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "\"자비스\" 호출어 대기 중 표시"
                    setShowBadge(false)
                },
            ),
        )
    }

    fun openAppIntent(context: Context, action: String? = null, requestCode: Int = 0): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            this.action = action ?: Intent.ACTION_MAIN
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}
