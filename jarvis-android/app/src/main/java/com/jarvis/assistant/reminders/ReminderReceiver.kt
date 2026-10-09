package com.jarvis.assistant.reminders

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.jarvis.assistant.R
import com.jarvis.assistant.data.db.ReminderDao
import com.jarvis.assistant.notifications.Notifications
import com.jarvis.assistant.tools.TimeText
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class ReminderReceiver : BroadcastReceiver() {

    @Inject lateinit var reminderDao: ReminderDao

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_FIRE) return
        val id = intent.getLongExtra(EXTRA_ID, -1)
        if (id < 0) return
        val pending = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val reminder = reminderDao.get(id) ?: return@launch
                if (reminder.fired) return@launch
                reminderDao.markFired(id)
                notify(context, id, reminder.text, reminder.triggerAt)
            } finally {
                pending.finish()
            }
        }
    }

    private fun notify(context: Context, id: Long, text: String, at: Long) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED &&
            android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU
        ) return
        val n = NotificationCompat.Builder(context, Notifications.CHANNEL_REMINDER)
            .setSmallIcon(R.drawable.ic_stat_jarvis)
            .setColor(0xFF00E5FF.toInt())
            .setContentTitle("◆ JARVIS 리마인더")
            .setContentText(text)
            .setSubText(TimeText.spokenTime(at))
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(Notifications.openAppIntent(context, requestCode = id.toInt()))
            .build()
        NotificationManagerCompat.from(context).notify(Notifications.ID_REMINDER_BASE + id.toInt(), n)
    }

    companion object {
        const val ACTION_FIRE = "com.jarvis.assistant.REMINDER_FIRE"
        const val EXTRA_ID = "reminder_id"
    }
}
