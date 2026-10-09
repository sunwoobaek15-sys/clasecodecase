package com.jarvis.assistant.services

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Environment
import android.os.StatFs
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.roundToInt

data class BatteryInfo(val percent: Int, val charging: Boolean, val temperatureC: Float?)
data class NetworkInfo(val connected: Boolean, val type: String, val strength: Float)
data class StorageInfo(val usedFraction: Float, val freeGb: Float, val totalGb: Float)

@Singleton
class DeviceStatus @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    fun battery(): BatteryInfo {
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val temp = intent?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Int.MIN_VALUE) ?: Int.MIN_VALUE
        val pct = if (level >= 0 && scale > 0) (level * 100f / scale).roundToInt() else {
            (context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager)
                .getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        }
        return BatteryInfo(
            percent = pct.coerceIn(0, 100),
            charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL,
            temperatureC = if (temp != Int.MIN_VALUE) temp / 10f else null,
        )
    }

    fun network(): NetworkInfo {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.activeNetwork?.let { cm.getNetworkCapabilities(it) }
            ?: return NetworkInfo(false, "OFFLINE", 0f)
        val type = when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WIFI"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "CELL"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ETH"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "VPN"
            else -> "NET"
        }
        val validated = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        val strength = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            val s = caps.signalStrength
            if (s == Int.MIN_VALUE || s == 0) (if (validated) 0.8f else 0.4f) else ((s + 100) / 60f).coerceIn(0.05f, 1f)
        } else if (validated) 0.8f else 0.4f
        return NetworkInfo(true, type, strength)
    }

    fun storage(): StorageInfo {
        val stat = StatFs(Environment.getDataDirectory().path)
        val total = stat.totalBytes.toFloat()
        val free = stat.availableBytes.toFloat()
        val gb = 1024f * 1024f * 1024f
        return StorageInfo(if (total > 0) 1f - free / total else 0f, free / gb, total / gb)
    }

    fun setFlashlight(on: Boolean): Boolean {
        val cm = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val id = cm.cameraIdList.firstOrNull { id ->
            cm.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
        } ?: return false
        cm.setTorchMode(id, on)
        return true
    }

    /** level: 0~100 (%) */
    fun setVolume(level: Int, stream: Int = AudioManager.STREAM_MUSIC): Int {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val max = am.getStreamMaxVolume(stream)
        val target = (level.coerceIn(0, 100) / 100f * max).roundToInt()
        am.setStreamVolume(stream, target, AudioManager.FLAG_SHOW_UI)
        return target * 100 / maxOf(1, max)
    }

    fun volumePercent(stream: Int = AudioManager.STREAM_MUSIC): Int {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        return am.getStreamVolume(stream) * 100 / maxOf(1, am.getStreamMaxVolume(stream))
    }
}
