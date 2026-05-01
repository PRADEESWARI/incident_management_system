from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey,
    Enum as SAEnum, JSON, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.postgres import Base
import enum
import uuid


def gen_uuid():
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    ENGINEER = "engineer"
    VIEWER = "viewer"


class IncidentStatus(str, enum.Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    INVESTIGATING = "INVESTIGATING"
    MITIGATED = "MITIGATED"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"
    REOPENED = "REOPENED"
    CANCELLED = "CANCELLED"


class IncidentSeverity(str, enum.Enum):
    P0_CRITICAL = "P0_CRITICAL"
    P1_HIGH = "P1_HIGH"
    P2_MEDIUM = "P2_MEDIUM"
    P3_LOW = "P3_LOW"
    P4_INFO = "P4_INFO"


class ComponentType(str, enum.Enum):
    API = "API"
    SERVER = "SERVER"
    CACHE = "CACHE"
    QUEUE = "QUEUE"
    RDBMS = "RDBMS"
    NOSQL = "NOSQL"
    SECURITY = "SECURITY"
    NETWORK = "NETWORK"
    UNKNOWN = "UNKNOWN"


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.ENGINEER, nullable=False)
    team = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    incidents = relationship("Incident", back_populates="assignee", foreign_keys="Incident.assignee_id")


class Incident(Base):
    __tablename__ = "incidents"
    id = Column(String, primary_key=True, default=gen_uuid)
    incident_number = Column(Integer, unique=True, autoincrement=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SAEnum(IncidentStatus), default=IncidentStatus.OPEN, nullable=False, index=True)
    severity = Column(SAEnum(IncidentSeverity), nullable=False, index=True)
    component_id = Column(String, nullable=False, index=True)
    component_type = Column(SAEnum(ComponentType), nullable=False)
    source = Column(String, nullable=True)
    assignee_id = Column(String, ForeignKey("users.id"), nullable=True)
    team = Column(String, nullable=True)
    signal_count = Column(Integer, default=1)
    error_fingerprint = Column(String, nullable=True, index=True)
    parent_incident_id = Column(String, ForeignKey("incidents.id"), nullable=True)
    first_signal_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    mttr_seconds = Column(Float, nullable=True)
    rca_completed = Column(Boolean, default=False)
    tags = Column(JSON, default=list)
    extra_data = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    assignee = relationship("User", back_populates="incidents", foreign_keys=[assignee_id])
    rca = relationship("RCA", back_populates="incident", uselist=False)
    comments = relationship("Comment", back_populates="incident", cascade="all, delete-orphan")
    status_history = relationship("IncidentStatusHistory", back_populates="incident", cascade="all, delete-orphan")
    __table_args__ = (
        Index("ix_incidents_component_status", "component_id", "status"),
        Index("ix_incidents_severity_status", "severity", "status"),
    )


class IncidentStatusHistory(Base):
    __tablename__ = "incident_status_history"
    id = Column(String, primary_key=True, default=gen_uuid)
    incident_id = Column(String, ForeignKey("incidents.id"), nullable=False, index=True)
    from_status = Column(SAEnum(IncidentStatus), nullable=True)
    to_status = Column(SAEnum(IncidentStatus), nullable=False)
    changed_by_id = Column(String, ForeignKey("users.id"), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    incident = relationship("Incident", back_populates="status_history")


class RCA(Base):
    __tablename__ = "rcas"
    id = Column(String, primary_key=True, default=gen_uuid)
    incident_id = Column(String, ForeignKey("incidents.id"), unique=True, nullable=False)
    incident_start_time = Column(DateTime(timezone=True), nullable=False)
    incident_end_time = Column(DateTime(timezone=True), nullable=False)
    root_cause_category = Column(String, nullable=False)
    root_cause_summary = Column(Text, nullable=False)
    fix_applied = Column(Text, nullable=False)
    prevention_steps = Column(Text, nullable=False)
    lessons_learned = Column(Text, nullable=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    mttr_seconds = Column(Float, nullable=True)
    draft = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    incident = relationship("Incident", back_populates="rca")


class Comment(Base):
    __tablename__ = "comments"
    id = Column(String, primary_key=True, default=gen_uuid)
    incident_id = Column(String, ForeignKey("incidents.id"), nullable=False, index=True)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    incident = relationship("Incident", back_populates="comments")


class Integration(Base):
    __tablename__ = "integrations"
    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    integration_type = Column(String, nullable=False)
    config = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
