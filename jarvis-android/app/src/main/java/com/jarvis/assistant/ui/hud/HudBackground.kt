package com.jarvis.assistant.ui.hud

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import com.jarvis.assistant.ui.theme.LocalHud
import com.jarvis.assistant.ui.theme.LocalLiteMode
import kotlin.math.sin
import kotlin.math.sqrt

/** 심해 남색 + 육각 그리드 + 떠다니는 입자 + 스캔라인 + 비네팅 */
@Composable
fun HudBackground(modifier: Modifier = Modifier, calm: Boolean = false) {
    val hud = LocalHud.current
    val lite = LocalLiteMode.current
    val time = LocalFrameTime.current
    val tilt = LocalTilt.current
    val particleCount = when {
        lite -> 24
        calm -> 50
        else -> 90
    }
    Spacer(
        modifier
            .fillMaxSize()
            .drawWithCache {
                val w = size.width
                val h = size.height
                val unit = density
                // 육각 그리드 (한 번만 만든다)
                val hexR = 26f * unit
                val hexW = sqrt(3f) * hexR
                val hex = Path()
                var row = -1
                var y = -hexR * 2
                while (y < h + hexR * 4) {
                    var x = if (row % 2 == 0) -hexW else -hexW / 2
                    while (x < w + hexW * 2) {
                        for (k in 0..5) {
                            val a = Math.toRadians((60.0 * k) + 30.0)
                            val px = x + hexR * kotlin.math.cos(a).toFloat()
                            val py = y + hexR * kotlin.math.sin(a).toFloat()
                            if (k == 0) hex.moveTo(px, py) else hex.lineTo(px, py)
                        }
                        hex.close()
                        x += hexW
                    }
                    y += hexR * 1.5f
                    row++
                }
                val hexBrushMask = Brush.radialGradient(
                    colors = listOf(hud.primary.copy(alpha = 0.075f), hud.primary.copy(alpha = 0.025f), Color.Transparent),
                    center = Offset(w / 2, h * 0.45f),
                    radius = maxOf(w, h) * 0.75f,
                )
                val glowCenter = Brush.radialGradient(
                    colors = listOf(hud.primary.copy(alpha = 0.10f), Color.Transparent),
                    center = Offset(w / 2, h * 0.45f),
                    radius = w * 0.9f,
                )
                val vignette = Brush.radialGradient(
                    colors = listOf(Color.Transparent, Color.Transparent, hud.bgDeep.copy(alpha = 0.85f)),
                    center = Offset(w / 2, h / 2),
                    radius = maxOf(w, h) * 0.78f,
                )
                val scanlines = Brush.verticalGradient(
                    0f to Color.Transparent,
                    0.5f to Color.Black.copy(alpha = 0.22f),
                    1f to Color.Transparent,
                    startY = 0f,
                    endY = 3f * unit,
                    tileMode = TileMode.Repeated,
                )
                val hexStroke = Stroke(width = 1f * unit * 0.8f)

                onDrawBehind {
                    val t = time.value
                    val tl = tilt.value
                    drawRect(hud.bg)
                    drawRect(glowCenter)
                    translate(-tl.x * 14f * unit, -tl.y * 14f * unit) {
                        drawPath(hex, hexBrushMask, style = hexStroke)
                    }
                    // 입자
                    for (i in 0 until particleCount) {
                        val r1 = hash(i * 3 + 1)
                        val r2 = hash(i * 3 + 2)
                        val r3 = hash(i * 3 + 3)
                        val vx = (r3 - 0.5f) * 10f * unit
                        val vy = -(3f + r2 * 9f) * unit
                        val px = ((r1 * w + vx * t - tl.x * 22f * unit * r3) % w + w) % w
                        val py = ((r2 * h + vy * t - tl.y * 22f * unit * r3) % h + h) % h
                        val tw = 0.5f + 0.5f * sin(t * (0.6f + r1 * 1.8f) + i)
                        val radius = (0.6f + r3 * 1.6f) * unit
                        drawCircle(hud.secondary.copy(alpha = 0.08f + 0.42f * tw * (0.4f + r2 * 0.6f)), radius, Offset(px, py))
                        if (!lite && r1 > 0.86f) {
                            drawCircle(hud.primary.copy(alpha = 0.06f * tw), radius * 5f, Offset(px, py))
                        }
                    }
                    // 천천히 내려가는 스캔 바
                    val barY = ((t * 0.07f) % 1.2f - 0.1f) * h
                    drawRect(
                        Brush.verticalGradient(
                            listOf(Color.Transparent, hud.primary.copy(alpha = 0.05f), Color.Transparent),
                            startY = barY - 60f * unit,
                            endY = barY + 60f * unit,
                        ),
                    )
                    drawRect(scanlines)
                    drawRect(vignette)
                }
            },
    )
}

/** 결정적 의사난수 0..1 */
fun hash(n: Int): Float {
    var x = n * 374761393 + 668265263
    x = (x xor (x ushr 13)) * 1274126177
    x = x xor (x ushr 16)
    return (x and 0x7fffffff) / 2147483647f
}
