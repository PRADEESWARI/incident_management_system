from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncio
import time

from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.db.postgres import init_db
from app.db.mongodb import init_mongodb, close_mongodb
from app.db.redis_client import init_redis, close_redis
from app.db.kafka_client import init_kafka_producer, close_kafka
from app.api.routes import signals, incidents, rca, analytics, auth, simulator, health, integrations, websocket, ai
from app.workers.escalation_worker import run_escalation_worker

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting IMS Backend", env=settings.APP_ENV)

    # Initialize databases
    await init_db()
    await init_mongodb()
    await init_redis()
    await init_kafka_producer()

    # Seed demo data
    try:
        from scripts.seed import seed_demo_data
        await seed_demo_data()
    except Exception as e:
        logger.warning("Seed data skipped", error=str(e))

    # Start background workers
    escalation_task = asyncio.create_task(run_escalation_worker())

    logger.info("IMS Backend started successfully")
    yield

    # Shutdown
    escalation_task.cancel()
    await close_kafka()
    await close_redis()
    await close_mongodb()
    logger.info("IMS Backend shutdown complete")


app = FastAPI(
    title="Incident Management System API",
    description="Enterprise-grade IMS for monitoring distributed systems",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    response.headers["X-Process-Time"] = str(round(time.time() - start, 4))
    response.headers["X-IMS-Version"] = "1.0.0"
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception", path=request.url.path, error=str(exc))
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# Include routers
PREFIX = "/api/v1"
app.include_router(health.router)
app.include_router(auth.router, prefix=PREFIX)
app.include_router(signals.router, prefix=PREFIX)
app.include_router(incidents.router, prefix=PREFIX)
app.include_router(rca.router, prefix=PREFIX)
app.include_router(analytics.router, prefix=PREFIX)
app.include_router(simulator.router, prefix=PREFIX)
app.include_router(integrations.router, prefix=PREFIX)
app.include_router(ai.router, prefix=PREFIX)
app.include_router(websocket.router)


@app.get("/")
async def root():
    return {
        "name": "Incident Management System",
        "version": "1.0.0",
        "docs": "/api/docs",
        "health": "/health",
    }
