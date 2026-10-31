"""Autonomy System: scans the database, proposes work, runs only what policy allows.

Policy (ACTION_POLICY) is enforced server-side in `execute()`:
* low-risk actions (read/analyse/suggest, local AI only) may run without approval
  when the user enabled `autonomy_auto_run_safe`;
* high-risk actions (deleting data, using the external network, paid services,
  sending personal data out) ALWAYS need the user's explicit approval.
Code changes/deploys and security-setting changes are not actions this system has
at all — they are listed in NEVER_AUTOMATIC for transparency.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from ..ai.providers import AIError
from ..ai.router import try_router
from ..models import AutonomyTask, EvaluationRecord, Knowledge, LearningRecord, Message, ResearchTask
from . import evaluation as E
from . import knowledge as K
from . import memory as M
from . import research as R
from . import settings_store
from .logs import log

ACTION_POLICY = {
    "evaluate_unevaluated": {"risk": "low", "approval": False, "label": "평가되지 않은 답변 평가"},
    "plan_research": {"risk": "low", "approval": False, "label": "지식 부족 주제의 조사 계획 작성 (네트워크 사용 안 함)"},
    "review_knowledge": {"risk": "low", "approval": False, "label": "오래되거나 신뢰도 낮은 지식 재검토"},
    "summarize_learning": {"risk": "low", "approval": False, "label": "최근 학습 결과 정리"},
    "suggest_improvement": {"risk": "low", "approval": False, "label": "답변 품질 개선 제안"},
    "run_web_research": {"risk": "high", "approval": True, "label": "외부 웹 검색으로 조사 실행 (외부 네트워크)"},
    "merge_duplicate_memories": {"risk": "high", "approval": True, "label": "중복 기억 병합 (데이터 삭제 포함)"},
}

NEVER_AUTOMATIC = [
    "데이터 대량 삭제", "프로그램 코드 변경 및 배포", "외부 서비스 연결", "유료 서비스 사용",
    "개인정보 외부 전송", "시스템 보안 설정 변경",
]


def _propose(db: Session, action: str, title: str, reason: str, payload: dict | None, key: str) -> AutonomyTask | None:
    exists = db.query(AutonomyTask).filter(AutonomyTask.dedupe_key == key,
                                           AutonomyTask.status.in_(("proposed", "approved", "running", "completed"))).first()
    if exists:
        return None
    pol = ACTION_POLICY[action]
    t = AutonomyTask(action=action, title=title[:300], reason=reason, payload=payload, risk=pol["risk"],
                     requires_approval=pol["approval"], dedupe_key=key[:200])
    db.add(t)
    db.flush()
    return t


def scan(db: Session) -> dict:
    cfg = settings_store.get_all(db)
    if not cfg["autonomy_enabled"]:
        return {"created": [], "auto_run": [], "disabled": True}
    created: list[AutonomyTask] = []

    # 1. answers without evaluation
    evaluated = {r.message_id for r in db.query(EvaluationRecord.message_id).all()}
    pending = [m.id for m in db.query(Message).filter(Message.role == "assistant").all() if m.id not in evaluated]
    if pending:
        t = _propose(db, "evaluate_unevaluated", f"평가되지 않은 답변 {len(pending)}개 평가",
                     "자기 평가 기록이 없는 답변이 있습니다.", {"message_ids": pending[:20]},
                     f"eval:{pending[-1]}")
        created += [t] if t else []

    # 2. knowledge gaps: user questions answered with no memory/knowledge context, or low self-evaluation
    gaps = []
    for am in db.query(Message).filter(Message.role == "assistant").order_by(Message.id.desc()).limit(50):
        g = (am.context or {}).get("grounding") or {}
        if g.get("no_context"):
            q = (db.query(Message).filter(Message.conversation_id == am.conversation_id, Message.id < am.id,
                                          Message.role == "user").order_by(Message.id.desc()).first())
            if q and len(q.content) >= 6 and not q.content.strip().endswith(("안녕", "고마워", "ㅎㅎ")):
                gaps.append((q.content, "관련 기억·지식 없이 답변함"))
    for ev in db.query(EvaluationRecord).filter(EvaluationRecord.overall.isnot(None),
                                                EvaluationRecord.overall < 3).limit(20):
        gaps.append((ev.question, f"자기 평가 점수 낮음 ({ev.overall})"))
    for question, why in gaps[:5]:
        topic = question.strip().replace("\n", " ")[:120]
        t = _propose(db, "plan_research", f"조사 계획: {topic}", f"지식 부족 영역 발견 — {why}",
                     {"topic": topic}, f"plan:{topic.lower()}")
        created += [t] if t else []

    # 3. knowledge review
    old = datetime.now(timezone.utc) - timedelta(days=30)
    weak = [k.id for k in db.query(Knowledge).all()
            if k.verification in ("unverified", "disputed") and (k.confidence < 0.5 or _aware(k.updated_at) < old)]
    if weak:
        t = _propose(db, "review_knowledge", f"지식 {len(weak)}개 재검토",
                     "신뢰도가 낮거나 30일 이상 검토되지 않은 미검증 지식입니다.", {"knowledge_ids": weak[:30]},
                     f"review:{','.join(map(str, weak[:30]))}")
        created += [t] if t else []

    # 4. duplicate memories (deletes rows -> approval)
    groups = M.duplicate_groups(db)
    if groups:
        ids = sorted(m.id for g in groups for m in g)
        t = _propose(db, "merge_duplicate_memories", f"중복 기억 {len(groups)}묶음 병합",
                     "내용이 거의 같은 기억이 여러 개 있습니다. 병합하면 일부 행이 삭제됩니다.", {"memory_ids": ids},
                     f"merge:{','.join(map(str, ids))}")
        created += [t] if t else []

    # 5. learning summary
    week = datetime.now(timezone.utc) - timedelta(days=7)
    recent = [r for r in db.query(LearningRecord).filter(LearningRecord.status == "completed").all()
              if _aware(r.created_at) >= week]
    if recent:
        t = _propose(db, "summarize_learning", f"최근 7일 학습 {len(recent)}건 정리", "최근 학습 결과를 한눈에 정리합니다.",
                     {"record_ids": [r.id for r in recent]}, f"sumlearn:{recent[-1].id}")
        created += [t] if t else []

    # 6. improvement suggestion from weakest evaluation dimension
    evs = db.query(EvaluationRecord).filter(EvaluationRecord.status == "completed").all()
    if len(evs) >= 3:
        t = _propose(db, "suggest_improvement", "답변 품질 개선 제안", f"평가 기록 {len(evs)}개를 분석합니다.",
                     None, f"improve:{len(evs) // 5}")
        created += [t] if t else []

    db.commit()
    auto = []
    if cfg["autonomy_auto_run_safe"]:
        for t in created:
            if not t.requires_approval:
                execute(db, t)
                auto.append(t.id)
    log(db, "autonomy", f"자율 스캔: 제안 {len(created)}개, 자동 실행 {len(auto)}개")
    return {"created": [t.id for t in created], "auto_run": auto, "disabled": False}


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


class ApprovalRequired(PermissionError):
    pass


def execute(db: Session, t: AutonomyTask) -> AutonomyTask:
    pol = ACTION_POLICY.get(t.action)
    if pol is None:
        raise ValueError("허용되지 않은 작업")
    if t.status in ("completed", "running", "rejected"):
        raise ValueError(f"이미 {t.status} 상태인 작업입니다.")
    if pol["approval"] and t.status != "approved":
        raise ApprovalRequired("이 작업은 사용자 승인이 필요합니다.")
    t.status = "running"
    db.commit()
    try:
        t.result = _do(db, t)
        t.status = "completed"
    except AIError as e:
        t.status, t.result = "failed", {"error": str(e)}
    except Exception as e:  # noqa: BLE001
        db.rollback()
        t.status, t.result = "failed", {"error": str(e)[:500] if isinstance(e, ValueError) else "실행 중 오류"}
    db.commit()
    log(db, "autonomy", f"자율 작업 #{t.id} {t.action}: {t.status}", "info" if t.status == "completed" else "warn")
    return t


def _do(db: Session, t: AutonomyTask) -> dict:
    p = t.payload or {}
    if t.action == "evaluate_unevaluated":
        done = []
        for mid in p.get("message_ids", []):
            if db.get(Message, mid):
                rec = E.evaluate(db, mid)
                done.append({"message_id": mid, "status": rec.status, "overall": rec.overall})
        return {"evaluated": done}

    if t.action == "plan_research":
        task = ResearchTask(topic=p["topic"], status="pending", origin="autonomy")
        router = try_router(db)
        plan, method = R.template_plan(p["topic"]), "template"
        if router and not router.sends_externally:
            try:
                from ..ai.jsonutil import parse_json
                res = router.chat([{"role": "user", "content": R.PLAN_PROMPT.format(topic=p["topic"])}], json_mode=True, temperature=0.2)
                data = parse_json(res.content)
                if isinstance(data, dict) and data.get("queries"):
                    plan, method = {"questions": data.get("questions", [])[:5], "queries": data["queries"][:4]}, "llm"
            except AIError:
                pass
        task.plan, task.plan_method = [plan], method
        task.stage_message = "자율 시스템이 만든 조사 계획입니다. 실행하려면 Research 화면에서 시작하세요."
        db.add(task)
        db.commit()
        return {"research_task_id": task.id, "plan_method": method, "plan": plan}

    if t.action == "review_knowledge":
        out = []
        for kid in p.get("knowledge_ids", []):
            k = db.get(Knowledge, kid)
            if not k:
                continue
            cmp = K.compare(db, k.content, exclude_ids={k.id})
            rel = [{"id": r.id, "title": r.title, "similarity": s, "verification": r.verification} for r, s in cmp["related"]]
            dup = cmp["duplicate"]
            out.append({"id": k.id, "title": k.title, "confidence": k.confidence, "verification": k.verification,
                        "duplicate_of": dup.id if dup else None, "related": rel,
                        "suggestion": ("중복 지식 — 하나를 삭제하세요" if dup else
                                       "관련 지식과 비교해 검증 상태를 정하세요" if rel else
                                       "다른 자료로 확인되지 않음 — 조사로 확인을 권장")})
        return {"reviewed": out}

    if t.action == "summarize_learning":
        recs = [db.get(LearningRecord, i) for i in p.get("record_ids", [])]
        recs = [r for r in recs if r]
        return {"records": len(recs), "added": sum(r.added for r in recs), "duplicates": sum(r.duplicates for r in recs),
                "related": sum(r.related for r in recs), "titles": [r.title for r in recs][:20],
                "methods": sorted({r.method or "?" for r in recs})}

    if t.action == "suggest_improvement":
        evs = db.query(EvaluationRecord).filter(EvaluationRecord.status == "completed").all()
        avgs = {}
        for d in E.DIMENSIONS:
            vals = [getattr(e, d) for e in evs if getattr(e, d) is not None]
            avgs[d] = round(sum(vals) / len(vals), 2) if vals else None
        known = {d: v for d, v in avgs.items() if v is not None}
        weakest = min(known, key=known.get) if known else None
        tips = {
            "accuracy": "정확성이 가장 낮습니다. 자주 묻는 주제의 신뢰할 수 있는 자료를 Learning에 추가하세요.",
            "logic": "논리성이 가장 낮습니다. 더 큰 로컬 모델 사용을 고려하세요.",
            "evidence": "근거 점수가 가장 낮습니다. 관련 지식을 학습시키거나 조사 결과를 지식으로 저장하세요.",
            "relevance": "관련성이 가장 낮습니다. 질문을 구체적으로 하거나 기억 검색 개수를 조정하세요.",
        }
        no_ctx = sum(1 for e in evs if (e.grounding or {}).get("no_context"))
        return {"averages": avgs, "weakest": weakest, "suggestion": tips.get(weakest, "데이터가 부족합니다."),
                "answers_without_context": no_ctx, "evaluations": len(evs)}

    if t.action == "merge_duplicate_memories":
        return M.merge_duplicates(db)

    if t.action == "run_web_research":
        task = ResearchTask(topic=p["topic"], origin="autonomy")
        db.add(task)
        db.commit()
        R.run(task.id, use_web=True)
        db.refresh(task)
        return {"research_task_id": task.id, "status": task.status}

    raise ValueError("알 수 없는 작업")
