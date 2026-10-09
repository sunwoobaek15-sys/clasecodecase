package com.jarvis.assistant.audio

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

enum class HapticPattern { BOOT, LISTEN, THINK, EXECUTE, DONE, ERROR, TICK, WARN }

/** 상태 전환마다 서로 다른 진동 패턴. */
@Singleton
class Haptics @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    @Volatile var enabled = true

    private val vibrator: Vibrator? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    fun play(p: HapticPattern) {
        if (!enabled) return
        val v = vibrator ?: return
        if (!v.hasVibrator()) return
        val effect = when (p) {
            HapticPattern.BOOT -> VibrationEffect.createWaveform(longArrayOf(0, 20, 60, 20, 60, 120), intArrayOf(0, 90, 0, 140, 0, 255), -1)
            HapticPattern.LISTEN -> VibrationEffect.createWaveform(longArrayOf(0, 18, 50, 28), intArrayOf(0, 120, 0, 200), -1)
            HapticPattern.THINK -> VibrationEffect.createOneShot(12, 70)
            HapticPattern.EXECUTE -> VibrationEffect.createWaveform(longArrayOf(0, 10, 30, 10, 30, 10), intArrayOf(0, 140, 0, 140, 0, 140), -1)
            HapticPattern.DONE -> VibrationEffect.createOneShot(22, 160)
            HapticPattern.ERROR -> VibrationEffect.createWaveform(longArrayOf(0, 70, 60, 70, 60, 140), intArrayOf(0, 255, 0, 255, 0, 255), -1)
            HapticPattern.TICK -> VibrationEffect.createOneShot(8, 90)
            HapticPattern.WARN -> VibrationEffect.createWaveform(longArrayOf(0, 40, 80, 40), intArrayOf(0, 200, 0, 200), -1)
        }
        runCatching { v.vibrate(effect) }
    }
}
