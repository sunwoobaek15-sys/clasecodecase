"""AI CORE: understand -> retrieve memories & knowledge -> answer -> record -> learn from the turn."""
from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..ai.providers import AIError
from ..ai.router import AIRouter
from ..models import Conversation, Knowledge, Memory, Message
from . import knowledge as K
from . import memory as M
from . import settings_store
from . import text as T
from .logs import log

HISTORY_TURNS = 12

SYSTEM_PROMPT = """너는 SELF AI, 한 사람을 위한 개인 AI다.
규칙:
1. 아래 [기억]과 [지식]은 데이터베이스에서 검색한 자료다. 질문과 관련 있을 때만 사용하고, 사용했다면 문장 끝에 [M1], [K2]처럼 표시하라.
2. 자료에 없는 내용은 일반 지식으로 답하되, 확실하지 않으면 "확실하지 않음"이라고 분명히 말하라. 지어내지 마라.
3. 자료끼리 충돌하면 충돌한다고 알려라.
4. 사용자가 쓴 언어로, 핵심부터 간결하게 답하라."""

UNCERTAIN_PATTERNS = re.compile(r"확실하지 않|불확실|모르겠|알 수 없|추정|아마|정확하지 않을 수|not sure|uncertain|i don't know|might be|may be", re.I)


def build_context(db: Session, question: str, cfg: dict, allow_personal: bool) -> dict:
    mems = M.search(db, question, limit=cfg["memory_context_limit"]) if allow_personal else []
    knows = K.search(db, question, limit=cfg["knowledge_context_limit"]) if allow_personal else []
    return {"memories": mems, "knowledge": knows}


def context_block(ctx: dict) -> str:
    lines = []
    if ctx["memories"]:
        lines.append("[기억]")
        for i, (m, _) in enumerate(ctx["memories"], 1):
            lines.append(f"M{i} ({M.KIND_LABELS.get(m.kind, m.kind)}): {m.content}")
    if ctx["knowledge"]:
        lines.append("[지식]")
        for i, (k, _) in enumerate(ctx["knowledge"], 1):
            body = k.content if len(k.content) < 1200 else k.content[:1200] + "…"
            lines.append(f"K{i} [{k.title}] (출처: {k.source or k.source_type}, 신뢰도 {k.confidence:.2f}, {k.verification}): {body}")
    return "\n".join(lines) if lines else "[기억/지식] 관련 자료 없음"


def grounding(answer: str, ctx_meta: dict) -> dict:
    cites = sorted(set(re.findall(r"\[([MK]\d+)\]", answer)))
    return {
        "memories_given": len(ctx_meta.get("memories", [])),
        "knowledge_given": len(ctx_meta.get("knowledge", [])),
        "citations": cites,
        "uses_context": bool(cites),
        "uncertainty_expressed": bool(UNCERTAIN_PATTERNS.search(answer)),
        "no_context": not ctx_meta.get("memories") and not ctx_meta.get("knowledge"),
    }


def chat(db: Session, message: str, conversation_id: int | None = None) -> dict:
    cfg = settings_store.get_all(db)
    router = AIRouter(db)
    router._pick()  # raises AIError with a clear reason before anything is stored

    allow_personal = (not router.sends_externally) or cfg["cloud_send_memories"]
    conv = None
    history: list[dict] = []
    if conversation_id is not None:
        conv = db.get(Conversation, conversation_id)
        if conv is None:
            raise LookupError("대화를 찾을 수 없습니다.")
        history = [{"role": m.role, "content": m.content} for m in conv.messages[-HISTORY_TURNS:]]

    ctx = build_context(db, message, cfg, allow_personal)
    msgs = [{"role": "system", "content": SYSTEM_PROMPT + "\n\n" + context_block(ctx)}, *history,
            {"role": "user", "content": message}]
    result = router.chat(msgs)
    answer = result.content.strip() or "(빈 응답)"

    ctx_meta = {
        "memories": [{"ref": f"M{i}", "id": m.id, "kind": m.kind, "content": m.content[:300], "score": round(s, 3)}
                     for i, (m, s) in enumerate(ctx["memories"], 1)],
        "knowledge": [{"ref": f"K{i}", "id": k.id, "title": k.title, "source": k.source, "confidence": k.confidence,
                       "verification": k.verification, "score": round(s, 3)}
                      for i, (k, s) in enumerate(ctx["knowledge"], 1)],
        "withheld_for_privacy": not allow_personal,
    }
    ctx_meta["grounding"] = grounding(answer, ctx_meta)
    now = datetime.now(timezone.utc)
    for m, _ in ctx["memories"]:
        m.last_used_at = now
    for k, _ in ctx["knowledge"]:
        k.times_used += 1

    out = {"answer": answer, "provider": result.provider, "model": result.model,
           "latency_ms": result.latency_ms, "context": ctx_meta, "saved": cfg["save_chat_history"]}

    if cfg["save_chat_history"]:
        if conv is None:
            conv = Conversation(title=T.make_title(message, 40))
            db.add(conv)
            db.flush()
        um = Message(conversation_id=conv.id, role="user", content=message)
        db.add(um)
        db.flush()
        am = Message(conversation_id=conv.id, role="assistant", content=answer, provider=result.provider,
                     model=result.model, latency_ms=result.latency_ms, context=ctx_meta)
        db.add(am)
        conv.updated_at = now
        db.commit()
        out.update(conversation_id=conv.id, user_message_id=um.id, assistant_message_id=am.id)
    else:
        db.commit()
        out.update(conversation_id=None, user_message_id=None, assistant_message_id=None)

    log(db, "chat", f"답변 생성 ({result.provider}/{result.model}, {result.latency_ms}ms)",
        data={"conversation_id": out["conversation_id"], "memories": len(ctx_meta["memories"]),
              "knowledge": len(ctx_meta["knowledge"])})
    return out


def remember_from_message(db: Session, text: str, source: str) -> list[dict]:
    """Extract memories from a user message (rules always; AI too when it is local or allowed)."""
    cfg = settings_store.get_all(db)
    if not cfg["auto_memory"]:
        return []
    cands = M.extract_rules(text)
    try:
        router = AIRouter(db)
        if not router.sends_externally or cfg["cloud_send_memories"]:
            cands += M.extract_llm(router, text)
    except AIError:
        pass
    saved = []
    for c in cands:
        m, created = M.create(db, c["kind"], c["content"], source=source, importance=c["importance"])
        saved.append({"id": m.id, "kind": m.kind, "content": m.content, "created": created})
    if saved:
        log(db, "memory", f"대화에서 기억 {sum(s['created'] for s in saved)}개 저장, {sum(not s['created'] for s in saved)}개 강화",
            data={"source": source})
    return saved


def touch_counts(db: Session) -> dict:
    return {"memories": db.query(Memory).count(), "knowledge": db.query(Knowledge).count()}
