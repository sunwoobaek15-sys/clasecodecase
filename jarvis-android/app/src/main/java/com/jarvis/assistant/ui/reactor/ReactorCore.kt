package com.jarvis.assistant.ui.reactor

import android.graphics.Paint
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Spacer
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.sp
import com.jarvis.assistant.ui.hud.LocalFrameTime
import com.jarvis.assistant.ui.hud.hash
import com.jarvis.assistant.ui.theme.HudType
import com.jarvis.assistant.ui.theme.LocalHud
import com.jarvis.assistant.ui.theme.LocalLiteMode
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

enum class CoreMode { IDLE, LISTENING, THINKING, SPEAKING, EXECUTING, ERROR }

/** 프레임 사이에 유지되는 가변 상태 (스냅샷 상태가 아니므로 그리기 단계에서 자유롭게 갱신). */
private class ReactorRuntime {
    val angles = FloatArray(RING_COUNT)
    var lastT = -1f
    val spectrum = FloatArray(SPECTRUM_BARS)
    val eq = FloatArray(EQ_BARS)
    val lines = FloatArray(maxOf(TICKS, SPECTRUM_BARS, EQ_BARS) * 4)
    var glitchSeed = 0
    var glitchUntil = 0f
}

private const val RING_COUNT = 7
private const val TICKS = 120
private const val SPECTRUM_BARS = 96
private const val EQ_BARS = 64
private const val SUCK_PARTICLES = 46

/** 링별 기본 회전 속도 (도/초). 부호가 방향. */
private val BASE_SPEED = floatArrayOf(6f, -10f, 4f, 40f, -14f, 22f, -30f)

private val LABELS = listOf("047.3", "SYS.A1", "0xF3E", "NODE 7", "812", "Δ 0.92", "LINK", "CORE-3")

/**
 * 영화 속 홀로그램 리액터 코어.
 * 5~7겹 링이 각각 다른 방향/속도로 돌고, 상태에 따라 가속/역회전/스펙트럼/이퀄라이저/글리치 연출을 한다.
 *
 * [level] 마이크 음량, [speech] TTS 음절 엔벨로프 — 둘 다 그리기 단계에서만 읽는다.
 */
@Composable
fun ReactorCore(
    mode: CoreMode,
    level: () -> Float,
    speech: () -> Float,
    modifier: Modifier = Modifier,
    lowPower: Boolean = false,
    ignition: Float = 1f,
    onTap: () -> Unit = {},
    onLongPress: () -> Unit = {},
) {
    val hud = LocalHud.current
    val lite = LocalLiteMode.current
    val time = LocalFrameTime.current
    val runtime = remember { ReactorRuntime() }
    val measurer = rememberTextMeasurer()

    val power = if (lowPower) 0.35f else 1f
    val speedMul by animateFloatAsState(
        power * when (mode) {
            CoreMode.IDLE -> 1f
            CoreMode.LISTENING -> 2.4f
            CoreMode.THINKING -> 4.2f
            CoreMode.SPEAKING -> 1.6f
            CoreMode.EXECUTING -> 3f
            CoreMode.ERROR -> 0.4f
        },
        tween(700), label = "speed",
    )
    val counter by animateFloatAsState(if (mode == CoreMode.THINKING) 1f else 0f, tween(600), label = "counter")
    val bright by animateFloatAsState(
        when (mode) {
            CoreMode.IDLE -> if (lowPower) 0.7f else 0.85f
            CoreMode.LISTENING, CoreMode.EXECUTING -> 1.15f
            else -> 1f
        },
        tween(500), label = "bright",
    )
    val red by animateFloatAsState(if (mode == CoreMode.ERROR) 1f else 0f, tween(if (mode == CoreMode.ERROR) 120 else 900), label = "red")
    val spectrumAmt by animateFloatAsState(if (mode == CoreMode.LISTENING) 1f else 0f, tween(350), label = "spec")
    val eqAmt by animateFloatAsState(if (mode == CoreMode.SPEAKING) 1f else 0f, tween(350), label = "eq")
    val suckAmt by animateFloatAsState(if (mode == CoreMode.THINKING || mode == CoreMode.EXECUTING) 1f else 0f, tween(500), label = "suck")
    val processingText by animateFloatAsState(if (mode == CoreMode.THINKING) 1f else 0f, tween(300), label = "proc")

    val labelStyle = HudType.label(hud.primary, 7.sp, glowOn = false)
    val labelLayouts: List<TextLayoutResult> = remember(measurer, hud) { LABELS.map { measurer.measure(it, labelStyle) } }
    val processingLayout = remember(measurer, hud) { measurer.measure("PROCESSING", HudType.label(hud.secondary, 9.sp)) }
    val listeningLayout = remember(measurer, hud) { measurer.measure("LISTENING", HudType.label(hud.secondary, 9.sp)) }

    val tap by rememberUpdatedState(onTap)
    val longPress by rememberUpdatedState(onLongPress)

    Spacer(
        modifier
            .pointerInput(Unit) {
                detectTapGestures(onTap = { tap() }, onLongPress = { longPress() })
            }
            .drawWithCache {
                val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { strokeCap = Paint.Cap.BUTT }
                val unit = density
                onDrawBehind {
                    if (size.minDimension < 8f) return@onDrawBehind
                    val t = time.value
                    val dt = if (runtime.lastT < 0f) 0f else (t - runtime.lastT).coerceIn(0f, 0.1f)
                    runtime.lastT = t

                    // 링 회전 적분
                    for (i in 0 until RING_COUNT) {
                        val reverse = if (i % 2 == 1) -2.6f else 1.6f
                        val s = BASE_SPEED[i] * speedMul * (1f + counter * reverse)
                        runtime.angles[i] = (runtime.angles[i] + s * dt) % 360f
                    }

                    val baseColor = lerp(hud.primary, hud.danger, red)
                    val hi = lerp(hud.secondary, Color(0xFFFFD6DC), red)
                    val center = Offset(size.width / 2, size.height / 2)
                    val R = size.minDimension / 2f * 0.94f

                    // 오류 글리치: 위치 떨림 + RGB 분리
                    var jitter = Offset.Zero
                    if (red > 0.02f) {
                        if (t > runtime.glitchUntil) {
                            runtime.glitchSeed = Random.nextInt()
                            runtime.glitchUntil = t + 0.05f + Random.nextFloat() * 0.08f
                        }
                        val rnd = Random(runtime.glitchSeed)
                        jitter = Offset((rnd.nextFloat() - 0.5f) * 14f * unit * red, (rnd.nextFloat() - 0.5f) * 4f * unit * red)
                    }

                    // 블룸
                    val bloomR = R * 1.15f
                    drawCircle(
                        Brush.radialGradient(
                            listOf(baseColor.copy(alpha = 0.22f * bright * ignition), baseColor.copy(alpha = 0.06f * ignition), Color.Transparent),
                            center = center, radius = bloomR,
                        ),
                        bloomR, center,
                    )

                    if (red > 0.02f && !lite) {
                        translate(jitter.x + 4f * unit * red, 0f) {
                            drawRings(runtime, center, R, Color(0xFFFF2244).copy(alpha = 0.35f * red), hi, 0.5f, t, paint, unit, lite = true, labelLayouts = null, ignition = ignition)
                        }
                        translate(jitter.x - 4f * unit * red, 0f) {
                            drawRings(runtime, center, R, Color(0xFF00FFFF).copy(alpha = 0.25f * red), hi, 0.5f, t, paint, unit, lite = true, labelLayouts = null, ignition = ignition)
                        }
                    }

                    translate(jitter.x, jitter.y) {
                        drawRings(runtime, center, R, baseColor, hi, bright, t, paint, unit, lite, labelLayouts, ignition)

                        // 듣는 중: 360도 스펙트럼 바
                        if (spectrumAmt > 0.01f) drawSpectrum(runtime, center, R, baseColor, hi, level(), spectrumAmt, t, paint, unit)
                        // 생각 중: 코어로 빨려 들어가는 데이터 조각
                        if (suckAmt > 0.01f) drawSuck(center, R, baseColor, hi, suckAmt, t, unit)

                        // 코어
                        val pulse = when (mode) {
                            CoreMode.SPEAKING -> speech() * 0.38f
                            CoreMode.LISTENING -> level() * 0.22f + 0.03f * sin(t * 6f)
                            CoreMode.THINKING -> 0.07f * sin(t * 9f)
                            CoreMode.EXECUTING -> 0.05f * sin(t * 12f)
                            CoreMode.ERROR -> 0.1f * Random.nextFloat()
                            CoreMode.IDLE -> 0.06f * sin(t * 1.7f)
                        }
                        drawCore(center, R, baseColor, hi, pulse, bright * ignition, t, paint, unit, lite)

                        // 말하는 중: 원형 이퀄라이저
                        if (eqAmt > 0.01f) drawEqualizer(runtime, center, R, baseColor, hi, speech(), eqAmt, t, paint, unit)
                    }

                    // 오류 찢김 띠
                    if (red > 0.3f) {
                        val rnd = Random(runtime.glitchSeed + 7)
                        repeat(3) {
                            val y = center.y - R + rnd.nextFloat() * R * 2
                            val h = (2f + rnd.nextFloat() * 8f) * unit
                            drawRect(hud.danger.copy(alpha = 0.18f * red), Offset(center.x - R, y), Size(R * 2, h))
                        }
                    }

                    // 상태 텍스트 (링 위에서도 읽히도록 어두운 받침판)
                    val label = when {
                        processingText > 0.01f -> processingLayout to processingText * (if ((t * 2.5f).toInt() % 2 == 0) 1f else 0.35f)
                        spectrumAmt > 0.5f -> listeningLayout to spectrumAmt * (0.65f + 0.35f * sin(t * 4f))
                        else -> null
                    }
                    if (label != null) {
                        val (layout, alpha) = label
                        val pad = 6f * unit
                        val tl = Offset(center.x - layout.size.width / 2f, center.y + R * 0.6f)
                        val plateTl = tl - Offset(pad * 1.6f, pad * 0.7f)
                        val plateSize = Size(layout.size.width + pad * 3.2f, layout.size.height + pad * 1.4f)
                        drawRect(hud.bg.copy(alpha = 0.82f * alpha.coerceAtLeast(0.6f)), plateTl, plateSize)
                        drawRect(hud.primary.copy(alpha = 0.7f), plateTl, plateSize, style = Stroke(1f * unit))
                        drawText(layout, topLeft = tl, alpha = alpha)
                    }
                }
            },
    )
}

private fun DrawScope.nativeLines(lines: FloatArray, count: Int, color: Color, width: Float, paint: Paint) {
    paint.color = color.toArgb()
    paint.strokeWidth = width
    paint.style = Paint.Style.STROKE
    drawIntoCanvas { it.nativeCanvas.drawLines(lines, 0, count * 4, paint) }
}

private fun DrawScope.drawRings(
    rt: ReactorRuntime,
    c: Offset,
    R: Float,
    color: Color,
    hi: Color,
    bright: Float,
    t: Float,
    paint: Paint,
    unit: Float,
    lite: Boolean,
    labelLayouts: List<TextLayoutResult>?,
    ignition: Float,
) {
    val a = rt.angles
    val glow = !lite
    // 점화 연출: ignition 0→1 동안 바깥 링부터 차례로 그려진다
    fun reveal(i: Int): Float = ((ignition * (RING_COUNT + 1)) - i).coerceIn(0f, 1f)
    fun alpha(x: Float) = (x * bright).coerceIn(0f, 1f)

    // ── 1. 바깥 눈금 링 (r=1.0)
    run {
        val rv = reveal(0); if (rv <= 0f) return@run
        val r = R
        drawCircle(color.copy(alpha = alpha(0.22f)), r, c, style = Stroke(1f * unit))
        val n = (TICKS * rv).toInt()
        var k = 0
        val base = Math.toRadians(a[0].toDouble())
        for (i in 0 until n) {
            val ang = base + i * 2 * PI / TICKS
            val len = if (i % 10 == 0) R * 0.075f else if (i % 5 == 0) R * 0.05f else R * 0.03f
            val cs = cos(ang).toFloat(); val sn = sin(ang).toFloat()
            rt.lines[k++] = c.x + cs * r; rt.lines[k++] = c.y + sn * r
            rt.lines[k++] = c.x + cs * (r - len); rt.lines[k++] = c.y + sn * (r - len)
        }
        if (glow) nativeLines(rt.lines, n, color.copy(alpha = alpha(0.18f)), 3f * unit, paint)
        nativeLines(rt.lines, n, color.copy(alpha = alpha(0.7f)), 1f * unit, paint)
    }

    // ── 2. 굵은 호 조각 (r=0.9)
    run {
        val rv = reveal(1); if (rv <= 0f) return@run
        val r = R * 0.885f
        val w = 4f * unit
        val segs = floatArrayOf(0f, 62f, 78f, 24f, 118f, 90f, 222f, 40f, 276f, 64f)
        for (s in segs.indices step 2) {
            val sweep = segs[s + 1] * rv
            arc(c, r, a[1] + segs[s], sweep, color.copy(alpha = alpha(0.9f)), w, glow, unit)
        }
        // 작은 꺾쇠 표식
        for (s in 0 until 4) {
            val ang = Math.toRadians((a[1] + 45f + s * 90f).toDouble())
            val p1 = c + Offset(cos(ang).toFloat(), sin(ang).toFloat()) * (r + 7f * unit)
            drawCircle(hi.copy(alpha = alpha(0.9f) * rv), 1.6f * unit, p1)
        }
    }

    // ── 3. 점선 링 + 회전 라벨 (r=0.8)
    run {
        val rv = reveal(2); if (rv <= 0f) return@run
        val r = R * 0.79f
        for (i in 0 until 60) {
            if (i / 60f > rv) break
            val start = a[2] + i * 6f
            arc(c, r, start, 3.2f, color.copy(alpha = alpha(if (i % 3 == 0) 0.75f else 0.35f)), 1.5f * unit, false, unit)
        }
        if (labelLayouts != null && rv >= 1f) {
            labelLayouts.forEachIndexed { i, layout ->
                val deg = a[2] + i * (360f / labelLayouts.size) + 4f
                rotate(deg + 90f, c) {
                    drawText(
                        layout,
                        topLeft = Offset(c.x - layout.size.width / 2f, c.y - r - layout.size.height - 3f * unit),
                        alpha = alpha(0.75f),
                    )
                }
            }
        }
    }

    // ── 4. 이중 얇은 링 + 스캐너 (r=0.70)
    run {
        val rv = reveal(3); if (rv <= 0f) return@run
        val r1 = R * 0.70f
        val r2 = R * 0.665f
        arc(c, r1, a[3] * 0.1f, 360f * rv, color.copy(alpha = alpha(0.3f)), 1f * unit, false, unit)
        arc(c, r2, -a[3] * 0.1f, 360f * rv, color.copy(alpha = alpha(0.2f)), 1f * unit, false, unit)
        if (rv >= 1f) {
            for (s in 0 until 3) {
                val head = a[3] + s * 120f
                // 꼬리가 흐려지는 스캐너
                for (k in 0 until 6) {
                    arc(c, (r1 + r2) / 2, head - k * 5f, 5f, hi.copy(alpha = alpha(0.85f - k * 0.14f)), 3f * unit, glow && k == 0, unit)
                }
            }
        }
    }

    // ── 5. 세그먼트 링 (r=0.58) — 데이터 깜빡임
    run {
        val rv = reveal(4); if (rv <= 0f) return@run
        val r = R * 0.575f
        val w = 7f * unit
        val tick = (t * 3f).toInt()
        for (i in 0 until 36) {
            if (i / 36f > rv) break
            val on = hash(i * 31 + tick / 2) > 0.35f
            val al = if (on) 0.55f + 0.35f * hash(i + tick) else 0.12f
            arc(c, r, a[4] + i * 10f, 7f, color.copy(alpha = alpha(al)), w, false, unit)
        }
    }

    // ── 6. 삼각 표식 + 얇은 링 (r=0.47)
    run {
        val rv = reveal(5); if (rv <= 0f) return@run
        val r = R * 0.465f
        arc(c, r, a[5], 360f * rv, color.copy(alpha = alpha(0.45f)), 1f * unit, false, unit)
        if (rv >= 1f) {
            for (i in 0 until 8) {
                val ang = Math.toRadians((a[5] + i * 45f).toDouble())
                val dir = Offset(cos(ang).toFloat(), sin(ang).toFloat())
                val perp = Offset(-dir.y, dir.x)
                val tip = c + dir * (r - 3f * unit)
                val b1 = c + dir * (r + 6f * unit) + perp * 4f * unit
                val b2 = c + dir * (r + 6f * unit) - perp * 4f * unit
                drawPath(Path().apply { moveTo(tip.x, tip.y); lineTo(b1.x, b1.y); lineTo(b2.x, b2.y); close() }, hi.copy(alpha = alpha(if (i % 2 == 0) 0.9f else 0.45f)))
            }
        }
    }

    // ── 7. 안쪽 굵은 발광 링 (r=0.36)
    run {
        val rv = reveal(6); if (rv <= 0f) return@run
        val r = R * 0.355f
        arc(c, r, a[6], 360f * rv, color.copy(alpha = alpha(0.95f)), 2.6f * unit, glow, unit)
        if (rv >= 1f) {
            for (i in 0 until 4) {
                arc(c, r + 5f * unit, a[6] + i * 90f + 20f, 30f, hi.copy(alpha = alpha(0.7f)), 1.4f * unit, false, unit)
            }
        }
    }
}

private fun DrawScope.arc(c: Offset, r: Float, start: Float, sweep: Float, color: Color, width: Float, glow: Boolean, unit: Float) {
    val tl = Offset(c.x - r, c.y - r)
    val sz = Size(r * 2, r * 2)
    if (glow) drawArc(color.copy(alpha = color.alpha * 0.28f), start, sweep, false, tl, sz, style = Stroke(width + 6f * unit, cap = StrokeCap.Butt))
    drawArc(color, start, sweep, false, tl, sz, style = Stroke(width, cap = StrokeCap.Butt))
}

private fun DrawScope.drawCore(c: Offset, R: Float, color: Color, hi: Color, pulse: Float, bright: Float, t: Float, paint: Paint, unit: Float, lite: Boolean) {
    val coreR = R * 0.24f * (1f + pulse)
    // 바깥 후광
    drawCircle(
        Brush.radialGradient(
            listOf(color.copy(alpha = 0.55f * bright), color.copy(alpha = 0.12f * bright), Color.Transparent),
            center = c, radius = coreR * 1.9f,
        ),
        coreR * 1.9f, c,
    )
    // 방사형 광선
    val rays = if (lite) 16 else 28
    val lines = FloatArray(rays * 4)
    for (i in 0 until rays) {
        val ang = i * 2 * PI / rays + t * 0.25
        val len = coreR * (1.05f + 0.55f * (0.5f + 0.5f * sin(t * 2.3f + i * 1.7f)))
        val cs = cos(ang).toFloat(); val sn = sin(ang).toFloat()
        lines[i * 4] = c.x + cs * coreR * 0.55f; lines[i * 4 + 1] = c.y + sn * coreR * 0.55f
        lines[i * 4 + 2] = c.x + cs * len; lines[i * 4 + 3] = c.y + sn * len
    }
    nativeLines(lines, rays, hi.copy(alpha = (0.35f * bright).coerceIn(0f, 1f)), 1.2f * unit, paint)
    // 코어 본체
    drawCircle(
        Brush.radialGradient(
            0f to Color.White.copy(alpha = (0.98f * bright).coerceIn(0f, 1f)),
            0.28f to hi.copy(alpha = (0.95f * bright).coerceIn(0f, 1f)),
            0.62f to color.copy(alpha = (0.75f * bright).coerceIn(0f, 1f)),
            1f to Color.Transparent,
            center = c, radius = coreR,
        ),
        coreR, c,
    )
    // 코어 테두리 링
    drawCircle(hi.copy(alpha = (0.7f * bright).coerceIn(0f, 1f)), coreR * 0.78f, c, style = Stroke(1.2f * unit))
}

private fun DrawScope.drawSpectrum(rt: ReactorRuntime, c: Offset, R: Float, color: Color, hi: Color, level: Float, amt: Float, t: Float, paint: Paint, unit: Float) {
    val inner = R * 0.39f
    var k = 0
    for (i in 0 until SPECTRUM_BARS) {
        val n = 0.35f + 0.65f * (0.5f + 0.5f * sin(t * 13f + i * 0.9f) * sin(t * 7.3f + i * 0.37f))
        val target = (0.06f + level * n) * amt
        rt.spectrum[i] += (target - rt.spectrum[i]) * 0.35f
        val len = R * 0.2f * rt.spectrum[i]
        val ang = i * 2 * PI / SPECTRUM_BARS - PI / 2
        val cs = cos(ang).toFloat(); val sn = sin(ang).toFloat()
        rt.lines[k++] = c.x + cs * inner; rt.lines[k++] = c.y + sn * inner
        rt.lines[k++] = c.x + cs * (inner + len); rt.lines[k++] = c.y + sn * (inner + len)
    }
    nativeLines(rt.lines, SPECTRUM_BARS, color.copy(alpha = 0.3f * amt), 4.5f * unit, paint)
    nativeLines(rt.lines, SPECTRUM_BARS, hi.copy(alpha = 0.95f * amt), 1.8f * unit, paint)
}

private fun DrawScope.drawEqualizer(rt: ReactorRuntime, c: Offset, R: Float, color: Color, hi: Color, env: Float, amt: Float, t: Float, paint: Paint, unit: Float) {
    val inner = R * 0.27f
    var k = 0
    for (i in 0 until EQ_BARS) {
        // 좌우 대칭 이퀄라이저
        val mirror = if (i < EQ_BARS / 2) i else EQ_BARS - 1 - i
        val n = 0.3f + 0.7f * (0.5f + 0.5f * sin(t * 17f + mirror * 0.8f))
        val target = (0.05f + env * n) * amt
        rt.eq[i] += (target - rt.eq[i]) * 0.45f
        val len = R * 0.11f * rt.eq[i]
        val ang = i * 2 * PI / EQ_BARS - PI / 2
        val cs = cos(ang).toFloat(); val sn = sin(ang).toFloat()
        rt.lines[k++] = c.x + cs * inner; rt.lines[k++] = c.y + sn * inner
        rt.lines[k++] = c.x + cs * (inner + len); rt.lines[k++] = c.y + sn * (inner + len)
    }
    nativeLines(rt.lines, EQ_BARS, color.copy(alpha = 0.35f * amt), 5f * unit, paint)
    nativeLines(rt.lines, EQ_BARS, hi.copy(alpha = amt), 2.2f * unit, paint)
}

private fun DrawScope.drawSuck(c: Offset, R: Float, color: Color, hi: Color, amt: Float, t: Float, unit: Float) {
    for (i in 0 until SUCK_PARTICLES) {
        val seed = hash(i * 7 + 3)
        val p = ((t * (0.45f + seed * 0.5f) + hash(i * 11 + 5)) % 1f)
        val ang = hash(i * 13 + 1) * 2 * PI + t * 0.4
        val dist = R * (1.08f - p * 0.82f)
        val dir = Offset(cos(ang).toFloat(), sin(ang).toFloat())
        val head = c + dir * dist
        val tail = c + dir * (dist + R * (0.025f + 0.05f * p))
        val al = (p * p * amt).coerceIn(0f, 1f)
        drawLine(if (i % 4 == 0) hi.copy(alpha = al) else color.copy(alpha = al * 0.8f), tail, head, (1f + p * 1.5f) * unit)
        if (i % 5 == 0) drawRect(hi.copy(alpha = al * 0.8f), head - Offset(1.5f * unit, 1.5f * unit), Size(3f * unit, 3f * unit))
    }
}
