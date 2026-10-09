package com.jarvis.assistant.data.db

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [MessageEntity::class, MemoEntity::class, TodoEntity::class, ReminderEntity::class],
    version = 1,
    exportSchema = true,
)
abstract class JarvisDatabase : RoomDatabase() {
    abstract fun messageDao(): MessageDao
    abstract fun memoDao(): MemoDao
    abstract fun todoDao(): TodoDao
    abstract fun reminderDao(): ReminderDao
}
