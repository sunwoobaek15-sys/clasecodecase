package com.jarvis.assistant.ui.settings

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jarvis.assistant.briefing.BriefingScheduler
import com.jarvis.assistant.data.settings.AppSettings
import com.jarvis.assistant.data.settings.HudTheme
import com.jarvis.assistant.data.settings.SecureKeyStore
import com.jarvis.assistant.data.settings.SettingsRepository
import com.jarvis.assistant.reminders.ReminderScheduler
import com.jarvis.assistant.tools.JarvisTool
import com.jarvis.assistant.tools.ToolRegistry
import com.jarvis.assistant.voice.SpeechOutput
import com.jarvis.assistant.voice.VoskModelManager
import com.jarvis.assistant.voice.WakeWordController
import com.jarvis.assistant.voice.WakeWordService
import com.jarvis.assistant.widget.JarvisWidgetProvider
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val repo: SettingsRepository,
    private val keyStore: SecureKeyStore,
    private val registry: ToolRegistry,
    private val briefing: BriefingScheduler,
    private val speech: SpeechOutput,
    private val reminders: ReminderScheduler,
    val vosk: VoskModelManager,
    val wake: WakeWordController,
) : ViewModel() {

    val settings: StateFlow<AppSettings> = repo.settings.stateIn(viewModelScope, SharingStarted.Eagerly, AppSettings())
    val hasKey: StateFlow<Boolean> = keyStore.hasKey

    val tools: List<JarvisTool> get() = registry.tools

    fun maskedKey(): String? = keyStore.maskedKey()

    fun saveApiKey(key: String) {
        keyStore.setApiKey(key)
    }

    fun clearApiKey() = keyStore.setApiKey(null)

    fun setUserName(v: String) = viewModelScope.launch { repo.setUserName(v) }

    fun setTtsRate(v: Float) = viewModelScope.launch { repo.setTtsRate(v) }
    fun setTtsPitch(v: Float) = viewModelScope.launch { repo.setTtsPitch(v) }

    fun testVoice() = viewModelScope.launch {
        val s = repo.current()
        val name = s.userName.ifBlank { null }?.let { if (it.endsWith("님")) it else "${it}님" } ?: "님"
        speech.speak("음성 출력 테스트입니다, $name. 이 정도 속도면 괜찮으신가요?", s.ttsRate, s.ttsPitch)
    }

    fun setBriefing(enabled: Boolean, hour: Int, minute: Int) = viewModelScope.launch {
        val h = ((hour % 24) + 24) % 24
        val m = ((minute % 60) + 60) % 60
        repo.setBriefing(enabled, h, m)
        briefing.apply(enabled, h, m)
    }

    fun setWakeWord(enabled: Boolean) = viewModelScope.launch {
        repo.setWakeWord(enabled)
        if (enabled) {
            if (!vosk.isReady()) vosk.download()
            if (vosk.isReady()) WakeWordService.startIfAllowed(context)
        } else {
            WakeWordService.stop(context)
        }
    }

    fun downloadModel() = viewModelScope.launch { vosk.download() }

    fun setConfirm(tool: String, required: Boolean) = viewModelScope.launch { repo.setConfirmTool(tool, required) }
    fun setBoot(v: Boolean) = viewModelScope.launch { repo.setBootSequence(v) }
    fun setSfx(enabled: Boolean, volume: Float) = viewModelScope.launch { repo.setSfx(enabled, volume) }
    fun setHaptics(v: Boolean) = viewModelScope.launch { repo.setHaptics(v) }
    fun setTheme(v: HudTheme) = viewModelScope.launch {
        repo.setTheme(v)
        JarvisWidgetProvider.requestUpdate(context)
    }
    fun setLite(v: Boolean) = viewModelScope.launch { repo.setLiteMode(v) }

    fun canScheduleExact(): Boolean = reminders.canScheduleExact()
}
