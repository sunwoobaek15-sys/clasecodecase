package com.jarvis.assistant.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/** 위젯/알림용 정지 리액터 이미지 (RemoteViews 는 Compose 를 못 쓰므로 Bitmap 으로 그린다). */
object ReactorBitmap {

    fun accentFor(themeIndex: Int): Int = when (themeIndex) {
        1 -> 0xFFFFB300.toInt()
        2 -> 0xFFFF3D57.toInt()
        3 -> 0xFFE8F4FF.toInt()
        else -> 0xFF00E5FF.toInt()
    }

    fun render(context: Context, sizeDp: Int, accent: Int, phase: Float = 0f): Bitmap {
        val px = (sizeDp * context.resources.displayMetrics.density).toInt().coerceIn(64, 720)
        val bmp = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val cx = px / 2f
        val cy = px / 2f
        val r = px * 0.46f
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
        val glow = Paint(p).apply { maskFilter = BlurMaskFilter(px * 0.02f, BlurMaskFilter.Blur.NORMAL) }

        // 블룸
        c.drawCircle(cx, cy, r, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = RadialGradient(cx, cy, r, intArrayOf(withAlpha(accent, 90), withAlpha(accent, 20), Color.TRANSPARENT), floatArrayOf(0f, 0.55f, 1f), Shader.TileMode.CLAMP)
        })

        fun ring(radius: Float, width: Float, alpha: Int) {
            glow.color = withAlpha(accent, alpha / 2); glow.strokeWidth = width * 3
            c.drawCircle(cx, cy, radius, glow)
            p.color = withAlpha(accent, alpha); p.strokeWidth = width
            c.drawCircle(cx, cy, radius, p)
        }
        fun arcs(radius: Float, width: Float, alpha: Int, segments: List<Pair<Float, Float>>, rot: Float) {
            val rect = RectF(cx - radius, cy - radius, cx + radius, cy + radius)
            for ((start, sweep) in segments) {
                glow.color = withAlpha(accent, alpha / 2); glow.strokeWidth = width * 2.5f
                c.drawArc(rect, start + rot, sweep, false, glow)
                p.color = withAlpha(accent, alpha); p.strokeWidth = width
                c.drawArc(rect, start + rot, sweep, false, p)
            }
        }

        // 눈금 링
        p.strokeWidth = px * 0.006f
        for (i in 0 until 72) {
            val a = (i / 72f) * 2 * PI + phase
            val len = if (i % 6 == 0) r * 0.07f else r * 0.035f
            p.color = withAlpha(accent, if (i % 6 == 0) 230 else 120)
            c.drawLine(cx + cos(a).toFloat() * r, cy + sin(a).toFloat() * r, cx + cos(a).toFloat() * (r - len), cy + sin(a).toFloat() * (r - len), p)
        }
        arcs(r * 0.86f, px * 0.022f, 220, listOf(10f to 70f, 100f to 40f, 190f to 95f, 300f to 30f), phase * 57f)
        ring(r * 0.74f, px * 0.006f, 160)
        arcs(r * 0.66f, px * 0.012f, 200, listOf(0f to 20f, 30f to 20f, 60f to 20f, 120f to 50f, 200f to 20f, 230f to 20f, 260f to 60f), -phase * 90f)
        ring(r * 0.52f, px * 0.016f, 240)
        // 코어
        c.drawCircle(cx, cy, r * 0.42f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = RadialGradient(cx, cy, r * 0.42f, intArrayOf(Color.WHITE, withAlpha(accent, 230), withAlpha(accent, 40), Color.TRANSPARENT), floatArrayOf(0f, 0.3f, 0.75f, 1f), Shader.TileMode.CLAMP)
        })
        // 광선
        p.strokeWidth = px * 0.004f
        for (i in 0 until 16) {
            val a = (i / 16f) * 2 * PI + phase * 0.5
            p.color = withAlpha(Color.WHITE, 90)
            c.drawLine(cx + cos(a).toFloat() * r * 0.18f, cy + sin(a).toFloat() * r * 0.18f, cx + cos(a).toFloat() * r * 0.36f, cy + sin(a).toFloat() * r * 0.36f, p)
        }
        return bmp
    }

    private fun withAlpha(color: Int, alpha: Int) = (color and 0x00FFFFFF) or (alpha.coerceIn(0, 255) shl 24)
}
