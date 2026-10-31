"""AI Router: picks which provider answers, according to AI_MODE.

AUTO  -> local Ollama if it is ready, otherwise cloud only if it is fully enabled.
LOCAL -> Ollama only.
CLOUD -> cloud only, and only if CLOUD_ENABLED + key (.env) + `cloud_allowed` (Settings).
No mode ever silently calls a paid API that the user has not switched on.
"""
from __future__ import annotations

from dataclasses import asdict

from sqlalchemy.orm import Session

from ..services import settings_store
from .providers import AIError, AIProvider, ChatResult, OllamaProvider, OpenAICompatibleProvider

# Test hook: tests replace these factories to inject fake transports.
local_factory = OllamaProvider
cloud_factory = OpenAICompatibleProvider


class AIRouter:
    def __init__(self, db: Session):
        self.cfg = settings_store.get_all(db)
        self.mode = self.cfg["ai_mode"]
        self.local = local_factory(default_model=self.cfg["local_model"])
        self.cloud = cloud_factory()
        self._local_cache = None

    def _local_st(self):
        # one health check per router instance (i.e. per request)
        if self._local_cache is None:
            self._local_cache = self.local.status(self.cfg["local_model"])
        return self._local_cache

    def cloud_usable(self) -> tuple[bool, str]:
        st = self.cloud.status()
        if not st.available:
            return False, st.detail
        if not self.cfg["cloud_allowed"]:
            return False, "Settings에서 클라우드 사용이 꺼져 있습니다."
        return True, st.detail

    def status(self) -> dict:
        local = self._local_st()
        cloud = self.cloud.status()
        cloud_ok, cloud_detail = self.cloud_usable()
        try:
            active = self._pick()
            active_info = {"provider": active.name,
                           "model": self.cfg["local_model"] if active.name == "ollama" else cloud.model}
            error = None
        except AIError as e:
            active_info, error = None, str(e)
        return {
            "mode": self.mode,
            "ready": active_info is not None,
            "active": active_info,
            "error": error,
            "local": asdict(local),
            "cloud": {**asdict(cloud), "usable": cloud_ok, "detail": cloud_detail if not cloud_ok else cloud.detail},
        }

    def _pick(self) -> AIProvider:
        if self.mode == "LOCAL":
            st = self._local_st()
            if not st.available:
                raise AIError(f"[LOCAL 모드] {st.detail}", "local_unavailable")
            return self.local
        if self.mode == "CLOUD":
            ok, detail = self.cloud_usable()
            if not ok:
                raise AIError(f"[CLOUD 모드] {detail}", "cloud_unavailable")
            return self.cloud
        st = self._local_st()
        if st.available:
            return self.local
        ok, detail = self.cloud_usable()
        if ok:
            return self.cloud
        raise AIError(f"사용 가능한 AI가 없습니다. 로컬: {st.detail} / 클라우드: {detail}", "no_provider")

    def chat(self, messages: list[dict], json_mode: bool = False, temperature: float | None = None) -> ChatResult:
        provider = self._pick()
        t = self.cfg["temperature"] if temperature is None else temperature
        if provider is self.local:
            return self.local.chat(messages, model=self.cfg["local_model"], temperature=t, json_mode=json_mode)
        return provider.chat(messages, temperature=t, json_mode=json_mode)

    @property
    def sends_externally(self) -> bool:
        """True when the provider that would answer sends data off this machine."""
        try:
            return self._pick() is self.cloud
        except AIError:
            return False


def try_router(db: Session) -> AIRouter | None:
    r = AIRouter(db)
    try:
        r._pick()
        return r
    except AIError:
        return None
