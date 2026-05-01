from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import datetime


class RCACreate(BaseModel):
    incident_start_time: datetime
    incident_end_time: datetime
    root_cause_category: str = Field(..., min_length=1, max_length=200)
    root_cause_summary: str = Field(..., min_length=10, max_length=10000)
    fix_applied: str = Field(..., min_length=5, max_length=5000)
    prevention_steps: str = Field(..., min_length=5, max_length=5000)
    lessons_learned: Optional[str] = Field(None, max_length=5000)
    draft: bool = False

    @model_validator(mode="after")
    def validate_times(self):
        if self.incident_end_time <= self.incident_start_time:
            raise ValueError("incident_end_time must be after incident_start_time")
        return self


class RCAUpdate(BaseModel):
    incident_start_time: Optional[datetime] = None
    incident_end_time: Optional[datetime] = None
    root_cause_category: Optional[str] = None
    root_cause_summary: Optional[str] = None
    fix_applied: Optional[str] = None
    prevention_steps: Optional[str] = None
    lessons_learned: Optional[str] = None
    draft: Optional[bool] = None


class RCAResponse(BaseModel):
    id: str
    incident_id: str
    incident_start_time: datetime
    incident_end_time: datetime
    root_cause_category: str
    root_cause_summary: str
    fix_applied: str
    prevention_steps: str
    lessons_learned: Optional[str] = None
    owner_id: str
    owner_name: Optional[str] = None
    mttr_seconds: Optional[float] = None
    draft: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


RCA_CATEGORIES = [
    "Infrastructure Failure",
    "Software Bug",
    "Configuration Error",
    "Capacity Issue",
    "Network Issue",
    "Security Incident",
    "Third-Party Service Failure",
    "Human Error",
    "Deployment Issue",
    "Database Issue",
    "Unknown",
]
