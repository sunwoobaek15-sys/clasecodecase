package com.jarvis.assistant.ui.main

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jarvis.assistant.services.WeatherService
import com.jarvis.assistant.tools.EventItem
import com.jarvis.assistant.tools.NewsItem
import com.jarvis.assistant.ui.hud.CircularGauge
import com.jarvis.assistant.ui.hud.LocalFrameTime
import com.jarvis.assistant.ui.hud.PanelHeader
import com.jarvis.assistant.ui.hud.WeatherGlyph
import com.jarvis.assistant.ui.hud.hudPanel
import com.jarvis.assistant.ui.theme.HudType
import com.jarvis.assistant.ui.theme.LocalHud
import com.jarvis.assistant.ui.theme.LocalLiteMode
import kotlinx.coroutines.delay
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** 1초마다 갱신되는 현재 시각 (패널 텍스트용) */
@Composable
fun rememberNow(): Long {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            now = System.currentTimeMillis()
            delay(1000 - now % 1000)
        }
    }
    return now
}

// ───────────────────────── 좌상단: 시계 ─────────────────────────

@Composable
fun ClockPanel(modifier: Modifier = Modifier) {
    val hud = LocalHud.current
    val lite = LocalLiteMode.current
    val time = LocalFrameTime.current
    val now = rememberNow()
    val dt = LocalDateTime.ofInstant(java.time.Instant.ofEpochMilli(now), java.time.ZoneId.systemDefault())
    Box(modifier.hudPanel(hud.primary, lite = lite).padding(10.dp)) {
        Column {
            PanelHeader("CHRONOMETER", "01")
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                // 초 단위 회전 게이지
                Canvas(Modifier.size(42.dp)) {
                    val sec = (System.currentTimeMillis() % 60_000) / 60_000f
                    val r = size.minDimension / 2 - 3.dp.toPx()
                    val c = Offset(size.width / 2, size.height / 2)
                    for (i in 0 until 60) {
                        val a = Math.toRadians(i * 6.0 - 90)
                        val on = i / 60f <= sec
                        val len = if (i % 5 == 0) 5.dp.toPx() else 2.5.dp.toPx()
                        drawLine(
                            (if (on) hud.primary else hud.dim).copy(alpha = if (on) 0.95f else 0.25f),
                            c + Offset(kotlin.math.cos(a).toFloat(), kotlin.math.sin(a).toFloat()) * r,
                            c + Offset(kotlin.math.cos(a).toFloat(), kotlin.math.sin(a).toFloat()) * (r - len),
                            1.2.dp.toPx(),
                        )
                    }
                    val spin = (time.value * 120f) % 360f
                    drawArc(hud.secondary.copy(alpha = 0.8f), spin, 40f, false, Offset(c.x - r * 0.55f, c.y - r * 0.55f), Size(r * 1.1f, r * 1.1f), style = Stroke(1.5.dp.toPx()))
                    drawCircle(hud.primary, 2.dp.toPx(), c)
                }
                Spacer(Modifier.width(8.dp))
                Column {
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(dt.format(DateTimeFormatter.ofPattern("HH:mm")), style = HudType.numeric(hud.secondary, 25.sp), maxLines = 1, softWrap = false)
                        Text(
                            dt.format(DateTimeFormatter.ofPattern(":ss")),
                            style = HudType.numeric(hud.primary, 11.sp, weight = androidx.compose.ui.text.font.FontWeight.Medium),
                            maxLines = 1,
                            softWrap = false,
                            modifier = Modifier.padding(bottom = 4.dp, start = 2.dp),
                        )
                    }
                    Text(
                        dt.format(DateTimeFormatter.ofPattern("yyyy.MM.dd  EEE", Locale.ENGLISH)).uppercase(),
                        style = HudType.label(hud.primary.copy(alpha = 0.8f), 8.sp, glowOn = false),
                    )
                }
            }
        }
    }
}

// ───────────────────────── 우상단: 날씨 ─────────────────────────

@Composable
fun WeatherPanel(weather: WeatherSnapshot?, modifier: Modifier = Modifier) {
    val hud = LocalHud.current
    val lite = LocalLiteMode.current
    Box(modifier.hudPanel(hud.primary, lite = lite).padding(10.dp)) {
        Column {
            PanelHeader("ATMOSPHERE", "02")
            Spacer(Modifier.height(4.dp))
            if (weather == null) {
                Text("SENSOR OFFLINE", style = HudType.label(hud.dim, 9.sp))
                Text("위치 권한 또는 네트워크 확인", style = HudType.body(hud.dim, 11.sp))
                return@Column
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                WeatherGlyph(weather.code, weather.isDay, hud.secondary, Modifier.size(40.dp), accent = hud.primary)
                Spacer(Modifier.width(6.dp))
                Column {
                    Text("${weather.temp}°", style = HudType.numeric(hud.secondary, 24.sp))
                    Text(
                        "${weather.max}° / ${weather.min}°",
                        style = HudType.label(hud.primary.copy(alpha = 0.85f), 8.sp, glowOn = false),
                    )
                }
                Spacer(Modifier.width(6.dp))
                Column(Modifier.weight(1f)) {
                    Text(WeatherService.describe(weather.code), style = HudType.body(hud.secondary, 12.sp), maxLines = 1)
                    Text(weather.place, style = HudType.body(hud.dim, 10.sp), maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            Spacer(Modifier.height(4.dp))
            PrecipGraph(weather.hourlyPrecip, Modifier.fillMaxWidth().height(20.dp))
        }
    }
}

/** 12시간 강수확률 미니 막대 그래프 */
@Composable
fun PrecipGraph(values: List<Int>, modifier: Modifier = Modifier) {
    val hud = LocalHud.current
    val measurer = rememberTextMeasurer()
    val label = remember(measurer) { measurer.measure("PRECIP 12H", HudType.label(hud.dim, 6.sp, glowOn = false)) }
    Canvas(modifier) {
        if (values.isEmpty()) return@Canvas
        val n = values.size
        val gap = 2.dp.toPx()
        val barW = (size.width - gap * (n - 1)) / n
        values.forEachIndexed { i, v ->
            val h = (v / 100f).coerceIn(0.04f, 1f) * (size.height - 2.dp.toPx())
            val x = i * (barW + gap)
            val col = if (v >= 60) hud.warn else hud.primary
            drawRect(col.copy(alpha = 0.18f), Offset(x, 0f), Size(barW, size.height))
            drawRect(col.copy(alpha = 0.85f), Offset(x, size.height - h), Size(barW, h))
        }
        drawText(label, topLeft = Offset(2.dp.toPx(), 0f))
    }
}

// ───────────────────────── 좌하단: 다음 일정 ─────────────────────────

@Composable
fun NextEventPanel(event: EventItem?, modifier: Modifier = Modifier) {
    val hud = LocalHud.current
    val lite = LocalLiteMode.current
    val now = rememberNow()
    Box(modifier.hudPanel(hud.primary, lite = lite).padding(10.dp)) {
        Column {
            PanelHeader("NEXT EVENT", "04")
            Spacer(Modifier.height(4.dp))
            if (event == null) {
                Text("NO EVENTS IN QUEUE", style = HudType.label(hud.dim, 8.sp))
                Text("7일 내 예정된 일정 없음", style = HudType.body(hud.dim, 11.sp))
                return@Column
            }
            val remain = ((event.startMillis - now) / 1000).coerceAtLeast(0)
            val h = remain / 3600
            val m = (remain % 3600) / 60
            val s = remain % 60
            val urgent = remain < 15 * 60
            Text("IN", style = HudType.label(hud.primary.copy(alpha = 0.7f), 7.sp, glowOn = false))
            Text(
                if (h >= 100) "%dD %02dH".format(h / 24, h % 24) else "%02d:%02d:%02d".format(h, m, s),
                style = HudType.numeric(if (urgent) hud.warn else hud.secondary, 18.sp),
            )
            Text(event.title, style = HudType.body(hud.secondary, 12.sp, androidx.compose.ui.text.font.FontWeight.Medium), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(
                com.jarvis.assistant.tools.TimeText.spoken(event.startMillis) + (event.location?.let { " · $it" } ?: ""),
                style = HudType.body(hud.dim, 10.sp), maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

// ───────────────────────── 우하단: 시스템 게이지 ─────────────────────────

@Composable
fun SystemPanel(system: SystemSnapshot?, modifier: Modifier = Modifier) {
    val hud = LocalHud.current
    val lite = LocalLiteMode.current
    Box(modifier.hudPanel(hud.primary, lite = lite).padding(10.dp)) {
        Column {
            PanelHeader("SYSTEM STATUS", "05")
            Spacer(Modifier.height(6.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                val b = system?.battery
                CircularGauge(
                    fraction = (b?.percent ?: 0) / 100f,
                    label = if (b?.charging == true) "CHRG" else "PWR",
                    valueText = b?.let { "${it.percent}" } ?: "--",
                    color = when {
                        b == null -> hud.dim
                        b.percent <= 15 -> hud.danger
                        b.percent <= 30 -> hud.warn
                        else -> hud.primary
                    },
                    modifier = Modifier.size(54.dp),
                )
                val n = system?.network
                CircularGauge(
                    fraction = n?.strength ?: 0f,
                    label = n?.type ?: "NET",
                    valueText = if (n?.connected == true) "${(n.strength * 100).toInt()}" else "OFF",
                    color = if (n?.connected == true) hud.primary else hud.danger,
                    modifier = Modifier.size(54.dp),
                )
                val st = system?.storage
                CircularGauge(
                    fraction = st?.usedFraction ?: 0f,
                    label = "DISK",
                    valueText = st?.let { "${(it.usedFraction * 100).toInt()}" } ?: "--",
                    color = if ((st?.usedFraction ?: 0f) > 0.9f) hud.warn else hud.primary,
                    modifier = Modifier.size(54.dp),
                )
            }
        }
    }
}

// ───────────────────────── 하단 띠: 뉴스 티커 ─────────────────────────

@Composable
fun NewsTicker(items: List<NewsItem>, modifier: Modifier = Modifier) {
    val hud = LocalHud.current
    val time = LocalFrameTime.current
    val text = if (items.isEmpty()) "◆ NEWS UPLINK STANDBY ◆ 뉴스 피드를 수신하는 중입니다" else
        items.joinToString("     ◆     ") { "${it.title}  [${it.source}]" }
    Row(
        modifier
            .height(26.dp)
            .drawWithCache {
                val bg = Brush.horizontalGradient(listOf(hud.primary.copy(alpha = 0.16f), hud.primary.copy(alpha = 0.04f), hud.primary.copy(alpha = 0.16f)))
                onDrawBehind {
                    drawRect(bg)
                    drawLine(hud.primary.copy(alpha = 0.6f), Offset(0f, 0f), Offset(size.width, 0f), 1.dp.toPx())
                    drawLine(hud.primary.copy(alpha = 0.3f), Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx())
                }
            },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .height(26.dp)
                .drawWithCache {
                    val p = Path().apply {
                        moveTo(0f, 0f); lineTo(size.width - 8.dp.toPx(), 0f); lineTo(size.width, size.height); lineTo(0f, size.height); close()
                    }
                    onDrawBehind { drawPath(p, hud.primary) }
                }
                .padding(start = 8.dp, end = 14.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text("LIVE", style = HudType.label(hud.bg, 9.sp, androidx.compose.ui.text.font.FontWeight.Black, glowOn = false))
        }
        // 전광판처럼 흐르는 텍스트: 측정 후 그리기 단계에서 x 이동
        Layout(
            content = {
                Text(text, style = HudType.body(hud.secondary, 12.sp, androidx.compose.ui.text.font.FontWeight.Medium), maxLines = 1, softWrap = false)
            },
            modifier = Modifier.weight(1f).clipToBounds(),
        ) { measurables, constraints ->
            val placeable = measurables.first().measure(Constraints(maxHeight = constraints.maxHeight))
            val w = constraints.maxWidth
            layout(w, placeable.height) {
                placeable.placeWithLayer(0, 0) {
                    val speed = 42f * density
                    val span = placeable.width + w
                    translationX = w - ((time.value * speed) % span)
                }
            }
        }
    }
}

/** 상단 상태줄: 코어 상태 + 모드 라벨 */
@Composable
fun StatusStrip(mode: String, apiReady: Boolean, modifier: Modifier = Modifier) {
    val hud = LocalHud.current
    val time = LocalFrameTime.current
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Canvas(Modifier.size(8.dp)) {
            val blink = 0.4f + 0.6f * (0.5f + 0.5f * kotlin.math.sin(time.value * 4f))
            drawCircle((if (apiReady) hud.primary else hud.warn).copy(alpha = blink), size.minDimension / 2)
        }
        Spacer(Modifier.width(6.dp))
        Text("J.A.R.V.I.S.", style = HudType.label(hud.secondary, 10.sp, androidx.compose.ui.text.font.FontWeight.Bold))
        Spacer(Modifier.width(8.dp))
        Text("v1.0 // ", style = HudType.label(hud.dim, 8.sp, glowOn = false))
        Text(mode, style = HudType.label(hud.primary, 8.sp))
        Spacer(Modifier.weight(1f))
        Text(if (apiReady) "NEURAL LINK ●" else "NEURAL LINK ○ NO KEY", style = HudType.label(if (apiReady) hud.primary else hud.warn, 8.sp, glowOn = apiReady))
    }
}
