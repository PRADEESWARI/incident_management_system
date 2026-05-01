"""Seed demo data for IMS."""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
import random
from sqlalchemy import select, func
from app.db.postgres import AsyncSessionLocal
from app.models.postgres_models import (
    User, UserRole, Incident, IncidentStatus, IncidentSeverity,
    ComponentType, IncidentStatusHistory, RCA, Comment
)
from app.core.security import hash_password
from app.core.logging import logger

DEMO_USERS = [
    {"email": "admin@ims.local", "username": "admin", "full_name": "Admin User", "password": "Admin1234", "role": UserRole.ADMIN, "team": "platform-team"},
    {"email": "alice@ims.local", "username": "alice", "full_name": "Alice Chen", "password": "Engineer1234", "role": UserRole.ENGINEER, "team": "backend-team"},
    {"email": "bob@ims.local", "username": "bob", "full_name": "Bob Martinez", "password": "Engineer1234", "role": UserRole.ENGINEER, "team": "dba-team"},
    {"email": "carol@ims.local", "username": "carol", "full_name": "Carol Singh", "password": "Engineer1234", "role": UserRole.ENGINEER, "team": "infrastructure-team"},
    {"email": "dave@ims.local", "username": "dave", "full_name": "Dave Kim", "password": "Engineer1234", "role": UserRole.ENGINEER, "team": "security-team"},
    {"email": "viewer@ims.local", "username": "viewer", "full_name": "View Only", "password": "Viewer1234", "role": UserRole.VIEWER, "team": None},
]

SAMPLE_INCIDENTS = [
    {
        "title": "Payment API returning 500 errors",
        "description": "Payment service is returning HTTP 500 errors for 15% of requests. Checkout flow is impacted.",
        "severity": IncidentSeverity.P0_CRITICAL,
        "status": IncidentStatus.INVESTIGATING,
        "component_id": "payment-api",
        "component_type": ComponentType.API,
        "source": "datadog",
        "team": "backend-team",
        "signal_count": 847,
        "tags": ["payment", "critical", "revenue-impact"],
    },
    {
        "title": "Primary PostgreSQL replica lag > 30s",
        "description": "Read replica is lagging behind primary by 35 seconds. Read queries are returning stale data.",
        "severity": IncidentSeverity.P1_HIGH,
        "status": IncidentStatus.ACKNOWLEDGED,
        "component_id": "postgres-replica-1",
        "component_type": ComponentType.RDBMS,
        "source": "prometheus",
        "team": "dba-team",
        "signal_count": 234,
        "tags": ["database", "replication"],
    },
    {
        "title": "Redis cluster node 3 unreachable",
        "description": "Redis cluster node 3 has been unreachable for 8 minutes. Cache hit rate dropped to 45%.",
        "severity": IncidentSeverity.P1_HIGH,
        "status": IncidentStatus.MITIGATED,
        "component_id": "redis-cluster-node-3",
        "component_type": ComponentType.CACHE,
        "source": "alertmanager",
        "team": "platform-team",
        "signal_count": 156,
        "tags": ["cache", "redis"],
    },
    {
        "title": "Order processing queue consumer lag",
        "description": "Kafka consumer group order-processors is 50,000 messages behind. Order processing delayed.",
        "severity": IncidentSeverity.P2_MEDIUM,
        "status": IncidentStatus.OPEN,
        "component_id": "order-processing-queue",
        "component_type": ComponentType.QUEUE,
        "source": "kafka-monitor",
        "team": "platform-team",
        "signal_count": 89,
        "tags": ["kafka", "orders"],
    },
    {
        "title": "app-server-07 CPU at 98%",
        "description": "Application server 07 CPU usage has been at 98% for 12 minutes. Response times degraded.",
        "severity": IncidentSeverity.P2_MEDIUM,
        "status": IncidentStatus.OPEN,
        "component_id": "app-server-07",
        "component_type": ComponentType.SERVER,
        "source": "node-exporter",
        "team": "infrastructure-team",
        "signal_count": 45,
        "tags": ["server", "cpu"],
    },
    {
        "title": "Brute force attack on auth service",
        "description": "10,000+ failed login attempts detected from 3 IP ranges in the last 5 minutes.",
        "severity": IncidentSeverity.P0_CRITICAL,
        "status": IncidentStatus.INVESTIGATING,
        "component_id": "auth-service",
        "component_type": ComponentType.SECURITY,
        "source": "waf",
        "team": "security-team",
        "signal_count": 10234,
        "tags": ["security", "brute-force", "auth"],
    },
    {
        "title": "MongoDB shard 2 write timeout",
        "description": "Write operations to MongoDB shard 2 timing out after 5000ms. User profile updates failing.",
        "severity": IncidentSeverity.P1_HIGH,
        "status": IncidentStatus.RESOLVED,
        "component_id": "mongodb-shard-2",
        "component_type": ComponentType.NOSQL,
        "source": "mongodb-monitor",
        "team": "dba-team",
        "signal_count": 312,
        "tags": ["mongodb", "write-timeout"],
        "mttr_seconds": 1847.0,
        "rca_completed": True,
    },
    {
        "title": "SSL certificate expiring in 5 days",
        "description": "SSL certificate for api.company.com expires in 5 days. Auto-renewal failed.",
        "severity": IncidentSeverity.P2_MEDIUM,
        "status": IncidentStatus.OPEN,
        "component_id": "api-gateway",
        "component_type": ComponentType.SECURITY,
        "source": "cert-monitor",
        "team": "infrastructure-team",
        "signal_count": 3,
        "tags": ["ssl", "certificate"],
    },
    {
        "title": "Checkout API P99 latency spike",
        "description": "P99 latency for checkout API spiked to 8500ms. Normal baseline is 200ms.",
        "severity": IncidentSeverity.P1_HIGH,
        "status": IncidentStatus.CLOSED,
        "component_id": "checkout-api",
        "component_type": ComponentType.API,
        "source": "apm",
        "team": "backend-team",
        "signal_count": 567,
        "tags": ["latency", "checkout"],
        "mttr_seconds": 3600.0,
        "rca_completed": True,
    },
    {
        "title": "log-server-01 disk at 99%",
        "description": "Log server disk usage at 99%. Log rotation failed. New logs being dropped.",
        "severity": IncidentSeverity.P2_MEDIUM,
        "status": IncidentStatus.ACKNOWLEDGED,
        "component_id": "log-server-01",
        "component_type": ComponentType.SERVER,
        "source": "node-exporter",
        "team": "infrastructure-team",
        "signal_count": 12,
        "tags": ["disk", "logs"],
    },
]


async def seed_demo_data():
    async with AsyncSessionLocal() as session:
        # Check if already seeded
        result = await session.execute(select(func.count(User.id)))
        user_count = result.scalar()
        if user_count and user_count > 0:
            logger.info("Demo data already seeded, skipping")
            return

        logger.info("Seeding demo data...")

        # Create users
        users = {}
        for u_data in DEMO_USERS:
            user = User(
                id=str(uuid.uuid4()),
                email=u_data["email"],
                username=u_data["username"],
                full_name=u_data["full_name"],
                hashed_password=hash_password(u_data["password"]),
                role=u_data["role"],
                team=u_data["team"],
                is_active=True,
            )
            session.add(user)
            users[u_data["username"]] = user

        await session.flush()

        # Create incidents
        now = datetime.now(timezone.utc)
        team_user_map = {
            "backend-team": users["alice"],
            "dba-team": users["bob"],
            "infrastructure-team": users["carol"],
            "security-team": users["dave"],
            "platform-team": users["alice"],
        }

        for i, inc_data in enumerate(SAMPLE_INCIDENTS):
            created_at = now - timedelta(hours=random.randint(1, 72))
            assignee = team_user_map.get(inc_data["team"])

            incident = Incident(
                id=str(uuid.uuid4()),
                title=inc_data["title"],
                description=inc_data["description"],
                status=inc_data["status"],
                severity=inc_data["severity"],
                component_id=inc_data["component_id"],
                component_type=inc_data["component_type"],
                source=inc_data.get("source"),
                assignee_id=assignee.id if assignee else None,
                team=inc_data["team"],
                signal_count=inc_data.get("signal_count", 1),
                first_signal_at=created_at,
                tags=inc_data.get("tags", []),
                extra_data={},
                rca_completed=inc_data.get("rca_completed", False),
                mttr_seconds=inc_data.get("mttr_seconds"),
                created_at=created_at,
            )

            if inc_data["status"] in [IncidentStatus.RESOLVED, IncidentStatus.CLOSED]:
                incident.resolved_at = created_at + timedelta(seconds=inc_data.get("mttr_seconds", 3600))
            if inc_data["status"] == IncidentStatus.CLOSED:
                incident.closed_at = incident.resolved_at + timedelta(hours=1)
            if inc_data["status"] in [IncidentStatus.ACKNOWLEDGED, IncidentStatus.INVESTIGATING,
                                        IncidentStatus.MITIGATED, IncidentStatus.RESOLVED, IncidentStatus.CLOSED]:
                incident.acknowledged_at = created_at + timedelta(minutes=random.randint(2, 15))

            session.add(incident)
            await session.flush()

            # Status history
            history = IncidentStatusHistory(
                incident_id=incident.id,
                from_status=None,
                to_status=IncidentStatus.OPEN,
                changed_by_id=users["admin"].id,
                note="Incident created from signal ingestion",
                created_at=created_at,
            )
            session.add(history)

            if inc_data["status"] != IncidentStatus.OPEN:
                history2 = IncidentStatusHistory(
                    incident_id=incident.id,
                    from_status=IncidentStatus.OPEN,
                    to_status=inc_data["status"],
                    changed_by_id=assignee.id if assignee else users["admin"].id,
                    note="Status updated",
                    created_at=created_at + timedelta(minutes=10),
                )
                session.add(history2)

            # Add RCA for resolved/closed incidents
            if inc_data.get("rca_completed"):
                rca = RCA(
                    id=str(uuid.uuid4()),
                    incident_id=incident.id,
                    incident_start_time=created_at,
                    incident_end_time=created_at + timedelta(seconds=inc_data.get("mttr_seconds", 3600)),
                    root_cause_category="Software Bug",
                    root_cause_summary=f"Root cause analysis for: {inc_data['title']}. Investigation revealed a configuration drift caused by a recent deployment.",
                    fix_applied="Rolled back the deployment and applied hotfix. Increased connection pool size.",
                    prevention_steps="Added automated regression tests. Implemented canary deployments. Added circuit breaker.",
                    lessons_learned="Need better pre-deployment validation. Monitoring thresholds were too high.",
                    owner_id=assignee.id if assignee else users["admin"].id,
                    mttr_seconds=inc_data.get("mttr_seconds"),
                    draft=False,
                )
                session.add(rca)

            # Add sample comment
            comment = Comment(
                id=str(uuid.uuid4()),
                incident_id=incident.id,
                author_id=assignee.id if assignee else users["admin"].id,
                content=f"Investigating the issue. Initial analysis points to {inc_data['component_id']}. Will update in 15 minutes.",
                is_internal=False,
                created_at=created_at + timedelta(minutes=5),
            )
            session.add(comment)

        await session.commit()
        logger.info("Demo data seeded successfully", users=len(DEMO_USERS), incidents=len(SAMPLE_INCIDENTS))


if __name__ == "__main__":
    asyncio.run(seed_demo_data())
