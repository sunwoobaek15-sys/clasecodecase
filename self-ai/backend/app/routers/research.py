from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import serialize as S
from ..db import get_db
from ..models import ResearchTask
from ..services import research as R
from ..services import search, settings_store

router = APIRouter(prefix="/api/research", tags=["research"])


class StartIn(BaseModel):
    topic: str = Field(min_length=2, max_length=500)
    use_web: bool = True


@router.get("/provider")
def provider(db: Session = Depends(get_db)):
    return search.provider_status(settings_store.get_all(db))


@router.post("")
def start(body: StartIn, bg: BackgroundTasks, db: Session = Depends(get_db)):
    t = ResearchTask(topic=body.topic.strip())
    db.add(t)
    db.commit()
    bg.add_task(R.run, t.id, body.use_web)
    return S.research(t)


@router.post("/{tid}/run")
def rerun(tid: int, bg: BackgroundTasks, use_web: bool = True, db: Session = Depends(get_db)):
    t = db.get(ResearchTask, tid)
    if not t:
        raise HTTPException(404, "조사를 찾을 수 없습니다.")
    if t.status in ("planning", "searching", "analyzing", "writing"):
        raise HTTPException(409, "이미 진행 중입니다.")
    t.sources.clear()
    t.status, t.progress, t.report, t.comparison, t.error, t.saved_to_knowledge = "pending", 0, None, None, None, False
    db.commit()
    bg.add_task(R.run, t.id, use_web)
    return S.research(t)


@router.get("")
def list_tasks(db: Session = Depends(get_db)):
    return [S.research(t, with_sources=False) for t in db.query(ResearchTask).order_by(ResearchTask.id.desc()).limit(200)]


@router.get("/{tid}")
def get(tid: int, db: Session = Depends(get_db)):
    t = db.get(ResearchTask, tid)
    if not t:
        raise HTTPException(404, "조사를 찾을 수 없습니다.")
    return S.research(t)


@router.post("/{tid}/save")
def save(tid: int, db: Session = Depends(get_db)):
    t = db.get(ResearchTask, tid)
    if not t:
        raise HTTPException(404, "조사를 찾을 수 없습니다.")
    try:
        return R.save_to_knowledge(db, t)
    except ValueError as e:
        raise HTTPException(409, str(e)) from e


@router.delete("/{tid}")
def delete(tid: int, db: Session = Depends(get_db)):
    t = db.get(ResearchTask, tid)
    if not t:
        raise HTTPException(404, "조사를 찾을 수 없습니다.")
    db.delete(t)
    db.commit()
    return {"deleted": tid}
