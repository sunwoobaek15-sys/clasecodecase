package com.jarvis.assistant.ui.main

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jarvis.assistant.interaction.ConfirmationBroker
import com.jarvis.assistant.interaction.PermissionBroker
import com.jarvis.assistant.ui.hud.HudButton
import com.jarvis.assistant.ui.hud.HudTextField
import com.jarvis.assistant.ui.hud.LocalFrameTime
import com.jarvis.assistant.ui.hud.PanelHeader
import com.jarvis.assistant.ui.hud.ScrambleLabel
import com.jarvis.assistant.ui.hud.ToolGlyph
import com.jarvis.assistant.ui.hud.hudPanel
import com.jarvis.assistant.ui.theme.HudType
import com.jarvis.assistant.ui.theme.LocalHud

/** 화면을 어둡게 덮고 가운데 HUD 패널이 위아래로 펼쳐진다. */
@Composable
fun HudOverlay(
    accent: Color,
    onDismissRequest: (() -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    val unfold = remember { Animatable(0f) }
    LaunchedEffect(Unit) { unfold.animateTo(1f, tween(380, easing = FastOutSlowInEasing)) }
    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.72f * unfold.value))
            .clickable(remember { MutableInteractionSource() }, null) { onDismissRequest?.invoke() }
            .imePadding(),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier
                .padding(24.dp)
                .fillMaxWidth()
                .graphicsLayer {
                    scaleY = unfold.value
                    scaleX = 0.9f + 0.1f * unfold.value
                    alpha = unfold.value
                }
                .clickable(remember { MutableInteractionSource() }, null) { }
                .hudPanel(accent, fillAlpha = 0.14f)
                .background(Color(0xE603070F))
                .padding(18.dp),
        ) { content() }
    }
}

/** 위험 작업 확인: 앰버/레드 경고 패널 + 음성 확인 안내 */
@Composable
fun ConfirmationDialog(req: ConfirmationBroker.Request, onResult: (Boolean) -> Unit) {
    val hud = LocalHud.current
    val time = LocalFrameTime.current
    val accent = if (req.danger) hud.danger else hud.warn
    HudOverlay(accent) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Canvas(Modifier.size(34.dp)) {
                    val blink = 0.5f + 0.5f * kotlin.math.sin(time.value * 8f)
                    val p = Path().apply {
                        moveTo(size.width / 2, 2f); lineTo(size.width - 2f, size.height - 2f); lineTo(2f, size.height - 2f); close()
                    }
                    drawPath(p, accent.copy(alpha = 0.15f + 0.2f * blink))
                    drawPath(p, accent, style = Stroke(2.dp.toPx()))
                    drawLine(accent, Offset(size.width / 2, size.height * 0.38f), Offset(size.width / 2, size.height * 0.66f), 2.5.dp.toPx())
                    drawCircle(accent, 1.8.dp.toPx(), Offset(size.width / 2, size.height * 0.8f))
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    ScrambleLabel(if (req.danger) "AUTHORIZATION REQUIRED" else "CONFIRM ACTION", HudType.label(accent, 11.sp, FontWeight.Bold))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        ToolGlyph(req.category, accent.copy(alpha = 0.8f), Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(req.title, style = HudType.label(accent.copy(alpha = 0.75f), 8.sp, glowOn = false))
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
            Text(req.prompt, style = HudType.body(hud.secondary, 16.sp, FontWeight.Medium))
            Spacer(Modifier.height(10.dp))
            Text("음성으로 \"네\" 또는 \"아니요\" 라고 답하셔도 됩니다", style = HudType.body(hud.dim, 12.sp))
            Spacer(Modifier.height(18.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                HudButton("ABORT", { onResult(false) }, Modifier.weight(1f), color = hud.dim)
                HudButton("EXECUTE", { onResult(true) }, Modifier.weight(1f), color = accent, filled = true)
            }
        }
    }
}

/** 권한 요청 전 이유 설명 */
@Composable
fun PermissionRationaleDialog(req: PermissionBroker.Request, onAuthorize: () -> Unit, onDeny: () -> Unit) {
    val hud = LocalHud.current
    HudOverlay(hud.primary, onDismissRequest = onDeny) {
        Column {
            PanelHeader("ACCESS REQUEST", "SEC")
            Spacer(Modifier.height(12.dp))
            Text(req.rationale.ifBlank { "이 기능을 쓰려면 권한이 필요합니다." }, style = HudType.body(hud.secondary, 15.sp, FontWeight.Medium))
            Spacer(Modifier.height(10.dp))
            req.permissions.forEach {
                Text("▸ " + permissionLabel(it), style = HudType.tech(hud.primary, 13.sp))
            }
            Spacer(Modifier.height(18.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                HudButton("DENY", onDeny, Modifier.weight(1f), color = hud.dim)
                HudButton("AUTHORIZE", onAuthorize, Modifier.weight(1f), filled = true)
            }
        }
    }
}

fun permissionLabel(p: String): String = when (p.substringAfterLast('.')) {
    "RECORD_AUDIO" -> "MICROPHONE · 마이크"
    "READ_CONTACTS" -> "CONTACTS · 연락처"
    "CALL_PHONE" -> "PHONE · 전화 걸기"
    "SEND_SMS" -> "SMS · 문자 보내기"
    "READ_CALENDAR" -> "CALENDAR READ · 캘린더 읽기"
    "WRITE_CALENDAR" -> "CALENDAR WRITE · 캘린더 쓰기"
    "ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION" -> "LOCATION · 위치"
    "POST_NOTIFICATIONS" -> "NOTIFICATIONS · 알림"
    else -> p.substringAfterLast('.')
}

/** 코어를 길게 누르면 뜨는 텍스트 입력 */
@Composable
fun TextCommandDialog(onSubmit: (String) -> Unit, onDismiss: () -> Unit) {
    val hud = LocalHud.current
    var text by remember { mutableStateOf("") }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    HudOverlay(hud.primary, onDismissRequest = onDismiss) {
        Column {
            PanelHeader("MANUAL INPUT", "TXT")
            Spacer(Modifier.height(12.dp))
            HudTextField(
                value = text,
                onChange = { text = it },
                placeholder = "명령을 입력하세요",
                modifier = Modifier.fillMaxWidth(),
                focusRequester = focus,
                onDone = { onSubmit(text) },
            )
            Spacer(Modifier.height(16.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                HudButton("CANCEL", onDismiss, Modifier.weight(1f), color = hud.dim)
                HudButton("TRANSMIT", { onSubmit(text) }, Modifier.weight(1f), filled = true, enabled = text.isNotBlank())
            }
        }
    }
}
