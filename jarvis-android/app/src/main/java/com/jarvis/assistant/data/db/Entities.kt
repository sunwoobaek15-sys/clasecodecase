package com.jarvis.assistant.data.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "messages")
data class MessageEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val fromUser: Boolean,
    val text: String,
    val timestamp: Long = System.currentTimeMillis(),
)

@Entity(tableName = "memos", indices = [Index("tag")])
data class MemoEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val text: String,
    val tag: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
)

@Entity(tableName = "todos")
data class TodoEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val text: String,
    val dueAt: Long? = null,
    /** 0 = LOW, 1 = NORMAL, 2 = HIGH */
    val priority: Int = 1,
    val done: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val completedAt: Long? = null,
)

@Entity(tableName = "reminders")
data class ReminderEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val triggerAt: Long,
    val text: String,
    val fired: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
)
