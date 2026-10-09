package com.jarvis.assistant.services

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.jarvis.assistant.data.settings.CachedLocation
import com.jarvis.assistant.data.settings.SettingsRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LocationService @Inject constructor(
    @ApplicationContext private val context: Context,
    private val settings: SettingsRepository,
) {
    fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    /** 마지막으로 알려진 위치 (네트워크 호출 없음). */
    suspend fun cached(): CachedLocation? = settings.lastLocation.first()

    /** 현재 위치를 구하고 캐시에 저장한다. 권한이 없거나 실패하면 캐시 값을 돌려준다. */
    @SuppressLint("MissingPermission")
    suspend fun current(): CachedLocation? {
        if (!hasPermission()) return cached()
        val client = LocationServices.getFusedLocationProviderClient(context)
        val location = withTimeoutOrNull(8_000) {
            val cts = CancellationTokenSource()
            try {
                client.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, cts.token).await()
            } finally {
                cts.cancel()
            }
        } ?: runCatching { client.lastLocation.await() }.getOrNull()
        location ?: return cached()
        val place = reverseGeocode(location.latitude, location.longitude)
        val result = CachedLocation(location.latitude, location.longitude, place ?: cached()?.place)
        settings.saveLocation(result)
        return result
    }

    @Suppress("DEPRECATION")
    suspend fun reverseGeocode(lat: Double, lon: Double): String? = withContext(Dispatchers.IO) {
        if (!Geocoder.isPresent()) return@withContext null
        runCatching {
            val list = Geocoder(context, Locale.KOREA).getFromLocation(lat, lon, 1)
            val a = list?.firstOrNull() ?: return@runCatching null
            listOfNotNull(a.adminArea, a.locality ?: a.subAdminArea, a.subLocality ?: a.thoroughfare)
                .distinct()
                .joinToString(" ")
                .ifBlank { null }
        }.getOrNull()
    }
}
