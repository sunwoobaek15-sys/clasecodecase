package com.jarvis.assistant.tools

import android.Manifest
import android.content.Context
import android.content.Intent
import android.provider.AlarmClock
import com.jarvis.assistant.data.db.MemoDao
import com.jarvis.assistant.data.db.MemoEntity
import com.jarvis.assistant.data.db.ReminderDao
import com.jarvis.assistant.data.db.ReminderEntity
import com.jarvis.assistant.data.db.TodoDao
import com.jarvis.assistant.data.db.TodoEntity
import com.jarvis.assistant.reminders.ReminderScheduler
import com.jarvis.assistant.services.CalendarRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import javax.inject.Inject
import javax.inject.Singleton

/** 일정·알람·메모·할 일 */
@Singleton
class ProductivityTools @Inject constructor(
    @ApplicationContext private val context: Context,
    private val calendar: CalendarRepository,
    private val memoDao: MemoDao,
    private val todoDao: TodoDao,
    private val reminderDao: ReminderDao,
    private val reminderScheduler: ReminderScheduler,
) : ToolProvider {

    override val bundleId = "10_productivity"

    private val calendarRationale = "일정을 읽고 추가하려면 캘린더 접근 권한이 필요합니다."

    override val tools: List<JarvisTool> = listOf(
        SimpleTool(
            name = "create_alarm",
            description = "시계 앱에 알람을 만든다. 반복 요일을 줄 수 있다 (1=일요일 ... 7=토요일).",
            inputSchema = Schema.obj(
                "hour" to Schema.integer("시 (0-23, 24시간제)", 0, 23),
                "minute" to Schema.integer("분 (0-59)", 0, 59),
                "label" to Schema.string("알람 이름"),
                "days" to Schema.intArray("반복 요일. 1=일요일, 2=월요일 ... 7=토요일. 생략하면 1회성", 1, 7),
                required = listOf("hour", "minute"),
            ),
            category = ToolCategory.ALARM,
            hudLabel = "ALARM SET",
        ) { input ->
            val hour = input.int("hour") ?: return@SimpleTool ToolResult.error("hour 가 필요합니다")
            val minute = input.int("minute") ?: 0
            val label = input.str("label") ?: "JARVIS"
            val days = input.intList("days")?.filter { it in 1..7 }?.distinct()
            val intent = Intent(AlarmClock.ACTION_SET_ALARM).apply {
                putExtra(AlarmClock.EXTRA_HOUR, hour)
                putExtra(AlarmClock.EXTRA_MINUTES, minute)
                putExtra(AlarmClock.EXTRA_MESSAGE, label)
                putExtra(AlarmClock.EXTRA_SKIP_UI, true)
                if (!days.isNullOrEmpty()) putExtra(AlarmClock.EXTRA_DAYS, ArrayList(days))
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            if (!startActivity(intent)) return@SimpleTool ToolResult.error("알람을 설정할 시계 앱이 없습니다")
            val dayText = days?.takeIf { it.isNotEmpty() }?.joinToString(",") { "일월화수목금토"[it - 1].toString() }
            ToolResult("알람 설정 완료: %02d:%02d '%s'%s".format(hour, minute, label, dayText?.let { " (매주 $it)" } ?: ""))
        },
        SimpleTool(
            name = "set_timer",
            description = "타이머를 시작한다.",
            inputSchema = Schema.obj(
                "seconds" to Schema.integer("타이머 길이(초)", 1, 86_400),
                "label" to Schema.string("타이머 이름"),
                required = listOf("seconds"),
            ),
            category = ToolCategory.ALARM,
            hudLabel = "TIMER ARMED",
        ) { input ->
            val seconds = input.int("seconds")?.coerceIn(1, 86_400) ?: return@SimpleTool ToolResult.error("seconds 가 필요합니다")
            val label = input.str("label") ?: "JARVIS 타이머"
            val intent = Intent(AlarmClock.ACTION_SET_TIMER).apply {
                putExtra(AlarmClock.EXTRA_LENGTH, seconds)
                putExtra(AlarmClock.EXTRA_MESSAGE, label)
                putExtra(AlarmClock.EXTRA_SKIP_UI, true)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            if (!startActivity(intent)) return@SimpleTool ToolResult.error("타이머를 지원하는 시계 앱이 없습니다")
            ToolResult("타이머 시작: ${seconds / 60}분 ${seconds % 60}초 '$label'")
        },
        SimpleTool(
            name = "create_reminder",
            description = "지정한 시각에 알림으로 알려 주는 리마인더를 만든다.",
            inputSchema = Schema.obj(
                "datetime" to Schema.string("알림 시각. ISO 8601 로컬 시각 (예: 2026-10-09T15:30:00)"),
                "text" to Schema.string("알려 줄 내용"),
                required = listOf("datetime", "text"),
            ),
            category = ToolCategory.ALARM,
            hudLabel = "REMINDER LOCK",
            requiredPermissions = listOf(Manifest.permission.POST_NOTIFICATIONS),
            permissionRationale = "정해진 시각에 리마인더를 알려 드리려면 알림 권한이 필요합니다.",
        ) { input ->
            val at = TimeText.toMillis(TimeText.parse(input.requireStr("datetime")))
            if (at <= System.currentTimeMillis()) return@SimpleTool ToolResult.error("이미 지난 시각입니다. 미래 시각으로 다시 지정하세요.")
            val text = input.requireStr("text")
            val id = reminderDao.insert(ReminderEntity(triggerAt = at, text = text))
            val exact = reminderScheduler.schedule(id, at)
            ToolResult(
                "리마인더 #$id 등록: ${TimeText.spoken(at)} '$text'" +
                    if (!exact) " (정확한 알람 권한이 없어 몇 분 늦을 수 있음)" else "",
            )
        },
        SimpleTool(
            name = "list_calendar_events",
            description = "기간 내 캘린더 일정을 조회한다. 결과의 id 로 삭제할 수 있다.",
            inputSchema = Schema.obj(
                "from" to Schema.string("시작 시각 ISO 8601 (생략 시 오늘 0시)"),
                "to" to Schema.string("끝 시각 ISO 8601 (생략 시 시작 + 1일)"),
                required = emptyList(),
            ),
            category = ToolCategory.CALENDAR,
            hudLabel = "CALENDAR SYNC",
            requiredPermissions = listOf(Manifest.permission.READ_CALENDAR),
            permissionRationale = calendarRationale,
        ) { input ->
            val from = input.str("from")?.let { TimeText.parse(it, LocalTime.MIDNIGHT) } ?: LocalDate.now().atStartOfDay()
            val to = input.str("to")?.let { TimeText.parse(it, LocalTime.MAX) } ?: from.plusDays(1)
            val events = calendar.events(TimeText.toMillis(from), TimeText.toMillis(to))
            val card = ResultCard.Events(rangeTitle(from, to), events)
            if (events.isEmpty()) return@SimpleTool ToolResult("해당 기간에 일정이 없습니다.", card = card)
            ToolResult(
                events.joinToString("\n") { e ->
                    val time = if (e.allDay) "종일" else "${TimeText.iso(e.startMillis)}~${TimeText.iso(e.endMillis).substringAfter('T')}"
                    "id=${e.id} | $time | ${e.title}" + (e.location?.let { " | 장소: $it" } ?: "")
                },
                card = card,
            )
        },
        SimpleTool(
            name = "create_calendar_event",
            description = "캘린더에 일정을 추가한다.",
            inputSchema = Schema.obj(
                "title" to Schema.string("일정 제목"),
                "start" to Schema.string("시작 시각 ISO 8601"),
                "end" to Schema.string("끝 시각 ISO 8601 (생략 시 1시간)"),
                "all_day" to Schema.boolean("종일 일정 여부"),
                "location" to Schema.string("장소"),
                "description" to Schema.string("메모"),
                required = listOf("title", "start"),
            ),
            category = ToolCategory.CALENDAR,
            hudLabel = "CALENDAR WRITE",
            requiredPermissions = listOf(Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR),
            permissionRationale = calendarRationale,
            confirm = { "'${it.str("title")}' 일정을 ${it.str("start")?.let { s -> runCatching { TimeText.spoken(TimeText.toMillis(TimeText.parse(s))) }.getOrDefault(s) }}에 추가할까요?" },
        ) { input ->
            val title = input.requireStr("title")
            val start = TimeText.parse(input.requireStr("start"))
            val allDay = input.bool("all_day") ?: false
            val end = input.str("end")?.let { TimeText.parse(it) }?.takeIf { it.isAfter(start) } ?: start.plusHours(1)
            val id = calendar.create(title, TimeText.toMillis(start), TimeText.toMillis(end), allDay, input.str("location"), input.str("description"))
            val ev = com.jarvis.assistant.tools.EventItem(id, title, TimeText.toMillis(start), TimeText.toMillis(end), allDay, input.str("location"))
            ToolResult(
                "일정 추가 완료 (id=$id): $title, ${if (allDay) "종일" else TimeText.spoken(ev.startMillis)}",
                card = ResultCard.Events("NEW EVENT", listOf(ev)),
            )
        },
        SimpleTool(
            name = "delete_calendar_event",
            description = "캘린더 일정을 id 로 삭제한다. id 는 list_calendar_events 로 먼저 확인한다.",
            inputSchema = Schema.obj("id" to Schema.integer("일정 id"), required = listOf("id")),
            category = ToolCategory.CALENDAR,
            hudLabel = "CALENDAR PURGE",
            requiredPermissions = listOf(Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR),
            permissionRationale = calendarRationale,
            alwaysConfirm = true,
            confirm = { "일정 #${it.long("id")} 을(를) 삭제합니다. 진행할까요?" },
        ) { input ->
            val id = input.long("id") ?: return@SimpleTool ToolResult.error("id 가 필요합니다")
            val title = calendar.title(id) ?: return@SimpleTool ToolResult.error("id=$id 일정을 찾지 못했습니다")
            if (calendar.delete(id)) ToolResult("일정 삭제 완료: $title") else ToolResult.error("삭제하지 못했습니다")
        },
        SimpleTool(
            name = "add_memo",
            description = "메모를 저장한다.",
            inputSchema = Schema.obj(
                "text" to Schema.string("메모 내용"),
                "tag" to Schema.string("분류 태그 (선택)"),
                required = listOf("text"),
            ),
            category = ToolCategory.MEMO,
            hudLabel = "MEMO ARCHIVE",
        ) { input ->
            val text = input.requireStr("text")
            val tag = input.str("tag")
            val id = memoDao.insert(MemoEntity(text = text, tag = tag))
            ToolResult(
                "메모 #$id 저장 완료" + (tag?.let { " [$it]" } ?: ""),
                card = ResultCard.Files("MEMO SAVED", listOf(FileEntry(fileCode("MEMO", id), text, tag?.let { "TAG: ${it.uppercase()}" } ?: "UNTAGGED", highlight = true))),
            )
        },
        SimpleTool(
            name = "search_memos",
            description = "메모를 검색한다. query 를 비우면 최근 메모를 돌려준다.",
            inputSchema = Schema.obj("query" to Schema.string("검색어"), required = emptyList()),
            category = ToolCategory.MEMO,
            hudLabel = "MEMO SCAN",
        ) { input ->
            val q = input.str("query")
            val list = if (q == null) memoDao.recent(10) else memoDao.search(q)
            if (list.isEmpty()) return@SimpleTool ToolResult("일치하는 메모가 없습니다.")
            ToolResult(
                list.joinToString("\n") { "#${it.id} [${TimeText.iso(it.createdAt).take(10)}] ${it.text}" + (it.tag?.let { t -> " (태그: $t)" } ?: "") },
                card = ResultCard.Files(
                    if (q == null) "RECENT MEMOS" else "SEARCH: ${q.uppercase()}",
                    list.map { FileEntry(fileCode("MEMO", it.id), it.text, it.tag?.let { t -> "TAG: ${t.uppercase()}" } ?: TimeText.iso(it.createdAt).take(10)) },
                ),
            )
        },
        SimpleTool(
            name = "add_todo",
            description = "할 일을 추가한다.",
            inputSchema = Schema.obj(
                "text" to Schema.string("할 일 내용"),
                "due" to Schema.string("마감 시각 ISO 8601 (선택)"),
                "priority" to Schema.string("우선순위", listOf("low", "normal", "high")),
                required = listOf("text"),
            ),
            category = ToolCategory.TODO,
            hudLabel = "TASK QUEUE",
        ) { input ->
            val text = input.requireStr("text")
            val due = input.str("due")?.let { TimeText.toMillis(TimeText.parse(it, LocalTime.of(18, 0))) }
            val pr = when (input.str("priority")) { "high" -> 2; "low" -> 0; else -> 1 }
            val id = todoDao.insert(TodoEntity(text = text, dueAt = due, priority = pr))
            ToolResult(
                "할 일 #$id 추가 완료" + (due?.let { ", 마감 ${TimeText.spoken(it)}" } ?: ""),
                card = ResultCard.Files("TASK QUEUED", listOf(FileEntry(fileCode("TASK", id), text, priorityMeta(pr, due), highlight = true))),
            )
        },
        SimpleTool(
            name = "list_todos",
            description = "완료하지 않은 할 일 목록을 조회한다.",
            inputSchema = Schema.empty,
            category = ToolCategory.TODO,
            hudLabel = "TASK SCAN",
        ) { _ ->
            val list = todoDao.pending()
            if (list.isEmpty()) return@SimpleTool ToolResult("남은 할 일이 없습니다.", card = ResultCard.Files("TASK QUEUE", emptyList()))
            ToolResult(
                list.joinToString("\n") { t -> "id=${t.id} | ${t.text}" + (t.dueAt?.let { " | 마감 ${TimeText.iso(it)}" } ?: "") + " | 우선순위 ${listOf("낮음", "보통", "높음")[t.priority.coerceIn(0, 2)]}" },
                card = ResultCard.Files("TASK QUEUE", list.map { FileEntry(fileCode("TASK", it.id), it.text, priorityMeta(it.priority, it.dueAt), highlight = it.priority >= 2) }),
            )
        },
        SimpleTool(
            name = "complete_todo",
            description = "할 일을 완료 처리한다. id 는 list_todos 로 확인한다.",
            inputSchema = Schema.obj("id" to Schema.integer("할 일 id"), required = listOf("id")),
            category = ToolCategory.TODO,
            hudLabel = "TASK CLOSE",
        ) { input ->
            val id = input.long("id") ?: return@SimpleTool ToolResult.error("id 가 필요합니다")
            val todo = todoDao.get(id) ?: return@SimpleTool ToolResult.error("id=$id 할 일을 찾지 못했습니다")
            todoDao.update(todo.copy(done = true, completedAt = System.currentTimeMillis()))
            ToolResult(
                "완료 처리: ${todo.text}",
                card = ResultCard.Files("TASK CLOSED", listOf(FileEntry(fileCode("TASK", id), todo.text, "STATUS: COMPLETE", done = true))),
            )
        },
    )

    private fun startActivity(intent: Intent): Boolean = runCatching {
        context.startActivity(intent)
    }.isSuccess

    private fun rangeTitle(from: LocalDateTime, to: LocalDateTime): String {
        val today = LocalDate.now()
        return when {
            from.toLocalDate() == today && !to.toLocalDate().isAfter(today.plusDays(1)) -> "TODAY"
            from.toLocalDate() == today.plusDays(1) && !to.toLocalDate().isAfter(today.plusDays(2)) -> "TOMORROW"
            else -> "%02d.%02d — %02d.%02d".format(from.monthValue, from.dayOfMonth, to.monthValue, to.dayOfMonth)
        }
    }

    companion object {
        fun fileCode(prefix: String, id: Long) = "%s_%04d".format(prefix, id)
        fun priorityMeta(priority: Int, due: Long?): String {
            val p = listOf("LOW", "NORMAL", "HIGH")[priority.coerceIn(0, 2)]
            return "PRIORITY: $p" + (due?.let { " / DUE ${TimeText.iso(it).replace('T', ' ').take(16)}" } ?: "")
        }
    }
}
