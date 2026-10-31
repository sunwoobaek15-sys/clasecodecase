import platform
import time
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import serialize as S
from ..ai.router import AIRouter
from ..config import get_settings
from ..db import get_db
from ..models import (AutonomyTask, Conversation, EvaluationRecord, Knowledge, LearningRecord, Memory, Message,
                      ResearchTask, SystemLog, UserFeedback)
from ..services import backup, models_pull, search, settings_store
from ..services.logs import log

router = APIRouter(prefix="/api", tags=["system"])
STARTED = time.time()


@router.get("/health")
def health():
    return {"ok": True, "version": "1.1.0"}


@router.get("/ai/status")
def ai_status(db: Session = Depends(get_db)):
    return AIRouter(db).status()


class PullIn(BaseModel):
    model: str = Field(min_length=1, max_length=100)
    confirm: bool = False  # external download: the user must confirm


@router.get("/ai/models")
def ai_models(db: Session = Depends(get_db)):
    st = AIRouter(db).status()
    return {"installed": st["local"]["models"], "selected": st["local"]["model"], "ollama_ok": st["local"]["reachable"],
            "suggested": models_pull.SUGGESTED, "jobs": models_pull.jobs()}


@router.post("/ai/models/pull")
def ai_models_pull(body: PullIn):
    if not body.confirm:
        raise HTTPException(428, {"code": "confirmation_required",
                                  "message": "모델 받기는 인터넷에서 큰 파일을 내려받습니다. 확인이 필요합니다."})
    try:
        return models_pull.start(body.model.strip())
    except ValueError as e:
        raise HTTPException(422, str(e)) from e


@router.get("/system")
def system_status(db: Session = Depends(get_db)):
    from ..config import BACKEND_DIR
    env = get_settings()
    data = env.data_path
    try:
        data_label = str(data.relative_to(BACKEND_DIR.parent))
    except ValueError:
        data_label = data.name
    try:
        backups = backup.list_all()
    except ValueError:
        backups = []
    return {
        **_system(settings_store.get_all(db)),
        "version": "1.1.0",
        "data_dir": data_label,
        "backups": len(backups),
        "last_backup": backups[0]["created_at"] if backups else None,
        "ai": AIRouter(db).status(),
        "counts": {"memories": db.query(Memory).count(), "knowledge": db.query(Knowledge).count(),
                   "conversations": db.query(Conversation).count(), "messages": db.query(Message).count(),
                   "logs": db.query(SystemLog).count()},
    }


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    ai = AIRouter(db).status()
    cfg = settings_store.get_all(db)
    return {
        "ai": ai,
        "counts": {
            "memories": db.query(Memory).count(),
            "knowledge": db.query(Knowledge).count(),
            "research_completed": db.query(ResearchTask).filter(ResearchTask.status == "completed").count(),
            "research_total": db.query(ResearchTask).count(),
            "conversations": db.query(Conversation).count(),
            "messages": db.query(Message).count(),
            "learning_records": db.query(LearningRecord).count(),
            "evaluations": db.query(EvaluationRecord).filter(EvaluationRecord.status == "completed").count(),
            "feedback": db.query(UserFeedback).count(),
            "autonomy_proposed": db.query(AutonomyTask).filter(AutonomyTask.status == "proposed").count(),
        },
        "recent_learning": [S.learning(r) for r in db.query(LearningRecord).order_by(LearningRecord.id.desc()).limit(5)],
        "recent_activity": [S.log(entry) for entry in db.query(SystemLog).order_by(SystemLog.id.desc()).limit(12)],
        "system": _system(cfg),
    }


def _system(cfg: dict) -> dict:
    env = get_settings()
    return {
        "uptime_seconds": int(time.time() - STARTED),
        "python": platform.python_version(),
        "database": "sqlite" if env.database_url.startswith("sqlite") else "other",
        "database_size": backup.db_size(),
        "search": search.provider_status(cfg),
        "external_network_enabled": cfg["external_network_enabled"],
        "access_token_required": bool(env.ACCESS_TOKEN),
    }


@router.get("/settings")
def get_settings_api(db: Session = Depends(get_db)):
    env = get_settings()
    return {
        "values": settings_store.get_all(db),
        "sensitive_keys": sorted(settings_store.SENSITIVE_KEYS),
        "env": {  # read-only, secrets reported only as set / not set
            "CLOUD_ENABLED": env.CLOUD_ENABLED,
            "CLOUD_PROVIDER": env.CLOUD_PROVIDER,
            "CLOUD_MODEL": env.CLOUD_MODEL or None,
            "CLOUD_API_KEY_SET": bool(env.CLOUD_API_KEY),
            "OLLAMA_BASE_URL": env.OLLAMA_BASE_URL,
            "SEARXNG_URL_SET": bool(env.SEARXNG_URL),
            "BRAVE_API_KEY_SET": bool(env.BRAVE_API_KEY),
            "TAVILY_API_KEY_SET": bool(env.TAVILY_API_KEY),
            "MAX_UPLOAD_MB": env.MAX_UPLOAD_MB,
            "ACCESS_TOKEN_SET": bool(env.ACCESS_TOKEN),
        },
        "options": {"ai_modes": list(settings_store.AI_MODES), "search_providers": list(settings_store.SEARCH_PROVIDERS)},
    }


class SettingsIn(BaseModel):
    values: dict[str, Any]
    confirm_sensitive: bool = False  # must be true to switch ON cloud / external network / sending memories out


@router.put("/settings")
def put_settings(body: SettingsIn, db: Session = Depends(get_db)):
    turning_on = [k for k in body.values if k in settings_store.SENSITIVE_KEYS and body.values[k] is True
                  and settings_store.get(db, k) is not True]
    if turning_on and not body.confirm_sensitive:
        raise HTTPException(428, {"code": "confirmation_required", "keys": turning_on,
                                  "message": "외부 연결·개인정보 전송 관련 설정을 켜려면 확인이 필요합니다."})
    try:
        values = settings_store.set_many(db, body.values)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    log(db, "settings", f"설정 변경: {', '.join(body.values)}", data={"keys": list(body.values)})
    return {"values": values}


@router.get("/logs")
def logs(category: str | None = None, limit: int = 100, db: Session = Depends(get_db)):
    q = db.query(SystemLog)
    if category:
        q = q.filter(SystemLog.category == category)
    return [S.log(entry) for entry in q.order_by(SystemLog.id.desc()).limit(max(1, min(limit, 500)))]


# ---------- backup & data management ----------

@router.get("/backups")
def list_backups():
    try:
        return backup.list_all()
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.post("/backups")
def create_backup(db: Session = Depends(get_db)):
    try:
        info = backup.create()
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    log(db, "backup", f"백업 생성: {info['name']}")
    return info


@router.get("/backups/{name}/download")
def download_backup(name: str):
    try:
        p = backup.resolve(name)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    if not p.exists():
        raise HTTPException(404, "백업을 찾을 수 없습니다.")
    return FileResponse(p, filename=p.name, media_type="application/octet-stream")


class ConfirmIn(BaseModel):
    confirm: str = Field(default="")


@router.post("/backups/{name}/restore")
def restore_backup(name: str, body: ConfirmIn):
    if body.confirm != "RESTORE":
        raise HTTPException(428, "복구하려면 confirm 값으로 RESTORE를 입력해야 합니다.")
    try:
        p = backup.resolve(name)
        if not p.exists():
            raise HTTPException(404, "백업을 찾을 수 없습니다.")
        return backup.restore(p)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.delete("/backups/{name}")
def delete_backup(name: str):
    try:
        backup.delete_backup(name)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(404, "백업을 찾을 수 없습니다.") from e
    return {"deleted": name}


@router.post("/backups/upload")
async def upload_backup(file: UploadFile = File(...)):
    data = await file.read(200 * 1024 * 1024 + 1)
    if len(data) > 200 * 1024 * 1024:
        raise HTTPException(413, "백업 파일이 너무 큽니다 (최대 200MB).")
    try:
        p = backup.save_upload(data)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    return backup.info(p)


@router.get("/export")
def export(db: Session = Depends(get_db)):
    return JSONResponse(backup.export_json(db), headers={"Content-Disposition": 'attachment; filename="self-ai-export.json"'})


DATA_SCOPES = {
    "conversations": [Conversation],
    "memories": [Memory],
    "knowledge": [Knowledge],
    "learning": [LearningRecord],
    "research": [ResearchTask],
    "evaluations": [EvaluationRecord, UserFeedback],
    "logs": [SystemLog],
    "autonomy": [AutonomyTask],
}


class DeleteDataIn(BaseModel):
    scope: str
    confirm: str = ""


@router.post("/data/delete")
def delete_data(body: DeleteDataIn, db: Session = Depends(get_db)):
    """Bulk delete. Requires typing DELETE, and always makes a backup first."""
    if body.scope not in DATA_SCOPES:
        raise HTTPException(422, "잘못된 범위")
    if body.confirm != "DELETE":
        raise HTTPException(428, "대량 삭제는 confirm 값으로 DELETE를 입력해야 합니다.")
    try:
        safety = backup.create("predelete")["name"]
    except ValueError:
        safety = None
    counts = {}
    if body.scope == "conversations":
        counts["conversation_memories"] = db.query(Memory).filter(Memory.source.like("conversation:%")).delete(
            synchronize_session=False)
    for model in DATA_SCOPES[body.scope]:
        rows = db.query(model).all()
        for r in rows:
            db.delete(r)
        counts[model.__tablename__] = len(rows)
    db.commit()
    log(db, "data", f"데이터 삭제: {body.scope} {counts}", "warn")
    return {"deleted": counts, "safety_backup": safety}
