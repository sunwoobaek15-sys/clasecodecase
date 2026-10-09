package com.jarvis.assistant

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Text
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { Text("JARVIS") }
    }

    companion object {
        const val ACTION_LISTEN = "com.jarvis.assistant.LISTEN"
        const val ACTION_BRIEFING = "com.jarvis.assistant.BRIEFING"
    }
}
