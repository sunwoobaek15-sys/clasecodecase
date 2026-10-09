package com.jarvis.assistant.ui.hud

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalContext
import kotlin.math.abs

/**
 * 화면 전체가 공유하는 프레임 시계(초).
 * 이 값은 그리기 단계(Canvas/drawBehind/graphicsLayer)에서만 읽어야 재구성 없이 매 프레임 다시 그려진다.
 */
val LocalFrameTime = compositionLocalOf<State<Float>> { mutableFloatStateOf(0f) }

/** 기기 기울기 (-1..1). 패럴랙스용. 그리기 단계에서만 읽을 것. */
val LocalTilt = compositionLocalOf<State<Offset>> { mutableStateOf(Offset.Zero) }

@Composable
fun rememberFrameTime(throttle: Boolean): State<Float> {
    val state = remember { mutableFloatStateOf(0f) }
    LaunchedEffect(throttle) {
        val start = withFrameNanos { it }
        var frame = 0L
        while (true) {
            withFrameNanos { now ->
                frame++
                // 라이트 모드: 절반 프레임만 갱신 (배터리 절약)
                if (!throttle || frame % 2L == 0L) state.floatValue = (now - start) / 1_000_000_000f
            }
        }
    }
    return state
}

@Composable
fun rememberTilt(enabled: Boolean): State<Offset> {
    val context = LocalContext.current
    val state = remember { mutableStateOf(Offset.Zero) }
    DisposableEffect(enabled) {
        if (!enabled) {
            state.value = Offset.Zero
            return@DisposableEffect onDispose { }
        }
        val sm = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val sensor = sm.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR) ?: sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        if (sensor == null) return@DisposableEffect onDispose { }
        val rot = FloatArray(9)
        val orient = FloatArray(3)
        var base: Offset? = null
        var smooth = Offset.Zero
        val listener = object : SensorEventListener {
            override fun onSensorChanged(e: SensorEvent) {
                val raw = if (e.sensor.type == Sensor.TYPE_GAME_ROTATION_VECTOR) {
                    SensorManager.getRotationMatrixFromVector(rot, e.values)
                    SensorManager.getOrientation(rot, orient)
                    Offset(orient[2], orient[1]) // roll, pitch (rad)
                } else {
                    Offset(-e.values[0] / 9.81f, e.values[1] / 9.81f)
                }
                val b = base ?: raw.also { base = it }
                // 기준 자세가 크게 바뀌면 천천히 따라간다
                base = b + (raw - b) * 0.004f
                val d = raw - b
                val target = Offset((d.x / 0.35f).coerceIn(-1f, 1f), (d.y / 0.35f).coerceIn(-1f, 1f))
                smooth += (target - smooth) * 0.12f
                if (abs(smooth.x - state.value.x) > 0.002f || abs(smooth.y - state.value.y) > 0.002f) state.value = smooth
            }
            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }
        sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_GAME)
        onDispose { sm.unregisterListener(listener) }
    }
    return state
}
