from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings
from app.core.logging import logger
from typing import Optional

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


async def init_mongodb():
    global _client, _db
    _client = AsyncIOMotorClient(settings.MONGO_URL, serverSelectionTimeoutMS=5000)
    _db = _client[settings.MONGO_DB]
    # Create indexes
    await _db.signals.create_index([("component_id", 1), ("timestamp", -1)])
    await _db.signals.create_index([("incident_id", 1)])
    await _db.signals.create_index([("signal_type", 1), ("timestamp", -1)])
    await _db.audit_logs.create_index([("entity_id", 1), ("timestamp", -1)])
    await _db.raw_payloads.create_index([("created_at", -1)], expireAfterSeconds=604800)  # 7 days TTL
    logger.info("MongoDB initialized with indexes")


def get_mongodb() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("MongoDB not initialized")
    return _db


async def check_mongodb_health() -> bool:
    try:
        if _client is None:
            return False
        await _client.admin.command("ping")
        return True
    except Exception as e:
        logger.error("MongoDB health check failed", error=str(e))
        return False


async def close_mongodb():
    global _client
    if _client:
        _client.close()
