from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case, text
from app.models.postgres_models import Incident, IncidentStatus, IncidentSeverity
from app.db.redis_client import cache_get, cache_set, get_redis
from app.services.signal_service import get_signals_per_second
from app.core.logging import logger


async def get_dashboard_summary(db: AsyncSession) -> Dict[str, Any]:
    cache_key = "ims:dashboard:summary"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    try:
        # Total incidents
        total = (await db.execute(select(func.count(Incident.id)))).scalar() or 0

        # Active incidents
        active = (await db.execute(
            select(func.count(Incident.id)).where(
                Incident.status.in_([
                    IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED,
                    IncidentStatus.INVESTIGATING, IncidentStatus.REOPENED
                ])
            )
        )).scalar() or 0

        # Critical active
        critical = (await db.execute(
            select(func.count(Incident.id)).where(
                and_(
                    Incident.severity == IncidentSeverity.P0_CRITICAL,
                    Incident.status.in_([
                        IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED,
                        IncidentStatus.INVESTIGATING, IncidentStatus.REOPENED
                    ])
                )
            )
        )).scalar() or 0

        # Resolved/Closed
        resolved = (await db.execute(
            select(func.count(Incident.id)).where(
                Incident.status.in_([IncidentStatus.RESOLVED, IncidentStatus.CLOSED])
            )
        )).scalar() or 0

        # MTTR overall average (not just today since seed data may be old)
        mttr_result = (await db.execute(
            select(func.avg(Incident.mttr_seconds)).where(
                Incident.mttr_seconds.isnot(None)
            )
        )).scalar()

        # MTTR today specifically
        mttr_today_result = (await db.execute(
            select(func.avg(Incident.mttr_seconds)).where(
                and_(
                    Incident.mttr_seconds.isnot(None),
                    Incident.resolved_at >= today_start
                )
            )
        )).scalar()

        # Use overall MTTR if today has none
        effective_mttr = mttr_today_result or mttr_result or 0

        # Severity distribution of active incidents
        sev_rows = (await db.execute(
            select(Incident.severity, func.count(Incident.id).label("cnt"))
            .where(Incident.status.in_([
                IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED,
                IncidentStatus.INVESTIGATING, IncidentStatus.REOPENED
            ]))
            .group_by(Incident.severity)
        )).all()
        severity_dist = {row[0].value: row[1] for row in sev_rows}

        # Status distribution (all incidents)
        status_rows = (await db.execute(
            select(Incident.status, func.count(Incident.id).label("cnt"))
            .group_by(Incident.status)
        )).all()
        status_dist = {row[0].value: row[1] for row in status_rows}

        # Top noisy components
        noisy_rows = (await db.execute(
            select(
                Incident.component_id,
                func.sum(Incident.signal_count).label("total_signals")
            )
            .group_by(Incident.component_id)
            .order_by(func.sum(Incident.signal_count).desc())
            .limit(10)
        )).all()
        top_noisy = [{"component": r[0], "signal_count": int(r[1] or 0)} for r in noisy_rows]

        # Incidents per hour — last 7 days to always show data
        hour_trunc = func.date_trunc('hour', Incident.created_at)
        hours_rows = (await db.execute(
            select(
                hour_trunc.label("hour"),
                func.count(Incident.id).label("cnt")
            )
            .where(Incident.created_at >= now - timedelta(days=7))
            .group_by(hour_trunc)
            .order_by(hour_trunc)
        )).all()
        incidents_per_hour = [
            {"hour": r[0].isoformat() if r[0] else None, "count": r[1]}
            for r in hours_rows
        ]

        # Team performance
        team_rows = (await db.execute(
            select(
                Incident.team,
                func.count(Incident.id).label("total"),
                func.avg(Incident.mttr_seconds).label("avg_mttr")
            )
            .where(Incident.team.isnot(None))
            .group_by(Incident.team)
            .order_by(func.count(Incident.id).desc())
        )).all()
        team_perf = [
            {"team": r[0], "total": r[1], "avg_mttr": round(float(r[2] or 0), 1)}
            for r in team_rows
        ]

        # Signals per second
        signals_per_sec = await get_signals_per_second()

        # Queue backlog
        queue_backlog = 0
        try:
            r = get_redis()
            queue_backlog = int(await r.llen("ims:signal:queue") or 0)
        except Exception:
            pass

        # Total signal count across all incidents
        total_signals_result = (await db.execute(
            select(func.sum(Incident.signal_count))
        )).scalar() or 0

        summary = {
            "total_incidents": total,
            "active_incidents": active,
            "critical_incidents": critical,
            "resolved_incidents": resolved,
            "mttr_today_seconds": round(float(effective_mttr), 1),
            "mttr_today_minutes": round(float(effective_mttr) / 60, 1),
            "severity_distribution": severity_dist,
            "status_distribution": status_dist,
            "top_noisy_components": top_noisy,
            "incidents_per_hour": incidents_per_hour,
            "team_performance": team_perf,
            "signals_per_second": signals_per_sec,
            "queue_backlog": queue_backlog,
            "total_signals_processed": int(total_signals_result),
            "generated_at": now.isoformat(),
        }

        await cache_set(cache_key, summary, ttl=15)
        return summary

    except Exception as e:
        logger.error("Dashboard summary failed", error=str(e))
        raise


async def get_mttr_trends(db: AsyncSession, days: int = 7) -> List[Dict]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    day_trunc = func.date_trunc('day', Incident.resolved_at)
    result = (await db.execute(
        select(
            day_trunc.label("day"),
            func.avg(Incident.mttr_seconds).label("avg_mttr"),
            func.count(Incident.id).label("count")
        )
        .where(
            and_(
                Incident.resolved_at >= since,
                Incident.mttr_seconds.isnot(None)
            )
        )
        .group_by(day_trunc)
        .order_by(day_trunc)
    )).all()
    return [
        {
            "day": r[0].isoformat() if r[0] else None,
            "avg_mttr_seconds": round(float(r[1] or 0), 1),
            "avg_mttr_minutes": round(float(r[1] or 0) / 60, 1),
            "count": r[2]
        }
        for r in result
    ]


async def get_service_health(db: AsyncSession) -> List[Dict]:
    rows = (await db.execute(
        select(
            Incident.component_id,
            Incident.component_type,
            func.count(Incident.id).label("total"),
            func.sum(
                case(
                    (Incident.status.in_([
                        IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED,
                        IncidentStatus.INVESTIGATING, IncidentStatus.REOPENED
                    ]), 1),
                    else_=0
                )
            ).label("active"),
        )
        .group_by(Incident.component_id, Incident.component_type)
        .order_by(func.count(Incident.id).desc())
        .limit(50)
    )).all()

    services = []
    for r in rows:
        active_count = int(r[3] or 0)
        # Determine health by checking if there are active incidents
        if active_count == 0:
            health = "healthy"
        else:
            # Check severity of active incidents for this component
            sev_result = (await db.execute(
                select(Incident.severity)
                .where(
                    and_(
                        Incident.component_id == r[0],
                        Incident.status.in_([
                            IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED,
                            IncidentStatus.INVESTIGATING, IncidentStatus.REOPENED
                        ])
                    )
                )
                .order_by(Incident.severity.asc())
                .limit(1)
            )).scalar()
            if sev_result and sev_result.value in ["P0_CRITICAL", "P1_HIGH"]:
                health = "critical"
            else:
                health = "degraded"

        services.append({
            "component_id": r[0],
            "component_type": r[1].value if r[1] else "UNKNOWN",
            "total_incidents": r[2],
            "active_incidents": active_count,
            "health_status": health,
        })
    return services
