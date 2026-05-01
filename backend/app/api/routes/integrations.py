from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.core.security import get_current_user
from app.schemas.signal import SignalIngest, SignalType, SignalSeverity
from app.services.signal_service import ingest_signal
from app.core.logging import logger
import hmac
import hashlib

router = APIRouter(prefix="/integrations", tags=["Integrations"])


class SlackConfig(BaseModel):
    webhook_url: str
    channel: Optional[str] = "#incidents"


class GitHubWebhookPayload(BaseModel):
    action: Optional[str] = None
    workflow_run: Optional[Dict[str, Any]] = None
    repository: Optional[Dict[str, Any]] = None


@router.post("/webhook/github")
async def github_webhook(request: Request):
    """
    Receive GitHub Actions webhook events.
    Failed workflow runs create incidents automatically.
    """
    body = await request.body()
    event_type = request.headers.get("X-GitHub-Event", "")
    payload = await request.json()

    if event_type == "workflow_run":
        run = payload.get("workflow_run", {})
        if run.get("conclusion") == "failure":
            repo = payload.get("repository", {})
            signal = SignalIngest(
                signal_type=SignalType.API_500_ERROR,
                component_id=f"github-{repo.get('name', 'unknown')}",
                component_name=f"GitHub: {repo.get('full_name', 'unknown')}",
                severity=SignalSeverity.HIGH,
                message=f"GitHub Actions workflow failed: {run.get('name', 'unknown')} on {run.get('head_branch', 'unknown')}",
                source="github-webhook",
                metadata={
                    "workflow": run.get("name"),
                    "branch": run.get("head_branch"),
                    "run_url": run.get("html_url"),
                    "repo": repo.get("full_name"),
                },
            )
            result = await ingest_signal(signal)
            return {"processed": True, "incident_id": result.incident_id}

    return {"processed": False, "event": event_type}


@router.post("/webhook/generic")
async def generic_webhook(
    request: Request,
    source: str = "webhook",
):
    """Generic webhook endpoint for any monitoring tool."""
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # Try to extract signal info from common formats
    signal_type_str = payload.get("signal_type", payload.get("type", "GENERIC_ALERT"))
    severity_str = payload.get("severity", payload.get("level", "MEDIUM")).upper()
    component = payload.get("component_id", payload.get("service", payload.get("host", "unknown")))
    message = payload.get("message", payload.get("description", payload.get("text", "Alert received")))

    try:
        signal_type = SignalType(signal_type_str)
    except ValueError:
        signal_type = SignalType.GENERIC_ALERT

    try:
        severity = SignalSeverity(severity_str)
    except ValueError:
        severity = SignalSeverity.MEDIUM

    signal = SignalIngest(
        signal_type=signal_type,
        component_id=str(component).lower().replace(" ", "-"),
        component_name=str(component),
        severity=severity,
        message=str(message)[:2000],
        source=source,
        metadata=payload,
    )
    result = await ingest_signal(signal)
    return {"processed": True, "signal_id": result.signal_id, "incident_id": result.incident_id}


@router.get("/config")
async def get_integration_config(current_user: dict = Depends(get_current_user)):
    return {
        "integrations": [
            {
                "id": "github",
                "name": "GitHub Actions",
                "type": "webhook",
                "endpoint": "/api/v1/integrations/webhook/github",
                "description": "Receive GitHub Actions workflow failure events",
                "status": "active",
            },
            {
                "id": "slack",
                "name": "Slack Notifications",
                "type": "outbound",
                "description": "Send incident notifications to Slack channels",
                "status": "configurable",
            },
            {
                "id": "generic",
                "name": "Generic Webhook",
                "type": "webhook",
                "endpoint": "/api/v1/integrations/webhook/generic",
                "description": "Accept signals from any monitoring tool",
                "status": "active",
            },
        ]
    }
