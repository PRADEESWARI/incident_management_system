from aiokafka import AIOKafkaProducer
from aiokafka.errors import KafkaConnectionError
from app.core.config import settings
from app.core.logging import logger
from typing import Optional
import json
import asyncio

_producer: Optional[AIOKafkaProducer] = None
_kafka_available: bool = False
_reconnect_task: Optional[asyncio.Task] = None


async def _try_connect() -> bool:
    global _producer, _kafka_available
    try:
        if _producer:
            try:
                await _producer.stop()
            except Exception:
                pass
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
            compression_type="gzip",
            max_batch_size=65536,
            linger_ms=5,
            request_timeout_ms=10000,
            retry_backoff_ms=500,
        )
        await _producer.start()
        _kafka_available = True
        logger.info("Kafka producer started")
        return True
    except Exception as e:
        _kafka_available = False
        logger.warning("Kafka not available, using fallback queue", error=str(e))
        return False


async def _reconnect_loop():
    """Background task that keeps retrying Kafka connection until successful."""
    global _kafka_available
    backoff = 5
    while not _kafka_available:
        await asyncio.sleep(backoff)
        logger.info("Retrying Kafka connection...", backoff=backoff)
        success = await _try_connect()
        if success:
            logger.info("Kafka reconnected successfully")
            break
        backoff = min(backoff * 2, 60)  # exponential backoff, max 60s


async def init_kafka_producer():
    global _reconnect_task
    success = await _try_connect()
    if not success:
        # Start background reconnect loop
        _reconnect_task = asyncio.create_task(_reconnect_loop())


async def send_signal(topic: str, data: dict, key: Optional[str] = None) -> bool:
    global _kafka_available
    if not _kafka_available or _producer is None:
        return False
    try:
        key_bytes = key.encode("utf-8") if key else None
        await _producer.send_and_wait(topic, data, key=key_bytes)
        return True
    except Exception as e:
        logger.error("Kafka send failed", topic=topic, error=str(e))
        _kafka_available = False
        # Trigger reconnect
        asyncio.create_task(_reconnect_loop())
        return False


async def close_kafka():
    global _producer, _reconnect_task
    if _reconnect_task:
        _reconnect_task.cancel()
    if _producer:
        try:
            await _producer.stop()
        except Exception:
            pass


def is_kafka_available() -> bool:
    return _kafka_available


async def check_kafka_health() -> bool:
    return _kafka_available
