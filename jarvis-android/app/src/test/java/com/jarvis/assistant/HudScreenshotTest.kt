package com.jarvis.assistant

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.github.takahirom.roborazzi.captureRoboImage
import com.jarvis.assistant.data.settings.HudTheme
import com.jarvis.assistant.interaction.ConfirmationBroker
import com.jarvis.assistant.services.BatteryInfo
import com.jarvis.assistant.services.NetworkInfo
import com.jarvis.assistant.services.StorageInfo
import com.jarvis.assistant.tools.EventItem
import com.jarvis.assistant.tools.FileEntry
import com.jarvis.assistant.tools.NewsItem
import com.jarvis.assistant.tools.ResultCard
import com.jarvis.assistant.tools.ToolCategory
import com.jarvis.assistant.ui.boot.BootState
import com.jarvis.assistant.ui.boot.BootTerminal
import com.jarvis.assistant.ui.hud.HudBackground
import com.jarvis.assistant.ui.hud.LocalFrameTime
import com.jarvis.assistant.ui.hud.LocalTilt
import com.jarvis.assistant.ui.main.CardEntry
import com.jarvis.assistant.ui.main.ConfirmationDialog
import com.jarvis.assistant.ui.main.ExecutingTool
import com.jarvis.assistant.ui.main.FileRow
import com.jarvis.assistant.ui.main.HudUiState
import com.jarvis.assistant.ui.main.LogLine
import com.jarvis.assistant.ui.main.MainHud
import com.jarvis.assistant.ui.main.SystemSnapshot
import com.jarvis.assistant.ui.main.WeatherSnapshot
import com.jarvis.assistant.ui.nav.HudNavBar
import com.jarvis.assistant.ui.nav.Screen
import com.jarvis.assistant.ui.reactor.CoreMode
import com.jarvis.assistant.ui.schedule.RadarDial
import com.jarvis.assistant.ui.theme.JarvisTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * HUD 스크린샷 (Robolectric 네이티브 그래픽 + Roborazzi).
 * CI 에서 build/shots/*.png 로 저장된다. 실기기 없이 디자인을 점검하기 위한 용도.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w400dp-h860dp-xhdpi", application = android.app.Application::class)
class HudScreenshotTest {

    @get:Rule
    val compose = createComposeRule()

    private val now = System.currentTimeMillis()

    private val baseState = HudUiState(
        weather = WeatherSnapshot(
            place = "서울 강남구",
            temp = 18,
            code = 2,
            isDay = true,
            hourlyPrecip = listOf(0, 5, 10, 20, 40, 65, 70, 30, 10, 5, 0, 0),
            hourlyTemps = listOf(18.0, 19.0, 20.5, 21.0, 21.5, 20.0, 18.5, 17.0, 16.0, 15.5, 15.0, 14.5),
            max = 22,
            min = 13,
        ),
        nextEvent = EventItem(1, "디자인 리뷰 미팅", now + 5_047_000, now + 8_647_000, false, "본사 3층"),
        system = SystemSnapshot(BatteryInfo(76, false, 31f), NetworkInfo(true, "WIFI", 0.82f), StorageInfo(0.58f, 52f, 128f)),
        headlines = listOf(
            NewsItem("반도체 수출 3개월 연속 증가세", "연합뉴스", "https://example.com/1", null),
            NewsItem("주말 전국 대체로 맑고 일교차 커", "KBS", "https://example.com/2", null),
        ),
        logs = listOf(
            LogLine(1, false, "좋은 저녁입니다, 민수님. 모든 시스템 정상 가동 중입니다.", animate = false),
            LogLine(2, true, "내일 날씨 어때?", animate = false),
            LogLine(3, false, "내일 서울은 구름 조금, 최고 22도입니다. 오후 다섯 시쯤 비 소식이 있으니 우산을 챙기세요.", animate = false),
        ),
    )

    @Composable
    private fun Harness(theme: HudTheme = HudTheme.CYAN, t: Float = 12.4f, content: @Composable () -> Unit) {
        JarvisTheme(theme, lite = false) {
            CompositionLocalProvider(
                LocalFrameTime provides mutableFloatStateOf(t),
                LocalTilt provides mutableStateOf(Offset.Zero),
            ) {
                Box(Modifier.fillMaxSize()) {
                    HudBackground()
                    content()
                }
            }
        }
    }

    private fun shoot(name: String, settleMs: Long = 2_500, content: @Composable () -> Unit) {
        compose.mainClock.autoAdvance = false
        compose.setContent { content() }
        compose.mainClock.advanceTimeBy(settleMs)
        compose.onRoot().captureRoboImage("build/shots/$name.png")
    }

    @Composable
    private fun Main(state: HudUiState, level: Float = 0f, speech: Float = 0f) {
        Column(Modifier.fillMaxSize().padding(top = 24.dp)) {
            Box(Modifier.weight(1f)) {
                MainHud(state, BootState(skip = true), apiReady = true, { level }, { speech }, {}, {}, {})
            }
            HudNavBar(Screen.CORE, {})
        }
    }

    @Test
    fun main_idle() = shoot("01_main_idle") { Harness { Main(baseState) } }

    @Test
    fun main_listening() = shoot("02_main_listening") {
        Harness { Main(baseState.copy(mode = CoreMode.LISTENING, partialSpeech = "내일 오전 아홉 시에 알람"), level = 0.75f) }
    }

    @Test
    fun main_executing_with_cards() = shoot("03_main_executing") {
        Harness {
            Main(
                baseState.copy(
                    mode = CoreMode.EXECUTING,
                    executing = listOf(ExecutingTool("t1", "CALENDAR SYNC", ToolCategory.CALENDAR, now)),
                    cards = listOf(
                        CardEntry(
                            10,
                            ResultCard.Weather(
                                "서울 강남구", 18.0, 17.0, 61, 64, 9.0,
                                baseState.weather!!.hourlyTemps, baseState.weather.hourlyPrecip,
                                listOf("18", "19", "20", "21", "22", "23", "00", "01", "02", "03", "04", "05"),
                                22.0, 13.0, true,
                            ),
                        ),
                    ),
                ),
            )
        }
    }

    @Test
    fun main_thinking_amber() = shoot("04_main_thinking_amber") {
        Harness(HudTheme.AMBER) { Main(baseState.copy(mode = CoreMode.THINKING)) }
    }

    @Test
    fun confirmation_dialog() = shoot("05_confirm") {
        Harness {
            Main(baseState.copy(mode = CoreMode.EXECUTING))
            ConfirmationDialog(
                ConfirmationBroker.Request("TEXT TRANSMIT", "엄마에게 \"오늘 늦어요\" 라고 문자를 보냅니다. 진행할까요?", ToolCategory.COMMS, true),
            ) {}
        }
    }

    @Test
    fun boot_terminal() = shoot("06_boot", settleMs = 1_100) {
        Harness { BootTerminal(BootState(skip = false)) }
    }

    @Test
    fun schedule_radar_and_files() = shoot("07_radar_files") {
        val day = java.time.LocalDate.now().atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
        val events = listOf(
            EventItem(1, "스탠드업", day + 9 * 3_600_000L, day + 9 * 3_600_000L + 1_800_000L, false, null),
            EventItem(2, "디자인 리뷰", day + 14 * 3_600_000L, day + 16 * 3_600_000L, false, "3층"),
            EventItem(3, "헬스", day + 19 * 3_600_000L, day + 20 * 3_600_000L, false, null),
            EventItem(4, "점심 약속", day + 12 * 3_600_000L, day + 13 * 3_600_000L, false, null),
        )
        Harness {
            Column(Modifier.fillMaxSize().padding(16.dp)) {
                RadarDial(events, true, Modifier.fillMaxWidth().aspectRatio(1f))
                FileRow(FileEntry("FILE_0023", "분기 보고서 초안 작성", "PRIORITY: HIGH / DUE 2026-10-10 18:00", highlight = true))
                FileRow(FileEntry("FILE_0024", "세탁소 들르기", "PRIORITY: NORMAL"))
                FileRow(FileEntry("FILE_0019", "비타민 주문", "STATUS: COMPLETE", done = true))
            }
        }
    }
}
