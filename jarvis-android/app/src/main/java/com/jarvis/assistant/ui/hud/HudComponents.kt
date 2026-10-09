package com.jarvis.assistant.ui.hud

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.ui.focus.focusRequester
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import com.jarvis.assistant.ui.theme.HudType
import com.jarvis.assistant.ui.theme.LocalHud
import com.jarvis.assistant.ui.theme.LocalLiteMode
import kotlinx.coroutines.delay
import kotlin.random.Random

// ───────────────────────── 패널 ─────────────────────────

/**
 * 반투명 유리 + 얇은 발광 테두리 + 모서리 브래킷(┌ ┐ └ ┘).
 * 오른쪽 위 모서리는 비스듬히 잘린 형태.
 */
fun Modifier.hudPanel(
    accent: Color,
    fillAlpha: Float = 0.07f,
    corner: Dp = 12.dp,
    cut: Dp = 10.dp,
    lite: Boolean = false,
): Modifier = this.drawWithCache {
    val w = size.width
    val h = size.height
    val c = corner.toPx()
    val k = cut.toPx()
    val stroke = 1.dp.toPx()
    val bracket = 2.dp.toPx()
    val outline = Path().apply {
        moveTo(0f, 0f); lineTo(w - k, 0f); lineTo(w, k); lineTo(w, h); lineTo(0f, h); close()
    }
    val fill = Brush.verticalGradient(listOf(accent.copy(alpha = fillAlpha * 1.6f), accent.copy(alpha = fillAlpha * 0.4f)))
    val brackets = Path().apply {
        // ┌
        moveTo(0f, c); lineTo(0f, 0f); lineTo(c, 0f)
        // ┐ (잘린 모서리 따라)
        moveTo(w - k - c * 0.6f, 0f); lineTo(w - k, 0f); lineTo(w, k); lineTo(w, k + c * 0.6f)
        // ┘
        moveTo(w, h - c); lineTo(w, h); lineTo(w - c, h)
        // └
        moveTo(c, h); lineTo(0f, h); lineTo(0f, h - c)
    }
    onDrawBehind {
        drawPath(outline, fill)
        drawPath(outline, accent.copy(alpha = 0.18f), style = Stroke(stroke))
        if (!lite) drawPath(brackets, accent.copy(alpha = 0.25f), style = Stroke(bracket * 3f, cap = StrokeCap.Square))
        drawPath(brackets, accent.copy(alpha = 0.95f), style = Stroke(bracket, cap = StrokeCap.Square))
        // 아래쪽 눈금 장식
        val tick = 4.dp.toPx()
        var x = c * 2
        var i = 0
        while (x < w - c * 2 && i < 6) {
            drawLine(accent.copy(alpha = 0.35f), Offset(x, h - tick), Offset(x, h), stroke)
            x += tick * 1.6f
            i++
        }
    }
}

/** 패널 제목줄: ▸ SYSTEM STATUS ────── 03 */
@Composable
fun PanelHeader(title: String, code: String? = null, modifier: Modifier = Modifier, color: Color = LocalHud.current.primary) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Canvas(Modifier.size(6.dp)) {
            drawPath(
                Path().apply { moveTo(0f, 0f); lineTo(size.width, size.height / 2); lineTo(0f, size.height); close() },
                color,
            )
        }
        Spacer(Modifier.width(6.dp))
        Text(title, style = HudType.label(color, 9.sp))
        Spacer(Modifier.width(6.dp))
        Canvas(Modifier.weight(1f).height(1.dp)) {
            drawLine(
                Brush.horizontalGradient(listOf(color.copy(alpha = 0.6f), Color.Transparent)),
                Offset(0f, size.height / 2), Offset(size.width, size.height / 2), size.height,
            )
        }
        if (code != null) {
            Spacer(Modifier.width(6.dp))
            Text(code, style = HudType.label(color.copy(alpha = 0.6f), 8.sp, glowOn = false))
        }
    }
}

// ───────────────────────── 텍스트 효과 ─────────────────────────

private const val TECH_GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*<>/=+"

private fun scrambleChar(target: Char): Char = when {
    target.isWhitespace() -> target
    target in '가'..'힣' -> ('가' + Random.nextInt(0, 11172))
    target.isDigit() -> ('0' + Random.nextInt(10))
    else -> TECH_GLYPHS[Random.nextInt(TECH_GLYPHS.length)]
}

/**
 * 한 글자씩 타이핑 + 앞쪽 몇 글자가 랜덤 문자로 섞이다 맞춰지는 디코딩 효과.
 * 텍스트가 이어 붙여지면(스트리밍) 이미 보인 부분은 유지하고 새 부분만 디코딩한다.
 */
@Composable
fun DecodeText(
    text: String,
    style: TextStyle,
    modifier: Modifier = Modifier,
    charDelayMs: Long = 18,
    scrambleWidth: Int = 5,
    maxLines: Int = Int.MAX_VALUE,
    animate: Boolean = true,
    onDone: (() -> Unit)? = null,
) {
    var revealed by remember { mutableIntStateOf(if (animate) 0 else text.length) }
    var shown by remember { mutableStateOf(if (animate) "" else text) }
    var lastText by remember { mutableStateOf("") }
    LaunchedEffect(text, animate) {
        if (!animate) {
            revealed = text.length
            shown = text
            lastText = text
            onDone?.invoke()
            return@LaunchedEffect
        }
        if (!text.startsWith(lastText.take(revealed))) revealed = 0
        lastText = text
        while (revealed < text.length) {
            revealed++
            val fixed = text.substring(0, revealed)
            val tailEnd = minOf(text.length, revealed + scrambleWidth)
            val tail = buildString { for (i in revealed until tailEnd) append(scrambleChar(text[i])) }
            shown = fixed + tail
            // 줄바꿈/공백은 빠르게
            delay(if (text[revealed - 1].isWhitespace()) charDelayMs / 3 else charDelayMs)
        }
        shown = text
        onDone?.invoke()
    }
    Text(shown, style = style, modifier = modifier, maxLines = maxLines)
}

/** 라벨용: 짧은 텍스트를 전부 섞었다가 왼쪽부터 맞춰지는 효과 */
@Composable
fun ScrambleLabel(text: String, style: TextStyle, modifier: Modifier = Modifier, durationMs: Int = 500) {
    var shown by remember(text) { mutableStateOf(text.map(::scrambleChar).joinToString("")) }
    LaunchedEffect(text) {
        val steps = 14
        for (s in 1..steps) {
            val fixedCount = text.length * s / steps
            shown = text.take(fixedCount) + text.drop(fixedCount).map(::scrambleChar).joinToString("")
            delay((durationMs / steps).toLong())
        }
        shown = text
    }
    Text(shown, style = style, modifier = modifier, maxLines = 1)
}

// ───────────────────────── 버튼/스위치/슬라이더 ─────────────────────────

@Composable
fun HudButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: Color = LocalHud.current.primary,
    enabled: Boolean = true,
    filled: Boolean = false,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val glowAmt by animateFloatAsState(if (pressed) 1f else 0f, tween(120), label = "btn")
    val c = if (enabled) color else color.copy(alpha = 0.35f)
    Box(
        modifier
            .clickable(interaction, indication = null, enabled = enabled, onClick = onClick)
            .drawBehind {
                val k = 7.dp.toPx()
                val p = Path().apply {
                    moveTo(k, 0f); lineTo(size.width, 0f); lineTo(size.width, size.height - k)
                    lineTo(size.width - k, size.height); lineTo(0f, size.height); lineTo(0f, k); close()
                }
                drawPath(p, c.copy(alpha = (if (filled) 0.22f else 0.06f) + glowAmt * 0.25f))
                drawPath(p, c.copy(alpha = 0.25f + glowAmt * 0.5f), style = Stroke(5.dp.toPx() * glowAmt + 0.01f))
                drawPath(p, c.copy(alpha = 0.9f), style = Stroke(1.2.dp.toPx()))
            }
            .padding(horizontal = 16.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = HudType.label(c, 11.sp))
    }
}

/** 발광 토글 스위치 */
@Composable
fun HudSwitch(checked: Boolean, onChange: (Boolean) -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    val hud = LocalHud.current
    val lite = LocalLiteMode.current
    val pos by animateFloatAsState(if (checked) 1f else 0f, tween(180), label = "sw")
    Canvas(
        modifier
            .size(52.dp, 26.dp)
            .clickable(remember { MutableInteractionSource() }, null, enabled = enabled) { onChange(!checked) },
    ) {
        val c = if (enabled) hud.primary else hud.dim
        val h = size.height
        val w = size.width
        val k = h * 0.3f
        val track = Path().apply {
            moveTo(k, 0f); lineTo(w, 0f); lineTo(w, h - k); lineTo(w - k, h); lineTo(0f, h); lineTo(0f, k); close()
        }
        drawPath(track, c.copy(alpha = 0.05f + 0.18f * pos))
        drawPath(track, c.copy(alpha = 0.35f + 0.5f * pos), style = Stroke(1.dp.toPx()))
        // 슬롯 눈금
        for (i in 0..5) {
            val x = w * (0.15f + i * 0.14f)
            drawLine(c.copy(alpha = 0.15f), Offset(x, h * 0.3f), Offset(x, h * 0.7f), 1.dp.toPx())
        }
        val knobW = w * 0.42f
        val x = 3.dp.toPx() + (w - knobW - 6.dp.toPx()) * pos
        val knobColor = if (checked) c else hud.dim
        if (checked && !lite) drawRect(knobColor.copy(alpha = 0.35f), Offset(x - 4.dp.toPx(), 0f), Size(knobW + 8.dp.toPx(), h))
        drawRect(knobColor.copy(alpha = if (checked) 0.95f else 0.5f), Offset(x, 4.dp.toPx()), Size(knobW, h - 8.dp.toPx()))
    }
}

/** 눈금 게이지형 슬라이더 */
@Composable
fun HudSlider(
    value: Float,
    onChange: (Float) -> Unit,
    modifier: Modifier = Modifier,
    range: ClosedFloatingPointRange<Float> = 0f..1f,
    steps: Int = 40,
    onChangeFinished: (() -> Unit)? = null,
) {
    val hud = LocalHud.current
    val frac = ((value - range.start) / (range.endInclusive - range.start)).coerceIn(0f, 1f)
    Canvas(
        modifier
            .height(30.dp)
            .pointerInput(range) {
                detectTapGestures { o ->
                    onChange(range.start + (o.x / size.width).coerceIn(0f, 1f) * (range.endInclusive - range.start))
                    onChangeFinished?.invoke()
                }
            }
            .pointerInput(range) {
                detectHorizontalDragGestures(onDragEnd = { onChangeFinished?.invoke() }) { change, _ ->
                    onChange(range.start + (change.position.x / size.width).coerceIn(0f, 1f) * (range.endInclusive - range.start))
                }
            },
    ) {
        val w = size.width
        val h = size.height
        for (i in 0..steps) {
            val x = w * i / steps
            val on = i / steps.toFloat() <= frac
            val major = i % 5 == 0
            val top = if (major) h * 0.15f else h * 0.35f
            drawLine(
                (if (on) hud.primary else hud.dim).copy(alpha = if (on) 0.95f else 0.35f),
                Offset(x, top), Offset(x, h * 0.85f),
                (if (major) 2.dp else 1.5.dp).toPx(),
            )
        }
        val x = w * frac
        drawLine(hud.secondary, Offset(x, 0f), Offset(x, h), 2.dp.toPx())
        drawCircle(hud.primary.copy(alpha = 0.3f), 9.dp.toPx(), Offset(x, h / 2))
        drawCircle(hud.secondary, 3.dp.toPx(), Offset(x, h / 2))
    }
}

/** HUD 입력창 */
@Composable
fun HudTextField(
    value: String,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    password: Boolean = false,
    singleLine: Boolean = true,
    onDone: (() -> Unit)? = null,
    focusRequester: androidx.compose.ui.focus.FocusRequester? = null,
) {
    val hud = LocalHud.current
    Box(
        modifier
            .drawBehind {
                drawRect(hud.primary.copy(alpha = 0.06f))
                drawLine(hud.primary.copy(alpha = 0.9f), Offset(0f, size.height), Offset(size.width, size.height), 1.5.dp.toPx())
                drawLine(hud.primary.copy(alpha = 0.9f), Offset(0f, size.height), Offset(0f, size.height - 8.dp.toPx()), 1.5.dp.toPx())
                drawLine(hud.primary.copy(alpha = 0.9f), Offset(size.width, size.height), Offset(size.width, size.height - 8.dp.toPx()), 1.5.dp.toPx())
            }
            .padding(horizontal = 12.dp, vertical = 12.dp),
    ) {
        if (value.isEmpty()) Text(placeholder, style = HudType.body(hud.dim, 14.sp))
        BasicTextField(
            value = value,
            onValueChange = onChange,
            singleLine = singleLine,
            textStyle = HudType.body(hud.secondary, 15.sp),
            cursorBrush = SolidColor(hud.primary),
            visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(imeAction = if (singleLine) ImeAction.Done else ImeAction.Default),
            keyboardActions = KeyboardActions(onDone = { onDone?.invoke() }),
            modifier = if (focusRequester != null) Modifier.fillMaxWidth().focusRequester(focusRequester) else Modifier.fillMaxWidth(),
        )
    }
}

// ───────────────────────── 게이지 ─────────────────────────

/** 원형 게이지 (배터리/네트워크/저장공간) */
@Composable
fun CircularGauge(
    fraction: Float,
    label: String,
    valueText: String,
    modifier: Modifier = Modifier,
    color: Color = LocalHud.current.primary,
) {
    val hud = LocalHud.current
    val time = LocalFrameTime.current
    val animated by animateFloatAsState(fraction.coerceIn(0f, 1f), tween(900), label = "gauge")
    Box(modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.matchParentSize()) {
            val stroke = 3.dp.toPx()
            val r = size.minDimension / 2 - stroke * 2
            val center = Offset(size.width / 2, size.height / 2)
            val topLeft = Offset(center.x - r, center.y - r)
            val arcSize = Size(r * 2, r * 2)
            // 배경 눈금 링
            for (i in 0 until 40) {
                val a = Math.toRadians((i * 9.0) - 90)
                val o = Offset(center.x + (r + stroke * 1.4f) * kotlin.math.cos(a).toFloat(), center.y + (r + stroke * 1.4f) * kotlin.math.sin(a).toFloat())
                val inner = Offset(center.x + (r + stroke * 0.6f) * kotlin.math.cos(a).toFloat(), center.y + (r + stroke * 0.6f) * kotlin.math.sin(a).toFloat())
                drawLine(color.copy(alpha = if (i / 40f <= animated) 0.6f else 0.12f), inner, o, 1.dp.toPx())
            }
            drawArc(color.copy(alpha = 0.12f), -90f, 360f, false, topLeft, arcSize, style = Stroke(stroke))
            drawArc(color.copy(alpha = 0.3f), -90f, 360f * animated, false, topLeft, arcSize, style = Stroke(stroke * 3f, cap = StrokeCap.Butt))
            drawArc(color, -90f, 360f * animated, false, topLeft, arcSize, style = Stroke(stroke, cap = StrokeCap.Butt))
            // 회전하는 작은 표식
            val spin = (time.value * 40f) % 360f
            drawArc(hud.secondary.copy(alpha = 0.7f), spin, 14f, false, Offset(center.x - r * 0.72f, center.y - r * 0.72f), Size(r * 1.44f, r * 1.44f), style = Stroke(1.5.dp.toPx()))
        }
        androidx.compose.foundation.layout.Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Text(valueText, style = HudType.numeric(hud.secondary, 12.sp))
            Text(label, style = HudType.label(color.copy(alpha = 0.8f), 6.5.sp, glowOn = false))
        }
    }
}

/** 수평 진행 바 (도구 실행 등) */
fun DrawScope.hudProgress(fraction: Float, color: Color, indeterminatePhase: Float? = null) {
    val h = size.height
    drawRect(color.copy(alpha = 0.12f))
    if (indeterminatePhase != null) {
        val segW = size.width * 0.3f
        val x = (indeterminatePhase % 1f) * (size.width + segW) - segW
        drawRect(
            Brush.horizontalGradient(listOf(Color.Transparent, color, Color.Transparent), startX = x, endX = x + segW),
            Offset(0f, 0f), Size(size.width, h),
        )
    } else {
        drawRect(color, Offset.Zero, Size(size.width * fraction.coerceIn(0f, 1f), h))
    }
    // 세그먼트 구분선
    var x = 0f
    val step = 6.dp.toPx()
    while (x < size.width) {
        drawLine(Color.Black.copy(alpha = 0.5f), Offset(x, 0f), Offset(x, h), 1.dp.toPx())
        x += step
    }
}
