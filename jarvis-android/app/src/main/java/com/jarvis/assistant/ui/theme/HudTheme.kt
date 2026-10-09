package com.jarvis.assistant.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.jarvis.assistant.R
import com.jarvis.assistant.data.settings.HudTheme

@Immutable
data class HudPalette(
    /** 메인 홀로그램 색 */
    val primary: Color,
    /** 보조 (시안 화이트) */
    val secondary: Color,
    val warn: Color,
    val danger: Color,
    val bg: Color,
    val bgDeep: Color,
    /** 본문용 흐린 색 */
    val dim: Color,
)

val Bg = Color(0xFF03070F)
val Amber = Color(0xFFFFB300)
val Danger = Color(0xFFFF3D57)

fun paletteFor(theme: HudTheme): HudPalette = when (theme) {
    HudTheme.CYAN -> HudPalette(Color(0xFF00E5FF), Color(0xFFB8F6FF), Amber, Danger, Bg, Color(0xFF01030A), Color(0xFF5E8A99))
    HudTheme.AMBER -> HudPalette(Color(0xFFFFB300), Color(0xFFFFE6A6), Color(0xFFFF7A1A), Danger, Color(0xFF0A0703), Color(0xFF040301), Color(0xFF99805A))
    HudTheme.RED -> HudPalette(Color(0xFFFF3D57), Color(0xFFFFC4CC), Amber, Color(0xFFFF9100), Color(0xFF0B0306), Color(0xFF050103), Color(0xFF995A64))
    HudTheme.WHITE -> HudPalette(Color(0xFFE8F4FF), Color(0xFFFFFFFF), Amber, Danger, Color(0xFF05070A), Color(0xFF020305), Color(0xFF7D8894))
}

val LocalHud = staticCompositionLocalOf { paletteFor(HudTheme.CYAN) }
val LocalLiteMode = staticCompositionLocalOf { false }

object HudFonts {
    val orbitron = FontFamily(
        Font(R.font.orbitron_medium, FontWeight.Medium),
        Font(R.font.orbitron_bold, FontWeight.Bold),
        Font(R.font.orbitron_black, FontWeight.Black),
    )
    val rajdhani = FontFamily(
        Font(R.font.rajdhani_medium, FontWeight.Medium),
        Font(R.font.rajdhani_semibold, FontWeight.SemiBold),
        Font(R.font.rajdhani_bold, FontWeight.Bold),
    )
    val pretendard = FontFamily(
        Font(R.font.pretendard_regular, FontWeight.Normal),
        Font(R.font.pretendard_medium, FontWeight.Medium),
        Font(R.font.pretendard_bold, FontWeight.Bold),
    )
}

/** 글자에 은은한 발광 */
fun glow(color: Color, radius: Float = 14f, alpha: Float = 0.85f) =
    Shadow(color = color.copy(alpha = alpha), offset = Offset.Zero, blurRadius = radius)

object HudType {
    /** 영문 대문자 라벨 (자간 넓게) */
    fun label(color: Color, size: TextUnit = 10.sp, weight: FontWeight = FontWeight.Medium, glowOn: Boolean = true) = TextStyle(
        fontFamily = HudFonts.orbitron,
        fontWeight = weight,
        fontSize = size,
        letterSpacing = 0.22.em,
        color = color,
        shadow = if (glowOn) glow(color, 10f, 0.6f) else null,
    )

    /** 큰 숫자 (시계, 게이지 값) */
    fun numeric(color: Color, size: TextUnit, weight: FontWeight = FontWeight.Bold) = TextStyle(
        fontFamily = HudFonts.orbitron,
        fontWeight = weight,
        fontSize = size,
        letterSpacing = 0.06.em,
        color = color,
        shadow = glow(color, 22f, 0.9f),
    )

    /** 테크 보조 텍스트 */
    fun tech(color: Color, size: TextUnit = 13.sp, weight: FontWeight = FontWeight.SemiBold) = TextStyle(
        fontFamily = HudFonts.rajdhani,
        fontWeight = weight,
        fontSize = size,
        letterSpacing = 0.08.em,
        color = color,
        shadow = glow(color, 8f, 0.5f),
    )

    /** 한글 본문 */
    fun body(color: Color, size: TextUnit = 15.sp, weight: FontWeight = FontWeight.Normal) = TextStyle(
        fontFamily = HudFonts.pretendard,
        fontWeight = weight,
        fontSize = size,
        lineHeight = size * 1.45f,
        color = color,
        shadow = glow(color, 8f, 0.45f),
    )
}

@Composable
fun JarvisTheme(theme: HudTheme, lite: Boolean, content: @Composable () -> Unit) {
    val palette = paletteFor(theme)
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = palette.primary,
            secondary = palette.secondary,
            background = palette.bg,
            surface = palette.bg,
            error = palette.danger,
            onPrimary = palette.bg,
            onBackground = palette.secondary,
            onSurface = palette.secondary,
        ),
    ) {
        CompositionLocalProvider(
            LocalHud provides palette,
            LocalLiteMode provides lite,
            content = content,
        )
    }
}
