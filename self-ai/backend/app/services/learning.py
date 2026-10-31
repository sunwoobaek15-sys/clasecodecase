"""Learning pipeline: analyse material -> extract key points -> dedupe -> compare -> store.

method = "llm"        when an AI provider produced the summary / key points
method = "extractive" when no AI was available (sentence scoring, clearly labelled)
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from ..ai.jsonutil import parse_json
from ..ai.providers import AIError
from ..ai.router import try_router
from ..models import LearningRecord
from . import knowledge as K
from . import memory as M
from . import text as T
from .logs import log

MAX_CHARS = 400_000

ANALYZE_PROMPT = """다음 자료를 분석하라. 자료에 있는 내용만 사용하고 추측하지 마라.
JSON만 출력:
{{"title": "짧은 제목", "category": "한 단어 분류", "summary": "3문장 이내 요약", "key_points": ["핵심 내용 1", "..."]}}
key_points는 최대 7개.

자료:
{text}"""

COMPARE_PROMPT = """기존 지식과 새 자료를 비교하라.
relation: "same"(같은 내용), "adds"(새 정보 추가), "conflict"(서로 모순), "unrelated" 중 하나.
JSON만 출력: {{"relation": "...", "note": "한 문장 설명"}}

[기존 지식]
{old}

[새 자료]
{new}"""


def _llm_analyze(router, text: str) -> dict | None:
    res = router.chat([{"role": "user", "content": ANALYZE_PROMPT.format(text=text[:6000])}],
                      json_mode=True, temperature=0)
    data = parse_json(res.content)
    if not isinstance(data, dict) or not data.get("summary"):
        return None
    pts = data.get("key_points") if isinstance(data.get("key_points"), list) else []
    return {"title": str(data.get("title") or "")[:200], "category": str(data.get("category") or "")[:50],
            "summary": str(data["summary"])[:2000], "key_points": [str(p)[:500] for p in pts[:7]],
            "model": f"{res.provider}:{res.model}"}


def _llm_compare(router, old: str, new: str) -> dict | None:
    res = router.chat([{"role": "user", "content": COMPARE_PROMPT.format(old=old[:1500], new=new[:1500])}],
                      json_mode=True, temperature=0)
    data = parse_json(res.content)
    if isinstance(data, dict) and data.get("relation") in ("same", "adds", "conflict", "unrelated"):
        return {"relation": data["relation"], "note": str(data.get("note", ""))[:500]}
    return None


def run(db: Session, record_id: int, text: str) -> LearningRecord:
    rec = db.get(LearningRecord, record_id)
    rec.status = "running"
    db.commit()
    try:
        text = (text or "").strip()[:MAX_CHARS]
        if len(text) < 20:
            raise ValueError("자료가 너무 짧습니다 (최소 20자).")
        rec.chars = len(text)
        router = try_router(db)
        analysis = None
        if router:
            try:
                analysis = _llm_analyze(router, text)
            except AIError as e:
                log(db, "learning", f"AI 분석 실패, 발췌 방식으로 진행: {e}", "warn")
        if analysis:
            rec.method = "llm"
            rec.summary = analysis["summary"]
            rec.key_points = analysis["key_points"] or T.extractive_points(text, 5)
            if analysis["category"] and rec.category == "general":
                rec.category = analysis["category"]
            if analysis["title"] and rec.title in ("", "제목 없음"):
                rec.title = analysis["title"]
        else:
            rec.method = "extractive"
            pts = T.extractive_points(text, 5)
            rec.key_points = pts
            rec.summary = " ".join(pts[:2])[:1000]

        chunks = T.chunk_text(text)
        rec.chunks_total = len(chunks)
        comparisons, added, dups, related = [], 0, 0, 0
        llm_compares = 0
        for i, chunk in enumerate(chunks):
            title = rec.title if len(chunks) == 1 else f"{rec.title} ({i + 1}/{len(chunks)})"
            k, cmp = K.add(db, title=title, content=chunk, category=rec.category, source_type=rec.source_type,
                           source=rec.source_name or "직접 입력", learning_record_id=rec.id,
                           summary=rec.summary if len(chunks) == 1 else None, commit=False)
            if k is None:
                dups += 1
                d = cmp["duplicate"]
                comparisons.append({"chunk": i + 1, "result": "duplicate", "knowledge_id": d.id,
                                    "knowledge_title": d.title})
                continue
            added += 1
            for other, sim in cmp["related"][:2]:
                related += 1
                entry = {"chunk": i + 1, "result": "related", "knowledge_id": other.id,
                         "knowledge_title": other.title, "similarity": sim, "new_id": k.id}
                if router and llm_compares < 3:
                    try:
                        c = _llm_compare(router, other.content, chunk)
                        llm_compares += 1
                        if c:
                            entry.update(c)
                            if c["relation"] == "conflict":
                                k.verification = other.verification = "disputed"
                                k.confidence = min(k.confidence, 0.4)
                                other.confidence = min(other.confidence, 0.4)
                    except AIError:
                        pass
                comparisons.append(entry)
        rec.added, rec.duplicates, rec.related = added, dups, related
        rec.comparison = comparisons
        rec.status = "completed"
        db.commit()
        if added:
            note = (rec.summary or "").strip()[:300]
            M.create(db, "knowledge", f"학습한 자료 '{rec.title}' ({rec.category}): {note}", source=f"learning:{rec.id}",
                     importance=2)
        log(db, "learning", f"학습 완료: {rec.title} (추가 {added}, 중복 {dups}, 관련 {related})",
            data={"record_id": rec.id, "method": rec.method})
    except Exception as e:  # noqa: BLE001
        db.rollback()
        rec = db.get(LearningRecord, record_id)
        rec.status = "failed"
        rec.error = str(e)[:1000] if isinstance(e, (ValueError, AIError)) else "학습 중 오류가 발생했습니다."
        db.commit()
        log(db, "learning", f"학습 실패: {rec.title}: {e}", "error")
    return rec
