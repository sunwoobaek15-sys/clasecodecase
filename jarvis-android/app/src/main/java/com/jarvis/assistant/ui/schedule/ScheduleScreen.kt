package com.jarvis.assistant.ui.schedule

import android.Manifest
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jarvis.assistant.services.CalendarRepository
import com.jarvis.assistant.tools.EventItem
import com.jarvis.assistant.tools.PermissionGate
import com.jarvis.assistant.tools.TimeText
import com.jarvis.assistant.ui.hud.HudButton
import com.jarvis.assistant.ui.hud.LocalFrameTime
import com.jarvis.assistant.ui.hud.PanelHeader
import com.jarvis.assistant.ui.hud.ScrambleLabel
import com.jarvis.assistant.ui.hud.hudPanel
import com.jarvis.assistant.ui.theme.HudType
import com.jarvis.assistant.ui.theme.LocalHud
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun ScheduleScreen(calendar: CalendarRepository, permissions: PermissionGate) {
    val hud = LocalHud.current
    val scope = rememberCoroutineScope()
    var day by remember { mutableStateOf(LocalDate.now()) }
    var events by remember { mutableStateOf<List<EventItem>>(emptyList()) }
    var canRead by remember { mutableStateOf(calendar.canRead()) }
    var reload by remember { mutableStateOf(0) }

    LaunchedEffect(day, canRead, reload) {
        if (!canRead) return@LaunchedEffect
        val zone = ZoneId.systemDefault()
        events = calendar.events(day.atStartOfDay(zone).toInstant().toEpochMilli(), day.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli())
    }

    Column(Modifier.fillMaxSize().padding(horizontal = 12.dp)) {
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            HudButton("◀", { day = day.minusDays(1) })
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                ScrambleLabel(
                    day.format(DateTimeFormatter.ofPattern("yyyy.MM.dd  EEE", Locale.ENGLISH)).uppercase(),
                    HudType.numeric(hud.secondary, 16.sp),
                )
                Text(
                    if (day == LocalDate.now()) "TODAY · 24H RADAR" else "24H RADAR",
                    style = HudType.label(hud.primary.copy(alpha = 0.7f), 8.sp, glowOn = false),
                )
            }
            HudButton("▶", { day = day.plusDays(1) })
        }
        Spacer(Modifier.height(8.dp))
        Box(Modifier.fillMaxWidth().aspectRatio(1f).padding(8.dp), contentAlignment = Alignment.Center) {
            RadarDial(events, day == LocalDate.now(), Modifier.fillMaxSize())
            if (!canRead) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("CALENDAR LINK OFFLINE", style = HudType.label(hud.warn, 10.sp))
                    Spacer(Modifier.height(8.dp))
                    HudButton("GRANT ACCESS", {
                        scope.launch {
                            canRead = permissions.ensure(
                                listOf(Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR),
                                "일정을 다이얼에 표시하려면 캘린더 권한이 필요합니다.",
                            )
                            reload++
                        }
                    })
                }
            }
        }
        Box(Modifier.weight(1f).fillMaxWidth().hudPanel(hud.primary).padding(10.dp)) {
            Column {
                PanelHeader("EVENT LIST", "%02d".format(events.size))
                Spacer(Modifier.height(6.dp))
                if (events.isEmpty()) {
                    Text(if (canRead) "NO ENTRIES FOR THIS CYCLE" else "—", style = HudType.label(hud.dim, 9.sp))
                }
                LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(events, key = { it.id.toString() + it.startMillis }) { e ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.width(64.dp)) {
                                Text(if (e.allDay) "ALL" else TimeText.iso(e.startMillis).substring(11, 16), style = HudType.numeric(hud.primary, 13.sp))
                                if (!e.allDay) Text(TimeText.iso(e.endMillis).substring(11, 16), style = HudType.label(hud.dim, 8.sp, glowOn = false))
                            }
                            Canvas(Modifier.width(3.dp).height(32.dp)) { drawRect(hud.primary) }
                            Spacer(Modifier.width(8.dp))
                            Column(Modifier.weight(1f)) {
                                Text(e.title, style = HudType.body(hud.secondary, 14.sp, FontWeight.Medium), maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text("EVT_%04d".format(e.id % 10000) + (e.location?.let { "  ·  $it" } ?: ""), style = HudType.body(hud.dim, 10.sp), maxLines = 1)
                            }
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(4.dp))
    }
}

/** 원형 24시간 다이얼 위에 일정이 호(arc)로 표시되는 레이더형 타임라인 */
@Composable
private fun RadarDial(events: List<EventItem>, isToday: Boolean, modifier: Modifier) {
    val hud = LocalHud.current
    val time = LocalFrameTime.current
    val measurer = rememberTextMeasurer()
    val hourLabels = remember(measurer) {
        (0 until 24 step 3).associateWith { h -> measurer.measure("%02d".format(h), HudType.label(hud.primary, 8.sp, glowOn = false)) }
    }
    val nowLabelStyle = HudType.numeric(hud.secondary, 18.sp)
    val subStyle = HudType.label(hud.dim, 7.sp, glowOn = false)
    Canvas(modifier) {
        val t = time.value
        val c = Offset(size.width / 2, size.height / 2)
        val R = size.minDimension / 2 * 0.92f
        fun angleOf(hourFrac: Float) = hourFrac / 24f * 360f - 90f

        // 배경 동심원
        drawCircle(Brush.radialGradient(listOf(hud.primary.copy(alpha = 0.08f), Color.Transparent), c, R), R, c)
        for (k in 1..4) drawCircle(hud.primary.copy(alpha = 0.12f), R * k / 4f, c, style = Stroke(1f))
        // 시간 눈금
        for (h in 0 until 96) {
            val a = Math.toRadians(angleOf(h / 4f).toDouble())
            val major = h % 4 == 0
            val len = if (h % 12 == 0) R * 0.08f else if (major) R * 0.05f else R * 0.02f
            val o = Offset(cos(a).toFloat(), sin(a).toFloat())
            drawLine(hud.primary.copy(alpha = if (major) 0.8f else 0.3f), c + o * R, c + o * (R - len), if (major) 2f else 1f)
        }
        hourLabels.forEach { (h, layout) ->
            val a = Math.toRadians(angleOf(h.toFloat()).toDouble())
            val p = c + Offset(cos(a).toFloat(), sin(a).toFloat()) * (R * 0.84f)
            drawText(layout, topLeft = p - Offset(layout.size.width / 2f, layout.size.height / 2f))
        }

        // 레이더 스윕
        val sweep = (t * 40f) % 360f
        rotate(sweep, c) {
            drawArc(
                Brush.sweepGradient(listOf(Color.Transparent, Color.Transparent, hud.primary.copy(alpha = 0.25f)), c),
                -90f - 60f, 60f, true, Offset(c.x - R, c.y - R), Size(R * 2, R * 2),
            )
        }

        // 일정 호: 겹치면 안쪽 레인으로
        val lanes = mutableListOf<Long>() // 레인별 끝 시각
        val zone = ZoneId.systemDefault()
        events.sortedBy { it.startMillis }.forEach { e ->
            val startT = java.time.Instant.ofEpochMilli(e.startMillis).atZone(zone).toLocalTime()
            val endT = java.time.Instant.ofEpochMilli(e.endMillis).atZone(zone).toLocalTime()
            val startH = if (e.allDay) 0f else startT.toSecondOfDay() / 3600f
            var endH = if (e.allDay) 24f else endT.toSecondOfDay() / 3600f
            if (endH <= startH) endH = 24f
            var lane = lanes.indexOfFirst { it <= e.startMillis }
            if (lane < 0) { lanes += e.endMillis; lane = lanes.lastIndex } else lanes[lane] = e.endMillis
            val r = R * (0.68f - lane * 0.1f).coerceAtLeast(0.25f)
            val start = angleOf(startH)
            val sw = ((endH - startH) / 24f * 360f).coerceAtLeast(3f)
            val col = if (e.allDay) hud.warn else hud.primary
            val tl = Offset(c.x - r, c.y - r)
            drawArc(col.copy(alpha = 0.25f), start, sw, false, tl, Size(r * 2, r * 2), style = Stroke(14.dp.toPx(), cap = StrokeCap.Butt))
            drawArc(col, start, sw, false, tl, Size(r * 2, r * 2), style = Stroke(5.dp.toPx(), cap = StrokeCap.Butt))
            // 시작점 표식
            val a = Math.toRadians(start.toDouble())
            drawCircle(hud.secondary, 3.dp.toPx(), c + Offset(cos(a).toFloat(), sin(a).toFloat()) * r)
        }

        // 현재 시각 바늘
        if (isToday) {
            val now = LocalTime.now()
            val nowH = now.toSecondOfDay() / 3600f
            val a = Math.toRadians(angleOf(nowH).toDouble())
            val o = Offset(cos(a).toFloat(), sin(a).toFloat())
            drawLine(hud.warn.copy(alpha = 0.3f), c, c + o * R, 6.dp.toPx())
            drawLine(hud.warn, c, c + o * R, 1.5.dp.toPx())
            drawCircle(hud.warn, 4.dp.toPx(), c + o * R)
        }
        // 중앙 표시
        drawCircle(hud.bg, R * 0.22f, c)
        drawCircle(hud.primary.copy(alpha = 0.7f), R * 0.22f, c, style = Stroke(1.5.dp.toPx()))
        val label = measurer.measure(if (isToday) LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm")) else "%02d".format(events.size), nowLabelStyle)
        drawText(label, topLeft = c - Offset(label.size.width / 2f, label.size.height / 2f + 4.dp.toPx()))
        val sub = measurer.measure(if (isToday) "LOCAL TIME" else "EVENTS", subStyle)
        drawText(sub, topLeft = c + Offset(-sub.size.width / 2f, label.size.height / 2f - 2.dp.toPx()))
    }
}
