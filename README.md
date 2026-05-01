# 🚨 Incident Management System (IMS)

> Enterprise-grade, production-ready Incident Management Platform for monitoring distributed systems at scale.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9-3178C6?logo=typescript)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docker.com)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NGINX (Port 80)                             │
│                    Reverse Proxy + Rate Limiting                    │
└──────────────────────┬──────────────────────┬───────────────────────┘
                       │                      │
              ┌────────▼────────┐    ┌────────▼────────┐
              │  React Frontend │    │  FastAPI Backend │
              │  (Port 3000)    │    │  (Port 8000)     │
              │  TypeScript     │    │  Async Python    │
              │  Tailwind CSS   │    │  4 Workers       │
              └─────────────────┘    └────────┬─────────┘
                                              │
              ┌───────────────────────────────┼───────────────────────┐
              │                               │                       │
    ┌─────────▼──────┐  ┌────────────┐  ┌────▼──────┐  ┌───────────┐│
    │  PostgreSQL 16  │  │ MongoDB 7  │  │  Redis 7  │  │  Kafka    ││
    │  (Port 5432)    │  │ (Port 27017│  │ (Port 6379│  │ (Port 9092││
    │  Incidents      │  │ Signals    │  │ Cache     │  │ Ingestion ││
    │  RCA, Users     │  │ Audit Logs │  │ Pub/Sub   │  │ Queue     ││
    └─────────────────┘  └────────────┘  └───────────┘  └───────────┘│
              │                                                        │
    ┌─────────▼──────┐  ┌────────────────────────────────────────────┐│
    │  Prometheus     │  │  Grafana (Port 3001)                       ││
    │  (Port 9090)    │  │  Dashboards & Alerting                     ││
    └─────────────────┘  └────────────────────────────────────────────┘│
```

## 🚀 Quick Start (One Command)

```bash
# Clone and start everything
git clone <repo>
cd ims
docker-compose up --build -d

# Wait ~2 minutes for all services to start
# Then open: http://localhost
```

### Demo Credentials

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123!` | Admin (full access) |
| `alice` | `engineer123!` | Engineer (backend team) |
| `bob` | `engineer123!` | Engineer (DBA team) |
| `carol` | `engineer123!` | Engineer (infra team) |
| `dave` | `engineer123!` | Engineer (security team) |
| `viewer` | `viewer123!` | Viewer (read-only) |

---

## 📋 Features

### Signal Ingestion
- **10,000 signals/sec** throughput via async FastAPI
- JSON schema validation with field-level error messages
- API key authentication (`X-API-Key` header)
- Kafka-first with in-memory fallback queue
- Retry logic with exponential backoff
- Dead-letter queue for failed messages

### Debounce & Correlation
- **Smart deduplication**: 100 signals → 1 incident
- Configurable time window (default: 10 seconds)
- Error fingerprinting by component + signal type
- Parent-child incident correlation
- Auto-reopen recently closed incidents
- Noise reduction metrics

### Workflow Engine
- 8 lifecycle states: OPEN → ACKNOWLEDGED → INVESTIGATING → MITIGATED → RESOLVED → CLOSED
- Invalid transition prevention (e.g., OPEN → CLOSED blocked)
- Auto-escalation: P2 → P1 after 15min, P1 → P0 after 10min
- Ownership routing by component type
- Mandatory RCA before closure

### RCA (Root Cause Analysis)
- Mandatory before incident closure
- Auto-calculated MTTR
- Categories, summaries, fix applied, prevention steps
- Draft/submit workflow
- MTTR trends by day/severity/team

### Dashboard
- Live updates via WebSocket + Redis pub/sub
- Severity distribution charts
- Incidents per hour timeline
- Team performance metrics
- Top noisy components
- Service health map

### Chaos Simulator
- 13 pre-built failure scenarios
- Cascading outage simulation
- Duplicate alert storm (debounce testing)
- Configurable load test (signals/sec × duration)
- One-click random multi-service failure

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + TypeScript | UI |
| Styling | Tailwind CSS | Design system |
| State | Zustand + React Query | Client state |
| Charts | Recharts | Data visualization |
| Backend | FastAPI (Python 3.11) | API server |
| ORM | SQLAlchemy 2.0 async | DB access |
| Primary DB | PostgreSQL 16 | Incidents, RCA, users |
| Signal Store | MongoDB 7 | Raw signals, audit logs |
| Cache/PubSub | Redis 7 | Dashboard cache, live updates |
| Message Queue | Apache Kafka | Signal ingestion pipeline |
| Proxy | NGINX | Reverse proxy, rate limiting |
| Containers | Docker Compose | One-command deployment |
| Monitoring | Prometheus + Grafana | Observability |

---

## 📡 API Reference

### Signal Ingestion
```bash
POST /api/v1/signals
X-API-Key: signal-ingestion-api-key-2024

{
  "signal_type": "API_500_ERROR",
  "component_id": "payment-api",
  "component_name": "Payment API",
  "severity": "HIGH",
  "message": "HTTP 500 error rate exceeded 5%",
  "source": "datadog",
  "metadata": {"error_rate": 0.05}
}
```

### Authentication
```bash
POST /api/v1/auth/login
{"username": "admin", "password": "admin123!"}
# Returns: {"access_token": "...", "user": {...}}
```

### Incidents
```bash
GET  /api/v1/incidents?page=1&page_size=20&severity=P0_CRITICAL
GET  /api/v1/incidents/{id}
POST /api/v1/incidents/{id}/transition  {"to_status": "ACKNOWLEDGED"}
GET  /api/v1/incidents/{id}/signals
POST /api/v1/incidents/{id}/comments
```

### Analytics
```bash
GET /api/v1/analytics/dashboard
GET /api/v1/analytics/mttr-trends?days=7
GET /api/v1/analytics/service-health
```

### Health
```bash
GET /health    # Full health check
GET /ready     # Readiness probe
GET /metrics   # Live metrics
```

Full API docs: http://localhost:8000/api/docs

---

## 🔧 How Backpressure Works

```
Signal → NGINX (rate limit: 1000/s per IP)
       → FastAPI (async, non-blocking)
       → Kafka (buffer: millions of messages)
       → Worker consumers (parallel processing)
       → PostgreSQL + MongoDB (write)
       → Redis (cache invalidation + pub/sub)
```

If Kafka is unavailable → in-memory asyncio.Queue (100k capacity)
If PostgreSQL is slow → signals queued, retried with exponential backoff
If Redis is down → cache bypassed, direct DB queries

---

## 🔄 How Debounce Works

```
Signal arrives for component "payment-api" with type "API_500_ERROR"
  ↓
Compute fingerprint: MD5("payment-api:API_500_ERROR")
  ↓
Redis INCR debounce:{fingerprint} with 10s TTL
  ↓
Count > 5? → Find existing OPEN incident → increment signal_count
Count ≤ 5? → Create new incident OR update existing
  ↓
Result: 100 signals → 1 incident (99% noise reduction)
```

---

## 🧪 Testing

```bash
# Unit tests
cd backend && python -m pytest tests/unit/ -v

# Integration tests  
python -m pytest tests/integration/ -v

# Load test with Locust
pip install locust
locust -f tests/load/locustfile.py --host=http://localhost:8000

# Load test with k6
k6 run tests/load/k6_load_test.js

# Seed signals
python scripts/seed_signals.py --url http://localhost:8000 --count 500
```

---

## 📊 Monitoring

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin123)
- **API Docs**: http://localhost:8000/api/docs
- **Health**: http://localhost/health

---

## 🔒 Security

- JWT authentication (HS256, 24h expiry)
- Role-based access control (Admin, Engineer, Viewer)
- API key for signal ingestion
- NGINX rate limiting (100 req/s API, 1000 req/s signals)
- Secure headers (X-Frame-Options, X-Content-Type-Options)
- Password hashing with bcrypt
- Input sanitization and validation
- Secrets via environment variables

---

## 📈 Scalability

- **Horizontal scaling**: Add more backend workers via `--workers N`
- **Kafka partitions**: 4 partitions for parallel consumption
- **Redis clustering**: Supports Redis Cluster for HA
- **PostgreSQL**: Connection pooling (20 + 40 overflow)
- **NGINX**: Upstream load balancing with least_conn
- **Async I/O**: All DB operations are non-blocking

---

## 🗂️ Project Structure

```
ims/
├── backend/
│   ├── app/
│   │   ├── api/routes/      # FastAPI route handlers
│   │   ├── core/            # Config, security, logging
│   │   ├── db/              # Database clients
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── services/        # Business logic
│   │   ├── workers/         # Background workers
│   │   └── utils/           # Utilities
│   ├── scripts/             # Seed data
│   ├── tests/               # Unit + integration + load tests
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/             # API client functions
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom hooks
│   │   ├── pages/           # Page components
│   │   ├── store/           # Zustand stores
│   │   ├── types/           # TypeScript types
│   │   └── utils/           # Formatters
│   └── Dockerfile
├── nginx/                   # NGINX config
├── monitoring/              # Prometheus + Grafana
├── scripts/                 # Utility scripts
├── docs/                    # Documentation
└── docker-compose.yml
```

---

## 🎯 Demo Walkthrough

1. **Open** http://localhost → Login as `admin/admin123!`
2. **Dashboard** → See live incident counts, charts, team metrics
3. **Incidents** → Browse, filter, search incidents
4. **Click an incident** → View signals, timeline, add comments
5. **Transition** → Acknowledge → Investigate → Resolve
6. **RCA** → Submit root cause analysis before closing
7. **Simulator** → Trigger chaos scenarios, load tests
8. **Analytics** → MTTR trends, service health map
9. **Settings** → System health, live metrics

---

## 🔮 Future Enhancements

- PagerDuty / OpsGenie integration
- AI-powered root cause suggestions
- Runbook automation
- Multi-tenant support
- Mobile app (React Native)
- Incident cost tracking
- SLA breach alerts
- Postmortem templates
