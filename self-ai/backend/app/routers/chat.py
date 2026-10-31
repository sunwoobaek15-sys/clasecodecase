import json

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

from .. import serialize as S
from ..ai.providers import AIError
from ..db import SessionLocal, get_db
from ..models import Conversation, EvaluationRecord, Memory, Message, UserFeedback
from ..services import core, evaluation, settings_store
from ..services import text as T

router = APIRouter(prefix="/api", tags=["chat"])


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=20000)
    conversation_id: int | None = None

    @field_validator("message")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("메시지가 비어 있습니다.")
        return v.strip()


def _after_chat(message: str, conversation_id: int | None, user_message_id: int | None,
                assistant_id: int | None, do_eval: bool) -> None:
    """Runs after the answer was sent: remember facts, evaluate the answer, update the conversation memory."""
    db = SessionLocal()
    try:
        src = f"chat:{conversation_id}/{user_message_id}" if conversation_id else "chat:unsaved"
        core.remember_from_message(db, message, src)
        if do_eval and assistant_id:
            evaluation.evaluate(db, assistant_id)
        if conversation_id:
            core.summarize_conversation(db, conversation_id)
    finally:
        db.close()


@router.post("/chat")
def chat(body: ChatIn, bg: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        out = core.chat(db, body.message, body.conversation_id)
    except LookupError as e:
        raise HTTPException(404, str(e)) from e
    except AIError as e:
        raise HTTPException(503, {"code": e.code, "message": str(e)}) from e
    cfg = settings_store.get_all(db)
    bg.add_task(_after_chat, body.message, out["conversation_id"], out["user_message_id"],
                out["assistant_message_id"], cfg["auto_evaluate"])
    out["evaluation_pending"] = bool(cfg["auto_evaluate"] and out["assistant_message_id"])
    return out


@router.post("/chat/stream")
def chat_stream(body: ChatIn):
    """Same as /chat but streams the answer as NDJSON events: start, delta…, done | error."""
    db = SessionLocal()  # owned by the stream (dependency sessions may close before streaming ends)
    try:
        turn = core.prepare(db, body.message, body.conversation_id)
    except LookupError as e:
        db.close()
        raise HTTPException(404, str(e)) from e
    except AIError as e:
        db.close()
        raise HTTPException(503, {"code": e.code, "message": str(e)}) from e
    result: dict = {}

    def events():
        try:
            for ev in core.chat_stream(db, turn, body.message):
                if ev["type"] == "done":
                    ev["evaluation_pending"] = bool(turn.cfg["auto_evaluate"] and ev["assistant_message_id"])
                    result.update(ev)
                yield json.dumps(ev, ensure_ascii=False) + "\n"
        finally:
            db.close()

    def after():
        if result:
            _after_chat(body.message, result["conversation_id"], result["user_message_id"],
                        result["assistant_message_id"], turn.cfg["auto_evaluate"])

    return StreamingResponse(events(), media_type="application/x-ndjson", background=BackgroundTask(after),
                             headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"})


@router.get("/conversations")
def list_conversations(q: str = "", db: Session = Depends(get_db)):
    convs = db.query(Conversation).order_by(Conversation.updated_at.desc()).limit(200).all()
    if q.strip():
        ql = q.strip().lower()
        convs = [c for c in convs if ql in c.title.lower() or any(ql in m.content.lower() for m in c.messages)]
    return [{"id": c.id, "title": c.title, "message_count": len(c.messages), "created_at": S.iso(c.created_at),
             "updated_at": S.iso(c.updated_at)} for c in convs]


@router.get("/conversations/{cid}")
def get_conversation(cid: int, db: Session = Depends(get_db)):
    c = db.get(Conversation, cid)
    if not c:
        raise HTTPException(404, "대화를 찾을 수 없습니다.")
    ids = [m.id for m in c.messages]
    evals = {e.message_id: S.evaluation(e) for e in db.query(EvaluationRecord).filter(EvaluationRecord.message_id.in_(ids))}
    fbs = {f.message_id: S.feedback(f) for f in db.query(UserFeedback).filter(UserFeedback.message_id.in_(ids))}
    linked = db.query(Memory).filter(Memory.source.like(f"chat:{cid}/%")).count()
    return {"id": c.id, "title": c.title, "created_at": S.iso(c.created_at), "extracted_memories": linked,
            "messages": [{**S.message(m), "evaluation": evals.get(m.id), "feedback": fbs.get(m.id)} for m in c.messages]}


class RenameIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)


@router.patch("/conversations/{cid}")
def rename(cid: int, body: RenameIn, db: Session = Depends(get_db)):
    c = db.get(Conversation, cid)
    if not c:
        raise HTTPException(404, "대화를 찾을 수 없습니다.")
    c.title = body.title.strip()
    db.commit()
    return {"id": c.id, "title": c.title}


@router.delete("/conversations/{cid}")
def delete_conversation(cid: int, delete_memories: bool = False, db: Session = Depends(get_db)):
    """Deletes the conversation and its "대화 기록" memory. Facts remembered from it are kept unless
    delete_memories=true (they are separate memories the user can see in Memory)."""
    c = db.get(Conversation, cid)
    if not c:
        raise HTTPException(404, "대화를 찾을 수 없습니다.")
    n = core.forget_conversation(db, cid, include_extracted=delete_memories)
    db.delete(c)
    db.commit()
    return {"deleted": cid, "memories_deleted": n}


@router.get("/messages/{mid}/evaluation")
def message_evaluation(mid: int, db: Session = Depends(get_db)):
    e = db.query(EvaluationRecord).filter(EvaluationRecord.message_id == mid).order_by(EvaluationRecord.id.desc()).first()
    return S.evaluation(e) if e else None


@router.post("/messages/{mid}/evaluate")
def evaluate_now(mid: int, db: Session = Depends(get_db)):
    try:
        return S.evaluation(evaluation.evaluate(db, mid))
    except LookupError as e:
        raise HTTPException(404, str(e)) from e


class FeedbackIn(BaseModel):
    rating: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = Field(default=None, max_length=5000)
    corrected_answer: str | None = Field(default=None, max_length=20000)
    save_correction_as_knowledge: bool = False


@router.post("/messages/{mid}/feedback")
def feedback(mid: int, body: FeedbackIn, db: Session = Depends(get_db)):
    m = db.get(Message, mid)
    if not m or m.role != "assistant":
        raise HTTPException(404, "AI 답변을 찾을 수 없습니다.")
    if body.rating is None and not body.comment and not body.corrected_answer:
        raise HTTPException(422, "평점, 의견, 수정 답변 중 하나는 입력해야 합니다.")
    corrected = (body.corrected_answer or "").strip() or None
    f = UserFeedback(message_id=mid, rating=body.rating, comment=(body.comment or "").strip() or None,
                     corrected_answer=corrected,
                     similarity=evaluation.correction_similarity(m.content, corrected) if corrected else None)
    db.add(f)
    db.commit()
    out = S.feedback(f)
    if corrected and body.save_correction_as_knowledge:
        from ..services import knowledge as K
        q = (db.query(Message).filter(Message.conversation_id == m.conversation_id, Message.id < m.id,
                                      Message.role == "user").order_by(Message.id.desc()).first())
        title = f"[사용자 수정] {T.make_title(q.content if q else corrected, 80)}"
        content = (f"질문: {q.content}\n\n" if q else "") + f"올바른 답변 (사용자 확인): {corrected}"
        k, _ = K.add(db, title=title, content=content, category="correction", source_type="correction",
                     source=f"feedback:{f.id}", verification="user_verified", confidence=0.9)
        out["knowledge_id"] = k.id if k else None
    return out
