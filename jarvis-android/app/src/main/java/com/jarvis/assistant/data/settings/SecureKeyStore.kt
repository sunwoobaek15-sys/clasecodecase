package com.jarvis.assistant.data.settings

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/** API 키는 Android Keystore 로 암호화한 SharedPreferences 에만 저장한다. 코드/빌드에 키를 넣지 않는다. */
@Singleton
class SecureKeyStore @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "jarvis_secure",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    private val _hasKey = MutableStateFlow(false)
    val hasKey: StateFlow<Boolean> = _hasKey.asStateFlow()

    fun init() {
        _hasKey.value = !apiKey().isNullOrBlank()
    }

    fun apiKey(): String? = runCatching { prefs.getString(KEY_API, null) }.getOrNull()

    fun setApiKey(value: String?) {
        prefs.edit().apply {
            if (value.isNullOrBlank()) remove(KEY_API) else putString(KEY_API, value.trim())
        }.apply()
        _hasKey.value = !value.isNullOrBlank()
    }

    /** 화면 표시용 마스킹: sk-ant-…ABCD */
    fun maskedKey(): String? = apiKey()?.let { k ->
        if (k.length <= 12) "••••" else k.take(7) + "…" + k.takeLast(4)
    }

    private companion object {
        const val KEY_API = "anthropic_api_key"
    }
}
