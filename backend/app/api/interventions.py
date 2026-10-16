"""
interventions.py - AnxietyTwin Early-Warning & Personalized Intervention Engine API

Provides authenticated endpoints for:
1. Baseline comparisons, early-warning signals, and personalized recommendations.
2. Logging intervention sessions with pre- and post-activity distress feedback.
3. Retrieving longitudinal intervention and feedback history.
4. Stateless scenario evaluation for simulation lab demonstrations.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
import json

from backend.app.core.database import get_db
from backend.app.models.db_models import User, InterventionSession
from backend.app.models.schemas import (
    InterventionsStatusOut,
    InterventionSessionOut,
    InterventionSessionCreate,
)
from backend.app.api.deps import get_current_user
from backend.app.services.intervention_engine import InterventionEngine

router = APIRouter(prefix="/interventions", tags=["Early-Warning & Interventions"])


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@router.get("/status", response_model=InterventionsStatusOut)
def get_interventions_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    window_hours: int = Query(72, ge=12, le=720, description="Evaluation lookback window in hours"),
):
    """
    Evaluates current user's observations against empirical personal baseline,
    detects early-warning signals, and provides ranked supportive intervention recommendations.
    """
    return InterventionEngine.evaluate_user_status(current_user, db, window_hours=window_hours)


@router.get("/history", response_model=List[InterventionSessionOut])
def get_interventions_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    period_days: int = Query(30, ge=1, le=365),
    activity_type: Optional[str] = Query(None),
    signal_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    source_type: Optional[str] = Query(None),
    hide_simulated: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Retrieves longitudinal history of completed, dismissed, or in-progress intervention sessions
    with before-and-after distress ratings and subjective helpfulness feedback.
    """
    start_dt = utc_now() - timedelta(days=period_days)

    query = db.query(InterventionSession).filter(
        InterventionSession.user_id == current_user.id,
        InterventionSession.started_at >= start_dt,
    )

    if activity_type and activity_type != "all":
        query = query.filter(InterventionSession.intervention_type == activity_type)

    if signal_type and signal_type != "all":
        query = query.filter(InterventionSession.trigger_signal == signal_type)

    if status_filter and status_filter != "all":
        query = query.filter(InterventionSession.status == status_filter)

    if source_type and source_type != "all":
        query = query.filter(InterventionSession.source_type == source_type)

    if hide_simulated:
        query = query.filter(InterventionSession.source_type != "simulated")

    sessions = query.order_by(InterventionSession.started_at.desc()).limit(limit).all()

    results: List[InterventionSessionOut] = []
    for s in sessions:
        ctx = None
        if s.context_snapshot_json:
            try:
                ctx = json.loads(s.context_snapshot_json)
            except Exception:
                ctx = None

        results.append(
            InterventionSessionOut(
                id=s.id,
                user_id=s.user_id,
                intervention_type=s.intervention_type,
                trigger_signal=s.trigger_signal,
                status=s.status,
                pre_distress_rating=s.pre_distress_rating,
                post_distress_rating=s.post_distress_rating,
                rating_delta=s.rating_delta,
                helpfulness=s.helpfulness,
                user_notes=s.user_notes,
                source_type=s.source_type,
                context_snapshot=ctx,
                started_at=s.started_at,
                completed_at=s.completed_at,
            )
        )

    return results


@router.post("/record", response_model=InterventionSessionOut, status_code=status.HTTP_201_CREATED)
def record_intervention_session(
    payload: InterventionSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Records an intervention session (completed, dismissed, or in-progress)
    along with optional pre/post distress ratings and helpfulness feedback.
    """
    delta = None
    if payload.pre_distress_rating is not None and payload.post_distress_rating is not None:
        delta = round(payload.post_distress_rating - payload.pre_distress_rating, 1)

    ctx_json = None
    if payload.context_snapshot:
        try:
            ctx_json = json.dumps(payload.context_snapshot)
        except Exception:
            ctx_json = None

    now = utc_now()
    session_record = InterventionSession(
        user_id=current_user.id,
        intervention_type=payload.intervention_type,
        trigger_signal=payload.trigger_signal,
        status=payload.status,
        pre_distress_rating=payload.pre_distress_rating,
        post_distress_rating=payload.post_distress_rating,
        rating_delta=delta,
        helpfulness=payload.helpfulness,
        user_notes=payload.user_notes,
        source_type=payload.source_type or "user_entered",
        context_snapshot_json=ctx_json,
        started_at=now,
        completed_at=now if payload.status == "completed" else None,
    )

    db.add(session_record)
    db.commit()
    db.refresh(session_record)

    return InterventionSessionOut(
        id=session_record.id,
        user_id=session_record.user_id,
        intervention_type=session_record.intervention_type,
        trigger_signal=session_record.trigger_signal,
        status=session_record.status,
        pre_distress_rating=session_record.pre_distress_rating,
        post_distress_rating=session_record.post_distress_rating,
        rating_delta=session_record.rating_delta,
        helpfulness=session_record.helpfulness,
        user_notes=session_record.user_notes,
        source_type=session_record.source_type,
        context_snapshot=payload.context_snapshot,
        started_at=session_record.started_at,
        completed_at=session_record.completed_at,
    )


@router.post("/evaluate-scenario", response_model=InterventionsStatusOut)
def evaluate_synthetic_scenario(
    payload: Dict[str, Any],
):
    """
    Stateless evaluation of a synthetic simulation scenario against a synthetic baseline.
    Does not read or write database observations (zero contamination guarantee).
    """
    sample = payload.get("sample", {})
    baseline = payload.get("baseline", {})
    return InterventionEngine.evaluate_synthetic_sample(sample=sample, baseline=baseline)
