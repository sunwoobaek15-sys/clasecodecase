package com.jarvis.assistant.ui.main

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jarvis.assistant.ai.AssistantEngine
import com.jarvis.assistant.ai.EngineEvent
import com.jarvis.assistant.ai.Turn
import com.jarvis.assistant.audio.HapticPattern
import com.jarvis.assistant.audio.Haptics
import com.jarvis.assistant.audio.Sfx
import com.jarvis.assistant.audio.SfxPlayer
import com.jarvis.assistant.briefing.Briefing
import com.jarvis.assistant.briefing.BriefingComposer
import com.jarvis.assistant.briefing.BriefingStore
import com.jarvis.assistant.data.db.MessageDao
import com.jarvis.assistant.data.db.MessageEntity
import com.jarvis.assistant.data.settings.AppSettings
import com.jarvis.assistant.data.settings.SecureKeyStore
import com.jarvis.assistant.data.settings.SettingsRepository
import com.jarvis.assistant.interaction.ConfirmationBroker
import com.jarvis.assistant.services.BatteryInfo
import com.jarvis.assistant.services.CalendarRepository
import com.jarvis.assistant.services.DeviceStatus
import com.jarvis.assistant.services.LocationService
import com.jarvis.assistant.services.NetworkInfo
import com.jarvis.assistant.services.NewsService
import com.jarvis.assistant.services.StorageInfo
import com.jarvis.assistant.services.WeatherService
import com.jarvis.assistant.tools.EventItem
import com.jarvis.assistant.tools.NewsItem
import com.jarvis.assistant.tools.ResultCard
import com.jarvis.assistant.tools.ToolCategory
import com.jarvis.assistant.ui.reactor.CoreMode
import com.jarvis.assistant.voice.SpeechInput
import com.jarvis.assistant.voice.SpeechOutput
import com.jarvis.assistant.voice.WakeWordController
import com.jarvis.assistant.widget.JarvisWidgetProvider
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import android.content.Context
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.LocalTime
import javax.inject.Inject

data class LogLine(
    val id: Long,
    val fromUser: Boolean,
    val text: String,
    val streaming: Boolean = false,
    val error: Boolean = false,
    /** 저장된 기록을 다시 보여줄 때는 타이핑 효과 없이 */
    val animate: Boolean = true,
)

data class ExecutingTool(val id: String, val label: String, val category: ToolCategory, val startedAt: Long)

data class CardEntry(val id: Long, val card: ResultCard)

data class WeatherSnapshot(
    val place: String,
    val temp: Int,
    val code: Int,
    val isDay: Boolean,
    val hourlyPrecip: List<Int>,
    val hourlyTemps: List<Double>,
    val max: Int,
    val min: Int,
)

data class SystemSnapshot(val battery: BatteryInfo, val network: NetworkInfo, val storage: StorageInfo)

data class HudUiState(
    val mode: CoreMode = CoreMode.IDLE,
    val logs: List<LogLine> = emptyList(),
    val partialSpeech: String? = null,
    val executing: List<ExecutingTool> = emptyList(),
    val cards: List<CardEntry> = emptyList(),
    val weather: WeatherSnapshot? = null,
    val nextEvent: EventItem? = null,
    val system: SystemSnapshot? = null,
    val headlines: List<NewsItem> = emptyList(),
    val statusMessage: String? = null,
    val lowPower: Boolean = false,
    val textInputOpen: Boolean = false,
)

@HiltViewModel
class MainViewModel @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val engine: AssistantEngine,
    private val speechIn: SpeechInput,
    private val speechOut: SpeechOutput,
    private val sfx: SfxPlayer,
    private val haptics: Haptics,
    private val messageDao: MessageDao,
    private val settingsRepo: SettingsRepository,
    private val keyStore: SecureKeyStore,
    private val weatherService: WeatherService,
    private val newsService: NewsService,
    private val calendar: CalendarRepository,
    private val location: LocationService,
    private val device: DeviceStatus,
    private val confirmations: ConfirmationBroker,
    private val wake: WakeWordController,
    private val briefingComposer: BriefingComposer,
    private val briefingStore: BriefingStore,
    private val permissions: com.jarvis.assistant.tools.PermissionGate,
) : ViewModel() {

    private val _state = MutableStateFlow(HudUiState())
    val state: StateFlow<HudUiState> = _state.asStateFlow()

    val settings: StateFlow<AppSettings?> = settingsRepo.settings
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val hasApiKey: StateFlow<Boolean> = keyStore.hasKey

    /** 마이크 음량 0..1 (리액터 그리기 단계에서만 읽음) */
    private val _micLevel = MutableStateFlow(0f)
    val micLevel: StateFlow<Float> = _micLevel.asStateFlow()

    /** TTS 음절 엔벨로프 */
    val speechEnvelope: StateFlow<Float> = speechOut.envelope

    val pendingConfirmation = confirmations.pending

    private var interaction: Job? = null
    private var idleWatch: Job? = null
    private var lastActivity = System.currentTimeMillis()
    private var nextId = 1L
    private var bootGreeted = false

    init {
        sfx.prepare()
        viewModelScope.launch {
            settingsRepo.settings.collect { s ->
                sfx.enabled = s.sfxEnabled
                sfx.volume = s.sfxVolume
                haptics.enabled = s.haptics
            }
        }
        viewModelScope.launch {
            val saved = messageDao.recent(40)
            engine.restore(saved.map { Turn(it.fromUser, it.text) })
            _state.update { st ->
                st.copy(logs = saved.takeLast(6).map { LogLine(nextId++, it.fromUser, it.text, animate = false) })
            }
        }
        viewModelScope.launch {
            wake.detections.collect { startListening() }
        }
        viewModelScope.launch {
            // 확인 요청이 오면 음성으로 묻고 "네/아니요" 를 듣는다
            confirmations.pending.collect { req -> if (req != null) voiceConfirm(req) }
        }
        startIdleWatch()
        startHudRefresh()
    }

    // ───────────────────────── 화면 생명주기 ─────────────────────────

    fun onForeground(fg: Boolean) {
        wake.uiForeground = fg
        if (!fg) {
            cancelInteraction()
        }
    }

    fun greetAfterBoot() {
        if (bootGreeted) return
        bootGreeted = true
        viewModelScope.launch {
            val s = settingsRepo.current()
            val hour = LocalTime.now().hour
            val greet = when (hour) {
                in 4..10 -> "좋은 아침입니다"
                in 11..16 -> "좋은 오후입니다"
                in 17..21 -> "좋은 저녁입니다"
                else -> "늦은 시간까지 수고 많으십니다"
            }
            val name = s.userName.trim().takeIf { it.isNotEmpty() }?.let { if (it.endsWith("님")) it else "${it}님" }
            val text = buildString {
                append(greet)
                if (name != null) append(", ").append(name)
                append(". 모든 시스템 정상 가동 중입니다.")
                if (!keyStore.hasKey.value) append(" 먼저 설정에서 API 키를 입력해 주세요.")
            }
            addLog(LogLine(nextId++, false, text))
            speak(text, s)
        }
    }

    // ───────────────────────── 입력 ─────────────────────────

    /** 코어 탭 */
    fun onCoreTap() {
        touch()
        when (_state.value.mode) {
            CoreMode.LISTENING -> cancelInteraction()
            CoreMode.SPEAKING -> {
                speechOut.stop()
                startListening()
            }
            CoreMode.THINKING, CoreMode.EXECUTING -> {
                if (confirmations.pending.value == null) {
                    cancelInteraction()
                    setStatus("작업을 중단했습니다")
                }
            }
            else -> startListening()
        }
    }

    fun openTextInput(open: Boolean) {
        touch()
        _state.update { it.copy(textInputOpen = open) }
    }

    fun submitText(text: String) {
        val t = text.trim()
        if (t.isEmpty()) return
        _state.update { it.copy(textInputOpen = false) }
        speechOut.stop()
        interaction?.cancel()
        interaction = viewModelScope.launch { converse(t) }
    }

    fun startListening() {
        touch()
        speechOut.stop()
        interaction?.cancel()
        interaction = viewModelScope.launch {
            if (!speechIn.isAvailable()) {
                fail("이 기기에서 음성 인식을 사용할 수 없습니다. 코어를 길게 눌러 텍스트로 입력하세요.")
                return@launch
            }
            val micOk = permissions.ensure(
                listOf(android.Manifest.permission.RECORD_AUDIO),
                "말로 명령하려면 마이크 권한이 필요합니다. 거부하시면 코어를 길게 눌러 텍스트로 입력할 수 있습니다.",
            )
            if (!micOk) {
                setStatus("마이크 권한 없음 — 코어를 길게 눌러 텍스트로 입력하세요")
                return@launch
            }
            wake.pause("listen")
            try {
                val heard = listenOnce() ?: return@launch
                converse(heard)
            } finally {
                wake.resume("listen")
            }
        }
    }

    private suspend fun listenOnce(shortForm: Boolean = false): String? {
        sfx.play(Sfx.LISTEN)
        haptics.play(HapticPattern.LISTEN)
        setMode(CoreMode.LISTENING)
        _state.update { it.copy(partialSpeech = "", statusMessage = null) }
        var result: String? = null
        try {
            speechIn.listen(shortForm = shortForm).collect { e ->
                when (e) {
                    is SpeechInput.Event.Level -> _micLevel.value = e.value
                    is SpeechInput.Event.Partial -> _state.update { it.copy(partialSpeech = e.text) }
                    is SpeechInput.Event.Final -> result = e.text
                    is SpeechInput.Event.Error -> {
                        if (SpeechInput.isSilence(e.code)) setStatus("NO SIGNAL — 음성이 감지되지 않았습니다")
                        else if (e.code != android.speech.SpeechRecognizer.ERROR_CLIENT) {
                            fail(e.message)
                        }
                    }
                    else -> Unit
                }
            }
        } finally {
            _micLevel.value = 0f
            _state.update { it.copy(partialSpeech = null) }
            if (result == null && _state.value.mode == CoreMode.LISTENING) setMode(CoreMode.IDLE)
        }
        return result
    }

    // ───────────────────────── 대화 ─────────────────────────

    private suspend fun converse(userText: String) {
        touch()
        val s = settingsRepo.current()
        addLog(LogLine(nextId++, true, userText))
        messageDao.insert(MessageEntity(fromUser = true, text = userText))

        if (isBriefingRequest(userText)) {
            playBriefing(fresh = true)
            return
        }

        setMode(CoreMode.THINKING)
        haptics.play(HapticPattern.THINK)
        sfx.startHum()
        _state.update { it.copy(cards = emptyList()) }
        val replyId = nextId++
        var streamed = ""
        var failed = false
        var finalText: String? = null
        try {
            engine.run(userText).collect { e ->
                when (e) {
                    EngineEvent.Thinking -> if (_state.value.executing.isEmpty()) setMode(CoreMode.THINKING)
                    is EngineEvent.TextDelta -> {
                        streamed += e.text
                        upsertLog(LogLine(replyId, false, streamed.trim(), streaming = true))
                    }
                    is EngineEvent.ToolStarted -> {
                        if (streamed.isNotBlank() && !streamed.endsWith("\n")) streamed += "\n"
                        haptics.play(HapticPattern.EXECUTE)
                        _state.update {
                            it.copy(mode = CoreMode.EXECUTING, executing = it.executing + ExecutingTool(e.id, e.label, e.category, System.currentTimeMillis()))
                        }
                    }
                    is EngineEvent.ToolFinished -> {
                        sfx.play(if (e.result.isError) Sfx.ERROR else Sfx.DONE)
                        _state.update { st ->
                            st.copy(
                                executing = st.executing.filterNot { it.id == e.id },
                                cards = e.result.card?.let { (st.cards + CardEntry(nextId++, it)).takeLast(3) } ?: st.cards,
                                mode = if (st.executing.size <= 1) CoreMode.THINKING else st.mode,
                            )
                        }
                        if (e.result.card is ResultCard.Events || e.name.contains("calendar")) refreshNextEvent()
                    }
                    is EngineEvent.Completed -> finalText = e.text
                    is EngineEvent.Failed -> {
                        failed = true
                        fail(e.message)
                    }
                }
            }
        } finally {
            sfx.stopHum()
            _state.update { it.copy(executing = emptyList()) }
        }
        if (failed) {
            if (streamed.isBlank()) removeLog(replyId)
            return
        }
        val reply = finalText ?: return
        upsertLog(LogLine(replyId, false, reply, streaming = false))
        messageDao.insert(MessageEntity(fromUser = false, text = reply))
        haptics.play(HapticPattern.DONE)
        speak(reply, s)
    }

    private suspend fun speak(text: String, s: AppSettings) {
        setMode(CoreMode.SPEAKING)
        speechOut.speak(text, s.ttsRate, s.ttsPitch)
        if (_state.value.mode == CoreMode.SPEAKING) setMode(CoreMode.IDLE)
        touch()
    }

    private suspend fun fail(message: String) {
        sfx.stopHum()
        sfx.play(Sfx.ERROR)
        haptics.play(HapticPattern.ERROR)
        addLog(LogLine(nextId++, false, message, error = true))
        setMode(CoreMode.ERROR)
        delay(1_300)
        if (_state.value.mode == CoreMode.ERROR) setMode(CoreMode.IDLE)
        val s = settingsRepo.current()
        speechOut.speak(message, s.ttsRate, s.ttsPitch)
    }

    private fun cancelInteraction() {
        interaction?.cancel()
        interaction = null
        speechOut.stop()
        sfx.stopHum()
        _micLevel.value = 0f
        _state.update { it.copy(mode = CoreMode.IDLE, partialSpeech = null, executing = emptyList()) }
    }

    // ───────────────────────── 위험 작업 확인 ─────────────────────────

    private suspend fun voiceConfirm(req: ConfirmationBroker.Request) {
        sfx.play(Sfx.CONFIRM)
        haptics.play(HapticPattern.WARN)
        val s = settingsRepo.current()
        speechOut.speak(req.prompt, s.ttsRate, s.ttsPitch)
        if (confirmations.pending.value !== req) return
        if (!speechIn.isAvailable() || !permissions.isGranted(listOf(android.Manifest.permission.RECORD_AUDIO))) return
        wake.pause("confirm")
        try {
            // 최대 두 번 듣는다. 애매하면 버튼으로 결정하도록 둔다.
            repeat(2) {
                if (confirmations.pending.value !== req) return
                val answer = listenOnce(shortForm = true)
                _state.update { it.copy(mode = CoreMode.EXECUTING) }
                when (parseYesNo(answer)) {
                    true -> { confirmations.resolve(req, true); return }
                    false -> { confirmations.resolve(req, false); return }
                    null -> Unit
                }
            }
        } finally {
            wake.resume("confirm")
        }
    }

    fun resolveConfirmation(req: ConfirmationBroker.Request, approved: Boolean) {
        sfx.play(if (approved) Sfx.CONFIRM else Sfx.CLICK)
        haptics.play(if (approved) HapticPattern.DONE else HapticPattern.TICK)
        confirmations.resolve(req, approved)
    }

    private fun parseYesNo(text: String?): Boolean? {
        val t = text?.replace(" ", "")?.lowercase() ?: return null
        val no = listOf("아니", "취소", "하지마", "됐어", "그만", "멈춰", "싫어", "안돼", "no", "stop", "cancel")
        val yes = listOf("네", "예", "응", "그래", "좋아", "확인", "진행", "보내", "걸어", "해줘", "어", "맞아", "yes", "ok", "오케이", "삭제해")
        if (no.any { t.contains(it) }) return false
        if (yes.any { t.contains(it) }) return true
        return null
    }

    // ───────────────────────── 브리핑 ─────────────────────────

    private fun isBriefingRequest(text: String): Boolean {
        val t = text.replace(" ", "")
        return t.contains("브리핑") && (t.contains("아침") || t.contains("오늘") || t.length <= 8)
    }

    fun playBriefingFromNotification() {
        interaction?.cancel()
        interaction = viewModelScope.launch { playBriefing(fresh = false) }
    }

    private suspend fun playBriefing(fresh: Boolean) {
        setMode(CoreMode.THINKING)
        sfx.startHum()
        val stored = if (fresh) null else briefingStore.load()?.takeIf { System.currentTimeMillis() - it.createdAt < 3 * 3_600_000L }
        val b: Briefing = try {
            stored ?: briefingComposer.compose().also { briefingStore.save(it) }
        } catch (e: Exception) {
            sfx.stopHum()
            fail("브리핑 정보를 가져오지 못했습니다.")
            return
        } finally {
            sfx.stopHum()
        }
        val cards = buildList {
            _state.value.weather?.let { w ->
                add(ResultCard.Weather(w.place, w.temp.toDouble(), w.temp.toDouble(), w.code, 0, 0.0, w.hourlyTemps, w.hourlyPrecip, w.hourlyTemps.indices.map { "" }, w.max.toDouble(), w.min.toDouble(), w.isDay))
            }
            if (b.events.isNotEmpty()) add(ResultCard.Events("TODAY", b.events.mapIndexed { i, e -> EventItem(i.toLong(), e.title, e.startMillis, e.startMillis + 3_600_000L, e.allDay, null) }))
            if (b.news.isNotEmpty()) add(ResultCard.News("HEADLINES", b.news.map { NewsItem(it.title, it.source, it.link, null) }))
        }
        _state.update { it.copy(cards = cards.takeLast(3).map { c -> CardEntry(nextId++, c) }) }
        addLog(LogLine(nextId++, false, b.spoken))
        messageDao.insert(MessageEntity(fromUser = false, text = b.spoken))
        speak(b.spoken, settingsRepo.current())
    }

    // ───────────────────────── HUD 데이터 ─────────────────────────

    private fun startHudRefresh() {
        viewModelScope.launch {
            while (isActive) {
                refreshSystem()
                delay(10_000)
            }
        }
        viewModelScope.launch {
            while (isActive) {
                refreshNextEvent()
                delay(60_000)
            }
        }
        viewModelScope.launch {
            while (isActive) {
                refreshWeather()
                delay(30 * 60_000L)
            }
        }
        viewModelScope.launch {
            while (isActive) {
                runCatching { newsService.headlines(null, 10) }.onSuccess { list ->
                    _state.update { it.copy(headlines = list) }
                }
                delay(30 * 60_000L)
            }
        }
    }

    fun refreshAll() {
        viewModelScope.launch {
            refreshSystem()
            refreshNextEvent()
            refreshWeather()
        }
    }

    private fun refreshSystem() {
        runCatching { SystemSnapshot(device.battery(), device.network(), device.storage()) }
            .onSuccess { snap -> _state.update { it.copy(system = snap) } }
    }

    private suspend fun refreshNextEvent() {
        val next = runCatching { calendar.next() }.getOrNull()
        _state.update { it.copy(nextEvent = next) }
        runCatching { JarvisWidgetProvider.requestUpdate(appContext) }
    }

    private suspend fun refreshWeather() {
        val loc = runCatching { if (location.hasPermission()) location.current() else location.cached() }.getOrNull() ?: return
        runCatching { weatherService.forecast(loc.lat, loc.lon) }.onSuccess { r ->
            _state.update {
                it.copy(
                    weather = WeatherSnapshot(
                        place = loc.place ?: "LOCAL",
                        temp = Math.round(r.current.temperature).toInt(),
                        code = r.current.code,
                        isDay = r.current.isDay == 1,
                        hourlyPrecip = r.next12h.map { h -> h.precipProb },
                        hourlyTemps = r.next12h.map { h -> h.temp },
                        max = Math.round(r.todayMax).toInt(),
                        min = Math.round(r.todayMin).toInt(),
                    ),
                )
            }
        }
    }

    // ───────────────────────── 대기 절전 ─────────────────────────

    private fun touch() {
        lastActivity = System.currentTimeMillis()
        if (_state.value.lowPower) _state.update { it.copy(lowPower = false) }
    }

    private fun startIdleWatch() {
        idleWatch = viewModelScope.launch {
            while (isActive) {
                delay(5_000)
                val idle = _state.value.mode == CoreMode.IDLE && System.currentTimeMillis() - lastActivity > IDLE_LOW_POWER_MS
                if (idle != _state.value.lowPower) _state.update { it.copy(lowPower = idle) }
            }
        }
    }

    fun dismissCard(id: Long) {
        _state.update { st -> st.copy(cards = st.cards.filterNot { it.id == id }) }
    }

    fun clearHistory() {
        viewModelScope.launch {
            messageDao.clear()
            engine.reset()
            _state.update { it.copy(logs = emptyList(), cards = emptyList()) }
        }
    }

    // ───────────────────────── 내부 도우미 ─────────────────────────

    private fun setMode(mode: CoreMode) {
        _state.update { it.copy(mode = mode) }
    }

    private fun setStatus(msg: String?) {
        _state.update { it.copy(statusMessage = msg) }
        if (msg != null) viewModelScope.launch {
            delay(3_500)
            _state.update { if (it.statusMessage == msg) it.copy(statusMessage = null) else it }
        }
    }

    private fun addLog(line: LogLine) {
        _state.update { it.copy(logs = (it.logs + line).takeLast(MAX_LOGS)) }
    }

    private fun upsertLog(line: LogLine) {
        _state.update { st ->
            val idx = st.logs.indexOfFirst { it.id == line.id }
            val logs = if (idx >= 0) st.logs.toMutableList().also { it[idx] = line } else (st.logs + line)
            st.copy(logs = logs.takeLast(MAX_LOGS))
        }
    }

    private fun removeLog(id: Long) {
        _state.update { st -> st.copy(logs = st.logs.filterNot { it.id == id }) }
    }

    override fun onCleared() {
        speechOut.stop()
        sfx.stopHum()
        super.onCleared()
    }

    companion object {
        private const val MAX_LOGS = 12
        private const val IDLE_LOW_POWER_MS = 45_000L
    }
}
