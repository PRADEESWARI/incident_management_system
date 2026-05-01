from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.db.redis_client import get_redis
from app.core.logging import logger
import asyncio
import json

router = APIRouter(tags=["WebSocket"])

# Connected clients
_clients: list[WebSocket] = []


@router.websocket("/ws/incidents")
async def websocket_incidents(websocket: WebSocket):
    await websocket.accept()
    _clients.append(websocket)
    logger.info("WebSocket client connected", total_clients=len(_clients))

    try:
        # Subscribe to Redis pub/sub
        r = get_redis()
        pubsub = r.pubsub()
        await pubsub.subscribe("ims:incidents:updates")

        async def listen():
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        await websocket.send_json(data)
                    except Exception:
                        pass

        listen_task = asyncio.create_task(listen())

        # Keep connection alive with ping
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
            except WebSocketDisconnect:
                break

        listen_task.cancel()
        await pubsub.unsubscribe("ims:incidents:updates")

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("WebSocket error", error=str(e))
    finally:
        if websocket in _clients:
            _clients.remove(websocket)
        logger.info("WebSocket client disconnected", total_clients=len(_clients))


async def broadcast_to_all(data: dict):
    """Broadcast a message to all connected WebSocket clients."""
    disconnected = []
    for client in _clients:
        try:
            await client.send_json(data)
        except Exception:
            disconnected.append(client)
    for c in disconnected:
        if c in _clients:
            _clients.remove(c)
