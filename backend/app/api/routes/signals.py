from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from app.schemas.signal import SignalIngest, SignalResponse, BulkSignalIngest
from app.services.signal_service import ingest_signal
from app.core.security import verify_signal_api_key
from app.core.logging import logger
import asyncio

router = APIRouter(prefix="/signals", tags=["Signal Ingestion"])


@router.post("", response_model=SignalResponse, status_code=202)
async def ingest_single_signal(
    signal: SignalIngest,
    request: Request,
    api_key: str = Depends(verify_signal_api_key),
):
    """
    High-speed signal ingestion endpoint.
    Accepts up to 10,000 signals/sec with async processing.
    """
    try:
        result = await ingest_signal(signal)
        return result
    except Exception as e:
        logger.error("Signal ingestion failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Signal ingestion failed: {str(e)}")


@router.post("/bulk", status_code=202)
async def ingest_bulk_signals(
    payload: BulkSignalIngest,
    request: Request,
    api_key: str = Depends(verify_signal_api_key),
):
    """
    Bulk signal ingestion - up to 1000 signals per request.
    """
    results = []
    tasks = [ingest_signal(s) for s in payload.signals]
    responses = await asyncio.gather(*tasks, return_exceptions=True)

    for i, resp in enumerate(responses):
        if isinstance(resp, Exception):
            results.append({"index": i, "error": str(resp), "success": False})
        else:
            results.append({"index": i, "signal_id": resp.signal_id, "success": True})

    success_count = sum(1 for r in results if r.get("success"))
    return {
        "total": len(payload.signals),
        "success": success_count,
        "failed": len(payload.signals) - success_count,
        "results": results,
    }


@router.get("/types")
async def get_signal_types():
    """Get all supported signal types."""
    from app.schemas.signal import SignalType, SignalSeverity
    return {
        "signal_types": [t.value for t in SignalType],
        "severities": [s.value for s in SignalSeverity],
    }
