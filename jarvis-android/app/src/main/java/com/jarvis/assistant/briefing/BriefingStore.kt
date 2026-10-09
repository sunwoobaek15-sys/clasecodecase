package com.jarvis.assistant.briefing

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BriefingStore @Inject constructor(
    @ApplicationContext private val context: Context,
    private val json: Json,
) {
    private val file get() = File(context.filesDir, "last_briefing.json")

    suspend fun save(b: Briefing) = withContext(Dispatchers.IO) {
        file.writeText(json.encodeToString(Briefing.serializer(), b))
    }

    suspend fun load(): Briefing? = withContext(Dispatchers.IO) {
        runCatching { json.decodeFromString(Briefing.serializer(), file.readText()) }.getOrNull()
    }
}
