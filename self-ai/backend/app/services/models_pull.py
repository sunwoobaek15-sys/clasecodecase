"""Download Ollama models from the UI (so users don't need a terminal).

The local Ollama server does the download from ollama.com. This only starts when
the user explicitly asks and confirms (it is an external download, often several GB).
Progress is kept in memory; the finished model is listed by Ollama itself.
"""
from __future__ import annotations

import threading
import time

from ..ai import router as ai_router
from ..ai.providers import MODEL_NAME, AIError
from ..db import SessionLocal
from .logs import log

_jobs: dict[str, dict] = {}
_lock = threading.Lock()

# Popular small models that run on ordinary PCs (name, approx. download size, note)
SUGGESTED = [
    {"name": "qwen2.5:3b", "size": "1.9GB", "note": "기본값 · 한국어 가능 · RAM 8GB"},
    {"name": "qwen2.5:1.5b", "size": "1.0GB", "note": "더 가볍고 빠름"},
    {"name": "llama3.2:3b", "size": "2.0GB", "note": "영어 위주"},
    {"name": "gemma3:4b", "size": "3.3GB", "note": "RAM 16GB 권장"},
    {"name": "qwen2.5:7b", "size": "4.7GB", "note": "더 정확함 · RAM 16GB 이상"},
]


def jobs() -> list[dict]:
    with _lock:
        return [dict(j) for j in _jobs.values()]


def start(model: str) -> dict:
    if not MODEL_NAME.match(model or ""):
        raise ValueError("모델 이름 형식이 올바르지 않습니다 (예: qwen2.5:3b).")
    with _lock:
        cur = _jobs.get(model)
        if cur and cur["status"] == "running":
            return dict(cur)
        _jobs[model] = {"model": model, "status": "running", "detail": "시작 중", "completed": 0, "total": 0,
                        "error": None, "started_at": time.time(), "finished_at": None}
    threading.Thread(target=_run, args=(model,), daemon=True, name=f"pull-{model}").start()
    return jobs_for(model)


def jobs_for(model: str) -> dict:
    with _lock:
        return dict(_jobs[model])


def _update(model: str, **kw) -> None:
    with _lock:
        _jobs[model].update(kw)


def _run(model: str) -> None:
    provider = ai_router.local_factory()

    def progress(d: dict) -> None:
        upd = {"detail": str(d.get("status", ""))[:120]}
        if d.get("total"):
            upd.update(total=int(d["total"]), completed=int(d.get("completed") or 0))
        _update(model, **upd)

    db = SessionLocal()
    try:
        log(db, "settings", f"모델 받기 시작: {model}")
        provider.pull(model, progress)
        _update(model, status="completed", detail="완료", finished_at=time.time())
        log(db, "settings", f"모델 받기 완료: {model}")
    except AIError as e:
        _update(model, status="failed", error=str(e), finished_at=time.time())
        log(db, "settings", f"모델 받기 실패: {model}: {e}", "warn")
    except Exception:  # noqa: BLE001
        _update(model, status="failed", error="모델 받기 중 오류가 발생했습니다.", finished_at=time.time())
    finally:
        db.close()
