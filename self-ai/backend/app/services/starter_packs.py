"""Starter knowledge packs: curated markdown files shipped with SELF AI.

A pack is `# Title`, `> description`, then `## Section` blocks. Importing runs every
section through the normal Learning pipeline (analysis, chunking, dedupe, comparison),
so the result is real, visible Learning records and Knowledge rows. Content is written
by the SELF AI authors, so it is stored as "unverified" with source "기본 자료".
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..models import LearningRecord
from . import learning

PACK_DIR = Path(__file__).resolve().parent.parent / "starter_packs"
SOURCE_PREFIX = "기본 자료"
CATEGORY = {"selfai-guide": "selfai", "ai-basics": "ai", "dev-basics": "dev"}


@dataclass
class Section:
    title: str
    text: str


@dataclass
class Pack:
    id: str
    title: str
    description: str
    sections: list[Section]


def load_all() -> dict[str, Pack]:
    packs: dict[str, Pack] = {}
    for f in sorted(PACK_DIR.glob("*.md")):
        raw = f.read_text(encoding="utf-8")
        title = (re.search(r"^# (.+)$", raw, re.M) or [None, f.stem])[1].strip()
        desc = (re.search(r"^> (.+)$", raw, re.M) or [None, ""])[1].strip()
        parts = re.split(r"^## (.+)$", raw, flags=re.M)
        secs = [Section(parts[i].strip(), parts[i + 1].strip()) for i in range(1, len(parts) - 1, 2)]
        packs[f.stem] = Pack(f.stem, title, desc, [s for s in secs if len(s.text) >= 20])
    return packs


def source_name(pack: Pack, section: Section) -> str:
    return f"{SOURCE_PREFIX}: {pack.title} / {section.title}"


def status(db: Session) -> list[dict]:
    done = {r.source_name for r in db.query(LearningRecord).filter(
        LearningRecord.source_type == "starter", LearningRecord.status == "completed")}
    out = []
    for p in load_all().values():
        imported = sum(1 for s in p.sections if source_name(p, s) in done)
        out.append({"id": p.id, "title": p.title, "description": p.description, "sections": len(p.sections),
                    "imported": imported, "titles": [s.title for s in p.sections]})
    return out


def queue(db: Session, pack_id: str) -> list[int]:
    """Create pending Learning records for sections not yet imported. Returns their ids."""
    pack = load_all().get(pack_id)
    if pack is None:
        raise LookupError("알 수 없는 지식 팩입니다.")
    busy = {r.source_name for r in db.query(LearningRecord).filter(
        LearningRecord.source_type == "starter", LearningRecord.status.in_(("pending", "running", "completed")))}
    ids = []
    for s in pack.sections:
        name = source_name(pack, s)
        if name in busy:
            continue
        rec = LearningRecord(title=s.title, source_type="starter", source_name=name,
                             category=CATEGORY.get(pack.id, "general"))
        db.add(rec)
        db.flush()
        ids.append(rec.id)
    db.commit()
    return ids


def run_queued(pack_id: str, record_ids: list[int]) -> None:
    pack = load_all()[pack_id]
    texts = {source_name(pack, s): s.text for s in pack.sections}
    db = SessionLocal()
    try:
        for rid in record_ids:
            rec = db.get(LearningRecord, rid)
            if rec is not None and rec.source_name in texts:
                learning.run(db, rid, texts[rec.source_name])
    finally:
        db.close()
