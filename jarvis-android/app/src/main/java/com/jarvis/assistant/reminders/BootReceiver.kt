package com.jarvis.assistant.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.jarvis.assistant.briefing.BriefingScheduler
import com.jarvis.assistant.data.db.ReminderDao
import com.jarvis.assistant.data.settings.SettingsRepository
import com.jarvis.assistant.voice.WakeWordService
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

/** 재부팅/앱 업데이트 후 리마인더 알람과 브리핑을 다시 예약한다. */
@AndroidEntryPoint
class BootReceiver : BroadcastReceiver() {

    @Inject lateinit var reminderDao: ReminderDao
    @Inject lateinit var scheduler: ReminderScheduler
    @Inject lateinit var briefingScheduler: BriefingScheduler
    @Inject lateinit var settings: SettingsRepository

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED &&
            action != "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED"
        ) return
        val pending = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val now = System.currentTimeMillis()
                reminderDao.pending().forEach { r ->
                    // 꺼져 있는 동안 지난 리마인더는 즉시 울리도록 1초 뒤로 예약
                    scheduler.schedule(r.id, maxOf(r.triggerAt, now + 1_000))
                }
                val s = settings.current()
                briefingScheduler.apply(s.briefingEnabled, s.briefingHour, s.briefingMinute)
                // Android 14+ 는 부팅 직후 마이크 포그라운드 서비스 시작을 막으므로 그 이전 버전에서만 자동 재개
                if (s.wakeWordEnabled && action == Intent.ACTION_BOOT_COMPLETED && android.os.Build.VERSION.SDK_INT < 34) {
                    WakeWordService.startIfAllowed(context)
                }
            } finally {
                pending.finish()
            }
        }
    }
}
