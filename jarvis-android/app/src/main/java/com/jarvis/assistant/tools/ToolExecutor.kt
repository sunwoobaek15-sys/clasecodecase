package com.jarvis.assistant.tools

import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.JsonObject
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ToolExecutor @Inject constructor(
    private val registry: ToolRegistry,
    private val permissionGate: PermissionGate,
    private val confirmationGate: ConfirmationGate,
    private val confirmationPolicy: ConfirmationPolicy,
) {
    suspend fun execute(name: String, input: JsonObject): ToolResult {
        val tool = registry.find(name) ?: return ToolResult.error("알 수 없는 도구입니다: $name")

        if (tool.requiredPermissions.isNotEmpty() &&
            !permissionGate.ensure(tool.requiredPermissions, tool.permissionRationale)
        ) {
            return ToolResult.error(
                "권한이 없어 이 작업을 할 수 없습니다. 필요한 권한: " +
                    tool.requiredPermissions.joinToString { it.substringAfterLast('.') } +
                    ". 사용자에게 설정에서 권한을 허용해 달라고 짧게 안내하세요.",
            )
        }

        if (tool.alwaysConfirm || confirmationPolicy.requiresConfirmation(tool)) {
            val prompt = tool.confirmationPrompt(input) ?: "${tool.hudLabel} 작업을 실행할까요?"
            if (!confirmationGate.confirm(tool, prompt)) {
                return ToolResult("사용자가 실행을 취소했습니다. 실행하지 않았다고 짧게 알려 주세요.")
            }
        }

        return try {
            tool.execute(input)
        } catch (e: CancellationException) {
            throw e
        } catch (e: SecurityException) {
            ToolResult.error("권한이 없어 이 작업을 할 수 없습니다: ${e.message}")
        } catch (e: Exception) {
            ToolResult.error("도구 실행 중 오류가 발생했습니다: ${e.message ?: e.javaClass.simpleName}")
        }
    }
}
