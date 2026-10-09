package com.jarvis.assistant.tools

import javax.inject.Inject
import javax.inject.Singleton

/**
 * 도구 묶음. 일정/정보/폰 제어 등 기능 단위로 하나씩 구현해 Hilt `@IntoSet` 으로 등록한다.
 * 나중에 PC 원격 제어 묶음을 붙일 때도 이 인터페이스 하나만 구현하면 된다.
 */
interface ToolProvider {
    /** 묶음 식별자. 정렬 기준이 되므로 고정 문자열을 쓴다 (프롬프트 캐시 안정성). */
    val bundleId: String
    val tools: List<JarvisTool>
}

@Singleton
class ToolRegistry @Inject constructor(
    providers: Set<@JvmSuppressWildcards ToolProvider>,
) {
    /** 요청마다 도구 목록 바이트가 같아야 캐시가 깨지지 않으므로 결정적인 순서로 정렬한다. */
    val tools: List<JarvisTool> = providers
        .sortedBy { it.bundleId }
        .flatMap { it.tools }
        .also { list ->
            val dupes = list.groupBy { it.name }.filterValues { it.size > 1 }.keys
            require(dupes.isEmpty()) { "Duplicate tool names: $dupes" }
        }

    private val byName = tools.associateBy { it.name }

    fun find(name: String): JarvisTool? = byName[name]
}
