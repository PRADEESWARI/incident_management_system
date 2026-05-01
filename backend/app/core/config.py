from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    APP_NAME: str = "IncidentManagementSystem"
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "super-secret-jwt-key-change-in-production-min-32-chars"
    API_KEY_HEADER: str = "X-API-Key"
    SIGNAL_API_KEY: str = "signal-ingestion-api-key-2024"

    # PostgreSQL
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "ims_db"
    POSTGRES_USER: str = "ims_user"
    POSTGRES_PASSWORD: str = "ims_password"
    DATABASE_URL: str = "postgresql+asyncpg://ims_user:ims_password@postgres:5432/ims_db"

    # MongoDB
    MONGO_HOST: str = "mongodb"
    MONGO_PORT: int = 27017
    MONGO_DB: str = "ims_signals"
    MONGO_USER: str = "ims_user"
    MONGO_PASSWORD: str = "ims_password"
    MONGO_URL: str = "mongodb://ims_user:ims_password@mongodb:27017/ims_signals?authSource=admin"

    # Redis
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = "ims_redis_password"
    REDIS_URL: str = "redis://:ims_redis_password@redis:6379/0"

    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = "kafka:9092"
    KAFKA_SIGNAL_TOPIC: str = "ims.signals"
    KAFKA_INCIDENT_TOPIC: str = "ims.incidents"
    KAFKA_ALERT_TOPIC: str = "ims.alerts"
    KAFKA_DLQ_TOPIC: str = "ims.dlq"

    # JWT
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    # Rate Limiting
    RATE_LIMIT_SIGNALS: str = "10000/minute"
    RATE_LIMIT_API: str = "1000/minute"

    # Debounce
    DEBOUNCE_WINDOW_SECONDS: int = 10
    DEBOUNCE_THRESHOLD: int = 5

    # Escalation
    ESCALATION_P2_TO_P1_MINUTES: int = 15
    ESCALATION_P1_TO_P0_MINUTES: int = 10

    # Slack
    SLACK_WEBHOOK_URL: Optional[str] = None
    SLACK_BOT_TOKEN: Optional[str] = None

    # HuggingFace AI
    HF_TOKEN: Optional[str] = None

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:80"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
