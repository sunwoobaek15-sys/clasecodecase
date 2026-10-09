package com.jarvis.assistant.services

import android.Manifest
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CalendarContract
import androidx.core.content.ContextCompat
import com.jarvis.assistant.tools.EventItem
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.ZoneId
import java.util.TimeZone
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CalendarRepository @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    fun canRead(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED

    fun canWrite(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_CALENDAR) == PackageManager.PERMISSION_GRANTED

    suspend fun events(fromMillis: Long, toMillis: Long, limit: Int = 50): List<EventItem> = withContext(Dispatchers.IO) {
        if (!canRead()) return@withContext emptyList()
        val uri = CalendarContract.Instances.CONTENT_URI.buildUpon().also {
            ContentUris.appendId(it, fromMillis)
            ContentUris.appendId(it, toMillis)
        }.build()
        val projection = arrayOf(
            CalendarContract.Instances.EVENT_ID,
            CalendarContract.Instances.TITLE,
            CalendarContract.Instances.BEGIN,
            CalendarContract.Instances.END,
            CalendarContract.Instances.ALL_DAY,
            CalendarContract.Instances.EVENT_LOCATION,
        )
        val out = mutableListOf<EventItem>()
        context.contentResolver.query(
            uri, projection,
            "${CalendarContract.Instances.VISIBLE} = 1", null,
            "${CalendarContract.Instances.BEGIN} ASC",
        )?.use { c ->
            while (c.moveToNext() && out.size < limit) {
                val allDay = c.getInt(4) == 1
                var begin = c.getLong(2)
                var end = c.getLong(3)
                if (allDay) {
                    // 종일 일정은 UTC 자정 기준으로 저장되므로 로컬 자정으로 보정
                    begin = utcMidnightToLocal(begin)
                    end = utcMidnightToLocal(end)
                }
                out += EventItem(
                    id = c.getLong(0),
                    title = c.getString(1)?.ifBlank { null } ?: "(제목 없음)",
                    startMillis = begin,
                    endMillis = end,
                    allDay = allDay,
                    location = c.getString(5)?.ifBlank { null },
                )
            }
        }
        out
    }

    suspend fun today(): List<EventItem> {
        val zone = ZoneId.systemDefault()
        val start = LocalDate.now().atStartOfDay(zone).toInstant().toEpochMilli()
        val end = LocalDate.now().plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli()
        return events(start, end)
    }

    /** 지금 이후 가장 가까운 일정 (진행 중 포함 안 함) */
    suspend fun next(withinDays: Long = 7): EventItem? {
        val now = System.currentTimeMillis()
        return events(now, now + withinDays * 86_400_000L, limit = 20)
            .filter { !it.allDay && it.startMillis > now }
            .minByOrNull { it.startMillis }
    }

    suspend fun create(
        title: String,
        startMillis: Long,
        endMillis: Long,
        allDay: Boolean,
        location: String?,
        description: String?,
    ): Long = withContext(Dispatchers.IO) {
        val calendarId = writableCalendarId() ?: throw IllegalStateException("쓰기 가능한 캘린더 계정이 없습니다")
        val values = ContentValues().apply {
            put(CalendarContract.Events.CALENDAR_ID, calendarId)
            put(CalendarContract.Events.TITLE, title)
            if (allDay) {
                val zone = ZoneId.systemDefault()
                val day = java.time.Instant.ofEpochMilli(startMillis).atZone(zone).toLocalDate()
                val utcStart = day.atStartOfDay(ZoneId.of("UTC")).toInstant().toEpochMilli()
                put(CalendarContract.Events.DTSTART, utcStart)
                put(CalendarContract.Events.DTEND, utcStart + 86_400_000L)
                put(CalendarContract.Events.ALL_DAY, 1)
                put(CalendarContract.Events.EVENT_TIMEZONE, "UTC")
            } else {
                put(CalendarContract.Events.DTSTART, startMillis)
                put(CalendarContract.Events.DTEND, endMillis)
                put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
            }
            if (!location.isNullOrBlank()) put(CalendarContract.Events.EVENT_LOCATION, location)
            if (!description.isNullOrBlank()) put(CalendarContract.Events.DESCRIPTION, description)
        }
        val uri = context.contentResolver.insert(CalendarContract.Events.CONTENT_URI, values)
            ?: throw IllegalStateException("일정을 저장하지 못했습니다")
        ContentUris.parseId(uri)
    }

    suspend fun title(eventId: Long): String? = withContext(Dispatchers.IO) {
        if (!canRead()) return@withContext null
        context.contentResolver.query(
            ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId),
            arrayOf(CalendarContract.Events.TITLE), null, null, null,
        )?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
    }

    suspend fun delete(eventId: Long): Boolean = withContext(Dispatchers.IO) {
        context.contentResolver.delete(
            ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId), null, null,
        ) > 0
    }

    private fun writableCalendarId(): Long? {
        val projection = arrayOf(
            CalendarContract.Calendars._ID,
            CalendarContract.Calendars.IS_PRIMARY,
            CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL,
        )
        context.contentResolver.query(
            CalendarContract.Calendars.CONTENT_URI, projection,
            "${CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL} >= ${CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR} AND ${CalendarContract.Calendars.VISIBLE} = 1",
            null, null,
        )?.use { c ->
            var fallback: Long? = null
            while (c.moveToNext()) {
                val id = c.getLong(0)
                if (c.getInt(1) == 1) return id
                if (fallback == null) fallback = id
            }
            return fallback
        }
        return null
    }

    private fun utcMidnightToLocal(utcMillis: Long): Long {
        val date = java.time.Instant.ofEpochMilli(utcMillis).atZone(ZoneId.of("UTC")).toLocalDate()
        return date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
    }
}
