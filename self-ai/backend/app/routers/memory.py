from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import serialize as S
from ..db import get_db
from ..models import MEMORY_KINDS, Memory
from ..services import memory as M

router = APIRouter(prefix="/api/memories", tags=["memory"])


class MemoryIn(BaseModel):
    kind: str
    content: str = Field(min_length=1, max_length=5000)
    importance: int = Field(default=3, ge=1, le=5)


class MemoryPatch(BaseModel):
    kind: str | None = None
    content: str | None = Field(default=None, min_length=1, max_length=5000)
    importance: int | None = Field(default=None, ge=1, le=5)


@router.get("/kinds")
def kinds():
    return [{"kind": k, "label": M.KIND_LABELS[k]} for k in MEMORY_KINDS]


@router.get("")
def list_memories(q: str = "", kind: str | None = None, db: Session = Depends(get_db)):
    if kind and kind not in MEMORY_KINDS:
        raise HTTPException(422, "잘못된 기억 종류")
    if q.strip():
        return [{**S.memory(m), "score": round(s, 3)} for m, s in M.search(db, q, kind, limit=100)]
    query = db.query(Memory)
    if kind:
        query = query.filter(Memory.kind == kind)
    return [S.memory(m) for m in query.order_by(Memory.updated_at.desc()).all()]


@router.post("")
def create(body: MemoryIn, db: Session = Depends(get_db)):
    try:
        m, created = M.create(db, body.kind, body.content, "manual", body.importance)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    return {**S.memory(m), "created": created}


@router.patch("/{mid}")
def update(mid: int, body: MemoryPatch, db: Session = Depends(get_db)):
    m = db.get(Memory, mid)
    if not m:
        raise HTTPException(404, "기억을 찾을 수 없습니다.")
    try:
        return S.memory(M.update(db, m, body.content, body.kind, body.importance))
    except ValueError as e:
        raise HTTPException(422, str(e)) from e


@router.delete("/{mid}")
def delete(mid: int, db: Session = Depends(get_db)):
    m = db.get(Memory, mid)
    if not m:
        raise HTTPException(404, "기억을 찾을 수 없습니다.")
    db.delete(m)
    db.commit()
    return {"deleted": mid}


@router.get("/duplicates")
def duplicates(db: Session = Depends(get_db)):
    return [[S.memory(m) for m in g] for g in M.duplicate_groups(db)]


@router.post("/dedupe")
def dedupe(db: Session = Depends(get_db)):
    return M.merge_duplicates(db)
