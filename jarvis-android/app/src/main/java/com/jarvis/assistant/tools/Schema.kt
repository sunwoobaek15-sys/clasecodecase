package com.jarvis.assistant.tools

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull

/** 도구 입력 스키마를 짧게 쓰기 위한 작은 DSL. */
object Schema {
    fun obj(vararg props: Pair<String, JsonObject>, required: List<String> = emptyList()): JsonObject =
        JsonObject(
            buildMap {
                put("type", JsonPrimitive("object"))
                put("properties", JsonObject(props.toMap()))
                if (required.isNotEmpty()) put("required", JsonArray(required.map(::JsonPrimitive)))
            },
        )

    fun string(description: String, enum: List<String>? = null): JsonObject = JsonObject(
        buildMap {
            put("type", JsonPrimitive("string"))
            put("description", JsonPrimitive(description))
            if (enum != null) put("enum", JsonArray(enum.map(::JsonPrimitive)))
        },
    )

    fun integer(description: String, min: Int? = null, max: Int? = null): JsonObject = JsonObject(
        buildMap {
            put("type", JsonPrimitive("integer"))
            put("description", JsonPrimitive(description))
            if (min != null) put("minimum", JsonPrimitive(min))
            if (max != null) put("maximum", JsonPrimitive(max))
        },
    )

    fun number(description: String): JsonObject =
        JsonObject(mapOf("type" to JsonPrimitive("number"), "description" to JsonPrimitive(description)))

    fun boolean(description: String): JsonObject =
        JsonObject(mapOf("type" to JsonPrimitive("boolean"), "description" to JsonPrimitive(description)))

    fun intArray(description: String, min: Int, max: Int): JsonObject = JsonObject(
        mapOf(
            "type" to JsonPrimitive("array"),
            "description" to JsonPrimitive(description),
            "items" to integer("값", min, max),
        ),
    )

    val empty: JsonObject = obj()
}

// ---- 입력 파싱 도우미 ----

private fun JsonObject.prim(key: String): JsonPrimitive? = (this[key] as? JsonPrimitive)

fun JsonObject.str(key: String): String? = prim(key)?.contentOrNull?.takeIf { it.isNotBlank() }
fun JsonObject.long(key: String): Long? = prim(key)?.let { it.longOrNull ?: it.doubleOrNull?.toLong() ?: it.contentOrNull?.trim()?.toLongOrNull() }
fun JsonObject.int(key: String): Int? = long(key)?.toInt()
fun JsonObject.double(key: String): Double? = prim(key)?.let { it.doubleOrNull ?: it.contentOrNull?.trim()?.toDoubleOrNull() }
fun JsonObject.bool(key: String): Boolean? = prim(key)?.let { it.booleanOrNull ?: it.contentOrNull?.lowercase()?.let { s -> s == "true" } }
fun JsonObject.intList(key: String): List<Int>? =
    (this[key] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.let { p -> p.longOrNull?.toInt() ?: p.contentOrNull?.toIntOrNull() } }

fun JsonObject.requireStr(key: String): String = str(key) ?: throw IllegalArgumentException("'$key' 값이 필요합니다")

