"""Research Agent: plan -> search -> collect sources -> rate -> compare -> report -> (save).

Reliability scores are heuristics with written reasons, not verified truth.
Claims in reports must cite sources [S#]; with no AI the report is a labelled
extractive digest of the sources.
"""
from __future__ import annotations

from urllib.parse import urlparse

from sqlalchemy.orm import Session

from ..ai.jsonutil import parse_json
from ..ai.providers import AIError
from ..ai.router import try_router
from ..db import SessionLocal
from ..models import ResearchSource, ResearchTask
from . import knowledge as K
from . import search as S
from . import settings_store
from . import text as T
from .logs import log

MAX_QUERIES = 4
RESULTS_PER_QUERY = 4
MAX_WEB_SOURCES = 8
MAX_FETCH = 5

PLAN_PROMPT = """조사 주제: {topic}
이 주제를 조사하기 위한 계획을 세워라. 검색어는 짧고 구체적으로.
JSON만 출력: {{"questions": ["알아내야 할 질문", "..."], "queries": ["검색어", "..."]}}
questions 최대 5개, queries 최대 4개."""

COMPARE_PROMPT = """다음 출처들의 내용을 비교하라. 출처 번호 [S#]를 반드시 표시하라.
JSON만 출력: {{"agreements": ["여러 출처가 동의하는 내용 [S1][S2]"], "disagreements": ["출처 간 다른 주장 [S1] vs [S3]"], "gaps": ["출처로 확인되지 않은 부분"]}}

주제: {topic}

{sources}"""

REPORT_PROMPT = """너는 신중한 조사원이다. 주제에 대한 보고서를 한국어 Markdown으로 써라.
규칙:
- 아래 출처에 있는 내용만 사실로 쓴다. 모든 사실 문장 끝에 [S#] 출처를 단다.
- 출처로 확인되지 않은 내용은 '확인되지 않음' 절에 따로 쓴다.
- 출처끼리 주장이 다르면 '서로 다른 주장' 절에 양쪽을 쓴다.
- 구성: ## 요약 / ## 핵심 내용 / ## 서로 다른 주장 / ## 확인되지 않음 / ## 결론

주제: {topic}
조사 질문: {questions}

{sources}"""


def template_plan(topic: str) -> dict:
    return {"questions": [f"{topic}은(는) 무엇인가?", f"{topic}의 핵심 특징은?", f"{topic}에 대한 서로 다른 의견은?",
                          f"{topic}의 최근 동향은?"],
            "queries": [topic, f"{topic} 개요", f"{topic} 장단점", f"{topic} 최신"]}


def rate_source(src: ResearchSource, others: list[ResearchSource]) -> None:
    if src.kind == "knowledge":
        return  # keeps the stored knowledge confidence
    score, notes = 0.45, ["기본값 0.45"]
    host = (urlparse(src.url).hostname or "").lower()
    if host.endswith((".gov", ".go.kr", ".edu", ".ac.kr", ".mil", ".int")) or ".gov." in host:
        score += 0.25
        notes.append("+0.25 공공·교육 기관 도메인")
    elif "wikipedia.org" in host:
        score += 0.1
        notes.append("+0.10 위키백과 (2차 자료, 원문 확인 권장)")
    if src.url.startswith("https://"):
        score += 0.05
        notes.append("+0.05 HTTPS")
    body = src.content or src.snippet
    if len(body) > 1500:
        score += 0.05
        notes.append("+0.05 본문 확보")
    elif len(body) < 80:
        score -= 0.1
        notes.append("-0.10 내용이 매우 짧음")
    agree = sum(1 for o in others if o.id != src.id and T.similarity(body[:3000], (o.content or o.snippet)[:3000]) > 0.12)
    if agree:
        score += 0.1
        notes.append(f"+0.10 다른 출처 {agree}개와 내용 겹침")
    src.reliability = round(max(0.05, min(0.95, score)), 2)
    src.reliability_notes = notes


def _sources_block(sources: list[ResearchSource], per: int = 1800) -> str:
    out = []
    for i, s in enumerate(sources, 1):
        body = (s.content or s.snippet or "")[:per]
        out.append(f"[S{i}] {s.title} ({s.url or '내부 지식'}, 신뢰도 {s.reliability:.2f})\n{body}")
    return "\n\n".join(out)


def _extractive_report(topic: str, sources: list[ResearchSource]) -> str:
    lines = [f"# {topic}", "", "> AI 모델이 연결되지 않아 출처 원문에서 핵심 문장을 발췌한 요약입니다. 내용 분석·비교는 수행되지 않았습니다.", "",
             "## 출처별 핵심 내용"]
    for i, s in enumerate(sources, 1):
        lines.append(f"### [S{i}] {s.title}")
        for p in T.extractive_points(s.content or s.snippet, 3):
            lines.append(f"- {p} [S{i}]")
        lines.append("")
    return "\n".join(lines)


def _set(db: Session, task: ResearchTask, status: str, progress: int, msg: str) -> None:
    task.status, task.progress, task.stage_message = status, progress, msg
    db.commit()


def run(task_id: int, use_web: bool = True) -> None:
    """Executes a research task in its own DB session (called as a background task)."""
    db = SessionLocal()
    try:
        _run(db, task_id, use_web)
    except Exception as e:  # noqa: BLE001
        db.rollback()
        task = db.get(ResearchTask, task_id)
        if task:
            task.status, task.error = "failed", "조사 중 오류가 발생했습니다."
            db.commit()
        log(db, "research", f"조사 #{task_id} 실패: {e}", "error")
    finally:
        db.close()


def _run(db: Session, task_id: int, use_web: bool) -> None:
    task = db.get(ResearchTask, task_id)
    cfg = settings_store.get_all(db)
    prov_status = S.provider_status(cfg)
    task.search_provider = prov_status["provider"] if use_web else "local-only"

    if use_web and not prov_status["connected"]:
        _set(db, task, "needs_connection", 0,
             f"웹 검색이 연결되지 않았습니다: {prov_status['detail']} — 연결 후 다시 실행하거나 '내부 지식만으로 조사'를 선택하세요.")
        log(db, "research", f"조사 #{task.id} 연결 필요: {prov_status['detail']}", "warn")
        return

    router = try_router(db)
    sends_out = bool(router and router.sends_externally and not cfg["cloud_send_memories"])

    # 1. plan
    _set(db, task, "planning", 10, "조사 계획 작성 중")
    plan, method = None, "template"
    if router:
        try:
            res = router.chat([{"role": "user", "content": PLAN_PROMPT.format(topic=task.topic)}], json_mode=True, temperature=0.2)
            data = parse_json(res.content)
            if isinstance(data, dict) and isinstance(data.get("queries"), list) and data["queries"]:
                plan = {"questions": [str(q)[:200] for q in data.get("questions", [])][:5],
                        "queries": [str(q)[:150] for q in data["queries"]][:MAX_QUERIES]}
                method = "llm"
        except AIError:
            pass
    plan = plan or template_plan(task.topic)
    task.plan, task.plan_method = [{"questions": plan["questions"], "queries": plan["queries"]}], method
    db.commit()

    # 2. collect sources
    _set(db, task, "searching", 25, "출처 수집 중")
    sources: list[ResearchSource] = []
    if not sends_out:
        for k, _ in K.search(db, task.topic, limit=4):
            src = ResearchSource(task_id=task.id, kind="knowledge", title=f"[내부 지식] {k.title}", url="",
                                 snippet=k.content[:400], content=k.content[:4000], query=task.topic,
                                 reliability=k.confidence,
                                 reliability_notes=[f"저장된 지식의 신뢰도 {k.confidence:.2f} ({k.verification})"])
            db.add(src)
            sources.append(src)
    if use_web:
        provider = S.get_provider(prov_status["provider"])
        seen: set[str] = set()
        errors = []
        for q in plan["queries"]:
            try:
                hits = provider.search(q, RESULTS_PER_QUERY)
            except Exception as e:  # noqa: BLE001
                errors.append(f"'{q}': {type(e).__name__}")
                continue
            for h in hits:
                if not h.url or h.url in seen or len([s for s in sources if s.kind == "web"]) >= MAX_WEB_SOURCES:
                    continue
                seen.add(h.url)
                src = ResearchSource(task_id=task.id, kind="web", title=h.title[:500] or h.url, url=h.url[:1000],
                                     snippet=h.snippet[:2000], query=q,
                                     content=h.content[:20000] if h.content else None)
                db.add(src)
                sources.append(src)
        if errors and not [s for s in sources if s.kind == "web"]:
            db.commit()
            _set(db, task, "failed", 25, f"검색 제공자 오류: {'; '.join(errors)[:500]}")
            task.error = "검색에 실패했습니다."
            db.commit()
            return
        _set(db, task, "searching", 45, "출처 본문 가져오는 중")
        for src in [s for s in sources if s.kind == "web" and not s.content][:MAX_FETCH]:
            try:
                src.content = S.fetch_page(src.url)[:20000]
            except Exception as e:  # noqa: BLE001
                notes = list(src.reliability_notes or [])
                notes.append(f"본문을 가져오지 못함 ({type(e).__name__}) — 검색 요약만 사용")
                src.reliability_notes = notes
        db.commit()

    if not sources:
        task.report = f"# {task.topic}\n\n출처를 찾지 못했습니다. 다른 검색어로 다시 시도하세요."
        task.report_method = "none"
        _set(db, task, "completed", 100, "출처 없음")
        return

    db.flush()
    for s in sources:
        rate_source(s, sources)
    sources.sort(key=lambda s: s.reliability, reverse=True)
    db.commit()

    # 3. compare
    _set(db, task, "analyzing", 65, "출처 비교·분석 중")
    block = _sources_block(sources)
    if router:
        try:
            res = router.chat([{"role": "user", "content": COMPARE_PROMPT.format(topic=task.topic, sources=block)}],
                              json_mode=True, temperature=0)
            data = parse_json(res.content)
            if isinstance(data, dict):
                task.comparison = [{"type": t, "items": [str(x)[:500] for x in data.get(t, []) if x][:8]}
                                   for t in ("agreements", "disagreements", "gaps")]
        except AIError:
            pass
    db.commit()

    # 4. report
    _set(db, task, "writing", 85, "보고서 작성 중")
    report, rmethod = None, "extractive"
    if router:
        try:
            res = router.chat([{"role": "user", "content": REPORT_PROMPT.format(
                topic=task.topic, questions="; ".join(plan["questions"]), sources=block)}], temperature=0.2)
            if res.content.strip():
                report, rmethod = res.content.strip(), f"llm:{res.model}"
        except AIError:
            pass
    report = report or _extractive_report(task.topic, sources)
    ref = "\n".join(f"- [S{i}] {s.title} — {s.url or '내부 지식'} (신뢰도 {s.reliability:.2f})" for i, s in enumerate(sources, 1))
    task.report = f"{report}\n\n## 출처\n{ref}"
    task.report_method = rmethod
    _set(db, task, "completed", 100, f"완료 — 출처 {len(sources)}개")
    log(db, "research", f"조사 완료: {task.topic} (출처 {len(sources)}개, {rmethod})", data={"task_id": task.id})


def save_to_knowledge(db: Session, task: ResearchTask) -> dict:
    if task.status != "completed" or not task.report:
        raise ValueError("완료된 조사만 저장할 수 있습니다.")
    if task.saved_to_knowledge:
        raise ValueError("이미 지식으로 저장되었습니다.")
    web = [s for s in task.sources if s.kind == "web"]
    if not task.sources:
        raise ValueError("출처가 없는 조사는 지식으로 저장하지 않습니다.")
    avg = sum(s.reliability for s in task.sources) / len(task.sources)
    verification = "multi_source" if len(web) >= 2 and avg >= 0.55 else "unverified"
    disagreements = next((c["items"] for c in (task.comparison or []) if c["type"] == "disagreements"), [])
    if disagreements:
        verification = "disputed"
    k, cmp = K.add(db, title=f"[조사] {task.topic}", content=task.report, category="research", source_type="research",
                   source=", ".join(s.url for s in web[:5]) or "내부 지식", confidence=round(avg, 2),
                   verification=verification, research_task_id=task.id,
                   key_points=T.extractive_points(task.report, 5))
    if k is None:
        raise ValueError("같은 내용의 지식이 이미 있습니다.")
    task.saved_to_knowledge = True
    db.commit()
    log(db, "research", f"조사 결과를 지식으로 저장: {task.topic}", data={"knowledge_id": k.id})
    return {"knowledge_id": k.id, "verification": verification, "confidence": k.confidence,
            "related": [{"id": r.id, "title": r.title, "similarity": s} for r, s in cmp["related"]]}
