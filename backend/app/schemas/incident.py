from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class IncidentStatusEnum(str, Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    INVESTIGATING = "INVESTIGATING"
    MITIGATED = "MITIGATED"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"
    REOPENED = "REOPENED"
    CANCELLED = "CANCELLED"


class IncidentSeverityEnum(str, Enum):
    P0_CRITICAL = "P0_CRITICAL"
    P1_HIGH = "P1_HIGH"
    P2_MEDIUM = "P2_MEDIUM"
    P3_LOW = "P3_LOW"
    P4_INFO = "P4_INFO"


class IncidentCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=500)
    description: Optional[str] = None
    severity: IncidentSeverityEnum
    component_id: str
    component_type: str
    source: Optional[str] = None
    assignee_id: Optional[str] = None
    team: Optional[str] = None
    tags: Optional[List[str]] = Field(default_factory=list)
    extra_data: Optional[Dict[str, Any]] = Field(default_factory=dict)


class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[IncidentSeverityEnum] = None
    assignee_id: Optional[str] = None
    team: Optional[str] = None
    tags: Optional[List[str]] = None


class StatusTransition(BaseModel):
    to_status: IncidentStatusEnum
    note: Optional[str] = None


class IncidentResponse(BaseModel):
    id: str
    incident_number: Optional[int] = None
    title: str
    description: Optional[str] = None
    status: str
    severity: str
    component_id: str
    component_type: str
    source: Optional[str] = None
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    team: Optional[str] = None
    signal_count: int = 1
    error_fingerprint: Optional[str] = None
    parent_incident_id: Optional[str] = None
    first_signal_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    mttr_seconds: Optional[float] = None
    rca_completed: bool = False
    tags: List[str] = []
    extra_data: Dict[str, Any] = {}
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class IncidentListResponse(BaseModel):
    items: List[IncidentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    is_internal: bool = False


class CommentResponse(BaseModel):
    id: str
    incident_id: str
    author_id: str
    author_name: Optional[str] = None
    content: str
    is_internal: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StatusHistoryResponse(BaseModel):
    id: str
    incident_id: str
    from_status: Optional[str] = None
    to_status: str
    changed_by_id: Optional[str] = None
    changed_by_name: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
