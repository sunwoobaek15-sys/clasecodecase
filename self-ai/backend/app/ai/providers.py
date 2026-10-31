"""AI Provider Adapters.

Every provider implements the same small interface so the router (and later new
providers) can be swapped without touching the rest of the program.
"""
from __future__ import annotations

import json
import re
import time
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field

import httpx

from ..config import get_settings, redact


_THINK_BLOCK = re.compile(r"<think>.*?</think>\s*", re.S)


def strip_thinking(text: str) -> str:
    """Remove reasoning blocks (<think>…</think>) that models such as qwen3 / deepseek-r1 emit."""
    out = _THINK_BLOCK.sub("", text or "")
    if out.lstrip().startswith("<think>"):  # cut off while still "thinking"
        return ""
    return out.strip()


def _partial_suffix(buf: str, tag: str) -> int:
    for k in range(min(len(tag) - 1, len(buf)), 0, -1):
        if buf.endswith(tag[:k]):
            return k
    return 0


class ThinkFilter:
    """Streaming version of strip_thinking: feed chunks, get only the visible answer text back."""

    OPEN, CLOSE = "<think>", "</think>"

    def __init__(self):
        self.buf = ""
        self.inside = False
        self.started = False  # strip leading whitespace of the visible answer

    def feed(self, chunk: str) -> str:
        self.buf += chunk
        out: list[str] = []
        while True:
            if self.inside:
                i = self.buf.find(self.CLOSE)
                if i == -1:
                    self.buf = self.buf[-(len(self.CLOSE) - 1):]
                    break
                self.buf = self.buf[i + len(self.CLOSE):]
                self.inside = False
                continue
            i = self.buf.find(self.OPEN)
            if i == -1:
                keep = _partial_suffix(self.buf, self.OPEN)
                out.append(self.buf[:len(self.buf) - keep])
                self.buf = self.buf[len(self.buf) - keep:]
                break
            out.append(self.buf[:i])
            self.buf = self.buf[i + len(self.OPEN):]
            self.inside = True
        text = "".join(out)
        if not self.started:
            text = text.lstrip()
            self.started = bool(text)
        return text

    def flush(self) -> str:
        rest, self.buf = ("" if self.inside else self.buf), ""
        return rest if self.started else rest.lstrip()


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
    reachable: bool = True  # server answered (even if the model is missing)


class AIProvider:
    name = "base"

    def status(self) -> ProviderStatus:  # pragma: no cover - interface
        raise NotImplementedError

    def chat(self, messages: list[dict], model: str | None = None, temperature: float = 0.4,
             json_mode: bool = False) -> ChatResult:  # pragma: no cover - interface
        raise NotImplementedError

    def chat_stream(self, messages: list[dict], model: str | None = None, temperature: float = 0.4,
                    meta: dict | None = None) -> Iterator[str]:
        """Yield the answer in pieces. Providers without streaming yield it in one piece."""
        res = self.chat(messages, model=model, temperature=temperature)
        if meta is not None:
            meta.update(model=res.model, usage=res.usage)
        yield res.content


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
                                  model=model, reachable=False)
        if not models:
            return ProviderStatus(self.name, False,
                                  f"Ollama는 실행 중이지만 설치된 모델이 없습니다. Settings > AI 모델에서 모델을 받거나 터미널에서 `ollama pull {model}`을 실행하세요.",
                                  models, model)
        if not _has_model(models, model):
            return ProviderStatus(self.name, False,
                                  f"선택한 모델 '{model}'이 설치되어 있지 않습니다. Settings > AI 모델에서 받거나 설치된 모델을 선택하세요 (터미널: `ollama pull {model}`).",
                                  models, model)
        return ProviderStatus(self.name, True, "연결됨", models, model)

    # Ask thinking models (qwen3, deepseek-r1, ...) to answer directly. Older Ollama versions ignore
    # the field; if a server rejects it we retry once without it and remember that.
    _send_think = True

    def _body(self, messages, model, temperature, json_mode, stream) -> dict:
        body: dict = {"model": model, "messages": messages, "stream": stream, "options": {"temperature": temperature}}
        if json_mode:
            body["format"] = "json"
        if self._send_think:
            body["think"] = False
        return body

    def _raise_for(self, status: int, text: str, model: str) -> None:
        if status == 404:
            raise AIError(f"모델 '{model}'을 찾을 수 없습니다. Settings에서 모델을 받거나 `ollama pull {model}`을 실행하세요.",
                          "model_missing")
        raise AIError(f"Ollama 오류 (HTTP {status}): {text[:300]}", "provider_error")

    def _unreachable(self, e: Exception) -> AIError:
        if isinstance(e, httpx.TimeoutException):
            return AIError("로컬 AI 응답 시간이 초과되었습니다. 더 작은 모델을 사용하거나 다시 시도하세요.", "timeout")
        return AIError(f"Ollama 서버({self.base_url})에 연결할 수 없습니다. Ollama를 실행했는지 확인하세요.", "unavailable")

    def chat(self, messages, model=None, temperature=0.4, json_mode=False) -> ChatResult:
        model = model or self.default_model
        t0 = time.monotonic()
        try:
            with self._client(self.timeout) as c:
                r = c.post("/api/chat", json=self._body(messages, model, temperature, json_mode, False))
                if r.status_code == 400 and self._send_think and "think" in r.text.lower():
                    type(self)._send_think = False
                    r = c.post("/api/chat", json=self._body(messages, model, temperature, json_mode, False))
        except httpx.HTTPError as e:
            raise self._unreachable(e) from e
        if r.status_code >= 400:
            self._raise_for(r.status_code, r.text, model)
        try:
            data = r.json()
        except ValueError as e:
            raise AIError("Ollama 응답을 해석할 수 없습니다. Ollama 주소(OLLAMA_BASE_URL)가 맞는지 확인하세요.",
                          "bad_response") from e
        content = strip_thinking((data.get("message") or {}).get("content", ""))
        return ChatResult(content=content, provider=self.name, model=data.get("model", model),
                          latency_ms=int((time.monotonic() - t0) * 1000),
                          usage={"prompt_tokens": data.get("prompt_eval_count"),
                                 "completion_tokens": data.get("eval_count")})

    def chat_stream(self, messages, model=None, temperature=0.4, meta=None) -> Iterator[str]:
        model = model or self.default_model
        filt = ThinkFilter()
        for attempt in (1, 2):
            try:
                with self._client(self.timeout) as c, \
                        c.stream("POST", "/api/chat", json=self._body(messages, model, temperature, False, True)) as r:
                    if r.status_code >= 400:
                        text = r.read().decode("utf-8", "replace")
                        if attempt == 1 and r.status_code == 400 and self._send_think and "think" in text.lower():
                            type(self)._send_think = False
                            continue
                        self._raise_for(r.status_code, text, model)
                    for line in r.iter_lines():
                        if not line.strip():
                            continue
                        try:
                            data = json.loads(line)
                        except ValueError:
                            continue  # ignore a malformed line rather than failing the whole answer
                        if data.get("error"):
                            raise AIError(f"Ollama 오류: {str(data['error'])[:300]}", "provider_error")
                        piece = filt.feed((data.get("message") or {}).get("content", ""))
                        if piece:
                            yield piece
                        if data.get("done"):
                            if meta is not None:
                                meta.update(model=data.get("model", model),
                                            usage={"prompt_tokens": data.get("prompt_eval_count"),
                                                   "completion_tokens": data.get("eval_count")})
                            break
                tail = filt.flush()
                if tail:
                    yield tail
                return
            except httpx.HTTPError as e:
                raise self._unreachable(e) from e

    def pull(self, model: str, on_progress: Callable[[dict], None]) -> None:
        """Download a model through the local Ollama server (it fetches from ollama.com)."""
        timeout = httpx.Timeout(30, read=900)
        try:
            with self._client(30) as c, c.stream("POST", "/api/pull", json={"model": model, "name": model, "stream": True},
                                                 timeout=timeout) as r:
                if r.status_code >= 400:
                    raise AIError(f"모델 받기 실패 (HTTP {r.status_code}): {r.read().decode('utf-8', 'replace')[:300]}",
                                  "pull_failed")
                for line in r.iter_lines():
                    if not line.strip():
                        continue
                    data = json.loads(line)
                    if data.get("error"):
                        raise AIError(f"모델 받기 실패: {str(data['error'])[:300]}", "pull_failed")
                    on_progress(data)
        except httpx.HTTPError as e:
            raise self._unreachable(e) from e


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
        return ChatResult(content=strip_thinking(data["choices"][0]["message"]["content"] or ""), provider=self.name,
                          model=data.get("model", body["model"]),
                          latency_ms=int((time.monotonic() - t0) * 1000), usage=data.get("usage") or {})


def _cloud_stream(self, messages, model=None, temperature=0.4, meta=None) -> Iterator[str]:
    st = self.status()
    if not st.available:
        raise AIError(st.detail, "cloud_disabled")
    body = {"model": model or self.model, "messages": messages, "temperature": temperature, "stream": True}
    filt = ThinkFilter()
    try:
        with httpx.Client(timeout=120, transport=self.transport) as c, \
                c.stream("POST", f"{self.base_url}/chat/completions", json=body,
                         headers={"Authorization": f"Bearer {self._key}"}) as r:
            if r.status_code >= 400:
                raise AIError(f"클라우드 AI 오류 (HTTP {r.status_code})", "provider_error")
            for line in r.iter_lines():
                if not line.startswith("data:"):
                    continue
                payload = line[5:].strip()
                if payload == "[DONE]":
                    break
                data = json.loads(payload)
                if meta is not None and data.get("model"):
                    meta["model"] = data["model"]
                for ch in data.get("choices", []):
                    piece = filt.feed((ch.get("delta") or {}).get("content") or "")
                    if piece:
                        yield piece
    except httpx.HTTPError as e:
        raise AIError("클라우드 AI 서버에 연결할 수 없습니다.", "unavailable") from e
    tail = filt.flush()
    if tail:
        yield tail


OpenAICompatibleProvider.chat_stream = _cloud_stream  # type: ignore[method-assign]


MODEL_NAME = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._\-/:]{0,99}$")


def _has_model(installed: list[str], model: str) -> bool:
    if model in installed:
        return True
    if ":" not in model:
        return f"{model}:latest" in installed
    return False
