"""AI Provider Adapters.

Every provider implements the same small interface so the router (and later new
providers) can be swapped without touching the rest of the program.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

import httpx

from ..config import get_settings, redact


class AIError(Exception):
    """Raised with a user-readable Korean message. Never contains secrets."""

    def __init__(self, message: str, code: str = "ai_error"):
        super().__init__(redact(message))
        self.code = code


@dataclass
class ChatResult:
    content: str
    provider: str
    model: str
    latency_ms: int
    usage: dict = field(default_factory=dict)


@dataclass
class ProviderStatus:
    name: str
    available: bool
    detail: str
    models: list[str] = field(default_factory=list)
    model: str | None = None


class AIProvider:
    name = "base"

    def status(self) -> ProviderStatus:  # pragma: no cover - interface
        raise NotImplementedError

    def chat(self, messages: list[dict], model: str | None = None, temperature: float = 0.4,
             json_mode: bool = False) -> ChatResult:  # pragma: no cover - interface
        raise NotImplementedError


class OllamaProvider(AIProvider):
    """Local AI through the Ollama HTTP API (https://github.com/ollama/ollama/blob/main/docs/api.md)."""

    name = "ollama"

    def __init__(self, base_url: str | None = None, default_model: str | None = None,
                 timeout: float | None = None, transport: httpx.BaseTransport | None = None):
        env = get_settings()
        self.base_url = (base_url or env.OLLAMA_BASE_URL).rstrip("/")
        self.default_model = default_model or env.OLLAMA_MODEL
        self.timeout = timeout or env.OLLAMA_TIMEOUT_SECONDS
        self.transport = transport

    def _client(self, timeout: float) -> httpx.Client:
        return httpx.Client(base_url=self.base_url, timeout=timeout, transport=self.transport, trust_env=False)

    def list_models(self) -> list[str]:
        with self._client(5) as c:
            r = c.get("/api/tags")
            r.raise_for_status()
            return [m.get("name", "") for m in r.json().get("models", []) if m.get("name")]

    def status(self, model: str | None = None) -> ProviderStatus:
        model = model or self.default_model
        try:
            models = self.list_models()
        except httpx.HTTPError:
            return ProviderStatus(self.name, False,
                                  f"Ollama 서버({self.base_url})에 연결할 수 없습니다. Ollama를 실행했는지 확인하세요.",
                                  model=model)
        if not models:
            return ProviderStatus(self.name, False,
                                  f"Ollama는 실행 중이지만 설치된 모델이 없습니다. 터미널에서 `ollama pull {model}`을 실행하세요.",
                                  models, model)
        if not _has_model(models, model):
            return ProviderStatus(self.name, False,
                                  f"선택한 모델 '{model}'이 설치되어 있지 않습니다. `ollama pull {model}`을 실행하거나 Settings에서 설치된 모델을 선택하세요.",
                                  models, model)
        return ProviderStatus(self.name, True, "연결됨", models, model)

    def chat(self, messages, model=None, temperature=0.4, json_mode=False) -> ChatResult:
        model = model or self.default_model
        body: dict = {"model": model, "messages": messages, "stream": False,
                      "options": {"temperature": temperature}}
        if json_mode:
            body["format"] = "json"
        t0 = time.monotonic()
        try:
            with self._client(self.timeout) as c:
                r = c.post("/api/chat", json=body)
        except httpx.TimeoutException as e:
            raise AIError("로컬 AI 응답 시간이 초과되었습니다. 더 작은 모델을 사용하거나 다시 시도하세요.", "timeout") from e
        except httpx.HTTPError as e:
            raise AIError(f"Ollama 서버({self.base_url})에 연결할 수 없습니다. Ollama를 실행했는지 확인하세요.",
                          "unavailable") from e
        if r.status_code == 404:
            raise AIError(f"모델 '{model}'을 찾을 수 없습니다. `ollama pull {model}`을 실행하세요.", "model_missing")
        if r.status_code >= 400:
            raise AIError(f"Ollama 오류 (HTTP {r.status_code}): {r.text[:300]}", "provider_error")
        data = r.json()
        content = (data.get("message") or {}).get("content", "")
        return ChatResult(content=content, provider=self.name, model=data.get("model", model),
                          latency_ms=int((time.monotonic() - t0) * 1000),
                          usage={"prompt_tokens": data.get("prompt_eval_count"),
                                 "completion_tokens": data.get("eval_count")})


class OpenAICompatibleProvider(AIProvider):
    """Cloud adapter for any OpenAI-compatible /chat/completions API.

    Disabled unless CLOUD_ENABLED=true and CLOUD_API_KEY is set in the server .env.
    The router additionally requires the user's `cloud_allowed` setting.
    """

    name = "cloud"

    def __init__(self, transport: httpx.BaseTransport | None = None):
        env = get_settings()
        self.enabled = env.CLOUD_ENABLED
        self.base_url = env.CLOUD_BASE_URL.rstrip("/")
        self.model = env.CLOUD_MODEL
        self._key = env.CLOUD_API_KEY
        self.transport = transport

    def status(self) -> ProviderStatus:
        if not self.enabled:
            return ProviderStatus(self.name, False, "클라우드 AI가 비활성화되어 있습니다 (CLOUD_ENABLED=false).")
        if not self._key or not self.model:
            return ProviderStatus(self.name, False, "서버 .env에 CLOUD_API_KEY와 CLOUD_MODEL을 설정해야 합니다.")
        return ProviderStatus(self.name, True, "설정됨 (유료 API일 수 있습니다)", [self.model], self.model)

    def chat(self, messages, model=None, temperature=0.4, json_mode=False) -> ChatResult:
        st = self.status()
        if not st.available:
            raise AIError(st.detail, "cloud_disabled")
        body: dict = {"model": model or self.model, "messages": messages, "temperature": temperature}
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        t0 = time.monotonic()
        try:
            with httpx.Client(timeout=120, transport=self.transport) as c:
                r = c.post(f"{self.base_url}/chat/completions", json=body,
                           headers={"Authorization": f"Bearer {self._key}"})
        except httpx.HTTPError as e:
            raise AIError("클라우드 AI 서버에 연결할 수 없습니다.", "unavailable") from e
        if r.status_code >= 400:
            raise AIError(f"클라우드 AI 오류 (HTTP {r.status_code})", "provider_error")
        data = r.json()
        return ChatResult(content=data["choices"][0]["message"]["content"], provider=self.name,
                          model=data.get("model", body["model"]),
                          latency_ms=int((time.monotonic() - t0) * 1000), usage=data.get("usage") or {})


def _has_model(installed: list[str], model: str) -> bool:
    if model in installed:
        return True
    if ":" not in model:
        return f"{model}:latest" in installed
    return False
