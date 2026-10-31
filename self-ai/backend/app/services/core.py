"""AI CORE: understand -> retrieve memories & knowledge -> answer -> record -> learn from the turn."""
from __future__ import annotations

import re
import time
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..ai.jsonutil import parse_json
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


def build_context(db: Session, question: str, cfg: dict, allow_personal: bool,
                  conversation_id: int | None = None) -> dict:
    if not allow_personal:
        return {"memories": [], "knowledge": []}
    own_summary = f"conversation:{conversation_id}" if conversation_id else None
    mems = [(m, sc) for m, sc in M.search(db, question, limit=cfg["memory_context_limit"] + 1)
            if m.source != own_summary][:cfg["memory_context_limit"]]  # the current chat is already in history
    knows = K.search(db, question, limit=cfg["knowledge_context_limit"])
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


@dataclass
class Turn:
    """Everything prepared for one question, before the model is called."""
    cfg: dict
    router: AIRouter
    conv: Conversation | None
    ctx: dict
    ctx_meta: dict
    messages: list[dict]


def prepare(db: Session, message: str, conversation_id: int | None = None) -> Turn:
    """Retrieve memories + knowledge and build the prompt. Raises AIError / LookupError before anything is stored."""
    cfg = settings_store.get_all(db)
    router = AIRouter(db)
    router._pick()  # raises AIError with a clear reason

    allow_personal = (not router.sends_externally) or cfg["cloud_send_memories"]
    conv = None
    history: list[dict] = []
    if conversation_id is not None:
        conv = db.get(Conversation, conversation_id)
        if conv is None:
            raise LookupError("대화를 찾을 수 없습니다.")
        history = [{"role": m.role, "content": m.content} for m in conv.messages[-HISTORY_TURNS:]]

    ctx = build_context(db, message, cfg, allow_personal, conversation_id)
    msgs = [{"role": "system", "content": SYSTEM_PROMPT + "\n\n" + context_block(ctx)}, *history,
            {"role": "user", "content": message}]
    ctx_meta = {
        "memories": [{"ref": f"M{i}", "id": m.id, "kind": m.kind, "content": m.content[:300], "score": round(sc, 3)}
                     for i, (m, sc) in enumerate(ctx["memories"], 1)],
        "knowledge": [{"ref": f"K{i}", "id": k.id, "title": k.title, "source": k.source, "confidence": k.confidence,
                       "verification": k.verification, "score": round(sc, 3)}
                      for i, (k, sc) in enumerate(ctx["knowledge"], 1)],
        "withheld_for_privacy": not allow_personal,
    }
    return Turn(cfg, router, conv, ctx, ctx_meta, msgs)


def finish(db: Session, turn: Turn, message: str, answer: str, provider: str, model: str, latency_ms: int) -> dict:
    """Record the answer: grounding checks, usage counters, conversation + messages, log."""
    answer = answer.strip() or "(빈 응답)"
    ctx_meta = {**turn.ctx_meta, "grounding": grounding(answer, turn.ctx_meta)}
    now = datetime.now(timezone.utc)
    for m, _ in turn.ctx["memories"]:
        m.last_used_at = now
    for k, _ in turn.ctx["knowledge"]:
        k.times_used += 1

    out = {"answer": answer, "provider": provider, "model": model, "latency_ms": latency_ms, "context": ctx_meta,
           "saved": turn.cfg["save_chat_history"]}
    conv = turn.conv
    if turn.cfg["save_chat_history"]:
        if conv is None:
            conv = Conversation(title=T.make_title(message, 40))
            db.add(conv)
            db.flush()
        um = Message(conversation_id=conv.id, role="user", content=message)
        db.add(um)
        db.flush()
        am = Message(conversation_id=conv.id, role="assistant", content=answer, provider=provider,
                     model=model, latency_ms=latency_ms, context=ctx_meta)
        db.add(am)
        conv.updated_at = now
        db.commit()
        out.update(conversation_id=conv.id, user_message_id=um.id, assistant_message_id=am.id)
    else:
        db.commit()
        out.update(conversation_id=None, user_message_id=None, assistant_message_id=None)

    log(db, "chat", f"답변 생성 ({provider}/{model}, {latency_ms}ms)",
        data={"conversation_id": out["conversation_id"], "memories": len(ctx_meta["memories"]),
              "knowledge": len(ctx_meta["knowledge"])})
    return out


def chat(db: Session, message: str, conversation_id: int | None = None) -> dict:
    turn = prepare(db, message, conversation_id)
    result = turn.router.chat(turn.messages)
    return finish(db, turn, message, result.content, result.provider, result.model, result.latency_ms)


def chat_stream(db: Session, turn: Turn, message: str) -> Iterator[dict]:
    """Yield events: start (context) -> delta (text pieces) -> done (saved ids) | error (nothing saved)."""
    yield {"type": "start", "context": turn.ctx_meta}
    meta: dict = {}
    parts: list[str] = []
    t0 = time.monotonic()
    try:
        for piece in turn.router.chat_stream(turn.messages, meta):
            parts.append(piece)
            yield {"type": "delta", "text": piece}
    except AIError as e:
        db.rollback()
        log(db, "chat", f"스트리밍 답변 실패: {e}", "warn")
        yield {"type": "error", "message": str(e)}
        return
    except Exception as e:  # noqa: BLE001 - never leave the browser with a silently cut stream
        db.rollback()
        log(db, "chat", f"스트리밍 답변 중 예상하지 못한 오류: {type(e).__name__}", "error")
        yield {"type": "error", "message": "답변을 만드는 중 오류가 발생했습니다. 다시 시도하세요."}
        return
    out = finish(db, turn, message, "".join(parts), meta.get("provider", "?"), meta.get("model") or "?",
                 int((time.monotonic() - t0) * 1000))
    yield {"type": "done", **out}


def _personal_ai_allowed(db: Session, cfg: dict) -> AIRouter | None:
    """A router that may see personal data: local AI, or cloud only if the user allowed sending memories."""
    try:
        router = AIRouter(db)
        router._pick()
    except AIError:
        return None
    if router.sends_externally and not cfg["cloud_send_memories"]:
        return None
    return router


def remember_from_message(db: Session, text: str, source: str) -> list[dict]:
    """Extract memories from a user message. Rules always run; the AI is asked only when the
    message looks personal (saves a model call on ordinary questions)."""
    cfg = settings_store.get_all(db)
    if not cfg["auto_memory"]:
        return []
    rules = M.extract_rules(text)
    ai_items = None
    if M.worth_ai_extraction(text):
        router = _personal_ai_allowed(db, cfg)
        if router:
            try:
                ai_items = M.extract_llm(router, text)
            except AIError:
                ai_items = None
    cands = M.merge_candidates(rules, ai_items)
    saved = []
    for c in cands:
        m, created = M.create(db, c["kind"], c["content"], source=source, importance=c["importance"])
        saved.append({"id": m.id, "kind": m.kind, "content": m.content, "created": created})
    if saved:
        log(db, "memory", f"대화에서 기억 {sum(s['created'] for s in saved)}개 저장, {sum(not s['created'] for s in saved)}개 강화",
            data={"source": source})
    return saved


SUMMARY_PROMPT = """다음 대화를 나중에 참고할 수 있게 요약하라. 사용자가 무엇을 물었고 어떤 정보나 결론이 나왔는지 1~2문장으로.
대화에 없는 내용은 쓰지 마라. JSON만 출력: {{"summary": "..."}}

대화:
{dialog}"""


def summarize_conversation(db: Session, conversation_id: int, force: bool = False) -> Memory | None:
    """Keep one "대화 기록" memory per conversation so later chats can use earlier ones.

    Re-summarised when the number of user messages reaches 2, 4, 8, 16, … (keeps model calls rare).
    """
    cfg = settings_store.get_all(db)
    conv = db.get(Conversation, conversation_id)
    if conv is None or not cfg["auto_memory"]:
        return None
    n = sum(1 for m in conv.messages if m.role == "user")
    if not force and (n < 2 or n & (n - 1)):
        return None
    dialog = "\n".join(f"{'사용자' if m.role == 'user' else 'AI'}: {m.content[:400]}" for m in conv.messages[-16:])
    summary = None
    router = _personal_ai_allowed(db, cfg)
    if router:
        try:
            res = router.chat([{"role": "user", "content": SUMMARY_PROMPT.format(dialog=dialog[:6000])}],
                              json_mode=True, temperature=0)
            data = parse_json(res.content)
            if isinstance(data, dict) and str(data.get("summary", "")).strip():
                summary = str(data["summary"]).strip()[:600]
        except AIError:
            pass
    if not summary:  # no AI: list what was asked (clearly not an AI summary)
        topics = "; ".join(T.make_title(m.content, 50) for m in conv.messages if m.role == "user")
        summary = f"사용자가 물은 것: {topics[:500]}"
    content = f"대화 '{conv.title}' ({conv.created_at:%Y-%m-%d}): {summary}"
    source = f"conversation:{conv.id}"
    mem = db.query(Memory).filter(Memory.source == source).first()
    if mem:
        mem.content, mem.content_hash = content, T.content_hash(content)
    else:
        mem = Memory(kind="conversation", content=content, source=source, importance=2,
                     content_hash=T.content_hash(content))
        db.add(mem)
    db.commit()
    log(db, "memory", f"대화 기록 갱신: {conv.title}", data={"conversation_id": conv.id})
    return mem


def forget_conversation(db: Session, conversation_id: int, include_extracted: bool) -> int:
    """Delete memories that came from a conversation (its summary always; extracted facts optionally)."""
    q = db.query(Memory).filter(Memory.source == f"conversation:{conversation_id}")
    n = q.delete(synchronize_session=False)
    if include_extracted:
        n += db.query(Memory).filter(Memory.source.like(f"chat:{conversation_id}/%")).delete(synchronize_session=False)
    return n


def touch_counts(db: Session) -> dict:
    return {"memories": db.query(Memory).count(), "knowledge": db.query(Knowledge).count()}
