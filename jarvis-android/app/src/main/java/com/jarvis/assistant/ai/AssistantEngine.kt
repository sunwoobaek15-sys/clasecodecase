package com.jarvis.assistant.ai

import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.core.JsonValue
import com.anthropic.errors.AnthropicServiceException
import com.anthropic.errors.BadRequestException
import com.anthropic.errors.RateLimitException
import com.anthropic.errors.UnauthorizedException
import com.anthropic.helpers.MessageAccumulator
import com.anthropic.models.messages.CacheControlEphemeral
import com.anthropic.models.messages.ContentBlockParam
import com.anthropic.models.messages.Message
import com.anthropic.models.messages.MessageCreateParams
import com.anthropic.models.messages.MessageParam
import com.anthropic.models.messages.OutputConfig
import com.anthropic.models.messages.StopReason
import com.anthropic.models.messages.TextBlockParam
import com.anthropic.models.messages.Tool
import com.anthropic.models.messages.ToolResultBlockParam
import com.anthropic.models.messages.ToolUnion
import com.anthropic.models.messages.ToolUseBlock
import com.fasterxml.jackson.databind.JsonNode
import com.jarvis.assistant.tools.JarvisTool
import com.jarvis.assistant.tools.ToolCategory
import com.jarvis.assistant.tools.ToolExecutor
import com.jarvis.assistant.tools.ToolRegistry
import com.jarvis.assistant.tools.ToolResult
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.trySendBlocking
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.channelFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.jsonObject
import java.time.Duration
import javax.inject.Inject
import javax.inject.Singleton

/** 엔진이 UI 에 흘려보내는 이벤트. */
sealed interface EngineEvent {
    /** API 요청을 보내고 첫 토큰을 기다리는 중 */
    data object Thinking : EngineEvent
    data class TextDelta(val text: String) : EngineEvent
    data class ToolStarted(val id: String, val name: String, val label: String, val category: ToolCategory) : EngineEvent
    data class ToolFinished(val id: String, val name: String, val result: ToolResult) : EngineEvent
    /** 최종 답변 (화면 표시 + TTS) */
    data class Completed(val text: String) : EngineEvent
    data class Failed(val message: String) : EngineEvent
}

/** 대화의 영속 형태. 텍스트만 저장해 앱 재시작/히스토리 재구성에 사용한다. */
data class Turn(val fromUser: Boolean, val text: String)

interface EngineSettings {
    suspend fun apiKey(): String?
    suspend fun userName(): String
}

/** 매 발화에 붙는 변동 컨텍스트 (현재 시각, 위치, 오늘 일정). */
interface ContextProvider {
    suspend fun currentContext(): String
}

/**
 * Claude tool-use 루프.
 *
 * - 시스템 프롬프트와 도구 목록은 고정 바이트로 유지해 프롬프트 캐시가 맞도록 하고,
 *   시각/위치/일정 같은 변동 정보는 사용자 메시지 앞에 붙인다.
 * - 대화 기록은 한 세션 동안 append-only. 길어지거나 오류/취소로 꼬이면
 *   텍스트 턴만으로 새 대화를 다시 구성한다 (thinking 블록을 편집하지 않기 위함).
 */
@Singleton
class AssistantEngine @Inject constructor(
    private val registry: ToolRegistry,
    private val executor: ToolExecutor,
    private val settings: EngineSettings,
    private val contextProvider: ContextProvider,
) {
    private val mutex = Mutex()
    private val history = mutableListOf<MessageParam>()
    private val turns = mutableListOf<Turn>()

    private var client: AnthropicClient? = null
    private var clientKey: String? = null

    private val toolDefinitions: List<ToolUnion> by lazy { registry.tools.map { it.toApiTool() } }

    /** 앱 시작 시 저장된 대화(텍스트)로 문맥을 복원한다. */
    suspend fun restore(saved: List<Turn>) = mutex.withLock {
        turns.clear()
        turns += saved.takeLast(MAX_RESTORED_TURNS)
        rebaseHistory()
    }

    suspend fun reset() = mutex.withLock {
        turns.clear()
        history.clear()
    }

    fun run(userText: String): Flow<EngineEvent> = channelFlow {
        mutex.withLock {
            val key = settings.apiKey()
            if (key.isNullOrBlank()) {
                send(EngineEvent.Failed("API 키가 설정되지 않았습니다. 설정 화면에서 Anthropic API 키를 입력해 주세요."))
                return@channelFlow
            }
            val api = clientFor(key)
            val system = SystemPrompt.build(settings.userName())
            val context = runCatching { contextProvider.currentContext() }.getOrDefault("")

            if (history.size > MAX_HISTORY_MESSAGES) rebaseHistory()
            val startSize = history.size
            history += userMessage(context, userText)

            var finalText = ""
            var completed = false
            try {
                var iteration = 0
                while (iteration++ < MAX_ITERATIONS) {
                    send(EngineEvent.Thinking)
                    val message = streamOnce(api, system) { delta -> trySendBlocking(EngineEvent.TextDelta(delta)) }
                    history += message.toParam()

                    val text = message.content().mapNotNull { it.text().orElse(null)?.text() }.joinToString("").trim()
                    val toolUses = message.content().mapNotNull { it.toolUse().orElse(null) }
                    val stop = message.stopReason().orElse(null)

                    if (stop == StopReason.REFUSAL) {
                        finalText = text.ifBlank { "죄송합니다, 그 요청은 처리할 수 없습니다." }
                        break
                    }
                    if (toolUses.isEmpty()) {
                        finalText = text
                        break
                    }

                    val results = toolUses.map { use ->
                        val result = runTool(use, truncated = stop == StopReason.MAX_TOKENS) { send(it) }
                        ContentBlockParam.ofToolResult(
                            ToolResultBlockParam.builder()
                                .toolUseId(use.id())
                                .content(result.content)
                                .isError(result.isError)
                                .build(),
                        )
                    }
                    // 병렬 호출 결과는 반드시 하나의 user 메시지로 돌려준다.
                    history += MessageParam.builder()
                        .role(MessageParam.Role.USER)
                        .contentOfBlockParams(results)
                        .build()
                }
                if (finalText.isBlank()) finalText = "작업을 마쳤습니다."
                completed = true
            } catch (e: CancellationException) {
                throw e
            } catch (e: UnauthorizedException) {
                send(EngineEvent.Failed("API 키가 올바르지 않습니다. 설정에서 키를 확인해 주세요."))
            } catch (e: RateLimitException) {
                send(EngineEvent.Failed("요청이 너무 많습니다. 잠시 후 다시 말씀해 주세요."))
            } catch (e: BadRequestException) {
                send(EngineEvent.Failed("요청 형식 오류가 발생해 대화 문맥을 초기화했습니다. 다시 말씀해 주세요."))
            } catch (e: AnthropicServiceException) {
                send(EngineEvent.Failed("AI 서버 오류(${e.statusCode()})가 발생했습니다. 잠시 후 다시 시도해 주세요."))
            } catch (e: Exception) {
                send(EngineEvent.Failed("연결에 실패했습니다. 네트워크를 확인해 주세요."))
            } finally {
                if (completed) {
                    turns += Turn(true, userText)
                    turns += Turn(false, finalText)
                } else {
                    // 미완결 tool_use 가 남지 않도록 텍스트 턴으로 다시 구성
                    while (history.size > startSize) history.removeAt(history.lastIndex)
                    rebaseHistory()
                }
            }
            if (completed) send(EngineEvent.Completed(finalText))
        }
    }.flowOn(Dispatchers.IO)

    /** 지금까지의 텍스트 턴 (저장용). */
    suspend fun snapshot(): List<Turn> = mutex.withLock { turns.toList() }

    private suspend fun runTool(
        use: ToolUseBlock,
        truncated: Boolean,
        emit: suspend (EngineEvent) -> Unit,
    ): ToolResult {
        if (truncated) return ToolResult.error("INVALID_JSON: 출력이 잘려 도구 입력이 불완전합니다. 더 짧게 다시 호출하세요.")
        val input: JsonObject = try {
            val node = use._input().convert(JsonNode::class.java)
            Json.parseToJsonElement(node?.toString() ?: "{}").jsonObject
        } catch (e: Exception) {
            return ToolResult.error("INVALID_JSON: 도구 입력을 해석할 수 없습니다. 올바른 JSON 으로 다시 호출하세요.")
        }
        val tool = registry.find(use.name())
        val label = tool?.hudLabel ?: use.name().uppercase()
        val category = tool?.category ?: ToolCategory.SYSTEM
        emit(EngineEvent.ToolStarted(use.id(), use.name(), label, category))
        val result = executor.execute(use.name(), input)
        emit(EngineEvent.ToolFinished(use.id(), use.name(), result))
        return result
    }

    private suspend fun streamOnce(api: AnthropicClient, system: String, onText: (String) -> Unit): Message {
        val params = MessageCreateParams.builder()
            .model(MODEL)
            .maxTokens(MAX_TOKENS)
            .systemOfTextBlockParams(
                listOf(
                    TextBlockParam.builder()
                        .text(system)
                        .cacheControl(CacheControlEphemeral.builder().build())
                        .build(),
                ),
            )
            .tools(toolDefinitions)
            .messages(history.toList())
            // 음성 비서는 지연 시간이 중요하므로 낮은 effort
            .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.LOW).build())
            // 안전 분류기가 거절할 경우 서버 측에서 다른 모델로 자동 대체
            .putAdditionalHeader("anthropic-beta", FALLBACK_BETA)
            .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
            .build()

        val accumulator = MessageAccumulator.create()
        val ctx = currentCoroutineContext()
        api.messages().createStreaming(params).use { response ->
            response.stream().forEach { event ->
                ctx.ensureActive()
                accumulator.accumulate(event)
                event.contentBlockDelta().ifPresent { delta ->
                    delta.delta().text().ifPresent { onText(it.text()) }
                }
            }
        }
        return accumulator.message()
    }

    private fun clientFor(key: String): AnthropicClient {
        val existing = client
        if (existing != null && clientKey == key) return existing
        existing?.close()
        return AnthropicOkHttpClient.builder()
            .apiKey(key)
            .timeout(Duration.ofSeconds(90))
            .maxRetries(2)
            .build()
            .also {
                client = it
                clientKey = key
            }
    }

    private fun userMessage(context: String, text: String): MessageParam {
        val body = if (context.isBlank()) text else "<context>\n$context\n</context>\n\n$text"
        return MessageParam.builder().role(MessageParam.Role.USER).content(body).build()
    }

    /** 텍스트 턴만으로 새 대화 기록을 만든다. user/assistant 가 번갈아 오도록 보정. */
    private fun rebaseHistory() {
        while (turns.size > MAX_RESTORED_TURNS) turns.removeAt(0)
        history.clear()
        var expectUser = true
        for (turn in turns) {
            if (turn.fromUser != expectUser) continue
            history += MessageParam.builder()
                .role(if (turn.fromUser) MessageParam.Role.USER else MessageParam.Role.ASSISTANT)
                .content(turn.text)
                .build()
            expectUser = !expectUser
        }
        // 마지막이 user 로 끝나면 다음 user 메시지와 겹치므로 제거
        if (history.isNotEmpty() && !expectUser) history.removeAt(history.lastIndex)
    }

    private fun JarvisTool.toApiTool(): ToolUnion {
        val props = (inputSchema["properties"] as? JsonObject).orEmpty()
        val required = (inputSchema["required"] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.content }.orEmpty()
        val schema = Tool.InputSchema.builder()
            .properties(
                Tool.InputSchema.Properties.builder()
                    .putAllAdditionalProperties(props.mapValues { (_, v) -> JsonValue.from(v.toPlain()) })
                    .build(),
            )
            .required(required)
            .build()
        return ToolUnion.ofTool(
            Tool.builder()
                .name(name)
                .description(description)
                .inputSchema(schema)
                .eagerInputStreaming(true)
                .build(),
        )
    }

    private fun JsonElement.toPlain(): Any? = when (this) {
        is JsonNull -> null
        is JsonPrimitive -> if (isString) content else booleanOrNull ?: longOrNull ?: doubleOrNull ?: content
        is JsonObject -> mapValues { (_, v) -> v.toPlain() }
        is JsonArray -> map { it.toPlain() }
    }

    companion object {
        const val MODEL = "claude-sonnet-5-5"
        private const val MAX_TOKENS = 4096L
        private const val MAX_ITERATIONS = 8
        private const val MAX_HISTORY_MESSAGES = 60
        private const val MAX_RESTORED_TURNS = 20
        private const val FALLBACK_BETA = "server-side-fallback-2026-07-01"
    }
}
