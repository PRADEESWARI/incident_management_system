from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from enum import Enum


class SignalType(str, Enum):
    # API signals
    API_500_ERROR = "API_500_ERROR"
    API_TIMEOUT = "API_TIMEOUT"
    API_SLOW_RESPONSE = "API_SLOW_RESPONSE"
    API_AUTH_FAILURE = "API_AUTH_FAILURE"
    API_LATENCY_SPIKE = "API_LATENCY_SPIKE"
    # Server signals
    SERVER_CPU_HIGH = "SERVER_CPU_HIGH"
    SERVER_RAM_FULL = "SERVER_RAM_FULL"
    SERVER_DISK_FULL = "SERVER_DISK_FULL"
    SERVER_PROCESS_CRASH = "SERVER_PROCESS_CRASH"
    # Cache signals
    CACHE_NODE_DOWN = "CACHE_NODE_DOWN"
    CACHE_REPLICATION_FAIL = "CACHE_REPLICATION_FAIL"
    CACHE_MEMORY_FULL = "CACHE_MEMORY_FULL"
    # Queue signals
    QUEUE_LAG_HIGH = "QUEUE_LAG_HIGH"
    QUEUE_CONSUMER_DEAD = "QUEUE_CONSUMER_DEAD"
    QUEUE_RETRY_FLOOD = "QUEUE_RETRY_FLOOD"
    # RDBMS signals
    DB_SLOW_QUERY = "DB_SLOW_QUERY"
    DB_TOO_MANY_CONNECTIONS = "DB_TOO_MANY_CONNECTIONS"
    DB_DEADLOCK = "DB_DEADLOCK"
    DB_DOWN = "DB_DOWN"
    # NoSQL signals
    NOSQL_READ_TIMEOUT = "NOSQL_READ_TIMEOUT"
    NOSQL_WRITE_TIMEOUT = "NOSQL_WRITE_TIMEOUT"
    NOSQL_NODE_FAILURE = "NOSQL_NODE_FAILURE"
    # Security signals
    SECURITY_UNAUTHORIZED_SPIKE = "SECURITY_UNAUTHORIZED_SPIKE"
    SECURITY_BRUTE_FORCE = "SECURITY_BRUTE_FORCE"
    SECURITY_TOKEN_ABUSE = "SECURITY_TOKEN_ABUSE"
    SECURITY_SSL_EXPIRY = "SECURITY_SSL_EXPIRY"
    # Generic
    GENERIC_ALERT = "GENERIC_ALERT"
    HEALTH_CHECK_FAIL = "HEALTH_CHECK_FAIL"


class SignalSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class SignalIngest(BaseModel):
    signal_type: SignalType
    component_id: str = Field(..., min_length=1, max_length=200)
    component_name: str = Field(..., min_length=1, max_length=200)
    severity: SignalSeverity
    message: str = Field(..., min_length=1, max_length=2000)
    source: Optional[str] = Field(None, max_length=200)
    timestamp: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    tags: Optional[List[str]] = Field(default_factory=list)
    host: Optional[str] = None
    region: Optional[str] = None
    environment: Optional[str] = "production"

    @field_validator("timestamp", mode="before")
    @classmethod
    def normalize_timestamp(cls, v):
        if v is None:
            return datetime.now(timezone.utc)
        if isinstance(v, str):
            try:
                dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except ValueError:
                raise ValueError("Invalid timestamp format")
        if isinstance(v, datetime):
            if v.tzinfo is None:
                return v.replace(tzinfo=timezone.utc)
            return v
        return v

    @field_validator("component_id")
    @classmethod
    def sanitize_component_id(cls, v):
        return v.strip().lower().replace(" ", "_")


class SignalResponse(BaseModel):
    signal_id: str
    incident_id: Optional[str] = None
    incident_created: bool = False
    incident_updated: bool = False
    debounced: bool = False
    message: str
    queued: bool = False


class BulkSignalIngest(BaseModel):
    signals: List[SignalIngest] = Field(..., min_length=1, max_length=1000)
