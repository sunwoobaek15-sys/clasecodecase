package com.jarvis.assistant.audio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.min
import kotlin.math.sin
import kotlin.random.Random

enum class Sfx { BOOT, LISTEN, DONE, ERROR, CLICK, CONFIRM }

/**
 * 모든 효과음은 외부 음원 없이 코드로 직접 합성한다 (라이선스 문제 없음, CREDITS.md 참고).
 * 처리 중 저음 험은 루프 재생.
 */
@Singleton
class SfxPlayer @Inject constructor() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val buffers = HashMap<Sfx, ShortArray>()
    private var humTrack: AudioTrack? = null

    @Volatile var enabled: Boolean = true
    @Volatile var volume: Float = 0.7f

    fun prepare() {
        scope.launch {
            Sfx.entries.forEach { buffers[it] = synth(it) }
        }
    }

    fun play(sfx: Sfx) {
        if (!enabled || volume <= 0f) return
        scope.launch {
            val data = buffers[sfx] ?: synth(sfx).also { buffers[sfx] = it }
            val track = newTrack(data.size, AudioTrack.MODE_STATIC) ?: return@launch
            track.write(data, 0, data.size)
            track.setVolume(volume)
            track.notificationMarkerPosition = data.size - 1
            track.setPlaybackPositionUpdateListener(object : AudioTrack.OnPlaybackPositionUpdateListener {
                override fun onMarkerReached(t: AudioTrack) { runCatching { t.release() } }
                override fun onPeriodicNotification(t: AudioTrack) {}
            })
            runCatching { track.play() }.onFailure { track.release() }
        }
    }

    /** 처리 중 저음 험 (루프). */
    fun startHum() {
        if (!enabled || volume <= 0f || humTrack != null) return
        val data = humBuffer()
        val track = newTrack(data.size, AudioTrack.MODE_STATIC) ?: return
        track.write(data, 0, data.size)
        track.setLoopPoints(0, data.size, -1)
        track.setVolume(volume * 0.35f)
        humTrack = track
        runCatching { track.play() }
    }

    fun stopHum() {
        humTrack?.let { runCatching { it.stop() }; runCatching { it.release() } }
        humTrack = null
    }

    private fun newTrack(samples: Int, mode: Int): AudioTrack? = runCatching {
        AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build(),
            )
            .setTransferMode(mode)
            .setBufferSizeInBytes(samples * 2)
            .build()
    }.getOrNull()

    // ---------------- 합성 ----------------

    private fun synth(sfx: Sfx): ShortArray = when (sfx) {
        Sfx.BOOT -> render(1.6f) { t ->
            // 상승 스윕 + 마지막 화음
            val sweepF = 120.0 + 900.0 * (t / 1.0).coerceAtMost(1.0).let { it * it }
            val sweep = sin(phaseOf(t) { sweepF }) * env(t, 0.02, 1.0) * 0.35
            val chordT = t - 1.0
            val chord = if (chordT > 0) (
                sin(2 * PI * 440.0 * chordT) + sin(2 * PI * 659.25 * chordT) * 0.7 + sin(2 * PI * 880.0 * chordT) * 0.5
                ) * exp(-chordT * 4.5) * 0.28 else 0.0
            val shimmer = (Random.nextDouble() * 2 - 1) * exp(-kotlin.math.abs(t - 1.0) * 30) * 0.15
            sweep + chord + shimmer
        }
        Sfx.LISTEN -> render(0.32f) { t ->
            // "띠링": 두 음
            val a = if (t < 0.12) sin(2 * PI * 1318.5 * t) * env(t, 0.004, 0.12) else 0.0
            val t2 = t - 0.1
            val b = if (t2 > 0) sin(2 * PI * 1975.5 * t2) * exp(-t2 * 14) * min(1.0, t2 / 0.004) else 0.0
            (a + b) * 0.45
        }
        Sfx.DONE -> render(0.14f) { t ->
            // "칙": 짧은 노이즈 버스트 + 고음 클릭
            val noise = (Random.nextDouble() * 2 - 1) * exp(-t * 55)
            val click = sin(2 * PI * 3200.0 * t) * exp(-t * 80)
            (noise * 0.35 + click * 0.25)
        }
        Sfx.ERROR -> render(0.5f) { t ->
            val f = if (t < 0.22) 440.0 else 311.0
            val local = if (t < 0.22) t else t - 0.25
            if (local < 0) 0.0 else {
                val sq = if (sin(2 * PI * f * local) >= 0) 1.0 else -1.0
                sq * env(local, 0.005, 0.2) * 0.18
            }
        }
        Sfx.CLICK -> render(0.05f) { t -> sin(2 * PI * 2400.0 * t) * exp(-t * 120) * 0.25 }
        Sfx.CONFIRM -> render(0.4f) { t ->
            (sin(2 * PI * 880.0 * t) * 0.6 + sin(2 * PI * 1174.7 * t) * 0.4) * env(t, 0.01, 0.38) * 0.3
        }
    }

    private fun humBuffer(): ShortArray {
        // 2초 루프: 55Hz + 110Hz + 느린 LFO. 루프 경계에서 위상이 맞도록 정수 주기.
        val seconds = 2.0
        val n = (RATE * seconds).toInt()
        return ShortArray(n) { i ->
            val t = i / RATE.toDouble()
            val lfo = 0.75 + 0.25 * sin(2 * PI * 0.5 * t)
            val v = (sin(2 * PI * 55.0 * t) * 0.6 + sin(2 * PI * 110.0 * t) * 0.3 + sin(2 * PI * 165.0 * t) * 0.1) * lfo * 0.5
            (v * Short.MAX_VALUE).toInt().toShort()
        }
    }

    private fun render(seconds: Float, fn: (Double) -> Double): ShortArray {
        val n = (RATE * seconds).toInt()
        phaseAcc = 0.0
        return ShortArray(n) { i ->
            val v = fn(i / RATE.toDouble()).coerceIn(-1.0, 1.0)
            (v * Short.MAX_VALUE * 0.9).toInt().toShort()
        }
    }

    private var phaseAcc = 0.0
    private inline fun phaseOf(@Suppress("UNUSED_PARAMETER") t: Double, freq: () -> Double): Double {
        phaseAcc += 2 * PI * freq() / RATE
        return phaseAcc
    }

    private fun env(t: Double, attack: Double, length: Double): Double = when {
        t < attack -> t / attack
        t > length -> 0.0
        else -> 1.0 - (t - attack) / (length - attack)
    }

    private companion object {
        const val RATE = 44_100
    }
}
