import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import settings
from backend.app.core.database import engine, Base
import backend.app.models.db_models  # Ensure models are registered
from backend.app.api import (
    auth,
    observations,
    checkins,
    twin,
    simulation,
    prediction,
    health,
    clinician,
    interventions,
    patterns,
    goals,
    journal,
    data_quality,
    reports,
    privacy,
    assistant,
)

from sqlalchemy import text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("anxietytwin")


def _run_schema_migrations():
    try:
        Base.metadata.create_all(bind=engine)
        with engine.begin() as conn:
            if engine.dialect.name == "postgresql":
                conn.execute(text("ALTER TABLE anxiety_checkins ADD COLUMN IF NOT EXISTS context_tags_json TEXT;"))
                conn.execute(text("ALTER TABLE simulation_scenarios ADD COLUMN IF NOT EXISTS seed INTEGER DEFAULT 42;"))
                conn.execute(text("ALTER TABLE simulation_scenarios ADD COLUMN IF NOT EXISTS scenario_type VARCHAR(50) DEFAULT 'custom';"))
                conn.execute(text("ALTER TABLE simulation_scenarios ADD COLUMN IF NOT EXISTS version VARCHAR(20) DEFAULT '1.0';"))
                conn.execute(text("ALTER TABLE simulation_scenarios ADD COLUMN IF NOT EXISTS tags_json TEXT;"))
            elif engine.dialect.name == "sqlite":
                for col_stmt in [
                    "ALTER TABLE anxiety_checkins ADD COLUMN context_tags_json TEXT",
                    "ALTER TABLE simulation_scenarios ADD COLUMN seed INTEGER DEFAULT 42",
                    "ALTER TABLE simulation_scenarios ADD COLUMN scenario_type VARCHAR(50) DEFAULT 'custom'",
                    "ALTER TABLE simulation_scenarios ADD COLUMN version VARCHAR(20) DEFAULT '1.0'",
                    "ALTER TABLE simulation_scenarios ADD COLUMN tags_json TEXT",
                ]:
                    try:
                        conn.execute(text(col_stmt))
                    except Exception:
                        pass
    except Exception as e:
        logger.warning(f"Schema verification notice: {e}")


# Ensure schema and tables exist immediately on import (including for TestClient)
_run_schema_migrations()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing AnxietyTwin Database Schema...")
    _run_schema_migrations()
    yield
    logger.info("Shutting down AnxietyTwin backend.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="AnxietyTwin: A Research-Oriented Healthcare Digital Twin for Personalized Anxiety Support & Impending Panic Modeling",
    lifespan=lifespan,
    debug=settings.DEBUG,
)

# CORS Configuration
cors_origins = (
    settings.BACKEND_CORS_ORIGINS
    if settings.ENVIRONMENT == "production"
    else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(observations.router, prefix=settings.API_V1_STR)
app.include_router(checkins.router, prefix=settings.API_V1_STR)
app.include_router(twin.router, prefix=settings.API_V1_STR)
app.include_router(simulation.router, prefix=settings.API_V1_STR)
app.include_router(prediction.router, prefix=settings.API_V1_STR)
app.include_router(health.router, prefix=settings.API_V1_STR)
app.include_router(clinician.router, prefix=settings.API_V1_STR)
app.include_router(interventions.router, prefix=settings.API_V1_STR)
app.include_router(patterns.router, prefix=settings.API_V1_STR)
app.include_router(goals.router, prefix=settings.API_V1_STR)
app.include_router(journal.router, prefix=settings.API_V1_STR)
app.include_router(data_quality.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(privacy.router, prefix=settings.API_V1_STR)
app.include_router(assistant.router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "service": "AnxietyTwin Backend API",
        "version": settings.PROJECT_VERSION,
        "docs_url": "/docs",
        "health_url": f"{settings.API_V1_STR}/health",
    }
