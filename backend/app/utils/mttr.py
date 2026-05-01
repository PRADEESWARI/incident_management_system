from datetime import datetime, timezone
from typing import Optional


def calculate_mttr(start: Optional[datetime], end: Optional[datetime]) -> Optional[float]:
    """Calculate MTTR in seconds."""
    if not start or not end:
        return None
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    delta = end - start
    return max(0.0, delta.total_seconds())


def format_mttr(seconds: Optional[float]) -> str:
    """Format MTTR seconds into human-readable string."""
    if seconds is None:
        return "—"
    seconds = int(seconds)
    if seconds < 60:
        return f"{seconds}s"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m"
    hours = minutes // 60
    remaining_minutes = minutes % 60
    if remaining_minutes > 0:
        return f"{hours}h {remaining_minutes}m"
    return f"{hours}h"
