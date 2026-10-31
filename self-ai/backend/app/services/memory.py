"""Long-term memory: store, search, edit, delete, dedupe, extract from chat."""
from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..ai.jsonutil import parse_json
from ..models import MEMORY_KINDS, Memory
from . import text as T

NEAR_DUPLICATE = 0.8

KIND_LABELS = {
    "user_info": "사용자 정보", "preference": "사용자 선호", "project": "프로젝트 정보",
    "conversation": "대화 기록", "knowledge": "학습한 지식", "decision": "중요한 결정",
}


def find_duplicate(db: Session, kind: str, content: str, exclude_id: int | None = None) -> Memory | None:
    h = T.content_hash(content)
    q = db.query(Memory).filter(Memory.content_hash == h)
    if exclude_id:
        q = q.filter(Memory.id != exclude_id)
    exact = q.first()
    if exact:
        return exact
    cands = db.query(Memory).filter(Memory.kind == kind).all()
    for m, _ in T.rank(content, [c for c in cands if c.id != exclude_id], lambda m: m.content, limit=5):
        if T.similarity(m.content, content) >= NEAR_DUPLICATE:
            return m
    return None


def create(db: Session, kind: str, content: str, source: str = "manual", importance: int = 3,
           commit: bool = True) -> tuple[Memory, bool]:
    """Returns (memory, created). If a duplicate exists it is reinforced instead of duplicated."""
    if kind not in MEMORY_KINDS:
        raise ValueError("잘못된 기억 종류")
    content = content.strip()
    dup = find_duplicate(db, kind, content)
    if dup:
        dup.times_seen += 1
        dup.importance = max(dup.importance, importance)
        dup.updated_at = datetime.now(timezone.utc)
        if commit:
            db.commit()
        return dup, False
    m = Memory(kind=kind, content=content, source=source[:200], importance=importance,
               content_hash=T.content_hash(content))
    db.add(m)
    if commit:
        db.commit()
        db.refresh(m)
    return m, True


def update(db: Session, m: Memory, content: str | None, kind: str | None, importance: int | None) -> Memory:
    if kind is not None:
        if kind not in MEMORY_KINDS:
            raise ValueError("잘못된 기억 종류")
        m.kind = kind
    if content is not None:
        m.content = content.strip()
        m.content_hash = T.content_hash(m.content)
    if importance is not None:
        m.importance = importance
    db.commit()
    db.refresh(m)
    return m


def search(db: Session, query: str, kind: str | None = None, limit: int = 5) -> list[tuple[Memory, float]]:
    q = db.query(Memory)
    if kind:
        q = q.filter(Memory.kind == kind)
    items = q.all()
    # small boost for important memories; BM25 decides relevance
    ranked = T.rank(query, items, lambda m: m.content, limit=limit * 2)
    ranked = [(m, s * (1 + 0.1 * (m.importance - 3))) for m, s in ranked]
    ranked.sort(key=lambda x: x[1], reverse=True)
    return ranked[:limit]


def duplicate_groups(db: Session) -> list[list[Memory]]:
    items = db.query(Memory).order_by(Memory.id).all()
    used: set[int] = set()
    groups = []
    for i, a in enumerate(items):
        if a.id in used:
            continue
        g = [a]
        for b in items[i + 1:]:
            if b.id in used or b.kind != a.kind:
                continue
            if a.content_hash == b.content_hash or T.similarity(a.content, b.content) >= NEAR_DUPLICATE:
                g.append(b)
                used.add(b.id)
        if len(g) > 1:
            used.add(a.id)
            groups.append(g)
    return groups


def merge_duplicates(db: Session) -> dict:
    """Keep the oldest memory of each duplicate group (longest content wins), delete the rest."""
    groups = duplicate_groups(db)
    removed = 0
    for g in groups:
        keep = g[0]
        longest = max(g, key=lambda m: len(m.content))
        if longest is not keep:
            keep.content = longest.content
            keep.content_hash = longest.content_hash
        keep.times_seen = sum(m.times_seen for m in g)
        keep.importance = max(m.importance for m in g)
        for m in g[1:]:
            db.delete(m)
            removed += 1
    db.commit()
    return {"groups": len(groups), "removed": removed}


# ---------- extraction from chat ----------

_RULES: list[tuple[re.Pattern, str, int]] = [
    (re.compile(r"(?:이거|이것|다음|이 내용)?\s*기억해(?:줘|주세요|둬|두세요)?[:,]?\s*(.+)", re.S), "auto", 4),
    (re.compile(r"(.+?)(?:을|를)?\s*기억해(?:줘|주세요|둬|두세요)", re.S), "auto", 4),
    (re.compile(r"remember(?: that)?[:,]?\s+(.+)", re.I | re.S), "auto", 4),
    (re.compile(r"(?:내|제|나의|저의)\s*이름은\s*(.+)"), "user_info", 5),
    (re.compile(r"my name is\s+(.+)", re.I), "user_info", 5),
    (re.compile(r"(?:나는|저는|난|전)\s*(.+?)(?:에서)?\s*(?:살아|살고 있|거주)"), "user_info", 4),
    (re.compile(r"(?:나는|저는|난|전)\s*(.+?)(?:이야|야|입니다|이에요|예요|로 일해|으로 일해)\s*[.!]?$"), "user_info", 3),
    (re.compile(r"(.+?)(?:을|를|이|가)?\s*(?:좋아해|좋아합니다|좋아한다|선호해|선호합니다|싫어해|싫어합니다)"), "preference", 3),
    (re.compile(r"i (?:like|love|prefer|hate|dislike)\s+(.+)", re.I), "preference", 3),
    (re.compile(r"(.+?)(?:하기로|로 하기로|으로 하기로)\s*(?:했어|했습니다|결정)"), "decision", 4),
    (re.compile(r"(?:we|i) decided (?:to\s+)?(.+)", re.I), "decision", 4),
    (re.compile(r"(.*프로젝트.*(?:만들|개발|진행|작업).*)"), "project", 3),
]


def _guess_kind(sentence: str) -> str:
    s = sentence.lower()
    if any(w in s for w in ("좋아", "싫어", "선호", "like", "prefer")):
        return "preference"
    if any(w in s for w in ("결정", "하기로", "decided")):
        return "decision"
    if any(w in s for w in ("프로젝트", "project")):
        return "project"
    if any(w in s for w in ("이름", "나이", "직업", "살아", "name", "live")):
        return "user_info"
    return "knowledge"


def extract_rules(text: str) -> list[dict]:
    out = []
    for sentence in T.split_sentences(text) or [text]:
        s = sentence.strip()
        if len(s) < 4 or s.endswith("?") or s.endswith("？"):
            continue
        for pat, kind, imp in _RULES:
            if pat.search(s):
                k = _guess_kind(s) if kind == "auto" else kind
                content = re.sub(r"\s*(?:이거|이것)?\s*기억해(?:줘|주세요|둬|두세요)?[.!]?\s*$", "", s).strip()
                content = re.sub(r"^(?:remember(?: that)?[:,]?\s+)", "", content, flags=re.I).strip()
                if len(content) >= 3:
                    out.append({"kind": k, "content": content, "importance": imp, "explicit": kind == "auto"})
                break
    return out


_PERSONAL_HINT = re.compile(
    r"(?:^|[\s,.])(?:나|난|내|내가|나는|나의|저|전|제|제가|저는|저의|우리|우리는)(?=[\s,.]|$)|기억|좋아|싫어|선호|결정|하기로|"
    r"프로젝트|이름|살아|일해|직업|취미|생일|"
    r"\b(?:i|i'm|i've|my|me|we|our|remember|prefer|decided)\b", re.I)


COVERED = 0.2


def merge_candidates(rule_items: list[dict], ai_items: list[dict] | None) -> list[dict]:
    """Rules phrase facts as the user said them ("나는 커피를 좋아해"), the AI as clean statements
    ("사용자는 커피를 좋아한다"). Keep explicit "기억해" requests always, the AI's facts, and only
    those rule facts the AI did not already cover (same kind + overlapping words)."""
    if not ai_items:
        return rule_items
    keep = [r for r in rule_items if r.get("explicit") or not any(
        a["kind"] == r["kind"] and T.similarity(a["content"], r["content"]) >= COVERED for a in ai_items)]
    return keep + ai_items


def worth_ai_extraction(text: str) -> bool:
    """Only ask the AI for memories when the message plausibly states something personal."""
    t = (text or "").strip()
    return len(t) >= 6 and bool(_PERSONAL_HINT.search(t))


EXTRACT_PROMPT = """너는 개인 AI의 기억 관리자다. 아래 '사용자 메시지'에서 앞으로의 대화에 도움이 될 사실만 뽑아라.
- 사용자가 직접 말한 사실만. 추측 금지. 일반 질문이나 잡담은 제외.
- kind는 user_info, preference, project, decision 중 하나.
- content는 3인칭 한 문장 (예: "사용자는 파이썬을 선호한다").
- 없으면 빈 배열.
JSON만 출력: {"memories": [{"kind": "...", "content": "...", "importance": 1-5}]}

사용자 메시지:
"""


def extract_llm(router, text: str) -> list[dict]:
    res = router.chat([{"role": "user", "content": EXTRACT_PROMPT + text[:3000]}], json_mode=True, temperature=0)
    data = parse_json(res.content)
    items = data.get("memories", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
    out = []
    for it in items[:5]:
        if not isinstance(it, dict):
            continue
        kind, content = it.get("kind"), str(it.get("content", "")).strip()
        if kind not in ("user_info", "preference", "project", "decision") or not (3 <= len(content) <= 500):
            continue
        try:
            imp = min(5, max(1, int(it.get("importance", 3))))
        except (TypeError, ValueError):
            imp = 3
        out.append({"kind": kind, "content": content, "importance": imp})
    return out
