from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import serialize as S
from ..db import SessionLocal, get_db
from ..models import Knowledge, LearningRecord, Memory
from ..services import files, learning, starter_packs
from ..services import text as T

router = APIRouter(prefix="/api/learning", tags=["learning"])


def _run_bg(record_id: int, text: str) -> None:
    db = SessionLocal()
    try:
        learning.run(db, record_id, text)
    finally:
        db.close()


class TextIn(BaseModel):
    text: str = Field(min_length=20, max_length=learning.MAX_CHARS)
    title: str | None = Field(default=None, max_length=300)
    category: str | None = Field(default=None, max_length=100)


@router.post("/text")
def learn_text(body: TextIn, bg: BackgroundTasks, db: Session = Depends(get_db)):
    rec = LearningRecord(title=(body.title or "").strip() or T.make_title(body.text), source_type="text",
                         source_name="직접 입력", category=(body.category or "").strip() or "general")
    db.add(rec)
    db.commit()
    bg.add_task(_run_bg, rec.id, body.text)
    return S.learning(rec)


@router.post("/file")
async def learn_file(bg: BackgroundTasks, file: UploadFile = File(...), category: str = Form(default=""),
                     db: Session = Depends(get_db)):
    name = files.safe_filename(file.filename or "")
    data = await file.read(files.max_bytes() + 1)
    try:
        text = files.extract_text(name, data)
    except files.UploadError as e:
        raise HTTPException(422, str(e)) from e
    rec = LearningRecord(title=name, source_type="file", source_name=name,
                         category=category.strip()[:100] or "general")
    db.add(rec)
    db.commit()
    bg.add_task(_run_bg, rec.id, text)
    return S.learning(rec)


@router.get("/packs")
def packs(db: Session = Depends(get_db)):
    return starter_packs.status(db)


@router.post("/packs/{pack_id}/import")
def import_pack(pack_id: str, bg: BackgroundTasks, db: Session = Depends(get_db)):
    """Learn the sections of a built-in pack that are not in the database yet (safe to repeat)."""
    try:
        ids = starter_packs.queue(db, pack_id)
    except LookupError as e:
        raise HTTPException(404, str(e)) from e
    if ids:
        bg.add_task(starter_packs.run_queued, pack_id, ids)
    return {"queued": len(ids), "already_imported": len(starter_packs.load_all()[pack_id].sections) - len(ids)}


@router.get("/records")
def records(db: Session = Depends(get_db)):
    return [S.learning(r) for r in db.query(LearningRecord).order_by(LearningRecord.id.desc()).limit(200)]


@router.get("/records/{rid}")
def record(rid: int, db: Session = Depends(get_db)):
    r = db.get(LearningRecord, rid)
    if not r:
        raise HTTPException(404, "학습 기록을 찾을 수 없습니다.")
    ks = db.query(Knowledge).filter(Knowledge.learning_record_id == rid).all()
    return {**S.learning(r), "knowledge": [S.knowledge(k, full=False) for k in ks]}


@router.delete("/records/{rid}")
def delete_record(rid: int, delete_knowledge: bool = False, db: Session = Depends(get_db)):
    r = db.get(LearningRecord, rid)
    if not r:
        raise HTTPException(404, "학습 기록을 찾을 수 없습니다.")
    n = 0
    if delete_knowledge:
        n = db.query(Knowledge).filter(Knowledge.learning_record_id == rid).delete()
        db.query(Memory).filter(Memory.source == f"learning:{rid}").delete()
    db.delete(r)
    db.commit()
    return {"deleted": rid, "knowledge_deleted": n}
