from fastapi import APIRouter
from app.db.postgres import check_postgres_health
from app.db.mongodb import check_mongodb_health
from app.db.redis_client import check_redis_health
from app.db.kafka_client import check_kafka_health, is_kafka_available
from app.core.config import settings
from app.services.signal_service import get_signals_per_second
import time

router = APIRouter(tags=["Health"])

START_TIME = time.time()


@router.get("/health")
async def health_check():
    pg    = await check_postgres_health()
    mongo = await check_mongodb_health()
    redis = await check_redis_health()
    kafka = await check_kafka_health()

    # System is healthy as long as the 3 core DBs are up.
    # Kafka is optional — fallback in-memory queue is used when unavailable.
    core_healthy = pg and mongo and redis
    status = "healthy" if core_healthy else "degraded"

    return {
        "status": status,
        "uptime_seconds": round(time.time() - START_TIME, 1),
        "services": {
            "postgresql": "up" if pg    else "down",
            "mongodb":    "up" if mongo else "down",
            "redis":      "up" if redis else "down",
            "kafka":      "up" if kafka else "unavailable (fallback queue active)",
        },
        "kafka_note": "Kafka is optional. Signals are queued in-memory when Kafka is unavailable.",
        "version": "1.0.0",
        "environment": settings.APP_ENV,
    }


@router.get("/ready")
async def readiness_check():
    pg    = await check_postgres_health()
    mongo = await check_mongodb_health()
    redis = await check_redis_health()

    if not (pg and mongo and redis):
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Service not ready")

    return {"status": "ready"}


@router.get("/metrics")
async def get_metrics():
    from app.db.redis_client import get_redis
    signals_per_sec = await get_signals_per_second()

    queue_size = 0
    try:
        r = get_redis()
        queue_size = await r.llen("ims:signal:queue") or 0
    except Exception:
        pass

    return {
        "signals_per_second": signals_per_sec,
        "queue_size": queue_size,
        "kafka_available": is_kafka_available(),
        "uptime_seconds": round(time.time() - START_TIME, 1),
    }
