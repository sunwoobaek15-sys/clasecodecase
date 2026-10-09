package com.jarvis.assistant.services

import android.content.Context
import android.net.Uri
import android.provider.ContactsContract
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

data class Contact(val name: String, val number: String, val label: String?)

@Singleton
class ContactsRepository @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    /** 이름으로 연락처 검색. 정확히 일치하는 이름을 우선한다. */
    suspend fun find(query: String): List<Contact> = withContext(Dispatchers.IO) {
        val q = query.trim().removeSuffix("님").removeSuffix("씨").trim()
        if (q.isEmpty()) return@withContext emptyList()
        val uri = Uri.withAppendedPath(ContactsContract.CommonDataKinds.Phone.CONTENT_FILTER_URI, Uri.encode(q))
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.TYPE,
            ContactsContract.CommonDataKinds.Phone.LABEL,
            ContactsContract.CommonDataKinds.Phone.IS_SUPER_PRIMARY,
        )
        val out = linkedMapOf<String, Contact>()
        context.contentResolver.query(uri, projection, null, null, null)?.use { c ->
            while (c.moveToNext()) {
                val name = c.getString(0) ?: continue
                val number = c.getString(1) ?: continue
                val label = ContactsContract.CommonDataKinds.Phone.getTypeLabel(
                    context.resources, c.getInt(2), c.getString(3),
                ).toString()
                val key = name + "|" + number.filter(Char::isDigit)
                if (key !in out) out[key] = Contact(name, number, label)
            }
        }
        val norm = q.replace(" ", "")
        out.values.sortedWith(
            compareByDescending<Contact> { it.name.replace(" ", "") == norm }
                .thenByDescending { it.label?.contains("휴대") == true || it.label?.contains("Mobile", true) == true }
                .thenBy { it.name.length },
        )
    }
}
