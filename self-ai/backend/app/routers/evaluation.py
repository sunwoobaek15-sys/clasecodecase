from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import serialize as S
from ..db import get_db
from ..models import EvaluationRecord, UserFeedback
from ..services.evaluation import DIMENSIONS

router = APIRouter(prefix="/api/evaluations", tags=["evaluation"])


@router.get("")
def list_evals(db: Session = Depends(get_db)):
    evs = db.query(EvaluationRecord).order_by(EvaluationRecord.id.desc()).limit(300).all()
    fbs = defaultdict(list)
    for f in db.query(UserFeedback).filter(UserFeedback.message_id.in_([e.message_id for e in evs])):
        fbs[f.message_id].append(S.feedback(f))
    return [{**S.evaluation(e), "feedback": fbs.get(e.message_id, [])} for e in evs]


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    evs = db.query(EvaluationRecord).filter(EvaluationRecord.status == "completed").order_by(EvaluationRecord.id).all()
    failed = db.query(EvaluationRecord).filter(EvaluationRecord.status == "failed").count()
    avg = {}
    for d in (*DIMENSIONS, "overall"):
        vals = [getattr(e, d) for e in evs if getattr(e, d) is not None]
        avg[d] = round(sum(vals) / len(vals), 2) if vals else None
    by_day = defaultdict(list)
    for e in evs:
        if e.overall is not None:
            by_day[e.created_at.date().isoformat()].append(e.overall)
    trend = [{"date": d, "overall": round(sum(v) / len(v), 2), "count": len(v)} for d, v in sorted(by_day.items())][-30:]
    # self-score vs user rating, where both exist
    fbs = {f.message_id: f for f in db.query(UserFeedback).filter(UserFeedback.rating.isnot(None))}
    pairs = [(e.overall, fbs[e.message_id].rating) for e in evs if e.message_id in fbs and e.overall is not None]
    gap = round(sum(abs(a - b) for a, b in pairs) / len(pairs), 2) if pairs else None
    corrections = db.query(UserFeedback).filter(UserFeedback.corrected_answer.isnot(None)).count()
    return {"count": len(evs), "failed": failed, "averages": avg, "trend": trend,
            "rated_pairs": len(pairs), "mean_abs_gap_self_vs_user": gap, "corrections": corrections}
