package com.jarvis.assistant

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.jarvis.assistant.briefing.BriefingScheduler
import com.jarvis.assistant.data.settings.SecureKeyStore
import com.jarvis.assistant.data.settings.SettingsRepository
import com.jarvis.assistant.notifications.Notifications
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltAndroidApp
class JarvisApp : Application(), Configuration.Provider {

    @Inject lateinit var workerFactory: HiltWorkerFactory
    @Inject lateinit var keyStore: SecureKeyStore
    @Inject lateinit var settings: SettingsRepository
    @Inject lateinit var briefingScheduler: BriefingScheduler

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder().setWorkerFactory(workerFactory).build()

    override fun onCreate() {
        super.onCreate()
        Notifications.createChannels(this)
        appScope.launch(Dispatchers.IO) {
            keyStore.init()
            val s = settings.current()
            briefingScheduler.apply(s.briefingEnabled, s.briefingHour, s.briefingMinute)
        }
    }
}
