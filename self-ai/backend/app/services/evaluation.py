"""Self-evaluation. The same (or another configured) model scores an answer.

This is a self-assessment, not ground truth: scores are recorded so they can be
compared with the user's own feedback and corrections over time. Nothing here
changes the model itself.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from ..ai.jsonutil import parse_json
from ..ai.providers import AIError
from ..ai.router import AIRouter
from ..models import EvaluationRecord, Message
from . import text as T
from .logs import log

DIMENSIONS = ("accuracy", "logic", "evidence", "relevance")

EVAL_PROMPT = """너는 엄격한 평가자다. 아래 질문에 대한 AI 답변을 평가하라.
각 항목 1~5점 (5가 최고):
- accuracy: 사실이 정확한가 (확인할 수 없으면 3 이하)
- logic: 논리가 일관적인가
- evidence: 근거(제공된 자료 인용, 출처)가 충분한가
- relevance: 질문에 맞게 답했는가
missing_info: 빠진 정보 (없으면 "없음")
uncertainty: 답변에서 불확실한 부분 (없으면 "없음")
comments: 한 문장 총평
JSON만 출력: {{"accuracy": n, "logic": n, "evidence": n, "relevance": n, "missing_info": "...", "uncertainty": "...", "comments": "..."}}

[답변에 제공된 자료]
{context}

[질문]
{question}

[답변]
{answer}"""


def _score(v) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return max(1.0, min(5.0, f))


def evaluate(db: Session, message_id: int) -> EvaluationRecord:
    msg = db.get(Message, message_id)
    if msg is None or msg.role != "assistant":
        raise LookupError("평가할 AI 답변을 찾을 수 없습니다.")
    question_msg = (db.query(Message).filter(Message.conversation_id == msg.conversation_id,
                                             Message.id < msg.id, Message.role == "user")
                    .order_by(Message.id.desc()).first())
    question = question_msg.content if question_msg else ""
    ctx = msg.context or {}
    ctx_text = "\n".join([f"{m['ref']}: {m['content']}" for m in ctx.get("memories", [])] +
                         [f"{k['ref']}: {k['title']}" for k in ctx.get("knowledge", [])]) or "없음"
    rec = EvaluationRecord(message_id=msg.id, question=question, answer=msg.content,
                           grounding=ctx.get("grounding"))
    try:
        router = AIRouter(db)
        res = router.chat([{"role": "user", "content": EVAL_PROMPT.format(
            context=ctx_text, question=question[:3000], answer=msg.content[:5000])}], json_mode=True, temperature=0)
        data = parse_json(res.content)
        if not isinstance(data, dict):
            raise AIError("평가 결과를 해석할 수 없습니다 (JSON 아님).", "bad_output")
        scores = {d: _score(data.get(d)) for d in DIMENSIONS}
        if all(v is None for v in scores.values()):
            raise AIError("평가 점수가 없습니다.", "bad_output")
        for d, v in scores.items():
            setattr(rec, d, v)
        vals = [v for v in scores.values() if v is not None]
        rec.overall = round(sum(vals) / len(vals), 2)
        rec.missing_info = str(data.get("missing_info", ""))[:2000]
        rec.uncertainty = str(data.get("uncertainty", ""))[:2000]
        rec.comments = str(data.get("comments", ""))[:2000]
        rec.evaluator = f"{res.provider}:{res.model}"
        rec.status = "completed"
    except AIError as e:
        rec.status = "failed"
        rec.error = str(e)
    db.add(rec)
    db.commit()
    db.refresh(rec)
    log(db, "evaluation", f"답변 #{msg.id} 평가 {rec.status}" + (f" (종합 {rec.overall})" if rec.overall else ""),
        "info" if rec.status == "completed" else "warn")
    return rec


def correction_similarity(original: str, corrected: str) -> float:
    return round(T.similarity(original, corrected), 3)
