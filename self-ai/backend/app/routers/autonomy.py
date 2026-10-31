from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import serialize as S
from ..db import get_db
from ..models import AutonomyTask
from ..services import autonomy as A

router = APIRouter(prefix="/api/autonomy", tags=["autonomy"])


@router.get("/policy")
def policy():
    return {"actions": A.ACTION_POLICY, "never_automatic": A.NEVER_AUTOMATIC}


@router.get("/tasks")
def tasks(status: str | None = None, db: Session = Depends(get_db)):
    q = db.query(AutonomyTask)
    if status:
        q = q.filter(AutonomyTask.status == status)
    return [S.autonomy(t) for t in q.order_by(AutonomyTask.id.desc()).limit(200)]


@router.post("/scan")
def scan(db: Session = Depends(get_db)):
    return A.scan(db)


def _get(db, tid) -> AutonomyTask:
    t = db.get(AutonomyTask, tid)
    if not t:
        raise HTTPException(404, "작업을 찾을 수 없습니다.")
    return t


@router.post("/tasks/{tid}/approve")
def approve(tid: int, db: Session = Depends(get_db)):
    t = _get(db, tid)
    if t.status != "proposed":
        raise HTTPException(409, "제안 상태인 작업만 승인할 수 있습니다.")
    t.status = "approved"
    db.commit()
    return S.autonomy(A.execute(db, t))


@router.post("/tasks/{tid}/run")
def run(tid: int, db: Session = Depends(get_db)):
    t = _get(db, tid)
    try:
        return S.autonomy(A.execute(db, t))
    except A.ApprovalRequired as e:
        raise HTTPException(403, str(e)) from e
    except ValueError as e:
        raise HTTPException(409, str(e)) from e


@router.post("/tasks/{tid}/reject")
def reject(tid: int, db: Session = Depends(get_db)):
    t = _get(db, tid)
    if t.status not in ("proposed", "approved"):
        raise HTTPException(409, "이미 처리된 작업입니다.")
    t.status = "rejected"
    db.commit()
    return S.autonomy(t)
