package com.jarvis.assistant.briefing

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.jarvis.assistant.MainActivity
import com.jarvis.assistant.R
import com.jarvis.assistant.data.settings.SettingsRepository
import com.jarvis.assistant.notifications.Notifications
import com.jarvis.assistant.tools.TimeText
import com.jarvis.assistant.widget.ReactorBitmap
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

@HiltWorker
class BriefingWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val composer: BriefingComposer,
    private val store: BriefingStore,
    private val settings: SettingsRepository,
    private val scheduler: BriefingScheduler,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val s = settings.current()
        try {
            val briefing = composer.compose()
            store.save(briefing)
            notify(briefing, s.theme.ordinal)
        } catch (e: Exception) {
            if (runAttemptCount < 2) return Result.retry()
        } finally {
            // 다음 날 같은 시각으로 다시 예약
            if (s.briefingEnabled) scheduler.apply(true, s.briefingHour, s.briefingMinute)
        }
        return Result.success()
    }

    private fun notify(b: Briefing, themeIndex: Int) {
        val ctx = applicationContext
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return

        val accent = ReactorBitmap.accentFor(themeIndex)
        val reactor = ReactorBitmap.render(ctx, 160, accent, phase = 0.3f)

        val small = RemoteViews(ctx.packageName, R.layout.notification_briefing_small).apply {
            setImageViewBitmap(R.id.reactor, reactor)
            setTextViewText(R.id.title, "MORNING BRIEFING")
            setTextViewText(R.id.headline, b.headline)
            setTextColor(R.id.title, accent)
        }
        val big = RemoteViews(ctx.packageName, R.layout.notification_briefing_big).apply {
            setImageViewBitmap(R.id.reactor, reactor)
            setTextViewText(R.id.title, "MORNING BRIEFING")
            setTextColor(R.id.title, accent)
            setTextViewText(R.id.weather, b.weatherLine ?: "WEATHER  OFFLINE")
            setTextViewText(
                R.id.events,
                if (b.events.isEmpty()) "SCHEDULE  CLEAR" else b.events.joinToString("\n") { e ->
                    (if (e.allDay) "ALL DAY" else TimeText.iso(e.startMillis).substring(11, 16)) + "  " + e.title
                },
            )
            setTextViewText(
                R.id.todos,
                if (b.todos.isEmpty()) "TASKS  0" else "TASKS  " + b.todos.joinToString("  ·  "),
            )
            setTextViewText(R.id.news, b.news.joinToString("\n") { "▸ " + it.title })
            setTextViewText(R.id.hint, "TAP TO PLAY VOICE BRIEFING")
            setTextColor(R.id.hint, accent)
        }

        val n = NotificationCompat.Builder(ctx, Notifications.CHANNEL_BRIEFING)
            .setSmallIcon(R.drawable.ic_stat_jarvis)
            .setColor(accent)
            .setStyle(NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(small)
            .setCustomBigContentView(big)
            .setContentTitle("MORNING BRIEFING")
            .setContentText(b.headline)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
            .setAutoCancel(true)
            .setContentIntent(Notifications.openAppIntent(ctx, MainActivity.ACTION_BRIEFING, requestCode = 7))
            .build()
        NotificationManagerCompat.from(ctx).notify(Notifications.ID_BRIEFING, n)
    }
}
