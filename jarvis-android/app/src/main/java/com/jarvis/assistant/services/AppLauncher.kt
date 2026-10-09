package com.jarvis.assistant.services

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

data class InstalledApp(val label: String, val packageName: String)

@Singleton
class AppLauncher @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    /** 흔히 부르는 이름 → 앱 라벨에 포함된 키워드 */
    private val aliases = mapOf(
        "유튜브" to listOf("youtube", "유튜브"),
        "카톡" to listOf("카카오톡", "kakaotalk"),
        "카카오톡" to listOf("카카오톡", "kakaotalk"),
        "인스타" to listOf("instagram", "인스타그램"),
        "인스타그램" to listOf("instagram", "인스타그램"),
        "지도" to listOf("지도", "maps", "map"),
        "카메라" to listOf("카메라", "camera"),
        "갤러리" to listOf("갤러리", "gallery", "사진", "photos"),
        "사진" to listOf("사진", "photos", "갤러리", "gallery"),
        "설정" to listOf("설정", "settings"),
        "크롬" to listOf("chrome", "크롬"),
        "브라우저" to listOf("chrome", "인터넷", "internet", "browser", "삼성 인터넷"),
        "계산기" to listOf("계산기", "calculator"),
        "시계" to listOf("시계", "clock"),
        "메시지" to listOf("메시지", "messages"),
        "전화" to listOf("전화", "phone"),
        "음악" to listOf("음악", "music", "멜론", "spotify", "youtube music"),
        "넷플릭스" to listOf("netflix", "넷플릭스"),
        "플레이스토어" to listOf("play 스토어", "play store"),
    )

    suspend fun installed(): List<InstalledApp> = withContext(Dispatchers.IO) {
        val pm = context.packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        @Suppress("DEPRECATION")
        pm.queryIntentActivities(intent, 0)
            .map { InstalledApp(it.loadLabel(pm).toString(), it.activityInfo.packageName) }
            .distinctBy { it.packageName }
            .filter { it.packageName != context.packageName }
    }

    suspend fun findBest(name: String): InstalledApp? {
        val apps = installed()
        val q = normalize(name)
        if (q.isEmpty()) return null
        val keys = (aliases[name.trim()] ?: aliases[q] ?: emptyList()).map(::normalize) + q
        apps.firstOrNull { normalize(it.label) == q }?.let { return it }
        for (k in keys) apps.firstOrNull { normalize(it.label) == k }?.let { return it }
        for (k in keys) apps.firstOrNull { normalize(it.label).contains(k) }?.let { return it }
        apps.firstOrNull { it.packageName.lowercase().contains(q) }?.let { return it }
        return apps.minByOrNull { levenshtein(normalize(it.label), q) }
            ?.takeIf { levenshtein(normalize(it.label), q) <= maxOf(1, q.length / 3) }
    }

    fun launch(app: InstalledApp): Boolean {
        val intent = context.packageManager.getLaunchIntentForPackage(app.packageName) ?: return false
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return runCatching { context.startActivity(intent) }.isSuccess
    }

    @Suppress("unused")
    fun isInstalled(pkg: String): Boolean = runCatching {
        context.packageManager.getPackageInfo(pkg, PackageManager.GET_ACTIVITIES); true
    }.getOrDefault(false)

    private fun normalize(s: String) = s.lowercase().replace(" ", "").replace("앱", "").trim()

    private fun levenshtein(a: String, b: String): Int {
        val dp = IntArray(b.length + 1) { it }
        for (i in 1..a.length) {
            var prev = dp[0]
            dp[0] = i
            for (j in 1..b.length) {
                val tmp = dp[j]
                dp[j] = minOf(dp[j] + 1, dp[j - 1] + 1, prev + if (a[i - 1] == b[j - 1]) 0 else 1)
                prev = tmp
            }
        }
        return dp[b.length]
    }
}
