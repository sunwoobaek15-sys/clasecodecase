package com.jarvis.assistant.ui.main

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jarvis.assistant.ui.boot.BootState
import com.jarvis.assistant.ui.hud.LocalTilt
import com.jarvis.assistant.ui.reactor.CoreMode
import com.jarvis.assistant.ui.reactor.ReactorCore
import com.jarvis.assistant.ui.theme.HudType
import com.jarvis.assistant.ui.theme.LocalHud

/** 패널이 사방에서 미끄러져 들어오고, 기울이면 시차 이동하는 레이어 */
private fun Modifier.assembled(boot: BootState, fromX: Float, fromY: Float, delayFrac: Float, parallax: Float, tilt: () -> androidx.compose.ui.geometry.Offset) =
    this.graphicsLayer {
        val raw = ((boot.assembly.value - delayFrac) / (1f - delayFrac)).coerceIn(0f, 1f)
        val p = 1f - (1f - raw) * (1f - raw) * (1f - raw)
        val tl = tilt()
        translationX = (1f - p) * fromX * size.width + tl.x * parallax * density
        translationY = (1f - p) * fromY * size.height + tl.y * parallax * density
        alpha = p
    }

@Composable
fun MainScreen(vm: MainViewModel, boot: BootState, apiReady: Boolean) {
    val state by vm.state.collectAsStateWithLifecycle()
    val hud = LocalHud.current
    val tiltState = LocalTilt.current
    val tilt = { tiltState.value }

    Column(Modifier.fillMaxSize().padding(horizontal = 12.dp)) {
        StatusStrip(
            mode = modeLabel(state.mode, state.lowPower),
            apiReady = apiReady,
            modifier = Modifier.padding(top = 6.dp, bottom = 6.dp).assembled(boot, 0f, -1f, 0f, 3f, tilt),
        )
        // 상단 패널
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ClockPanel(Modifier.weight(1f).fillMaxHeight().assembled(boot, -1.2f, 0f, 0.0f, 6f, tilt))
            WeatherPanel(state.weather, Modifier.weight(1f).fillMaxHeight().assembled(boot, 1.2f, 0f, 0.1f, 6f, tilt))
        }

        // 리액터 영역
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            val side = minOf(maxWidth, maxHeight)
            ReactorCore(
                mode = state.mode,
                level = { vm.micLevel.value },
                speech = { vm.speechEnvelope.value },
                lowPower = state.lowPower,
                ignition = boot.ignition.value,
                onTap = vm::onCoreTap,
                onLongPress = { vm.openTextInput(true) },
                modifier = Modifier
                    .width(side)
                    .aspectRatio(1f)
                    .graphicsLayer {
                        val tl = tiltState.value
                        translationX = -tl.x * 4f * density
                        translationY = -tl.y * 4f * density
                    },
            )
            // 도구 실행 카드: 코어 옆에 튀어나온다
            Column(
                Modifier.align(Alignment.TopStart).padding(top = 8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                state.executing.forEach { ExecutingCard(it) }
            }
            // 결과 홀로그램 카드
            Column(
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(bottom = 4.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                state.cards.takeLast(2).forEach { entry ->
                    key(entry.id) {
                        ResultCardView(entry, onDismiss = { vm.dismissCard(entry.id) }, modifier = Modifier.fillMaxWidth().widthIn(max = 520.dp))
                    }
                }
            }
            if (state.cards.isEmpty() && state.mode == CoreMode.IDLE && boot.assembly.value >= 1f) {
                Text(
                    "TAP CORE TO SPEAK  ·  HOLD FOR TEXT",
                    style = HudType.label(hud.dim, 8.sp, glowOn = false),
                    modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 2.dp),
                )
            }
        }

        // 대화 로그
        HoloLog(
            logs = state.logs,
            partial = state.partialSpeech,
            status = state.statusMessage,
            modifier = Modifier.fillMaxWidth().height(132.dp).assembled(boot, 0f, 1.5f, 0.15f, 5f, tilt),
        )
        Spacer(Modifier.height(8.dp))
        // 하단 패널
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            NextEventPanel(state.nextEvent, Modifier.weight(1f).fillMaxHeight().assembled(boot, -1.2f, 0f, 0.2f, 6f, tilt))
            SystemPanel(state.system, Modifier.weight(1.15f).fillMaxHeight().assembled(boot, 1.2f, 0f, 0.25f, 6f, tilt))
        }
        Spacer(Modifier.height(8.dp))
        Box(Modifier.assembled(boot, 0f, 2f, 0.3f, 2f, tilt)) {
            NewsTicker(state.headlines, Modifier.fillMaxWidth())
        }
    }
}

private fun modeLabel(mode: CoreMode, lowPower: Boolean) = when (mode) {
    CoreMode.IDLE -> if (lowPower) "STANDBY // LOW POWER" else "STANDBY"
    CoreMode.LISTENING -> "AUDIO CAPTURE"
    CoreMode.THINKING -> "PROCESSING"
    CoreMode.SPEAKING -> "VOICE OUTPUT"
    CoreMode.EXECUTING -> "EXECUTING"
    CoreMode.ERROR -> "FAULT DETECTED"
}
