"""Knowledge base: add with dedupe + comparison against existing knowledge, search.

Adding knowledge here is retrieval-based accumulation. It does NOT retrain or
change the AI model's weights; the model reads matching entries at answer time.

`confidence` is a transparent heuristic (0..1), not a measured truth score:
  user text / file 0.6, research = average source reliability, user-verified 0.9,
  disputed (conflicting entry recorded) capped at 0.4.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import Knowledge
from . import text as T

DUPLICATE = 0.85
RELATED = 0.25

BASE_CONFIDENCE = {"text": 0.6, "file": 0.6, "chat": 0.5, "research": 0.5, "correction": 0.9, "starter": 0.5}


def compare(db: Session, content: str, exclude_ids: set[int] | None = None) -> dict:
    """Compare new content against existing knowledge.

    Returns {"duplicate": Knowledge|None, "related": [(Knowledge, similarity)]}.
    """
    exclude_ids = exclude_ids or set()
    h = T.content_hash(content)
    exact = db.query(Knowledge).filter(Knowledge.content_hash == h).first()
    if exact and exact.id not in exclude_ids:
        return {"duplicate": exact, "related": []}
    items = [k for k in db.query(Knowledge).all() if k.id not in exclude_ids]
    cands = T.rank(content, items, lambda k: f"{k.title}\n{k.content}", limit=10)
    related = []
    for k, _ in cands:
        sim = T.similarity(content, k.content)
        if sim >= DUPLICATE:
            return {"duplicate": k, "related": []}
        if sim >= RELATED:
            related.append((k, round(sim, 3)))
    related.sort(key=lambda x: x[1], reverse=True)
    return {"duplicate": None, "related": related[:5]}


def add(db: Session, *, title: str, content: str, category: str = "general", source_type: str = "text",
        source: str = "", summary: str | None = None, key_points: list | None = None,
        confidence: float | None = None, verification: str = "unverified",
        learning_record_id: int | None = None, research_task_id: int | None = None,
        commit: bool = True) -> tuple[Knowledge | None, dict]:
    """Returns (knowledge or None if duplicate, comparison info)."""
    cmp = compare(db, content)
    if cmp["duplicate"] is not None:
        return None, cmp
    k = Knowledge(
        title=title[:300] or T.make_title(content), content=content, summary=summary,
        key_points=key_points or T.extractive_points(content, 3), category=(category or "general")[:100],
        source_type=source_type, source=source[:500],
        confidence=round(confidence if confidence is not None else BASE_CONFIDENCE.get(source_type, 0.5), 3),
        verification=verification, content_hash=T.content_hash(content),
        related_ids=[r.id for r, _ in cmp["related"]] or None,
        learning_record_id=learning_record_id, research_task_id=research_task_id,
    )
    db.add(k)
    if commit:
        db.commit()
        db.refresh(k)
    else:
        db.flush()
    return k, cmp


def search(db: Session, query: str, limit: int = 5, category: str | None = None) -> list[tuple[Knowledge, float]]:
    q = db.query(Knowledge)
    if category:
        q = q.filter(Knowledge.category == category)
    items = q.all()
    ranked = T.rank(query, items, lambda k: f"{k.title}\n{k.title}\n{k.content}", limit=limit * 2)
    weighted = [(k, s * (0.7 + 0.6 * k.confidence)) for k, s in ranked]
    weighted.sort(key=lambda x: x[1], reverse=True)
    return weighted[:limit]
