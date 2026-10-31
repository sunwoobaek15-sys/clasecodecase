from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import serialize as S
from ..db import get_db
from ..models import Knowledge
from ..services import knowledge as K
from ..services import text as T

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])
VERIFICATIONS = ("unverified", "user_verified", "multi_source", "disputed")


@router.get("")
def list_knowledge(q: str = "", category: str | None = None, verification: str | None = None,
                   db: Session = Depends(get_db)):
    if q.strip():
        items = [(k, s) for k, s in K.search(db, q, limit=100, category=category)]
        out = [{**S.knowledge(k, full=False), "score": round(s, 3)} for k, s in items]
    else:
        query = db.query(Knowledge)
        if category:
            query = query.filter(Knowledge.category == category)
        out = [S.knowledge(k, full=False) for k in query.order_by(Knowledge.updated_at.desc()).limit(500)]
    if verification:
        out = [k for k in out if k["verification"] == verification]
    return out


@router.get("/categories")
def categories(db: Session = Depends(get_db)):
    rows = db.query(Knowledge.category, func.count(Knowledge.id)).group_by(Knowledge.category).all()
    return [{"category": c, "count": n} for c, n in sorted(rows, key=lambda r: -r[1])]


@router.get("/{kid}")
def get(kid: int, db: Session = Depends(get_db)):
    k = db.get(Knowledge, kid)
    if not k:
        raise HTTPException(404, "지식을 찾을 수 없습니다.")
    related = [db.get(Knowledge, i) for i in (k.related_ids or [])]
    return {**S.knowledge(k), "related": [{"id": r.id, "title": r.title, "similarity": round(T.similarity(k.content, r.content), 3)}
                                          for r in related if r]}


class KnowledgePatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    content: str | None = Field(default=None, min_length=1, max_length=200000)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    verification: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)


@router.patch("/{kid}")
def update(kid: int, body: KnowledgePatch, db: Session = Depends(get_db)):
    k = db.get(Knowledge, kid)
    if not k:
        raise HTTPException(404, "지식을 찾을 수 없습니다.")
    if body.verification is not None:
        if body.verification not in VERIFICATIONS:
            raise HTTPException(422, "잘못된 검증 상태")
        k.verification = body.verification
        if body.verification == "user_verified" and body.confidence is None:
            k.confidence = max(k.confidence, 0.9)
    for f in ("title", "category", "confidence"):
        v = getattr(body, f)
        if v is not None:
            setattr(k, f, v.strip() if isinstance(v, str) else v)
    if body.content is not None:
        k.content = body.content
        k.content_hash = T.content_hash(body.content)
        k.key_points = T.extractive_points(body.content, 3)
    db.commit()
    return S.knowledge(k)


@router.delete("/{kid}")
def delete(kid: int, db: Session = Depends(get_db)):
    k = db.get(Knowledge, kid)
    if not k:
        raise HTTPException(404, "지식을 찾을 수 없습니다.")
    db.delete(k)
    db.commit()
    return {"deleted": kid}
