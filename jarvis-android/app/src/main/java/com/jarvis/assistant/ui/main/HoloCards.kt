package com.jarvis.assistant.ui.main

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.text.drawText
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jarvis.assistant.services.WeatherService
import com.jarvis.assistant.tools.FileEntry
import com.jarvis.assistant.tools.ResultCard
import com.jarvis.assistant.tools.TimeText
import com.jarvis.assistant.ui.hud.DecodeText
import com.jarvis.assistant.ui.hud.LocalFrameTime
import com.jarvis.assistant.ui.hud.PanelHeader
import com.jarvis.assistant.ui.hud.ScrambleLabel
import com.jarvis.assistant.ui.hud.ToolGlyph
import com.jarvis.assistant.ui.hud.WeatherGlyph
import com.jarvis.assistant.ui.hud.hudPanel
import com.jarvis.assistant.ui.hud.hudProgress
import com.jarvis.assistant.ui.theme.HudType
import com.jarvis.assistant.ui.theme.LocalHud
import com.jarvis.assistant.ui.theme.LocalLiteMode
import kotlin.math.roundToInt

// ───────────────────────── 대화 로그 ─────────────────────────

/** 말풍선 대신 홀로그램 로그 창. > USER / ◆ JARVIS */
@Composable
fun HoloLog(logs: List<LogLine>, partial: String?, status: String?, modifier: Modifier = Modifier) {
    val hud = LocalHud.current
    val lite = LocalLiteMode.current
    val listState = rememberLazyListState()
    val lastText = logs.lastOrNull()?.text
    LaunchedEffect(logs.size, lastText?.length, partial) {
        val count = logs.size + (if (partial != null) 1 else 0) + (if (status != null) 1 else 0)
        if (count > 0) listState.animateScrollToItem(count - 1)
    }
    Box(modifier.hudPanel(hud.primary, fillAlpha = 0.05f, lite = lite).padding(horizontal = 10.dp, vertical = 8.dp)) {
        Column {
            PanelHeader("COMM LOG", "03")
            Spacer(Modifier.height(4.dp))
            LazyColumn(
                state = listState,
                verticalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.fillMaxWidth().fadingEdges(hud.bg),
            ) {
                items(logs, key = { it.id }) { line -> LogRow(line) }
                if (partial != null) {
                    item(key = "partial") {
                        Column {
                            Text("> USER  ·  RECEIVING", style = HudType.label(hud.dim, 8.sp, glowOn = false))
                            Text(partial.ifBlank { "▍" }, style = HudType.body(hud.secondary.copy(alpha = 0.7f), 14.sp))
                        }
                    }
                }
                if (status != null) {
                    item(key = "status") {
                        Text("// $status", style = HudType.tech(hud.warn, 12.sp))
                    }
                }
            }
        }
    }
}

@Composable
private fun LogRow(line: LogLine) {
    val hud = LocalHud.current
    Column {
        if (line.fromUser) {
            Text("> USER", style = HudType.label(hud.dim, 8.sp, glowOn = false))
            Text(line.text, style = HudType.body(hud.secondary.copy(alpha = 0.85f), 14.sp))
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (line.error) "◆ JARVIS  ·  FAULT" else "◆ JARVIS",
                    style = HudType.label(if (line.error) hud.danger else hud.primary, 8.sp),
                )
                if (line.streaming) {
                    Spacer(Modifier.width(6.dp))
                    Text("▮", style = HudType.label(hud.primary, 8.sp))
                }
            }
            DecodeText(
                text = line.text,
                style = HudType.body(if (line.error) hud.danger else hud.secondary, 15.sp, FontWeight.Medium),
                animate = line.animate,
            )
        }
    }
}

/** 로그 위/아래 가장자리를 배경색으로 흐리게 */
private fun Modifier.fadingEdges(bg: Color) = this.drawWithContent {
    drawContent()
    val h = 26.dp.toPx()
    drawRect(Brush.verticalGradient(listOf(bg.copy(alpha = 0.8f), bg.copy(alpha = 0.5f), Color.Transparent), startY = 0f, endY = h), size = Size(size.width, h))
}

// ───────────────────────── 실행 중 도구 카드 ─────────────────────────

@Composable
fun ExecutingCard(tool: ExecutingTool, modifier: Modifier = Modifier) {
    val hud = LocalHud.current
    val time = LocalFrameTime.current
    val appear = remember(tool.id) { Animatable(0f) }
    LaunchedEffect(tool.id) { appear.animateTo(1f, tween(380, easing = FastOutSlowInEasing)) }
    Box(
        modifier
            .graphicsLayer {
                alpha = appear.value
                scaleX = 0.6f + 0.4f * appear.value
                scaleY = 0.2f + 0.8f * appear.value
                translationX = (1f - appear.value) * -40f * density
            }
            .drawBehind { drawRect(hud.bg.copy(alpha = 0.8f)) }
            .hudPanel(hud.warn, fillAlpha = 0.09f)
            .padding(8.dp),
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                ToolGlyph(tool.category, hud.warn, Modifier.size(22.dp))
                Spacer(Modifier.width(6.dp))
                Column {
                    Text("EXECUTING", style = HudType.label(hud.warn.copy(alpha = 0.75f), 7.sp, glowOn = false))
                    ScrambleLabel(tool.label, HudType.label(hud.warn, 9.sp, FontWeight.Bold))
                }
            }
            Spacer(Modifier.height(5.dp))
            Canvas(Modifier.width(132.dp).height(4.dp)) {
                hudProgress(0f, hud.warn, indeterminatePhase = time.value * 0.9f)
            }
        }
    }
}

// ───────────────────────── 결과 카드 ─────────────────────────

@Composable
fun ResultCardView(entry: CardEntry, onDismiss: () -> Unit, modifier: Modifier = Modifier) {
    val hud = LocalHud.current
    val lite = LocalLiteMode.current
    // 홀로그램이 세로로 펼쳐지는 등장
    val unfold = remember(entry.id) { Animatable(0f) }
    LaunchedEffect(entry.id) { unfold.animateTo(1f, tween(520, easing = FastOutSlowInEasing)) }
    Box(
        modifier
            .graphicsLayer {
                scaleY = unfold.value
                alpha = (unfold.value * 1.4f).coerceAtMost(1f)
                transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 0f)
            }
            .drawBehind { drawRect(hud.bg.copy(alpha = 0.86f)) }
            .hudPanel(hud.primary, fillAlpha = 0.1f, lite = lite)
            .clickable(remember { MutableInteractionSource() }, null, onClick = onDismiss)
            .padding(10.dp),
    ) {
        when (val c = entry.card) {
            is ResultCard.Weather -> WeatherCard(c)
            is ResultCard.Events -> EventsCard(c)
            is ResultCard.News -> NewsCard(c)
            is ResultCard.Files -> FilesCard(c)
        }
    }
}

@Composable
private fun WeatherCard(c: ResultCard.Weather) {
    val hud = LocalHud.current
    Column {
        PanelHeader("ATMOSPHERIC SCAN", c.place.take(14).uppercase())
        Spacer(Modifier.height(6.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            WeatherGlyph(c.weatherCode, c.isDay, hud.secondary, Modifier.size(56.dp), accent = hud.primary)
            Spacer(Modifier.width(10.dp))
            Column {
                Text("${c.temperature.roundToInt()}°C", style = HudType.numeric(hud.secondary, 30.sp))
                Text(WeatherService.describe(c.weatherCode) + "  ·  체감 ${c.apparent.roundToInt()}°", style = HudType.body(hud.secondary, 12.sp))
            }
            Spacer(Modifier.weight(1f))
            Column(horizontalAlignment = Alignment.End) {
                Text("HI ${c.todayMax.roundToInt()}°", style = HudType.label(hud.warn, 9.sp))
                Text("LO ${c.todayMin.roundToInt()}°", style = HudType.label(hud.primary, 9.sp))
                if (c.humidity > 0) Text("HUM ${c.humidity}%", style = HudType.label(hud.dim, 8.sp, glowOn = false))
                if (c.windKmh > 0) Text("WND ${c.windKmh.roundToInt()}", style = HudType.label(hud.dim, 8.sp, glowOn = false))
            }
        }
        Spacer(Modifier.height(8.dp))
        TempGraph(c.hourlyTemps, c.hourlyPrecipProb, c.hourlyLabels, Modifier.fillMaxWidth().height(70.dp))
    }
}

/** 12시간 기온 꺾은선 + 강수확률 막대 */
@Composable
private fun TempGraph(temps: List<Double>, precip: List<Int>, labels: List<String>, modifier: Modifier) {
    val hud = LocalHud.current
    val time = LocalFrameTime.current
    val born = remember(temps) { floatArrayOf(time.value) }
    val measurer = androidx.compose.ui.text.rememberTextMeasurer()
    val labelStyle = HudType.label(hud.dim, 6.sp, glowOn = false)
    val valueStyle = HudType.label(hud.secondary, 7.sp, glowOn = false)
    Canvas(modifier) {
        if (temps.size < 2) return@Canvas
        val reveal = ((time.value - born[0]) / 0.9f).coerceIn(0f, 1f)
        val top = 12.dp.toPx()
        val bottom = size.height - 12.dp.toPx()
        val minT = temps.min()
        val maxT = temps.max().let { if (it - minT < 1) minT + 1 else it }
        val stepX = size.width / (temps.size - 1)
        // 강수 막대
        precip.forEachIndexed { i, p ->
            val h = (p / 100f) * (bottom - top) * 0.6f * reveal
            drawRect(hud.primary.copy(alpha = 0.16f), Offset(i * stepX - stepX * 0.3f, bottom - h), Size(stepX * 0.6f, h))
        }
        // 그리드
        for (k in 0..2) {
            val y = top + (bottom - top) * k / 2f
            drawLine(hud.primary.copy(alpha = 0.12f), Offset(0f, y), Offset(size.width, y), 1f)
        }
        val path = Path()
        val area = Path()
        temps.forEachIndexed { i, t ->
            val x = i * stepX
            val y = bottom - ((t - minT) / (maxT - minT)).toFloat() * (bottom - top)
            if (i == 0) { path.moveTo(x, y); area.moveTo(x, bottom); area.lineTo(x, y) } else { path.lineTo(x, y); area.lineTo(x, y) }
        }
        area.lineTo(size.width, bottom); area.close()
        clipRect(right = size.width * reveal) {
            drawPath(area, Brush.verticalGradient(listOf(hud.primary.copy(alpha = 0.3f), Color.Transparent), startY = top, endY = bottom))
            drawPath(path, hud.primary.copy(alpha = 0.3f), style = Stroke(6.dp.toPx(), cap = StrokeCap.Round))
            drawPath(path, hud.secondary, style = Stroke(1.6.dp.toPx(), cap = StrokeCap.Round))
        }
        temps.forEachIndexed { i, t ->
            if (i % 3 != 0 || i / (temps.size - 1f) > reveal) return@forEachIndexed
            val x = i * stepX
            val y = bottom - ((t - minT) / (maxT - minT)).toFloat() * (bottom - top)
            drawCircle(hud.secondary, 2.5.dp.toPx(), Offset(x, y))
            val v = measurer.measure("${t.roundToInt()}°", valueStyle)
            drawText(v, topLeft = Offset((x - v.size.width / 2f).coerceIn(0f, size.width - v.size.width), y - v.size.height - 2.dp.toPx()))
            labels.getOrNull(i)?.takeIf { it.isNotBlank() }?.let { l ->
                val lt = measurer.measure("${l}H", labelStyle)
                drawText(lt, topLeft = Offset((x - lt.size.width / 2f).coerceIn(0f, size.width - lt.size.width), size.height - lt.size.height))
            }
        }
    }
}

@Composable
private fun EventsCard(c: ResultCard.Events) {
    val hud = LocalHud.current
    Column {
        PanelHeader("SCHEDULE // ${c.title}", "${c.events.size}".padStart(2, '0'))
        Spacer(Modifier.height(6.dp))
        if (c.events.isEmpty()) {
            Text("NO ENTRIES", style = HudType.label(hud.dim, 9.sp))
            return@Column
        }
        // 세로 타임라인
        c.events.take(5).forEachIndexed { i, e ->
            Row(Modifier.fillMaxWidth().height(38.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (e.allDay) "ALL" else TimeText.iso(e.startMillis).substring(11, 16),
                    style = HudType.numeric(hud.primary, 12.sp),
                    modifier = Modifier.width(52.dp),
                )
                Canvas(Modifier.width(18.dp).height(38.dp)) {
                    val x = size.width / 2
                    if (i > 0) drawLine(hud.primary.copy(alpha = 0.4f), Offset(x, 0f), Offset(x, size.height / 2), 1.5.dp.toPx())
                    if (i < minOf(4, c.events.size - 1)) drawLine(hud.primary.copy(alpha = 0.4f), Offset(x, size.height / 2), Offset(x, size.height), 1.5.dp.toPx())
                    drawCircle(hud.primary.copy(alpha = 0.3f), 6.dp.toPx(), Offset(x, size.height / 2))
                    drawCircle(hud.secondary, 3.dp.toPx(), Offset(x, size.height / 2))
                }
                Spacer(Modifier.width(6.dp))
                Column(Modifier.weight(1f)) {
                    Text(e.title, style = HudType.body(hud.secondary, 13.sp, FontWeight.Medium), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(
                        (if (e.allDay) "종일" else TimeText.spokenTime(e.startMillis) + " – " + TimeText.spokenTime(e.endMillis)) + (e.location?.let { " · $it" } ?: ""),
                        style = HudType.body(hud.dim, 10.sp), maxLines = 1, overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

@Composable
private fun NewsCard(c: ResultCard.News) {
    val hud = LocalHud.current
    val uri = LocalUriHandler.current
    Column {
        PanelHeader("NEWS UPLINK // ${c.topic.take(12)}", "${c.items.size}".padStart(2, '0'))
        Spacer(Modifier.height(4.dp))
        c.items.take(5).forEachIndexed { i, n ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .clickable { runCatching { uri.openUri(n.link) } }
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Text("%02d".format(i + 1), style = HudType.numeric(hud.primary, 11.sp), modifier = Modifier.width(26.dp))
                Column(Modifier.weight(1f)) {
                    Text(n.title, style = HudType.body(hud.secondary, 13.sp), maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(n.source.uppercase(), style = HudType.label(hud.dim, 7.sp, glowOn = false))
                }
            }
        }
    }
}

@Composable
private fun FilesCard(c: ResultCard.Files) {
    val hud = LocalHud.current
    Column {
        PanelHeader("DATA // ${c.title}", "${c.entries.size}".padStart(2, '0'))
        Spacer(Modifier.height(4.dp))
        if (c.entries.isEmpty()) Text("QUEUE EMPTY", style = HudType.label(hud.dim, 9.sp))
        c.entries.take(5).forEach { FileRow(it) }
    }
}

@Composable
fun FileRow(e: FileEntry, modifier: Modifier = Modifier, strike: Float = if (e.done) 1f else 0f) {
    val hud = LocalHud.current
    val color = when {
        e.done -> hud.dim
        e.highlight -> hud.warn
        else -> hud.primary
    }
    Row(modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
        Canvas(Modifier.size(width = 3.dp, height = 30.dp)) { drawRect(color) }
        Spacer(Modifier.width(8.dp))
        Column(Modifier.weight(1f)) {
            Row {
                Text(e.code, style = HudType.label(color, 8.sp, FontWeight.Bold))
                Text("  /  ${e.meta}", style = HudType.label(hud.dim, 7.sp, glowOn = false), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Text(
                e.text,
                style = HudType.body(if (e.done) hud.dim else hud.secondary, 13.sp).copy(
                    textDecoration = if (strike >= 1f) TextDecoration.LineThrough else TextDecoration.None,
                ),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
