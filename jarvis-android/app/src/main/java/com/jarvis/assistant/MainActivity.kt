package com.jarvis.assistant

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jarvis.assistant.audio.HapticPattern
import com.jarvis.assistant.audio.Haptics
import com.jarvis.assistant.audio.Sfx
import com.jarvis.assistant.audio.SfxPlayer
import com.jarvis.assistant.data.db.MemoDao
import com.jarvis.assistant.data.db.TodoDao
import com.jarvis.assistant.data.settings.AppSettings
import com.jarvis.assistant.data.settings.SettingsRepository
import com.jarvis.assistant.interaction.ConfirmationBroker
import com.jarvis.assistant.interaction.PermissionBroker
import com.jarvis.assistant.services.CalendarRepository
import com.jarvis.assistant.ui.boot.BootFlash
import com.jarvis.assistant.ui.boot.BootStage
import com.jarvis.assistant.ui.boot.BootTerminal
import com.jarvis.assistant.ui.boot.RunBootSequence
import com.jarvis.assistant.ui.boot.rememberBootState
import com.jarvis.assistant.ui.files.FilesScreen
import com.jarvis.assistant.ui.hud.HudBackground
import com.jarvis.assistant.ui.hud.LocalFrameTime
import com.jarvis.assistant.ui.hud.LocalTilt
import com.jarvis.assistant.ui.hud.rememberFrameTime
import com.jarvis.assistant.ui.hud.rememberTilt
import com.jarvis.assistant.ui.main.ConfirmationDialog
import com.jarvis.assistant.ui.main.MainScreen
import com.jarvis.assistant.ui.main.MainViewModel
import com.jarvis.assistant.ui.main.PermissionRationaleDialog
import com.jarvis.assistant.ui.main.TextCommandDialog
import com.jarvis.assistant.ui.nav.HudNavBar
import com.jarvis.assistant.ui.nav.HudNavHost
import com.jarvis.assistant.ui.nav.Screen
import com.jarvis.assistant.ui.schedule.ScheduleScreen
import com.jarvis.assistant.ui.settings.SettingsScreen
import com.jarvis.assistant.ui.settings.SettingsViewModel
import com.jarvis.assistant.ui.theme.JarvisTheme
import com.jarvis.assistant.voice.WakeWordController
import com.jarvis.assistant.voice.WakeWordService
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.MutableStateFlow
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var permissionBroker: PermissionBroker
    @Inject lateinit var confirmationBroker: ConfirmationBroker
    @Inject lateinit var settingsRepo: SettingsRepository
    @Inject lateinit var calendar: CalendarRepository
    @Inject lateinit var todoDao: TodoDao
    @Inject lateinit var memoDao: MemoDao
    @Inject lateinit var sfx: SfxPlayer
    @Inject lateinit var haptics: Haptics
    @Inject lateinit var wake: WakeWordController

    private val mainVm: MainViewModel by viewModels()

    /** 처리 대기 중인 외부 진입 (듣기/브리핑) */
    private val pendingAction = MutableStateFlow<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)
        handleIntent(intent)
        // 외부(위젯/타일/어시스턴트)에서 바로 듣기로 들어오면 부팅 연출은 건너뛴다
        val quickEntry = pendingAction.value != null

        setContent {
            val settings by mainVm.settings.collectAsStateWithLifecycle()
            val s = settings ?: return@setContent
            JarvisTheme(s.theme, s.liteMode) {
                JarvisRoot(s, skipBoot = !s.bootSequence || quickEntry || savedInstanceState != null)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        when (intent?.action) {
            ACTION_LISTEN, Intent.ACTION_ASSIST, "android.intent.action.VOICE_COMMAND" -> pendingAction.value = ACTION_LISTEN
            ACTION_BRIEFING -> pendingAction.value = ACTION_BRIEFING
        }
    }

    override fun onStart() {
        super.onStart()
        permissionBroker.uiAttached = true
        confirmationBroker.uiAttached = true
        mainVm.onForeground(true)
        mainVm.refreshAll()
    }

    override fun onStop() {
        permissionBroker.uiAttached = false
        confirmationBroker.uiAttached = false
        mainVm.onForeground(false)
        super.onStop()
    }

    @Composable
    private fun JarvisRoot(s: AppSettings, skipBoot: Boolean) {
        val lite = s.liteMode
        val frameTime = rememberFrameTime(throttle = lite)
        val tilt = rememberTilt(enabled = !lite)
        val boot = rememberBootState(skip = skipBoot)
        var screen by rememberSaveable { mutableStateOf(Screen.CORE) }
        val hasKey by mainVm.hasApiKey.collectAsStateWithLifecycle()
        val uiState by mainVm.state.collectAsStateWithLifecycle()
        val confirmation by confirmationBroker.pending.collectAsStateWithLifecycle()
        val permissionReq by permissionBroker.pending.collectAsStateWithLifecycle()
        val action by pendingAction.collectAsStateWithLifecycle()
        var rationaleShown by remember { mutableStateOf<PermissionBroker.Request?>(null) }

        val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
            val req = rationaleShown
            rationaleShown = null
            if (req != null) permissionBroker.resolve(req, result.values.all { it })
        }

        RunBootSequence(
            boot,
            onStart = { sfx.play(Sfx.BOOT) },
            onIgnite = { haptics.play(HapticPattern.BOOT) },
            onFinished = {
                if (pendingAction.value == null) mainVm.greetAfterBoot()
                if (s.wakeWordEnabled) WakeWordService.startIfAllowed(this@MainActivity)
            },
        )

        // 외부 진입 처리 (부팅이 끝난 뒤)
        LaunchedEffect(action, boot.stage) {
            val a = action ?: return@LaunchedEffect
            if (boot.stage != BootStage.DONE) return@LaunchedEffect
            pendingAction.value = null
            screen = Screen.CORE
            if (a == ACTION_BRIEFING) mainVm.playBriefingFromNotification() else mainVm.startListening()
        }

        BackHandler(enabled = screen != Screen.CORE) { screen = Screen.CORE }

        CompositionLocalProvider(LocalFrameTime provides frameTime, LocalTilt provides tilt) {
            Box(Modifier.fillMaxSize()) {
                HudBackground(calm = uiState.lowPower)
                Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
                    Box(Modifier.weight(1f).fillMaxWidth()) {
                        HudNavHost(screen, onGlitch = { sfx.play(Sfx.CLICK); haptics.play(HapticPattern.TICK) }) { shown ->
                            when (shown) {
                                Screen.CORE -> MainScreen(mainVm, boot, hasKey)
                                Screen.SCHEDULE -> ScheduleScreen(calendar, permissionBroker)
                                Screen.FILES -> FilesScreen(todoDao, memoDao, onTick = { haptics.play(HapticPattern.TICK) })
                                Screen.SETTINGS -> {
                                    val settingsVm: SettingsViewModel = hiltViewModel()
                                    SettingsScreen(settingsVm, onClearHistory = { mainVm.clearHistory() })
                                }
                            }
                        }
                    }
                    Box(
                        Modifier.graphicsLayer {
                            alpha = boot.assembly.value
                            translationY = (1f - boot.assembly.value) * 60f * density
                        },
                    ) {
                        HudNavBar(screen, onSelect = { screen = it })
                    }
                }

                // 부팅 오버레이
                BootTerminal(boot)
                BootFlash(boot)

                // 다이얼로그
                if (uiState.textInputOpen) {
                    TextCommandDialog(onSubmit = { mainVm.submitText(it) }, onDismiss = { mainVm.openTextInput(false) })
                }
                permissionReq?.let { req ->
                    PermissionRationaleDialog(
                        req,
                        onAuthorize = {
                            rationaleShown = req
                            permissionLauncher.launch(req.permissions.toTypedArray())
                        },
                        onDeny = { permissionBroker.resolve(req, false) },
                    )
                }
                confirmation?.let { req ->
                    ConfirmationDialog(req) { ok -> mainVm.resolveConfirmation(req, ok) }
                }
            }
        }
    }

    companion object {
        const val ACTION_LISTEN = "com.jarvis.assistant.LISTEN"
        const val ACTION_BRIEFING = "com.jarvis.assistant.BRIEFING"
    }
}
