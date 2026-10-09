package com.jarvis.assistant.ui.nav

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jarvis.assistant.ui.theme.HudType
import com.jarvis.assistant.ui.theme.LocalHud
import kotlin.random.Random

enum class Screen(val label: String, val code: String) {
    CORE("CORE", "00"),
    SCHEDULE("SCHEDULE", "01"),
    FILES("DATA", "02"),
    SETTINGS("CONFIG", "03"),
}

/**
 * 화면 전환: 이전 패널이 세로로 접히며 사라지고 → 글리치 프레임 → 새 패널이 펼쳐지며 조립.
 */
@Composable
fun HudNavHost(
    current: Screen,
    onGlitch: () -> Unit,
    content: @Composable (Screen) -> Unit,
) {
    var shown by remember { mutableStateOf(current) }
    val fold = remember { Animatable(1f) } // 1 = 펼침, 0 = 접힘
    var glitch by remember { mutableStateOf(0f) }

    LaunchedEffect(current) {
        if (current == shown) return@LaunchedEffect
        fold.animateTo(0f, tween(170, easing = FastOutSlowInEasing))
        shown = current
        onGlitch()
        glitch = 1f
        // 글리치 1~2프레임
        kotlinx.coroutines.delay(48)
        glitch = 0f
        fold.animateTo(1f, tween(320, easing = FastOutSlowInEasing))
    }

    val hud = LocalHud.current
    Box(
        Modifier
            .fillMaxSize()
            .graphicsLayer {
                scaleY = 0.02f + 0.98f * fold.value
                scaleX = 0.92f + 0.08f * fold.value
                alpha = (fold.value * 1.5f).coerceAtMost(1f)
            }
            .drawWithContent {
                if (glitch > 0f) {
                    val rnd = Random(System.nanoTime())
                    // RGB 분리 + 찢김 띠
                    translate(6.dp.toPx(), 0f) { this@drawWithContent.drawContent() }
                    drawRect(Color(0x55FF2244))
                    repeat(6) {
                        val y = rnd.nextFloat() * size.height
                        drawRect(hud.primary.copy(alpha = 0.5f), Offset(0f, y), Size(size.width, rnd.nextFloat() * 10.dp.toPx()))
                    }
                } else {
                    drawContent()
                }
            },
    ) {
        content(shown)
    }
}

/** 하단 내비게이션: 각 화면을 직접 그린 HUD 아이콘으로 */
@Composable
fun HudNavBar(current: Screen, onSelect: (Screen) -> Unit, modifier: Modifier = Modifier) {
    val hud = LocalHud.current
    Row(
        modifier.fillMaxWidth().height(52.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Screen.entries.forEach { s ->
            val selected = s == current
            val c = if (selected) hud.primary else hud.dim
            Column(
                Modifier
                    .clickable(remember { MutableInteractionSource() }, null) { onSelect(s) }
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Canvas(Modifier.size(22.dp)) {
                    val w = 1.6.dp.toPx()
                    val st = Stroke(w, cap = StrokeCap.Round)
                    val sz = size.minDimension
                    val ctr = Offset(sz / 2, sz / 2)
                    when (s) {
                        Screen.CORE -> {
                            drawCircle(c, sz * 0.44f, ctr, style = st)
                            drawCircle(c, sz * 0.26f, ctr, style = st)
                            drawCircle(c, sz * 0.1f, ctr)
                        }
                        Screen.SCHEDULE -> {
                            drawCircle(c, sz * 0.44f, ctr, style = st)
                            drawLine(c, ctr, ctr + Offset(0f, -sz * 0.3f), w, StrokeCap.Round)
                            drawLine(c, ctr, ctr + Offset(sz * 0.22f, 0f), w, StrokeCap.Round)
                            drawArc(c.copy(alpha = 0.5f), -90f, 120f, true, Offset(sz * 0.06f, sz * 0.06f), Size(sz * 0.88f, sz * 0.88f))
                        }
                        Screen.FILES -> {
                            drawPath(Path().apply {
                                moveTo(sz * 0.12f, sz * 0.2f); lineTo(sz * 0.42f, sz * 0.2f); lineTo(sz * 0.52f, sz * 0.32f)
                                lineTo(sz * 0.88f, sz * 0.32f); lineTo(sz * 0.88f, sz * 0.84f); lineTo(sz * 0.12f, sz * 0.84f); close()
                            }, c, style = st)
                            drawLine(c, Offset(sz * 0.26f, sz * 0.52f), Offset(sz * 0.74f, sz * 0.52f), w)
                            drawLine(c, Offset(sz * 0.26f, sz * 0.66f), Offset(sz * 0.6f, sz * 0.66f), w)
                        }
                        Screen.SETTINGS -> {
                            for (i in 0 until 3) {
                                val y = sz * (0.22f + i * 0.28f)
                                drawLine(c, Offset(sz * 0.08f, y), Offset(sz * 0.92f, y), w, StrokeCap.Round)
                                val x = sz * listOf(0.3f, 0.7f, 0.45f)[i]
                                drawRect(c, Offset(x - sz * 0.08f, y - sz * 0.09f), Size(sz * 0.16f, sz * 0.18f))
                            }
                        }
                    }
                }
                Text(s.label, style = HudType.label(c, 7.sp, glowOn = selected))
                Canvas(Modifier.size(width = 24.dp, height = 2.dp)) {
                    if (selected) drawRect(c)
                }
            }
        }
    }
}
