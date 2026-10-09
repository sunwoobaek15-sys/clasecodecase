package com.jarvis.assistant.ui.settings

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jarvis.assistant.ai.AssistantEngine
import com.jarvis.assistant.data.settings.HudTheme
import com.jarvis.assistant.ui.hud.HudButton
import com.jarvis.assistant.ui.hud.HudSlider
import com.jarvis.assistant.ui.hud.HudSwitch
import com.jarvis.assistant.ui.hud.HudTextField
import com.jarvis.assistant.ui.hud.PanelHeader
import com.jarvis.assistant.ui.hud.hudPanel
import com.jarvis.assistant.ui.hud.hudProgress
import com.jarvis.assistant.ui.main.permissionLabel
import com.jarvis.assistant.ui.theme.HudType
import com.jarvis.assistant.ui.theme.LocalHud
import com.jarvis.assistant.ui.theme.paletteFor
import com.jarvis.assistant.voice.VoskModelManager

/** 제어실 콘솔 느낌의 설정 화면 */
@Composable
fun SettingsScreen(vm: SettingsViewModel, onClearHistory: () -> Unit) {
    val hud = LocalHud.current
    val context = LocalContext.current
    val s by vm.settings.collectAsStateWithLifecycle()
    val hasKey by vm.hasKey.collectAsStateWithLifecycle()
    val model by vm.vosk.state.collectAsStateWithLifecycle()
    val wakeRunning by vm.wake.running.collectAsStateWithLifecycle()
    var permTick by remember { mutableIntStateOf(0) }
    val permLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { permTick++ }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        // ── API KEY
        Section("NEURAL LINK // API KEY", "A1") {
            var keyInput by remember { mutableStateOf("") }
            Row(verticalAlignment = Alignment.CenterVertically) {
                StatusDot(hasKey)
                Spacer(Modifier.width(8.dp))
                Text(
                    if (hasKey) "LINKED  ${vm.maskedKey() ?: ""}" else "NO KEY — Anthropic API 키가 필요합니다",
                    style = if (hasKey) HudType.label(hud.primary, 9.sp) else HudType.body(hud.warn, 13.sp),
                )
            }
            Spacer(Modifier.height(8.dp))
            HudTextField(keyInput, { keyInput = it }, Modifier.fillMaxWidth(), placeholder = "sk-ant-...", password = true)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                HudButton("SAVE KEY", { vm.saveApiKey(keyInput); keyInput = "" }, Modifier.weight(1f), filled = true, enabled = keyInput.isNotBlank())
                HudButton("PURGE", { vm.clearApiKey() }, Modifier.weight(1f), color = hud.danger, enabled = hasKey)
            }
            Hint("키는 기기의 Android Keystore 로 암호화되어 이 폰에만 저장됩니다. 모델: ${AssistantEngine.MODEL}")
        }

        // ── 호칭
        Section("IDENTITY", "A2") {
            var name by remember(s.userName) { mutableStateOf(s.userName) }
            Row(verticalAlignment = Alignment.CenterVertically) {
                HudTextField(name, { name = it }, Modifier.weight(1f), placeholder = "이름 또는 호칭 (예: 민수)")
                Spacer(Modifier.width(8.dp))
                HudButton("SET", { vm.setUserName(name) }, enabled = name != s.userName)
            }
            Hint("자비스는 \"${s.userName.ifBlank { "이름" }}님\" 이라고 부릅니다.")
        }

        // ── 음성
        Section("VOICE SYNTHESIS", "B1") {
            var rate by remember(s.ttsRate) { mutableFloatStateOf(s.ttsRate) }
            var pitch by remember(s.ttsPitch) { mutableFloatStateOf(s.ttsPitch) }
            LabeledValue("SPEECH RATE", "x%.2f".format(rate))
            HudSlider(rate, { rate = it }, Modifier.fillMaxWidth(), range = 0.5f..2f, onChangeFinished = { vm.setTtsRate(rate) })
            Spacer(Modifier.height(6.dp))
            LabeledValue("PITCH", "x%.2f".format(pitch))
            HudSlider(pitch, { pitch = it }, Modifier.fillMaxWidth(), range = 0.5f..2f, onChangeFinished = { vm.setTtsPitch(pitch) })
            Spacer(Modifier.height(8.dp))
            HudButton("TEST VOICE", { vm.testVoice() })
        }

        // ── 아침 브리핑
        Section("MORNING BRIEFING", "B2") {
            ToggleRow("DAILY BRIEFING", "날씨·일정·할 일·뉴스 요약 알림", s.briefingEnabled) {
                vm.setBriefing(it, s.briefingHour, s.briefingMinute)
            }
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("TIME", style = HudType.label(hud.dim, 9.sp), modifier = Modifier.width(60.dp))
                HudButton("−", { vm.setBriefing(s.briefingEnabled, s.briefingHour - 1, s.briefingMinute) })
                Text("%02d".format(s.briefingHour), style = HudType.numeric(hud.secondary, 22.sp), modifier = Modifier.padding(horizontal = 8.dp))
                HudButton("+", { vm.setBriefing(s.briefingEnabled, s.briefingHour + 1, s.briefingMinute) })
                Text(":", style = HudType.numeric(hud.primary, 22.sp), modifier = Modifier.padding(horizontal = 6.dp))
                HudButton("−", { vm.setBriefing(s.briefingEnabled, s.briefingHour, s.briefingMinute - 5) })
                Text("%02d".format(s.briefingMinute), style = HudType.numeric(hud.secondary, 22.sp), modifier = Modifier.padding(horizontal = 8.dp))
                HudButton("+", { vm.setBriefing(s.briefingEnabled, s.briefingHour, s.briefingMinute + 5) })
            }
        }

        // ── 호출어
        Section("WAKE WORD // \"자비스\"", "C1") {
            ToggleRow("STANDBY MODE", "\"자비스\" 라고 부르면 바로 응답", s.wakeWordEnabled) { on ->
                if (on && ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    permLauncher.launch(arrayOf(Manifest.permission.RECORD_AUDIO))
                } else {
                    vm.setWakeWord(on)
                }
            }
            Spacer(Modifier.height(6.dp))
            Text("⚠ 마이크를 계속 사용하므로 배터리 소모가 늘어납니다.", style = HudType.body(hud.warn, 12.sp))
            Spacer(Modifier.height(6.dp))
            val modelText = when (val m = model) {
                VoskModelManager.State.Missing -> "OFFLINE MODEL: NOT INSTALLED (~80MB)"
                is VoskModelManager.State.Downloading -> "DOWNLOADING ${(m.progress * 100).toInt()}%"
                VoskModelManager.State.Unpacking -> "UNPACKING..."
                VoskModelManager.State.Ready -> "OFFLINE MODEL: READY" + if (wakeRunning) "  ·  LISTENING" else ""
                is VoskModelManager.State.Failed -> "MODEL ERROR: ${m.message}"
            }
            Text(modelText, style = HudType.label(if (model is VoskModelManager.State.Failed) hud.danger else hud.primary, 8.sp))
            if (model is VoskModelManager.State.Downloading) {
                val p = (model as VoskModelManager.State.Downloading).progress
                Canvas(Modifier.fillMaxWidth().height(4.dp).padding(top = 2.dp)) {
                    hudProgress(p, hud.primary)
                }
            }
            if (model is VoskModelManager.State.Missing || model is VoskModelManager.State.Failed) {
                Spacer(Modifier.height(6.dp))
                HudButton("DOWNLOAD MODEL", { vm.downloadModel() })
            }
            if (!Settings.canDrawOverlays(context)) {
                Spacer(Modifier.height(8.dp))
                Hint("앱이 닫혀 있을 때 호출어로 화면을 띄우려면 \"다른 앱 위에 표시\" 권한이 필요합니다. 없으면 알림으로 대신 알려 드립니다.")
                HudButton("ALLOW OVERLAY", {
                    runCatching {
                        context.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    }
                })
            }
        }

        // ── 확인 필요 작업
        Section("AUTHORIZATION MATRIX", "C2") {
            Hint("켜진 작업은 실행 전에 확인을 받습니다. 전화·문자·일정 삭제는 항상 확인합니다.")
            Spacer(Modifier.height(4.dp))
            vm.tools.forEach { tool ->
                val locked = tool.alwaysConfirm
                Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(tool.hudLabel, style = HudType.label(if (locked) hud.warn else hud.primary, 8.sp))
                        Text(tool.name, style = HudType.tech(hud.dim, 11.sp))
                    }
                    HudSwitch(locked || tool.name in s.confirmTools, { vm.setConfirm(tool.name, it) }, enabled = !locked)
                }
            }
        }

        // ── 인터페이스
        Section("INTERFACE", "D1") {
            ToggleRow("BOOT SEQUENCE", "앱 실행 시 부팅 연출", s.bootSequence) { vm.setBoot(it) }
            ToggleRow("SOUND FX", "효과음", s.sfxEnabled) { vm.setSfx(it, s.sfxVolume) }
            var vol by remember(s.sfxVolume) { mutableFloatStateOf(s.sfxVolume) }
            LabeledValue("SFX VOLUME", "${(vol * 100).toInt()}%")
            HudSlider(vol, { vol = it }, Modifier.fillMaxWidth(), onChangeFinished = { vm.setSfx(s.sfxEnabled, vol) })
            ToggleRow("HAPTICS", "상태 전환 진동", s.haptics) { vm.setHaptics(it) }
            ToggleRow("LITE MODE", "저사양 기기용: 입자·발광 줄이고 30fps", s.liteMode) { vm.setLite(it) }
            Spacer(Modifier.height(8.dp))
            Text("HOLO COLOR", style = HudType.label(hud.dim, 8.sp))
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                HudTheme.entries.forEach { th ->
                    val p = paletteFor(th)
                    val sel = th == s.theme
                    Column(
                        Modifier.clickable(remember { MutableInteractionSource() }, null) { vm.setTheme(th) },
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Canvas(Modifier.size(34.dp)) {
                            drawCircle(p.primary.copy(alpha = 0.25f), size.minDimension / 2)
                            drawCircle(p.primary, size.minDimension / 4)
                            if (sel) drawCircle(p.secondary, size.minDimension / 2 - 1.dp.toPx(), style = Stroke(2.dp.toPx()))
                        }
                        Text(th.label, style = HudType.body(if (sel) p.primary else hud.dim, 11.sp))
                    }
                }
            }
        }

        // ── 권한
        Section("ACCESS CONTROL", "E1") {
            val groups = buildList {
                add("마이크" to listOf(Manifest.permission.RECORD_AUDIO))
                add("캘린더" to listOf(Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR))
                add("위치" to listOf(Manifest.permission.ACCESS_COARSE_LOCATION))
                add("연락처" to listOf(Manifest.permission.READ_CONTACTS))
                add("전화" to listOf(Manifest.permission.CALL_PHONE))
                add("문자" to listOf(Manifest.permission.SEND_SMS))
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) add("알림" to listOf(Manifest.permission.POST_NOTIFICATIONS))
            }
            groups.forEach { (label, perms) ->
                val granted = remember(permTick, perms) {
                    perms.all { ContextCompat.checkSelfPermission(context, it) == android.content.pm.PackageManager.PERMISSION_GRANTED }
                }
                Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                    StatusDot(granted)
                    Spacer(Modifier.width(8.dp))
                    Column(Modifier.weight(1f)) {
                        Text(label, style = HudType.body(hud.secondary, 13.sp))
                        Text(perms.joinToString { permissionLabel(it).substringBefore(" ·") }, style = HudType.label(hud.dim, 7.sp, glowOn = false))
                    }
                    if (!granted) HudButton("GRANT", { permLauncher.launch(perms.toTypedArray()) })
                    else Text("GRANTED", style = HudType.label(hud.primary, 8.sp))
                }
            }
            Spacer(Modifier.height(6.dp))
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                StatusDot(vm.canScheduleExact())
                Spacer(Modifier.width(8.dp))
                Text("정확한 알람 (리마인더)", style = HudType.body(hud.secondary, 13.sp), modifier = Modifier.weight(1f))
                if (!vm.canScheduleExact() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    HudButton("GRANT", {
                        runCatching {
                            context.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                        }
                    })
                }
            }
        }

        // ── 시스템
        Section("SYSTEM", "F1") {
            HudButton("SET AS DEFAULT ASSISTANT", {
                val intents = listOf(
                    Intent(Settings.ACTION_VOICE_INPUT_SETTINGS),
                    Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS),
                    Intent(Settings.ACTION_SETTINGS),
                )
                intents.firstOrNull { runCatching { context.startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }.isSuccess }
            }, Modifier.fillMaxWidth())
            Hint("설정 → 기본 앱 → 디지털 어시스턴트 앱에서 JARVIS 를 고르면 홈 버튼 길게 누르기로 호출됩니다.")
            Spacer(Modifier.height(8.dp))
            HudButton("PURGE CONVERSATION LOG", onClearHistory, Modifier.fillMaxWidth(), color = hud.danger)
        }
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun Section(title: String, code: String, content: @Composable () -> Unit) {
    val hud = LocalHud.current
    Box(Modifier.fillMaxWidth().hudPanel(hud.primary).padding(12.dp)) {
        Column {
            PanelHeader(title, code)
            Spacer(Modifier.height(10.dp))
            content()
        }
    }
}

@Composable
private fun ToggleRow(title: String, subtitle: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    val hud = LocalHud.current
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = HudType.label(if (checked) hud.primary else hud.dim, 9.sp, FontWeight.Bold))
            Text(subtitle, style = HudType.body(hud.dim, 12.sp))
        }
        HudSwitch(checked, onChange)
    }
}

@Composable
private fun LabeledValue(label: String, value: String) {
    val hud = LocalHud.current
    Row(Modifier.fillMaxWidth()) {
        Text(label, style = HudType.label(hud.dim, 8.sp), modifier = Modifier.weight(1f))
        Text(value, style = HudType.numeric(hud.secondary, 11.sp))
    }
}

@Composable
private fun Hint(text: String) {
    val hud = LocalHud.current
    Text(text, style = HudType.body(hud.dim, 11.sp), modifier = Modifier.padding(top = 4.dp))
}

@Composable
private fun StatusDot(on: Boolean) {
    val hud = LocalHud.current
    Canvas(Modifier.size(10.dp)) {
        val c = if (on) hud.primary else hud.warn
        drawCircle(c.copy(alpha = 0.3f), size.minDimension / 2)
        drawCircle(c, size.minDimension / 4)
        drawLine(c, Offset(0f, size.height / 2), Offset(1f, size.height / 2), 1f)
    }
}
