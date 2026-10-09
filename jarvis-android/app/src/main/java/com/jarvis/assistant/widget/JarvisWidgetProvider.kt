package com.jarvis.assistant.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.jarvis.assistant.MainActivity
import com.jarvis.assistant.R
import com.jarvis.assistant.data.settings.SettingsRepository
import com.jarvis.assistant.services.CalendarRepository
import com.jarvis.assistant.tools.TimeText
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

/** 홈 위젯: 미니 리액터 + 시계 + 다음 일정. 탭하면 바로 듣기 모드. */
@AndroidEntryPoint
class JarvisWidgetProvider : AppWidgetProvider() {

    @Inject lateinit var calendar: CalendarRepository
    @Inject lateinit var settings: SettingsRepository

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val pending = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                render(context, manager, ids, calendar, settings)
            } finally {
                pending.finish()
            }
        }
    }

    companion object {
        /** 앱 쪽에서 일정/테마가 바뀌었을 때 호출 */
        fun requestUpdate(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, JarvisWidgetProvider::class.java))
            if (ids.isEmpty()) return
            context.sendBroadcast(
                Intent(context, JarvisWidgetProvider::class.java)
                    .setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                    .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids),
            )
        }

        suspend fun render(
            context: Context,
            manager: AppWidgetManager,
            ids: IntArray,
            calendar: CalendarRepository,
            settings: SettingsRepository,
        ) {
            val theme = runCatching { settings.current().theme.ordinal }.getOrDefault(0)
            val accent = ReactorBitmap.accentFor(theme)
            val next = runCatching { calendar.next() }.getOrNull()
            val reactor = ReactorBitmap.render(context, 96, accent, phase = (System.currentTimeMillis() / 60_000 % 360) / 57f)
            val listen = PendingIntent.getActivity(
                context, 5,
                Intent(context, MainActivity::class.java).setAction(MainActivity.ACTION_LISTEN)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            for (id in ids) {
                val views = RemoteViews(context.packageName, R.layout.widget_jarvis).apply {
                    setImageViewBitmap(R.id.widget_reactor, reactor)
                    setTextColor(R.id.widget_clock, accent)
                    setTextColor(R.id.widget_label, accent)
                    setTextViewText(R.id.widget_next_title, next?.title ?: "NO UPCOMING EVENTS")
                    setTextViewText(R.id.widget_next_time, next?.let { "NEXT ▸ " + TimeText.spokenTime(it.startMillis) } ?: "SCHEDULE CLEAR")
                    setOnClickPendingIntent(R.id.widget_root, listen)
                }
                manager.updateAppWidget(id, views)
            }
        }
    }
}
