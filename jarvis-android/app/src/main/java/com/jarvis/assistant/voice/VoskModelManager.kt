package com.jarvis.assistant.voice

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.util.zip.ZipInputStream
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Vosk 오프라인 한국어 모델(약 80MB)을 처음 한 번 내려받아 앱 내부 저장소에 푼다.
 * 모델은 Apache 2.0 라이선스 (alphacephei.com/vosk/models).
 */
@Singleton
class VoskModelManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val http: OkHttpClient,
) {
    sealed interface State {
        data object Missing : State
        data class Downloading(val progress: Float) : State
        data object Unpacking : State
        data object Ready : State
        data class Failed(val message: String) : State
    }

    private val root get() = File(context.filesDir, "vosk")
    val modelDir: File get() = File(root, MODEL_NAME)

    private val _state = MutableStateFlow<State>(if (isReady()) State.Ready else State.Missing)
    val state: StateFlow<State> = _state.asStateFlow()

    fun isReady(): Boolean = File(modelDir, "am").exists() || File(modelDir, "conf").exists()

    suspend fun download(): Boolean = withContext(Dispatchers.IO) {
        if (isReady()) {
            _state.value = State.Ready
            return@withContext true
        }
        val tmp = File(context.cacheDir, "$MODEL_NAME.zip")
        try {
            _state.value = State.Downloading(0f)
            http.newCall(Request.Builder().url(MODEL_URL).build()).execute().use { r ->
                if (!r.isSuccessful) throw IOException("HTTP ${r.code}")
                val body = r.body ?: throw IOException("빈 응답")
                val total = body.contentLength().takeIf { it > 0 } ?: APPROX_SIZE
                body.byteStream().use { input ->
                    tmp.outputStream().use { out ->
                        val buf = ByteArray(64 * 1024)
                        var read = 0L
                        while (true) {
                            ensureActive()
                            val n = input.read(buf)
                            if (n < 0) break
                            out.write(buf, 0, n)
                            read += n
                            _state.value = State.Downloading((read.toFloat() / total).coerceIn(0f, 1f))
                        }
                    }
                }
            }
            _state.value = State.Unpacking
            root.deleteRecursively()
            root.mkdirs()
            val canonicalRoot = root.canonicalPath + File.separator
            ZipInputStream(tmp.inputStream().buffered()).use { zip ->
                while (true) {
                    val entry = zip.nextEntry ?: break
                    val target = File(root, entry.name)
                    // Zip slip 방지
                    if (!target.canonicalPath.startsWith(canonicalRoot)) throw IOException("잘못된 압축 항목")
                    if (entry.isDirectory) target.mkdirs() else {
                        target.parentFile?.mkdirs()
                        target.outputStream().use { zip.copyTo(it) }
                    }
                }
            }
            val ok = isReady()
            _state.value = if (ok) State.Ready else State.Failed("모델 구조가 예상과 다릅니다")
            ok
        } catch (e: Exception) {
            _state.value = State.Failed(e.message ?: "다운로드 실패")
            false
        } finally {
            tmp.delete()
        }
    }

    fun delete() {
        root.deleteRecursively()
        _state.value = State.Missing
    }

    companion object {
        const val MODEL_NAME = "vosk-model-small-ko-0.22"
        const val MODEL_URL = "https://alphacephei.com/vosk/models/$MODEL_NAME.zip"
        private const val APPROX_SIZE = 82L * 1024 * 1024
    }
}
