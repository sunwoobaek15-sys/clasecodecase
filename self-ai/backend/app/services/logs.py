from sqlalchemy.orm import Session

from ..config import redact
from ..models import SystemLog


def log(db: Session, category: str, message: str, level: str = "info", data: dict | None = None,
        commit: bool = True) -> None:
    db.add(SystemLog(category=category, message=redact(message)[:2000], level=level, data=data))
    if commit:
        db.commit()
