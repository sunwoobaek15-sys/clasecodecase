package com.jarvis.assistant.ui.files

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jarvis.assistant.data.db.MemoDao
import com.jarvis.assistant.data.db.MemoEntity
import com.jarvis.assistant.data.db.TodoDao
import com.jarvis.assistant.data.db.TodoEntity
import com.jarvis.assistant.tools.FileEntry
import com.jarvis.assistant.tools.ProductivityTools
import com.jarvis.assistant.tools.TimeText
import com.jarvis.assistant.ui.hud.HudButton
import com.jarvis.assistant.ui.hud.HudTextField
import com.jarvis.assistant.ui.hud.PanelHeader
import com.jarvis.assistant.ui.hud.hudPanel
import com.jarvis.assistant.ui.main.FileRow
import com.jarvis.assistant.ui.theme.HudType
import com.jarvis.assistant.ui.theme.LocalHud
import kotlinx.coroutines.launch

/** 할 일·메모: 데이터 파일 목록처럼. 완료 시 스캔 라인이 지나가며 삭선. */
@Composable
fun FilesScreen(todoDao: TodoDao, memoDao: MemoDao, onTick: () -> Unit) {
    val hud = LocalHud.current
    val scope = rememberCoroutineScope()
    var tab by remember { mutableStateOf(0) }
    val todos by todoDao.observeAll().collectAsState(initial = emptyList())
    val memos by memoDao.observeAll().collectAsState(initial = emptyList())
    var input by remember { mutableStateOf("") }

    Column(Modifier.fillMaxSize().padding(horizontal = 12.dp)) {
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            HudButton("TASKS · ${todos.count { !it.done }}", { tab = 0; onTick() }, Modifier.weight(1f), filled = tab == 0, color = if (tab == 0) hud.primary else hud.dim)
            HudButton("MEMOS · ${memos.size}", { tab = 1; onTick() }, Modifier.weight(1f), filled = tab == 1, color = if (tab == 1) hud.primary else hud.dim)
        }
        Spacer(Modifier.height(10.dp))
        Box(Modifier.weight(1f).fillMaxWidth().hudPanel(hud.primary).padding(10.dp)) {
            Column {
                PanelHeader(if (tab == 0) "TASK REGISTRY" else "MEMO ARCHIVE", "DIR /${if (tab == 0) "TASK" else "MEMO"}")
                Spacer(Modifier.height(4.dp))
                Text(
                    if (tab == 0) "TAP: COMPLETE  ·  HOLD: PURGE" else "HOLD: PURGE",
                    style = HudType.label(hud.dim, 7.sp, glowOn = false),
                )
                Spacer(Modifier.height(6.dp))
                if (tab == 0) {
                    if (todos.isEmpty()) Text("NO FILES", style = HudType.label(hud.dim, 9.sp))
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        items(todos, key = { "t" + it.id }) { todo ->
                            TodoItem(
                                todo,
                                onComplete = {
                                    onTick()
                                    scope.launch { todoDao.update(todo.copy(done = !todo.done, completedAt = if (!todo.done) System.currentTimeMillis() else null)) }
                                },
                                onDelete = { scope.launch { todoDao.delete(todo.id) } },
                            )
                        }
                    }
                } else {
                    if (memos.isEmpty()) Text("NO FILES", style = HudType.label(hud.dim, 9.sp))
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        items(memos, key = { "m" + it.id }) { memo ->
                            MemoItem(memo, onDelete = { scope.launch { memoDao.delete(memo.id) } })
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            HudTextField(input, { input = it }, Modifier.weight(1f), placeholder = if (tab == 0) "새 할 일" else "새 메모")
            Spacer(Modifier.width(8.dp))
            HudButton("ADD", {
                val text = input.trim()
                if (text.isNotEmpty()) {
                    onTick()
                    scope.launch {
                        if (tab == 0) todoDao.insert(TodoEntity(text = text)) else memoDao.insert(MemoEntity(text = text))
                    }
                    input = ""
                }
            }, filled = true)
        }
        Spacer(Modifier.height(4.dp))
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TodoItem(todo: TodoEntity, onComplete: () -> Unit, onDelete: () -> Unit) {
    val hud = LocalHud.current
    val scope = rememberCoroutineScope()
    // 스캔 라인 진행도 (완료 처리 시 0 → 1)
    val scan = remember(todo.id) { Animatable(if (todo.done) 1f else 0f) }
    var animating by remember { mutableStateOf(false) }
    Box(
        Modifier
            .fillMaxWidth()
            .combinedClickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = {
                    if (!todo.done && !animating) {
                        animating = true
                        scope.launch {
                            scan.snapTo(0f)
                            scan.animateTo(1f, tween(650, easing = LinearEasing))
                            animating = false
                            onComplete()
                        }
                    } else if (todo.done) {
                        scope.launch { scan.snapTo(0f) }
                        onComplete()
                    }
                },
                onLongClick = onDelete,
            )
            .drawWithContent {
                drawContent()
                val p = scan.value
                if (animating && p in 0f..1f) {
                    val x = size.width * p
                    drawRect(
                        Brush.horizontalGradient(listOf(Color.Transparent, hud.primary.copy(alpha = 0.35f)), startX = x - 60.dp.toPx(), endX = x),
                        Offset(0f, 0f), Size(x, size.height),
                    )
                    drawLine(hud.secondary, Offset(x, 0f), Offset(x, size.height), 2.dp.toPx())
                }
                if (animating) {
                    // 삭선이 스캔 라인을 따라 그어진다
                    val y = size.height * 0.62f
                    drawLine(hud.secondary, Offset(14.dp.toPx(), y), Offset(14.dp.toPx() + (size.width - 14.dp.toPx()) * p, y), 1.5.dp.toPx())
                }
            },
    ) {
        FileRow(
            FileEntry(
                code = ProductivityTools.fileCode("FILE", todo.id),
                text = todo.text,
                meta = if (todo.done) "STATUS: COMPLETE" else ProductivityTools.priorityMeta(todo.priority, todo.dueAt),
                done = todo.done,
                highlight = todo.priority >= 2 && !todo.done,
            ),
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MemoItem(memo: MemoEntity, onDelete: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .combinedClickable(remember { MutableInteractionSource() }, null, onClick = {}, onLongClick = onDelete),
    ) {
        FileRow(
            FileEntry(
                code = ProductivityTools.fileCode("MEMO", memo.id),
                text = memo.text,
                meta = (memo.tag?.let { "TAG: ${it.uppercase()}  ·  " } ?: "") + TimeText.iso(memo.createdAt).replace('T', ' ').take(16),
            ),
        )
    }
}
