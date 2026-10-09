package com.jarvis.assistant.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface MessageDao {
    @Insert
    suspend fun insert(message: MessageEntity): Long

    @Query("SELECT * FROM (SELECT * FROM messages ORDER BY id DESC LIMIT :limit) ORDER BY id ASC")
    suspend fun recent(limit: Int): List<MessageEntity>

    @Query("SELECT * FROM (SELECT * FROM messages ORDER BY id DESC LIMIT :limit) ORDER BY id ASC")
    fun observeRecent(limit: Int): Flow<List<MessageEntity>>

    @Query("DELETE FROM messages")
    suspend fun clear()
}

@Dao
interface MemoDao {
    @Insert
    suspend fun insert(memo: MemoEntity): Long

    @Query("SELECT * FROM memos ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<MemoEntity>>

    @Query("SELECT * FROM memos WHERE text LIKE '%' || :q || '%' OR tag LIKE '%' || :q || '%' ORDER BY createdAt DESC LIMIT 20")
    suspend fun search(q: String): List<MemoEntity>

    @Query("SELECT * FROM memos ORDER BY createdAt DESC LIMIT :limit")
    suspend fun recent(limit: Int): List<MemoEntity>

    @Query("DELETE FROM memos WHERE id = :id")
    suspend fun delete(id: Long)
}

@Dao
interface TodoDao {
    @Insert
    suspend fun insert(todo: TodoEntity): Long

    @Update
    suspend fun update(todo: TodoEntity)

    @Query("SELECT * FROM todos WHERE id = :id")
    suspend fun get(id: Long): TodoEntity?

    @Query("SELECT * FROM todos ORDER BY done ASC, priority DESC, CASE WHEN dueAt IS NULL THEN 1 ELSE 0 END, dueAt ASC, createdAt DESC")
    fun observeAll(): Flow<List<TodoEntity>>

    @Query("SELECT * FROM todos WHERE done = 0 ORDER BY priority DESC, CASE WHEN dueAt IS NULL THEN 1 ELSE 0 END, dueAt ASC, createdAt ASC")
    suspend fun pending(): List<TodoEntity>

    @Query("SELECT * FROM todos WHERE done = 0 AND text LIKE '%' || :q || '%' ORDER BY createdAt ASC")
    suspend fun findPending(q: String): List<TodoEntity>

    @Query("DELETE FROM todos WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("DELETE FROM todos WHERE done = 1")
    suspend fun clearDone()
}

@Dao
interface ReminderDao {
    @Insert
    suspend fun insert(reminder: ReminderEntity): Long

    @Query("SELECT * FROM reminders WHERE id = :id")
    suspend fun get(id: Long): ReminderEntity?

    @Query("UPDATE reminders SET fired = 1 WHERE id = :id")
    suspend fun markFired(id: Long)

    @Query("SELECT * FROM reminders WHERE fired = 0 ORDER BY triggerAt ASC")
    suspend fun pending(): List<ReminderEntity>

    @Query("SELECT * FROM reminders WHERE fired = 0 ORDER BY triggerAt ASC")
    fun observePending(): Flow<List<ReminderEntity>>
}
