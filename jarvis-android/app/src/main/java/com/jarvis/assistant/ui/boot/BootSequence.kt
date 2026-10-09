package com.jarvis.assistant.ui.boot

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jarvis.assistant.ui.hud.LocalFrameTime
import com.jarvis.assistant.ui.theme.HudType
import com.jarvis.assistant.ui.theme.LocalHud
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

enum class BootStage { TERMINAL, IGNITION, ASSEMBLE, DONE }

/**
 * 부팅 연출 상태. 메인 화면은 [ignition] 으로 리액터 링을 하나씩 그리고, [assembly] 로 패널을 사방에서 들여온다.
 */
@Stable
class BootState(skip: Boolean) {
    var stage by mutableStateOf(if (skip) BootStage.DONE else BootStage.TERMINAL)
    val ignition = Animatable(if (skip) 1f else 0f)
    val assembly = Animatable(if (skip) 1f else 0f)
    val flash = Animatable(0f)
    val terminalAlpha = Animatable(if (skip) 0f else 1f)
}

@Composable
fun rememberBootState(skip: Boolean): BootState = remember { BootState(skip) }

/**
 * 부팅 시퀀스 실행 (3~4초).
 * [onIgnite] 링 점화 순간 (효과음/진동), [onFinished] 패널 조립 완료 (인사말 TTS).
 */
@Composable
fun RunBootSequence(state: BootState, onStart: () -> Unit, onIgnite: () -> Unit, onFinished: () -> Unit) {
    LaunchedEffect(state) {
        if (state.stage == BootStage.DONE) {
            onFinished()
            return@LaunchedEffect
        }
        onStart()
        // 1. 터미널 로그 (BootTerminal 이 스스로 타이핑)
        delay(1350)
        // 2. 링 점화
        state.stage = BootStage.IGNITION
        coroutineScope {
            launch { state.terminalAlpha.animateTo(0f, tween(300)) }
            state.ignition.animateTo(1f, tween(1100, easing = LinearEasing))
        }
        onIgnite()
        state.flash.snapTo(1f)
        launch { state.flash.animateTo(0f, tween(650, easing = FastOutSlowInEasing)) }
        // 3. 패널 조립
        state.stage = BootStage.ASSEMBLE
        state.assembly.animateTo(1f, tween(900, easing = FastOutSlowInEasing))
        state.stage = BootStage.DONE
        onFinished()
    }
}

private val BOOT_LINES = listOf(
    "INITIALIZING J.A.R.V.I.S. ..." to null,
    "KERNEL HANDSHAKE" to "OK",
    "NEURAL LINK" to "OK",
    "VOICE MODULE" to "OK",
    "SPEECH SYNTH (KO-KR)" to "OK",
    "SATELLITE SYNC" to "OK",
    "CHRONO / CALENDAR BUS" to "OK",
    "HOLOGRAPHIC RENDERER" to "OK",
    "SECURITY ENCLAVE" to "LOCKED",
    "ALL SYSTEMS NOMINAL" to null,
)

/** 검은 화면 + 깜빡이는 커서 + 빠르게 스크롤되는 부팅 로그 */
@Composable
fun BootTerminal(state: BootState) {
    val hud = LocalHud.current
    val time = LocalFrameTime.current
    val lines = remember { mutableStateListOf<String>() }
    var typing by remember { mutableStateOf("") }
    var hexCounter by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) {
        delay(180)
        for ((label, status) in BOOT_LINES) {
            // 첫 줄은 타이핑, 나머지는 빠르게
            val full = if (status == null) label else label.padEnd(26, '.') + " " + status
            val step = if (lines.isEmpty()) 2 else 6
            var i = 0
            while (i < full.length) {
                i = minOf(full.length, i + step)
                typing = full.substring(0, i)
                hexCounter += 0x1F3
                delay(14)
            }
            lines += full
            typing = ""
            delay(if (lines.size == 1) 120 else 22)
        }
    }
    if (state.terminalAlpha.value <= 0.01f) return
    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = state.terminalAlpha.value))
            .statusBarsPadding()
            .padding(20.dp),
    ) {
        Column(Modifier.fillMaxWidth()) {
            Text(
                "BIOS 4.07  //  0x%06X".format(hexCounter and 0xFFFFFF),
                style = HudType.label(hud.dim.copy(alpha = state.terminalAlpha.value), 8.sp, glowOn = false),
            )
            Spacer(Modifier.height(12.dp))
            lines.forEach { l ->
                val ok = l.endsWith("OK") || l.endsWith("LOCKED")
                Text(
                    "> $l",
                    style = HudType.tech(
                        (if (ok) hud.primary else hud.secondary).copy(alpha = state.terminalAlpha.value),
                        13.sp,
                        if (l.startsWith("INITIALIZING") || l.startsWith("ALL")) FontWeight.Bold else FontWeight.SemiBold,
                    ),
                )
            }
            Row {
                val cursorOn = (time.value * 2.2f).toInt() % 2 == 0
                Text(
                    "> $typing" + if (cursorOn) "█" else " ",
                    style = HudType.tech(hud.secondary.copy(alpha = state.terminalAlpha.value), 13.sp),
                )
            }
        }
    }
}

/** 점화 순간 화면 전체 플래시 */
@Composable
fun BootFlash(state: BootState) {
    val hud = LocalHud.current
    val f = state.flash.value
    if (f <= 0.01f) return
    Box(
        Modifier
            .fillMaxSize()
            .drawBehind {
                drawRect(Color.White.copy(alpha = 0.55f * f))
                drawRect(hud.primary.copy(alpha = 0.35f * f))
            },
    )
}
