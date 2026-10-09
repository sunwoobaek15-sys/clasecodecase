package com.jarvis.assistant.di

import android.content.Context
import androidx.room.Room
import com.jarvis.assistant.ai.ContextProvider
import com.jarvis.assistant.ai.EngineSettings
import com.jarvis.assistant.data.db.JarvisDatabase
import com.jarvis.assistant.data.db.MemoDao
import com.jarvis.assistant.data.db.MessageDao
import com.jarvis.assistant.data.db.ReminderDao
import com.jarvis.assistant.data.db.TodoDao
import com.jarvis.assistant.interaction.ConfirmationBroker
import com.jarvis.assistant.interaction.JarvisContextProvider
import com.jarvis.assistant.interaction.JarvisEngineSettings
import com.jarvis.assistant.interaction.PermissionBroker
import com.jarvis.assistant.interaction.SettingsConfirmationPolicy
import com.jarvis.assistant.tools.ConfirmationGate
import com.jarvis.assistant.tools.ConfirmationPolicy
import com.jarvis.assistant.tools.InfoTools
import com.jarvis.assistant.tools.PermissionGate
import com.jarvis.assistant.tools.PhoneTools
import com.jarvis.assistant.tools.ProductivityTools
import com.jarvis.assistant.tools.ToolProvider
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides @Singleton
    fun database(@ApplicationContext context: Context): JarvisDatabase =
        Room.databaseBuilder(context, JarvisDatabase::class.java, "jarvis.db").build()

    @Provides fun messageDao(db: JarvisDatabase): MessageDao = db.messageDao()
    @Provides fun memoDao(db: JarvisDatabase): MemoDao = db.memoDao()
    @Provides fun todoDao(db: JarvisDatabase): TodoDao = db.todoDao()
    @Provides fun reminderDao(db: JarvisDatabase): ReminderDao = db.reminderDao()

    @Provides @Singleton
    fun okHttp(): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            chain.proceed(chain.request().newBuilder().header("User-Agent", "JARVIS-Android/1.0").build())
        }
        .build()

    @Provides @Singleton
    fun json(): Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
        explicitNulls = false
    }
}

@Module
@InstallIn(SingletonComponent::class)
abstract class BindingsModule {
    @Binds abstract fun permissionGate(impl: PermissionBroker): PermissionGate
    @Binds abstract fun confirmationGate(impl: ConfirmationBroker): ConfirmationGate
    @Binds abstract fun confirmationPolicy(impl: SettingsConfirmationPolicy): ConfirmationPolicy
    @Binds abstract fun engineSettings(impl: JarvisEngineSettings): EngineSettings
    @Binds abstract fun contextProvider(impl: JarvisContextProvider): ContextProvider
}

/**
 * 도구 묶음 등록부. 새 묶음(예: PC 원격 제어)은 ToolProvider 를 구현하고 여기에 한 줄 추가하면 된다.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class ToolBundlesModule {
    @Binds @IntoSet abstract fun productivity(impl: ProductivityTools): ToolProvider
    @Binds @IntoSet abstract fun info(impl: InfoTools): ToolProvider
    @Binds @IntoSet abstract fun phone(impl: PhoneTools): ToolProvider
}
