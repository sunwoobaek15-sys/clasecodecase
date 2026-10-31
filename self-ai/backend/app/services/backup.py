"""SQLite backup / restore / export. Backup names are validated so no path can escape the backup folder."""
from __future__ import annotations

import re
import sqlite3
from datetime import datetime
from pathlib import Path

from ..config import get_settings
from ..db import Base, get_engine, init_engine

NAME_RE = re.compile(r"^self_ai-\d{8}-\d{6}(?:-\d+)?(?:-[a-z]+)?\.db$")
REQUIRED_TABLES = {"conversations", "messages", "memories", "knowledge", "settings"}


def _db_file() -> Path:
    url = get_settings().database_url
    if not url.startswith("sqlite:///"):
        raise ValueError("백업/복구는 SQLite 데이터베이스에서만 지원됩니다.")
    return Path(url[len("sqlite:///"):])


def resolve(name: str) -> Path:
    if not NAME_RE.match(name or ""):
        raise ValueError("잘못된 백업 파일 이름입니다.")
    base = get_settings().backup_path.resolve()
    p = (base / name).resolve()
    if p.parent != base:
        raise ValueError("잘못된 백업 경로입니다.")
    return p


def create(tag: str = "") -> dict:
    src = _db_file()
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    name = f"self_ai-{stamp}{'-' + tag if tag else ''}.db"
    i = 1
    while (get_settings().backup_path / name).exists():
        name = f"self_ai-{stamp}-{i}{'-' + tag if tag else ''}.db"
        i += 1
    dest = get_settings().backup_path / name
    with sqlite3.connect(src) as s, sqlite3.connect(dest) as d:
        s.backup(d)
    return info(dest)


def info(p: Path) -> dict:
    st = p.stat()
    return {"name": p.name, "size": st.st_size, "created_at": datetime.fromtimestamp(st.st_mtime).isoformat()}


def list_all() -> list[dict]:
    return sorted((info(p) for p in get_settings().backup_path.glob("self_ai-*.db") if NAME_RE.match(p.name)),
                  key=lambda x: x["name"], reverse=True)


def validate_sqlite(p: Path) -> None:
    with open(p, "rb") as f:
        if f.read(16) != b"SQLite format 3\x00":
            raise ValueError("SQLite 백업 파일이 아닙니다.")
    with sqlite3.connect(f"file:{p}?mode=ro", uri=True) as c:
        tables = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if c.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("백업 파일이 손상되었습니다.")
    missing = REQUIRED_TABLES - tables
    if missing:
        raise ValueError(f"SELF AI 백업이 아닙니다 (없는 테이블: {', '.join(sorted(missing))}).")


def restore(p: Path) -> dict:
    validate_sqlite(p)
    safety = create("prerestore")  # current state is always kept first
    target = _db_file()
    get_engine().dispose()
    with sqlite3.connect(p) as s, sqlite3.connect(target) as d:
        s.backup(d)
    init_engine()  # re-open + create any tables newer than the backup
    return {"restored_from": p.name, "safety_backup": safety["name"]}


def save_upload(data: bytes) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    p = get_settings().backup_path / f"self_ai-{stamp}-uploaded.db"
    p.write_bytes(data)
    try:
        validate_sqlite(p)
    except Exception:
        p.unlink(missing_ok=True)
        raise
    return p


def export_json(db) -> dict:
    out = {"exported_at": datetime.now().isoformat(), "format": "self-ai-export-v1", "tables": {}}
    for table in Base.metadata.sorted_tables:
        rows = db.execute(table.select()).mappings().all()
        out["tables"][table.name] = [{k: (v.isoformat() if hasattr(v, "isoformat") else v) for k, v in r.items()} for r in rows]
    return out


def db_size() -> int | None:
    try:
        return _db_file().stat().st_size
    except (ValueError, OSError):
        return None


def delete_backup(name: str) -> None:
    resolve(name).unlink()


