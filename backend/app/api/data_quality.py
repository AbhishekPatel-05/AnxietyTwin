"""
data_quality.py - Feature 4: Digital Twin Confidence & Data Quality Center API Router
Endpoints:
- GET /api/data-quality/summary: Get full coverage, provenance breakdown, baseline reliability, rules, and warnings
- GET /api/data-quality/patient/{patient_id}: Clinician view of authorized patient data quality
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.db_models import User
from backend.app.models.schemas import DataQualityCenterOut
from backend.app.api.deps import get_current_user, get_current_clinician
from backend.app.services.data_quality_service import compute_data_quality_summary
from backend.app.services.clinical_service import verify_patient_access

router = APIRouter(prefix="/data-quality", tags=["Data Quality Center"])


@router.get("/summary", response_model=DataQualityCenterOut)
def get_user_data_quality_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns data quality, observation coverage, provenance distribution,
    baseline reliability, and transparency rules for authenticated user.
    """
    return compute_data_quality_summary(current_user.id, db)


@router.get("/patient/{patient_id}", response_model=DataQualityCenterOut)
def get_patient_data_quality_for_clinician(
    patient_id: int,
    current_clinician: User = Depends(get_current_clinician),
    db: Session = Depends(get_db),
):
    """
    Returns data quality report for an authorized patient (clinician role only).
    Enforces active consent grant.
    """
    verify_patient_access(patient_id, current_clinician, db)
    return compute_data_quality_summary(patient_id, db)
