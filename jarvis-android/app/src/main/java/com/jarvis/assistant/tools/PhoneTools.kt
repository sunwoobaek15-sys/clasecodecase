package com.jarvis.assistant.tools

import android.Manifest
import android.app.SearchManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.telephony.SmsManager
import com.jarvis.assistant.services.AppLauncher
import com.jarvis.assistant.services.ContactsRepository
import com.jarvis.assistant.services.DeviceStatus
import dagger.hilt.android.qualifiers.ApplicationContext
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/** 폰 제어 */
@Singleton
class PhoneTools @Inject constructor(
    @ApplicationContext private val context: Context,
    private val apps: AppLauncher,
    private val contacts: ContactsRepository,
    private val device: DeviceStatus,
) : ToolProvider {

    override val bundleId = "30_phone"

    override val tools: List<JarvisTool> = listOf(
        SimpleTool(
            name = "open_app",
            description = "설치된 앱을 이름으로 찾아 실행한다.",
            inputSchema = Schema.obj("name" to Schema.string("앱 이름 (예: 유튜브, 카카오톡, 카메라)"), required = listOf("name")),
            category = ToolCategory.DEVICE,
            hudLabel = "APP LAUNCH",
        ) { input ->
            val name = input.requireStr("name")
            val app = apps.findBest(name) ?: return@SimpleTool ToolResult.error("'$name' 앱을 찾지 못했습니다.")
            if (apps.launch(app)) ToolResult("'${app.label}' 실행") else ToolResult.error("'${app.label}' 을(를) 실행하지 못했습니다.")
        },
        SimpleTool(
            name = "call_contact",
            description = "연락처에서 이름을 찾아 전화를 건다. 실행 전에 사용자 확인을 받는다. 번호를 직접 줄 수도 있다.",
            inputSchema = Schema.obj("name" to Schema.string("연락처 이름 또는 전화번호"), required = listOf("name")),
            category = ToolCategory.COMMS,
            hudLabel = "VOICE LINK",
            requiredPermissions = listOf(Manifest.permission.READ_CONTACTS, Manifest.permission.CALL_PHONE),
            permissionRationale = "연락처에서 이름을 찾아 전화를 걸려면 연락처와 전화 권한이 필요합니다.",
            alwaysConfirm = true,
            confirm = { "${it.str("name")}에게 전화를 겁니다. 진행할까요?" },
        ) { input ->
            val target = resolve(input.requireStr("name")) ?: return@SimpleTool ToolResult.error("'${input.str("name")}' 연락처를 찾지 못했습니다.")
            val intent = Intent(Intent.ACTION_CALL, Uri.fromParts("tel", target.second, null))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            ToolResult("${target.first}(${target.second})에게 전화를 걸었습니다.")
        },
        SimpleTool(
            name = "send_sms",
            description = "연락처 이름으로 문자 메시지를 보낸다. 실행 전에 사용자 확인을 받는다.",
            inputSchema = Schema.obj(
                "name" to Schema.string("받는 사람 이름 또는 전화번호"),
                "text" to Schema.string("보낼 내용"),
                required = listOf("name", "text"),
            ),
            category = ToolCategory.COMMS,
            hudLabel = "TEXT TRANSMIT",
            requiredPermissions = listOf(Manifest.permission.READ_CONTACTS, Manifest.permission.SEND_SMS),
            permissionRationale = "연락처에서 받는 사람을 찾아 문자를 보내려면 연락처와 문자 권한이 필요합니다.",
            alwaysConfirm = true,
            confirm = { "${it.str("name")}에게 \"${it.str("text")}\" 라고 문자를 보냅니다. 진행할까요?" },
        ) { input ->
            val text = input.requireStr("text")
            val target = resolve(input.requireStr("name")) ?: return@SimpleTool ToolResult.error("'${input.str("name")}' 연락처를 찾지 못했습니다.")
            val sms: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                context.getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }
            val parts = sms.divideMessage(text)
            if (parts.size > 1) sms.sendMultipartTextMessage(target.second, null, parts, null, null)
            else sms.sendTextMessage(target.second, null, text, null, null)
            ToolResult("${target.first}(${target.second})에게 문자를 보냈습니다.")
        },
        SimpleTool(
            name = "toggle_flashlight",
            description = "손전등을 켜거나 끈다.",
            inputSchema = Schema.obj("on" to Schema.boolean("켜기(true)/끄기(false)"), required = listOf("on")),
            category = ToolCategory.DEVICE,
            hudLabel = "PHOTON EMITTER",
        ) { input ->
            val on = input.bool("on") ?: true
            if (device.setFlashlight(on)) ToolResult(if (on) "손전등 켜짐" else "손전등 꺼짐")
            else ToolResult.error("이 기기에는 손전등이 없습니다.")
        },
        SimpleTool(
            name = "set_volume",
            description = "미디어 볼륨을 0~100% 로 설정한다.",
            inputSchema = Schema.obj("level" to Schema.integer("볼륨 퍼센트", 0, 100), required = listOf("level")),
            category = ToolCategory.DEVICE,
            hudLabel = "AUDIO GAIN",
        ) { input ->
            val level = input.int("level") ?: return@SimpleTool ToolResult.error("level 이 필요합니다")
            val actual = device.setVolume(level)
            ToolResult("미디어 볼륨 $actual%")
        },
        SimpleTool(
            name = "open_url",
            description = "웹 주소를 브라우저로 연다.",
            inputSchema = Schema.obj("url" to Schema.string("http(s) 주소"), required = listOf("url")),
            category = ToolCategory.NETWORK,
            hudLabel = "NET ACCESS",
            confirm = { "${it.str("url")} 을(를) 열까요?" },
        ) { input ->
            var url = input.requireStr("url").trim()
            if (!url.startsWith("http://") && !url.startsWith("https://")) url = "https://$url"
            val uri = Uri.parse(url)
            if (uri.host.isNullOrBlank()) return@SimpleTool ToolResult.error("올바른 주소가 아닙니다")
            context.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            ToolResult("${uri.host} 을(를) 열었습니다.")
        },
        SimpleTool(
            name = "web_search",
            description = "검색어로 웹 검색 결과를 브라우저에서 연다.",
            inputSchema = Schema.obj("query" to Schema.string("검색어"), required = listOf("query")),
            category = ToolCategory.NETWORK,
            hudLabel = "WEB QUERY",
        ) { input ->
            val q = input.requireStr("query")
            val search = Intent(Intent.ACTION_WEB_SEARCH).putExtra(SearchManager.QUERY, q).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            val ok = runCatching { context.startActivity(search) }.isSuccess ||
                runCatching {
                    context.startActivity(
                        Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/search?q=" + Uri.encode(q)))
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                    )
                }.isSuccess
            if (ok) ToolResult("'$q' 검색 결과를 열었습니다.") else ToolResult.error("브라우저를 열지 못했습니다.")
        },
        SimpleTool(
            name = "get_battery_status",
            description = "배터리 잔량, 충전 여부, 온도와 네트워크/저장공간 상태를 확인한다.",
            inputSchema = Schema.empty,
            category = ToolCategory.SYSTEM,
            hudLabel = "POWER DIAGNOSTIC",
        ) { _ ->
            val b = device.battery()
            val n = device.network()
            val s = device.storage()
            ToolResult(
                "배터리 ${b.percent}% (${if (b.charging) "충전 중" else "방전 중"})" +
                    (b.temperatureC?.let { ", 온도 %.1f°C".format(it) } ?: "") +
                    "\n네트워크: ${if (n.connected) n.type else "연결 없음"}" +
                    "\n저장공간: 여유 %.1fGB / 전체 %.0fGB".format(s.freeGb, s.totalGb),
            )
        },
        SimpleTool(
            name = "get_current_time",
            description = "현재 날짜와 시각을 확인한다.",
            inputSchema = Schema.empty,
            category = ToolCategory.SYSTEM,
            hudLabel = "CHRONO SYNC",
        ) { _ ->
            val now = LocalDateTime.now()
            ToolResult(now.format(DateTimeFormatter.ofPattern("yyyy년 M월 d일 EEEE a h시 m분", Locale.KOREAN)) + " (" + now.withNano(0) + ")")
        },
    )

    /** 이름 또는 번호 → (표시 이름, 번호) */
    private suspend fun resolve(nameOrNumber: String): Pair<String, String>? {
        val digits = nameOrNumber.filter { it.isDigit() || it == '+' }
        if (digits.length >= 3 && digits.length >= nameOrNumber.count { !it.isWhitespace() && it != '-' } - 1) {
            return nameOrNumber to digits
        }
        val c = contacts.find(nameOrNumber).firstOrNull() ?: return null
        return c.name to c.number
    }
}
