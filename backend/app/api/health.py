from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.core.database import get_db
from backend.app.services.ml_service import ml_service
from backend.app.models.schemas import HealthResponse, HealthComponentStatus

router = APIRouter(tags=["Health & Status"])


@router.get("/health", response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)):
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"error: {str(e)}"

    ml_status = "loaded" if ml_service.loaded else "unavailable"
    twin_status = "operational"

    if db_status != "connected" and not ml_service.loaded:
        overall_status = "unhealthy"
    elif db_status != "connected" or not ml_service.loaded:
        overall_status = "degraded"
    else:
        overall_status = "healthy"

    return HealthResponse(
        status=overall_status,
        version="1.0.0",
        database=db_status,
        ml_models_loaded=ml_service.loaded,
        components=HealthComponentStatus(
            database=db_status,
            ml_inference=ml_status,
            twin_engine=twin_status,
        ),
        timestamp=datetime.now(timezone.utc),
    )
