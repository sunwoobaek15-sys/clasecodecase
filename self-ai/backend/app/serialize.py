"""Plain-dict serialisers for API responses."""
from datetime import datetime


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def memory(m):
    return {"id": m.id, "kind": m.kind, "content": m.content, "source": m.source, "importance": m.importance,
            "times_seen": m.times_seen, "created_at": iso(m.created_at), "updated_at": iso(m.updated_at),
            "last_used_at": iso(m.last_used_at)}


def knowledge(k, full: bool = True):
    d = {"id": k.id, "title": k.title, "category": k.category, "source_type": k.source_type, "source": k.source,
         "confidence": k.confidence, "verification": k.verification, "summary": k.summary,
         "key_points": k.key_points or [], "related_ids": k.related_ids or [], "times_used": k.times_used,
         "learning_record_id": k.learning_record_id, "research_task_id": k.research_task_id,
         "created_at": iso(k.created_at), "updated_at": iso(k.updated_at)}
    d["content"] = k.content if full else k.content[:300]
    return d


def learning(r):
    return {c: (iso(getattr(r, c)) if c.endswith("_at") else getattr(r, c)) for c in (
        "id", "title", "source_type", "source_name", "status", "method", "chars", "chunks_total", "added",
        "duplicates", "related", "summary", "key_points", "comparison", "error", "category", "created_at", "updated_at")}


def source(s):
    return {"id": s.id, "kind": s.kind, "title": s.title, "url": s.url, "snippet": s.snippet, "query": s.query,
            "reliability": s.reliability, "reliability_notes": s.reliability_notes or [],
            "has_content": bool(s.content), "created_at": iso(s.created_at)}


def research(t, with_sources: bool = True):
    d = {c: (iso(getattr(t, c)) if c.endswith("_at") else getattr(t, c)) for c in (
        "id", "topic", "status", "progress", "stage_message", "plan", "plan_method", "search_provider", "report",
        "report_method", "comparison", "saved_to_knowledge", "error", "origin", "created_at", "updated_at")}
    d["source_count"] = len(t.sources)
    if with_sources:
        d["sources"] = [source(s) for s in t.sources]
    else:
        d.pop("report")
    return d


def evaluation(e):
    return {c: (iso(getattr(e, c)) if c.endswith("_at") else getattr(e, c)) for c in (
        "id", "message_id", "question", "answer", "accuracy", "logic", "evidence", "relevance", "overall",
        "missing_info", "uncertainty", "comments", "grounding", "evaluator", "status", "error", "created_at")}


def feedback(f):
    return {"id": f.id, "message_id": f.message_id, "rating": f.rating, "comment": f.comment,
            "corrected_answer": f.corrected_answer, "similarity": f.similarity, "created_at": iso(f.created_at)}


def message(m):
    return {"id": m.id, "role": m.role, "content": m.content, "provider": m.provider, "model": m.model,
            "latency_ms": m.latency_ms, "context": m.context, "created_at": iso(m.created_at)}


def autonomy(t):
    return {"id": t.id, "action": t.action, "title": t.title, "reason": t.reason, "payload": t.payload,
            "risk": t.risk, "requires_approval": t.requires_approval, "status": t.status, "result": t.result,
            "created_at": iso(t.created_at), "updated_at": iso(t.updated_at)}


def log(entry):
    return {"id": entry.id, "level": entry.level, "category": entry.category, "message": entry.message,
            "data": entry.data, "created_at": iso(entry.created_at)}
