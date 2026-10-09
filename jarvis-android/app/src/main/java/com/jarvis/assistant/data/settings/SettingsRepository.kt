package com.jarvis.assistant.data.settings

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.doublePreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "jarvis_settings")

data class CachedLocation(val lat: Double, val lon: Double, val place: String?)

@Singleton
class SettingsRepository @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private object Keys {
        val userName = stringPreferencesKey("user_name")
        val briefingEnabled = booleanPreferencesKey("briefing_enabled")
        val briefingHour = intPreferencesKey("briefing_hour")
        val briefingMinute = intPreferencesKey("briefing_minute")
        val ttsRate = floatPreferencesKey("tts_rate")
        val ttsPitch = floatPreferencesKey("tts_pitch")
        val wakeWord = booleanPreferencesKey("wake_word")
        val confirmTools = stringSetPreferencesKey("confirm_tools")
        val bootSequence = booleanPreferencesKey("boot_sequence")
        val sfxEnabled = booleanPreferencesKey("sfx_enabled")
        val sfxVolume = floatPreferencesKey("sfx_volume")
        val haptics = booleanPreferencesKey("haptics")
        val theme = stringPreferencesKey("theme")
        val liteMode = booleanPreferencesKey("lite_mode")
        val onboarded = booleanPreferencesKey("onboarded")
        val lat = doublePreferencesKey("last_lat")
        val lon = doublePreferencesKey("last_lon")
        val place = stringPreferencesKey("last_place")
    }

    val settings: Flow<AppSettings> = context.dataStore.data.map { p ->
        val d = AppSettings()
        AppSettings(
            userName = p[Keys.userName] ?: d.userName,
            briefingEnabled = p[Keys.briefingEnabled] ?: d.briefingEnabled,
            briefingHour = p[Keys.briefingHour] ?: d.briefingHour,
            briefingMinute = p[Keys.briefingMinute] ?: d.briefingMinute,
            ttsRate = p[Keys.ttsRate] ?: d.ttsRate,
            ttsPitch = p[Keys.ttsPitch] ?: d.ttsPitch,
            wakeWordEnabled = p[Keys.wakeWord] ?: d.wakeWordEnabled,
            confirmTools = p[Keys.confirmTools] ?: d.confirmTools,
            bootSequence = p[Keys.bootSequence] ?: d.bootSequence,
            sfxEnabled = p[Keys.sfxEnabled] ?: d.sfxEnabled,
            sfxVolume = p[Keys.sfxVolume] ?: d.sfxVolume,
            haptics = p[Keys.haptics] ?: d.haptics,
            theme = p[Keys.theme]?.let { runCatching { HudTheme.valueOf(it) }.getOrNull() } ?: d.theme,
            liteMode = p[Keys.liteMode] ?: d.liteMode,
            onboarded = p[Keys.onboarded] ?: d.onboarded,
        )
    }

    suspend fun current(): AppSettings = settings.first()

    val lastLocation: Flow<CachedLocation?> = context.dataStore.data.map { p ->
        val lat = p[Keys.lat] ?: return@map null
        val lon = p[Keys.lon] ?: return@map null
        CachedLocation(lat, lon, p[Keys.place])
    }

    suspend fun saveLocation(loc: CachedLocation) = context.dataStore.edit {
        it[Keys.lat] = loc.lat
        it[Keys.lon] = loc.lon
        if (loc.place != null) it[Keys.place] = loc.place else it.remove(Keys.place)
    }

    suspend fun setUserName(v: String) = context.dataStore.edit { it[Keys.userName] = v.trim() }
    suspend fun setBriefing(enabled: Boolean, hour: Int, minute: Int) = context.dataStore.edit {
        it[Keys.briefingEnabled] = enabled
        it[Keys.briefingHour] = hour.coerceIn(0, 23)
        it[Keys.briefingMinute] = minute.coerceIn(0, 59)
    }
    suspend fun setTtsRate(v: Float) = context.dataStore.edit { it[Keys.ttsRate] = v.coerceIn(0.5f, 2.0f) }
    suspend fun setTtsPitch(v: Float) = context.dataStore.edit { it[Keys.ttsPitch] = v.coerceIn(0.5f, 2.0f) }
    suspend fun setWakeWord(v: Boolean) = context.dataStore.edit { it[Keys.wakeWord] = v }
    suspend fun setConfirmTool(name: String, required: Boolean) = context.dataStore.edit {
        val cur = it[Keys.confirmTools] ?: AppSettings.DEFAULT_CONFIRM_TOOLS
        it[Keys.confirmTools] = if (required) cur + name else cur - name
    }
    suspend fun setBootSequence(v: Boolean) = context.dataStore.edit { it[Keys.bootSequence] = v }
    suspend fun setSfx(enabled: Boolean, volume: Float) = context.dataStore.edit {
        it[Keys.sfxEnabled] = enabled
        it[Keys.sfxVolume] = volume.coerceIn(0f, 1f)
    }
    suspend fun setHaptics(v: Boolean) = context.dataStore.edit { it[Keys.haptics] = v }
    suspend fun setTheme(v: HudTheme) = context.dataStore.edit { it[Keys.theme] = v.name }
    suspend fun setLiteMode(v: Boolean) = context.dataStore.edit { it[Keys.liteMode] = v }
    suspend fun setOnboarded() = context.dataStore.edit { it[Keys.onboarded] = true }
}
