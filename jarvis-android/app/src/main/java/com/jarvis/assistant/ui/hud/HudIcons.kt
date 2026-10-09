package com.jarvis.assistant.ui.hud

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import com.jarvis.assistant.services.WeatherService
import com.jarvis.assistant.tools.ToolCategory
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * 날씨 아이콘을 선 애니메이션으로 직접 그린다.
 * 처음 나타날 때 선이 그려지고(trace), 이후 해는 돌고 비/눈은 떨어지고 번개는 번쩍인다.
 */
@Composable
fun WeatherGlyph(code: Int, isDay: Boolean, color: Color, modifier: Modifier = Modifier, accent: Color = color) {
    val time = LocalFrameTime.current
    val kind = WeatherService.kind(code)
    // 선 그리기 시작 시각은 컴포지션 시점 기준 (첫 그리기 시점이 아니라)
    val bornAt = androidx.compose.runtime.remember(code) { floatArrayOf(time.value) }
    Canvas(modifier) {
        val t = time.value
        val trace = ((t - bornAt[0]) / 1.1f).coerceIn(0f, 1f)
        val s = size.minDimension
        val stroke = Stroke(width = s * 0.045f, cap = StrokeCap.Round, join = StrokeJoin.Round)
        val glowStroke = Stroke(width = s * 0.12f, cap = StrokeCap.Round, join = StrokeJoin.Round)

        fun drawTraced(path: Path, c: Color, progress: Float) {
            val p = if (progress >= 1f) path else Path().also { out ->
                val pm = PathMeasure()
                pm.setPath(path, false)
                pm.getSegment(0f, pm.length * progress, out, true)
            }
            drawPath(p, c.copy(alpha = c.alpha * 0.25f), style = glowStroke)
            drawPath(p, c, style = stroke)
        }

        val cloud = cloudPath(Offset(s * 0.52f, s * 0.6f), s * 0.36f)
        when (kind) {
            WeatherService.Companion.Kind.CLEAR -> if (isDay) {
                drawTraced(circlePath(Offset(s / 2, s / 2), s * 0.2f), accent, trace)
                drawSunRays(Offset(s / 2, s / 2), s, t, accent, trace)
            } else {
                drawTraced(moonPath(Offset(s / 2, s / 2), s * 0.26f), accent, trace)
                for (i in 0 until 3) {
                    val tw = 0.4f + 0.6f * (0.5f + 0.5f * sin(t * 2f + i * 2.1f))
                    drawCircle(color.copy(alpha = tw * trace), s * 0.02f, Offset(s * (0.2f + i * 0.28f), s * (0.18f + (i % 2) * 0.12f)))
                }
            }
            WeatherService.Companion.Kind.PARTLY -> {
                val sunC = Offset(s * 0.36f, s * 0.36f)
                if (isDay) {
                    drawTraced(circlePath(sunC, s * 0.14f), accent, trace)
                    drawSunRays(sunC, s * 0.7f, t, accent, trace)
                } else {
                    drawTraced(moonPath(sunC, s * 0.16f), accent, trace)
                }
                drawTraced(cloudPath(Offset(s * 0.56f, s * 0.64f), s * 0.32f), color, trace)
            }
            WeatherService.Companion.Kind.CLOUDY -> {
                val drift = sin(t * 0.8f) * s * 0.03f
                drawTraced(cloudPath(Offset(s * 0.38f + drift, s * 0.42f), s * 0.24f), color.copy(alpha = 0.5f), trace)
                drawTraced(cloudPath(Offset(s * 0.56f - drift, s * 0.62f), s * 0.34f), color, trace)
            }
            WeatherService.Companion.Kind.FOG -> {
                drawTraced(cloud, color.copy(alpha = 0.6f), trace)
                for (i in 0 until 3) {
                    val y = s * (0.74f + i * 0.08f)
                    val shift = sin(t * 1.2f + i) * s * 0.06f
                    drawLine(color.copy(alpha = 0.7f * trace), Offset(s * 0.18f + shift, y), Offset(s * 0.82f + shift, y), s * 0.04f, StrokeCap.Round)
                }
            }
            WeatherService.Companion.Kind.RAIN -> {
                drawTraced(cloudPath(Offset(s * 0.52f, s * 0.42f), s * 0.34f), color, trace)
                drawPrecip(s, t, accent, trace, snow = false)
            }
            WeatherService.Companion.Kind.SNOW -> {
                drawTraced(cloudPath(Offset(s * 0.52f, s * 0.42f), s * 0.34f), color, trace)
                drawPrecip(s, t, accent, trace, snow = true)
            }
            WeatherService.Companion.Kind.STORM -> {
                drawTraced(cloudPath(Offset(s * 0.52f, s * 0.42f), s * 0.34f), color, trace)
                val flash = if ((t * 1.3f % 1f) < 0.12f) 1f else 0.45f
                val bolt = Path().apply {
                    moveTo(s * 0.55f, s * 0.55f); lineTo(s * 0.44f, s * 0.75f); lineTo(s * 0.54f, s * 0.75f); lineTo(s * 0.46f, s * 0.95f)
                }
                drawTraced(bolt, accent.copy(alpha = flash), trace)
            }
        }
    }
}

private fun DrawScope.drawSunRays(c: Offset, s: Float, t: Float, color: Color, trace: Float) {
    val rot = t * 0.4f
    for (i in 0 until 8) {
        val a = rot + i * PI.toFloat() / 4f
        val pulse = 0.85f + 0.15f * sin(t * 3f + i)
        val r1 = s * 0.29f
        val r2 = s * (0.29f + 0.1f * pulse)
        drawLine(
            color.copy(alpha = trace),
            Offset(c.x + cos(a) * r1, c.y + sin(a) * r1),
            Offset(c.x + cos(a) * r2, c.y + sin(a) * r2),
            s * 0.045f, StrokeCap.Round,
        )
    }
}

private fun DrawScope.drawPrecip(s: Float, t: Float, color: Color, trace: Float, snow: Boolean) {
    for (i in 0 until 5) {
        val x = s * (0.28f + i * 0.12f)
        val phase = ((t * (if (snow) 0.5f else 1.4f)) + i * 0.37f) % 1f
        val y = s * (0.66f + phase * 0.3f)
        val a = (1f - phase) * trace
        if (snow) {
            drawCircle(color.copy(alpha = a), s * 0.028f, Offset(x + sin(t * 2 + i) * s * 0.02f, y))
        } else {
            drawLine(color.copy(alpha = a), Offset(x, y), Offset(x - s * 0.03f, y + s * 0.08f), s * 0.035f, StrokeCap.Round)
        }
    }
}

private fun circlePath(c: Offset, r: Float) = Path().apply {
    addOval(androidx.compose.ui.geometry.Rect(c.x - r, c.y - r, c.x + r, c.y + r))
}

private fun moonPath(c: Offset, r: Float) = Path().apply {
    // 초승달: 큰 호 + 안쪽 호
    arcTo(androidx.compose.ui.geometry.Rect(c.x - r, c.y - r, c.x + r, c.y + r), -60f, 260f, true)
    arcTo(androidx.compose.ui.geometry.Rect(c.x - r * 0.35f, c.y - r * 1.05f, c.x + r * 1.35f, c.y + r * 0.65f), 120f, -200f, false)
}

/** 구름 모양 (중심 아래쪽 기준선) */
private fun cloudPath(c: Offset, w: Float): Path = Path().apply {
    val h = w * 0.55f
    val left = c.x - w
    val right = c.x + w
    val base = c.y + h * 0.45f
    moveTo(left + w * 0.25f, base)
    lineTo(right - w * 0.2f, base)
    arcTo(androidx.compose.ui.geometry.Rect(right - w * 0.6f, base - w * 0.6f, right, base), 90f, -180f, false)
    arcTo(androidx.compose.ui.geometry.Rect(c.x - w * 0.55f, base - w * 1.25f, c.x + w * 0.45f, base - w * 0.25f), -10f, -160f, false)
    arcTo(androidx.compose.ui.geometry.Rect(left, base - w * 0.65f, left + w * 0.6f, base + w * 0.0f), -100f, -170f, false)
    close()
}

/** 도구 분류별 HUD 아이콘 */
@Composable
fun ToolGlyph(category: ToolCategory, color: Color, modifier: Modifier = Modifier) {
    val time = LocalFrameTime.current
    Canvas(modifier) {
        val s = size.minDimension
        val w = s * 0.07f
        val st = Stroke(w, cap = StrokeCap.Round, join = StrokeJoin.Round)
        val t = time.value
        val c = Offset(s / 2, s / 2)
        when (category) {
            ToolCategory.ALARM -> {
                drawCircle(color, s * 0.32f, c, style = st)
                val a = t * 2f
                drawLine(color, c, c + Offset(cos(a), sin(a)) * s * 0.22f, w, StrokeCap.Round)
                drawLine(color, c, c + Offset(0f, -s * 0.16f), w, StrokeCap.Round)
                drawLine(color, Offset(s * 0.18f, s * 0.12f), Offset(s * 0.3f, s * 0.04f), w, StrokeCap.Round)
                drawLine(color, Offset(s * 0.82f, s * 0.12f), Offset(s * 0.7f, s * 0.04f), w, StrokeCap.Round)
            }
            ToolCategory.CALENDAR -> {
                drawRect(color, Offset(s * 0.16f, s * 0.22f), Size(s * 0.68f, s * 0.62f), style = st)
                drawLine(color, Offset(s * 0.16f, s * 0.4f), Offset(s * 0.84f, s * 0.4f), w)
                drawLine(color, Offset(s * 0.34f, s * 0.12f), Offset(s * 0.34f, s * 0.28f), w, StrokeCap.Round)
                drawLine(color, Offset(s * 0.66f, s * 0.12f), Offset(s * 0.66f, s * 0.28f), w, StrokeCap.Round)
                val blink = if ((t * 2).toInt() % 2 == 0) 1f else 0.3f
                drawRect(color.copy(alpha = blink), Offset(s * 0.56f, s * 0.54f), Size(s * 0.16f, s * 0.14f))
            }
            ToolCategory.MEMO, ToolCategory.TODO -> {
                val p = Path().apply {
                    moveTo(s * 0.22f, s * 0.1f); lineTo(s * 0.62f, s * 0.1f); lineTo(s * 0.8f, s * 0.28f)
                    lineTo(s * 0.8f, s * 0.9f); lineTo(s * 0.22f, s * 0.9f); close()
                }
                drawPath(p, color, style = st)
                for (i in 0 until 3) {
                    val y = s * (0.42f + i * 0.14f)
                    val len = if (category == ToolCategory.TODO && i == 0) 0.3f else 0.44f
                    drawLine(color, Offset(s * 0.32f, y), Offset(s * (0.32f + len * (0.6f + 0.4f * sin(t * 3 + i).coerceAtLeast(0f))), y), w * 0.8f, StrokeCap.Round)
                }
            }
            ToolCategory.WEATHER -> {
                drawCircle(color, s * 0.16f, Offset(s * 0.38f, s * 0.38f), style = st)
                drawArc(color, 180f, 180f, false, Offset(s * 0.3f, s * 0.42f), Size(s * 0.5f, s * 0.34f), style = st)
                drawLine(color, Offset(s * 0.22f, s * 0.76f), Offset(s * 0.86f, s * 0.76f), w, StrokeCap.Round)
            }
            ToolCategory.NEWS -> {
                for (i in 0 until 3) {
                    val r = s * (0.14f + i * 0.13f)
                    val a = ((t * 1.5f + i * 0.33f) % 1f)
                    drawArc(color.copy(alpha = 1f - a * 0.6f), -135f, 90f, false, Offset(s * 0.5f - r, s * 0.72f - r), Size(r * 2, r * 2), style = st)
                }
                drawCircle(color, s * 0.06f, Offset(s * 0.5f, s * 0.72f))
            }
            ToolCategory.COMMS -> {
                val p = Path().apply {
                    moveTo(s * 0.12f, s * 0.2f); lineTo(s * 0.88f, s * 0.2f); lineTo(s * 0.88f, s * 0.68f)
                    lineTo(s * 0.4f, s * 0.68f); lineTo(s * 0.22f, s * 0.86f); lineTo(s * 0.22f, s * 0.68f); lineTo(s * 0.12f, s * 0.68f); close()
                }
                drawPath(p, color, style = st)
                for (i in 0 until 3) {
                    val on = ((t * 3).toInt() % 3) >= i
                    drawCircle(color.copy(alpha = if (on) 1f else 0.3f), s * 0.05f, Offset(s * (0.32f + i * 0.18f), s * 0.44f))
                }
            }
            ToolCategory.DEVICE -> {
                drawRect(color, Offset(s * 0.28f, s * 0.08f), Size(s * 0.44f, s * 0.84f), style = st)
                drawLine(color, Offset(s * 0.42f, s * 0.8f), Offset(s * 0.58f, s * 0.8f), w, StrokeCap.Round)
                val y = s * (0.2f + ((t * 0.8f) % 1f) * 0.5f)
                drawLine(color.copy(alpha = 0.7f), Offset(s * 0.32f, y), Offset(s * 0.68f, y), w * 0.6f)
            }
            ToolCategory.NETWORK -> {
                drawCircle(color, s * 0.36f, c, style = st)
                drawOval(color, Offset(s * 0.34f, s * 0.14f), Size(s * 0.32f, s * 0.72f), style = st)
                drawLine(color, Offset(s * 0.14f, s * 0.5f), Offset(s * 0.86f, s * 0.5f), w)
                val a = t * 1.5f
                drawCircle(color, s * 0.05f, c + Offset(cos(a), sin(a)) * s * 0.36f)
            }
            ToolCategory.SYSTEM -> {
                for (i in 0 until 6) {
                    val a = t * 0.8f + i * PI.toFloat() / 3f
                    drawLine(color, c + Offset(cos(a), sin(a)) * s * 0.26f, c + Offset(cos(a), sin(a)) * s * 0.4f, w * 1.4f, StrokeCap.Butt)
                }
                drawCircle(color, s * 0.24f, c, style = st)
                drawCircle(color, s * 0.08f, c)
            }
        }
    }
}
