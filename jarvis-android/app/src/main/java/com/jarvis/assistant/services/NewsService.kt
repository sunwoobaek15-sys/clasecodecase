package com.jarvis.assistant.services

import android.util.Xml
import com.jarvis.assistant.tools.NewsItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.xmlpull.v1.XmlPullParser
import java.io.IOException
import java.io.InputStream
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/** 구글 뉴스 한국판 RSS */
@Singleton
class NewsService @Inject constructor(
    private val http: OkHttpClient,
) {
    suspend fun headlines(topic: String?, limit: Int = 8): List<NewsItem> = withContext(Dispatchers.IO) {
        val base = if (topic.isNullOrBlank()) {
            "https://news.google.com/rss".toHttpUrl().newBuilder()
        } else {
            "https://news.google.com/rss/search".toHttpUrl().newBuilder().addQueryParameter("q", topic)
        }
        val url = base
            .addQueryParameter("hl", "ko")
            .addQueryParameter("gl", "KR")
            .addQueryParameter("ceid", "KR:ko")
            .build()
        http.newCall(Request.Builder().url(url).build()).execute().use { r ->
            if (!r.isSuccessful) throw IOException("뉴스 서버 오류 ${r.code}")
            val stream = r.body?.byteStream() ?: throw IOException("빈 응답")
            parse(stream, limit)
        }
    }

    private fun parse(input: InputStream, limit: Int): List<NewsItem> {
        val parser = Xml.newPullParser()
        parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, false)
        parser.setInput(input, "UTF-8")
        val items = mutableListOf<NewsItem>()
        var inItem = false
        var title = ""
        var link = ""
        var source = ""
        var pub: Long? = null
        var event = parser.eventType
        while (event != XmlPullParser.END_DOCUMENT && items.size < limit) {
            when (event) {
                XmlPullParser.START_TAG -> when (parser.name) {
                    "item" -> {
                        inItem = true; title = ""; link = ""; source = ""; pub = null
                    }
                    "title" -> if (inItem) title = parser.nextText()
                    "link" -> if (inItem) link = parser.nextText()
                    "source" -> if (inItem) source = parser.nextText()
                    "pubDate" -> if (inItem) pub = parseDate(parser.nextText())
                }
                XmlPullParser.END_TAG -> if (parser.name == "item" && inItem) {
                    inItem = false
                    if (title.isNotBlank()) {
                        val cleanTitle = if (source.isNotBlank() && title.endsWith(" - $source")) {
                            title.removeSuffix(" - $source")
                        } else {
                            title.substringBeforeLast(" - ", title)
                        }
                        val src = source.ifBlank { title.substringAfterLast(" - ", "") }
                        items += NewsItem(cleanTitle.trim(), src.trim(), link.trim(), pub)
                    }
                }
            }
            event = parser.next()
        }
        return items
    }

    private fun parseDate(s: String): Long? = runCatching {
        ZonedDateTime.parse(s.trim(), DateTimeFormatter.RFC_1123_DATE_TIME.withLocale(Locale.ENGLISH)).toInstant().toEpochMilli()
    }.getOrNull()
}
