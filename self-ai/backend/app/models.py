"""Database tables. Every table records created_at; editable tables also updated_at."""
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def now() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class User(TimestampMixin, Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), default="owner")


class Conversation(TimestampMixin, Base):
    __tablename__ = "conversations"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), default=1)
    title: Mapped[str] = mapped_column(String(200), default="새 대화")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="Message.id"
    )


class Message(TimestampMixin, Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(20))  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # which memories / knowledge were given to the model as context
    context: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    conversation: Mapped[Conversation] = relationship(back_populates="messages")


MEMORY_KINDS = ("user_info", "preference", "project", "conversation", "knowledge", "decision")


class Memory(TimestampMixin, Base):
    __tablename__ = "memories"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), default=1)
    kind: Mapped[str] = mapped_column(String(30), index=True)
    content: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(200), default="manual")  # manual | chat:<conv>/<msg> | ...
    importance: Mapped[int] = mapped_column(Integer, default=3)  # 1..5
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    times_seen: Mapped[int] = mapped_column(Integer, default=1)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Knowledge(TimestampMixin, Base):
    __tablename__ = "knowledge"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    content: Mapped[str] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    key_points: Mapped[list | None] = mapped_column(JSON, nullable=True)
    category: Mapped[str] = mapped_column(String(100), default="general", index=True)
    source_type: Mapped[str] = mapped_column(String(30), default="text")  # text | file | research | chat
    source: Mapped[str] = mapped_column(String(500), default="")
    confidence: Mapped[float] = mapped_column(Float, default=0.5)  # 0..1 heuristic, see services/knowledge.py
    verification: Mapped[str] = mapped_column(String(30), default="unverified")  # unverified | user_verified | multi_source | disputed
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    related_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    learning_record_id: Mapped[int | None] = mapped_column(ForeignKey("learning_records.id", ondelete="SET NULL"), nullable=True)
    research_task_id: Mapped[int | None] = mapped_column(ForeignKey("research_tasks.id", ondelete="SET NULL"), nullable=True)
    times_used: Mapped[int] = mapped_column(Integer, default=0)


class LearningRecord(TimestampMixin, Base):
    __tablename__ = "learning_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    source_type: Mapped[str] = mapped_column(String(30))  # text | file
    source_name: Mapped[str] = mapped_column(String(300), default="")
    status: Mapped[str] = mapped_column(String(30), default="pending")  # pending | running | completed | failed
    method: Mapped[str | None] = mapped_column(String(30), nullable=True)  # llm | extractive
    chars: Mapped[int] = mapped_column(Integer, default=0)
    chunks_total: Mapped[int] = mapped_column(Integer, default=0)
    added: Mapped[int] = mapped_column(Integer, default=0)
    duplicates: Mapped[int] = mapped_column(Integer, default=0)
    related: Mapped[int] = mapped_column(Integer, default=0)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    key_points: Mapped[list | None] = mapped_column(JSON, nullable=True)
    comparison: Mapped[list | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), default="general")


class ResearchTask(TimestampMixin, Base):
    __tablename__ = "research_tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    topic: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(30), default="pending")
    # pending | planning | searching | analyzing | writing | completed | needs_connection | failed
    progress: Mapped[int] = mapped_column(Integer, default=0)
    stage_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    plan: Mapped[list | None] = mapped_column(JSON, nullable=True)
    plan_method: Mapped[str | None] = mapped_column(String(30), nullable=True)
    search_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    report: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_method: Mapped[str | None] = mapped_column(String(30), nullable=True)
    comparison: Mapped[list | None] = mapped_column(JSON, nullable=True)
    saved_to_knowledge: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    origin: Mapped[str] = mapped_column(String(30), default="user")  # user | autonomy
    sources: Mapped[list["ResearchSource"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", order_by="ResearchSource.id"
    )


class ResearchSource(TimestampMixin, Base):
    __tablename__ = "research_sources"
    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("research_tasks.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20), default="web")  # web | knowledge
    title: Mapped[str] = mapped_column(String(500))
    url: Mapped[str] = mapped_column(String(1000), default="")
    snippet: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    query: Mapped[str] = mapped_column(String(500), default="")
    reliability: Mapped[float] = mapped_column(Float, default=0.5)
    reliability_notes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    task: Mapped[ResearchTask] = relationship(back_populates="sources")


class EvaluationRecord(TimestampMixin, Base):
    __tablename__ = "evaluation_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("messages.id", ondelete="CASCADE"), index=True)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    logic: Mapped[float | None] = mapped_column(Float, nullable=True)
    evidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    relevance: Mapped[float | None] = mapped_column(Float, nullable=True)
    overall: Mapped[float | None] = mapped_column(Float, nullable=True)
    missing_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    uncertainty: Mapped[str | None] = mapped_column(Text, nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    grounding: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # deterministic checks
    evaluator: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[str] = mapped_column(String(30), default="completed")  # completed | failed
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class UserFeedback(TimestampMixin, Base):
    __tablename__ = "user_feedback"
    id: Mapped[int] = mapped_column(primary_key=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("messages.id", ondelete="CASCADE"), index=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1 (bad) .. 5 (good)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    corrected_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    similarity: Mapped[float | None] = mapped_column(Float, nullable=True)


class SystemLog(Base):
    __tablename__ = "system_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    level: Mapped[str] = mapped_column(String(10), default="info")
    category: Mapped[str] = mapped_column(String(30), index=True)
    message: Mapped[str] = mapped_column(Text)
    data: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class Setting(TimestampMixin, Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(JSON)


class AutonomyTask(TimestampMixin, Base):
    __tablename__ = "autonomy_tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    action: Mapped[str] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(300))
    reason: Mapped[str] = mapped_column(Text)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    risk: Mapped[str] = mapped_column(String(20), default="low")  # low | high
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(30), default="proposed")
    # proposed | approved | rejected | running | completed | failed
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    dedupe_key: Mapped[str] = mapped_column(String(200), index=True)
