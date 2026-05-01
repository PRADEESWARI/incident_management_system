import redis.asyncio as aioredis
from app.core.config import settings
from app.core.logging import logger
from typing import Optional
import json

_redis: Optional[aioredis.Redis] = None


async def init_redis():
    global _redis
    _redis = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        max_connections=50,
        socket_connect_timeout=5,
        socket_timeout=5,
        retry_on_timeout=True,
    )
    await _redis.ping()
    logger.info("Redis connected")


def get_redis() -> aioredis.Redis:
    if _redis is None:
        raise RuntimeError("Redis not initialized")
    return _redis


async def check_redis_health() -> bool:
    try:
        if _redis is None:
            return False
        await _redis.ping()
        return True
    except Exception as e:
        logger.error("Redis health check failed", error=str(e))
        return False


async def close_redis():
    global _redis
    if _redis:
        await _redis.close()


# Cache helpers
async def cache_set(key: str, value: dict, ttl: int = 30):
    try:
        r = get_redis()
        await r.setex(key, ttl, json.dumps(value, default=str))
    except Exception as e:
        logger.warning("Redis cache set failed", key=key, error=str(e))


async def cache_get(key: str) -> Optional[dict]:
    try:
        r = get_redis()
        data = await r.get(key)
        return json.loads(data) if data else None
    except Exception as e:
        logger.warning("Redis cache get failed", key=key, error=str(e))
        return None


async def cache_delete(key: str):
    try:
        r = get_redis()
        await r.delete(key)
    except Exception:
        pass


async def cache_delete_pattern(pattern: str):
    try:
        r = get_redis()
        keys = await r.keys(pattern)
        if keys:
            await r.delete(*keys)
    except Exception:
        pass


async def increment_counter(key: str, ttl: int = 60) -> int:
    try:
        r = get_redis()
        val = await r.incr(key)
        await r.expire(key, ttl)
        return val
    except Exception:
        return 0


async def publish_event(channel: str, data: dict):
    try:
        r = get_redis()
        await r.publish(channel, json.dumps(data, default=str))
    except Exception as e:
        logger.warning("Redis publish failed", channel=channel, error=str(e))
