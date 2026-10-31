"""User-changeable settings stored in the database (non-secret only)."""
from typing import Any

from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Setting

AI_MODES = ("AUTO", "LOCAL", "CLOUD")
SEARCH_PROVIDERS = ("none", "searxng", "wikipedia", "brave", "tavily")


def defaults() -> dict[str, Any]:
    env = get_settings()
    mode = env.AI_MODE.upper() if env.AI_MODE.upper() in AI_MODES else "AUTO"
    return {
        "ai_mode": mode,
        "local_model": env.OLLAMA_MODEL,
        "cloud_allowed": False,             # user switch; cloud also needs CLOUD_ENABLED + key in .env
        "cloud_send_memories": False,       # personal data never leaves the machine unless allowed
        "auto_memory": True,                # extract memories from chat
        "auto_evaluate": True,              # self-evaluate each answer
        "save_chat_history": True,
        "memory_context_limit": 5,
        "knowledge_context_limit": 5,
        "search_provider": "none",
        "external_network_enabled": False,  # web search / page fetch for research
        "autonomy_enabled": True,           # allow the scanner to create proposals
        "autonomy_auto_run_safe": False,    # auto-run low-risk proposals
        "temperature": 0.4,
    }


VALIDATORS = {
    "ai_mode": lambda v: isinstance(v, str) and v.upper() in AI_MODES,
    "local_model": lambda v: isinstance(v, str) and 0 < len(v) <= 100,
    "cloud_allowed": lambda v: isinstance(v, bool),
    "cloud_send_memories": lambda v: isinstance(v, bool),
    "auto_memory": lambda v: isinstance(v, bool),
    "auto_evaluate": lambda v: isinstance(v, bool),
    "save_chat_history": lambda v: isinstance(v, bool),
    "memory_context_limit": lambda v: isinstance(v, int) and not isinstance(v, bool) and 0 <= v <= 20,
    "knowledge_context_limit": lambda v: isinstance(v, int) and not isinstance(v, bool) and 0 <= v <= 20,
    "search_provider": lambda v: v in SEARCH_PROVIDERS,
    "external_network_enabled": lambda v: isinstance(v, bool),
    "autonomy_enabled": lambda v: isinstance(v, bool),
    "autonomy_auto_run_safe": lambda v: isinstance(v, bool),
    "temperature": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool) and 0 <= v <= 2,
}

# Changing these is a security-relevant action: the API requires explicit confirmation.
SENSITIVE_KEYS = {"cloud_allowed", "cloud_send_memories", "external_network_enabled"}


def get_all(db: Session) -> dict[str, Any]:
    data = defaults()
    for row in db.query(Setting).all():
        if row.key in data:
            data[row.key] = row.value
    data["ai_mode"] = str(data["ai_mode"]).upper()
    return data


def get(db: Session, key: str) -> Any:
    return get_all(db)[key]


def set_many(db: Session, changes: dict[str, Any]) -> dict[str, Any]:
    for k, v in changes.items():
        if k not in VALIDATORS:
            raise ValueError(f"알 수 없는 설정: {k}")
        if not VALIDATORS[k](v):
            raise ValueError(f"잘못된 값: {k}")
        if k == "ai_mode":
            v = v.upper()
        row = db.get(Setting, k)
        if row:
            row.value = v
        else:
            db.add(Setting(key=k, value=v))
    db.commit()
    return get_all(db)
