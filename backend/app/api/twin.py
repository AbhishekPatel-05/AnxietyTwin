import json
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import pandas as pd

from backend.app.core.database import get_db
from backend.app.models.db_models import (
    User,
    UserProfile,
    PhysiologicalObservation,
    LifestyleObservation,
    AnxietyCheckin,
    TwinStateSnapshot,
)
from backend.app.models.schemas import (
    TwinStateSnapshotOut,
    BaselineSummaryOut,
    LongitudinalTrendOut,
    LongitudinalTrendPoint,
    SyntheticPlaybackRequest,
    LongitudinalBaselineEvolutionOut,
    DigitalTwinMemoryOut,
)
from backend.app.services.twin_engine import DigitalTwinEngine
from backend.app.services.evolution_service import (
    get_longitudinal_baseline_evolution,
    get_digital_twin_memories,
    record_digital_twin_memory,
    reset_digital_twin_memory,
)
from backend.app.api.deps import get_current_user
from backend.app.api.observations import trigger_state_update

router = APIRouter(prefix="/twin", tags=["Digital Twin State"])


@router.get("/state")
def get_current_twin_state(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    snapshot = db.query(TwinStateSnapshot).filter(
        TwinStateSnapshot.user_id == current_user.id
    ).order_by(TwinStateSnapshot.timestamp.desc()).first()

    if not snapshot:
        snapshot = trigger_state_update(current_user, db)

    details = {}
    if snapshot.state_details_json:
        try:
            details = json.loads(snapshot.state_details_json)
        except Exception:
            details = {}

    return {
        "id": snapshot.id,
        "timestamp": snapshot.timestamp.isoformat(),
        "source": snapshot.source,
        "composite_stress_index": snapshot.composite_stress_index,
        "physiological_arousal_score": snapshot.physiological_arousal_score,
        "circadian_disruption_index": snapshot.circadian_disruption_index,
        "baseline_deviation_score": snapshot.baseline_deviation_score,
        "state_label": snapshot.state_label,
        "details": details,
    }


@router.get("/baseline", response_model=BaselineSummaryOut)
def get_personal_baseline(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()

    physios = db.query(PhysiologicalObservation).filter(
        PhysiologicalObservation.user_id == current_user.id,
        PhysiologicalObservation.source_type.in_(DigitalTwinEngine.GENUINE_SOURCE_TYPES),
    ).order_by(PhysiologicalObservation.timestamp.asc()).all()
    lifestyles = db.query(LifestyleObservation).filter(
        LifestyleObservation.user_id == current_user.id,
        LifestyleObservation.source_type.in_(DigitalTwinEngine.GENUINE_SOURCE_TYPES),
    ).order_by(LifestyleObservation.date.asc()).all()
    checkins = db.query(AnxietyCheckin).filter(
        AnxietyCheckin.user_id == current_user.id,
        AnxietyCheckin.source_type.in_(DigitalTwinEngine.GENUINE_SOURCE_TYPES),
    ).order_by(AnxietyCheckin.timestamp.asc()).all()

    baseline = DigitalTwinEngine.calculate_personal_baseline(
        profile=profile,
        historical_physio=physios,
        historical_lifestyle=lifestyles,
        historical_checkins=checkins,
    )

    last_snap = db.query(TwinStateSnapshot).filter(
        TwinStateSnapshot.user_id == current_user.id
    ).order_by(TwinStateSnapshot.timestamp.desc()).first()

    return BaselineSummaryOut(
        has_sufficient_data=baseline["has_sufficient_data"],
        is_cold_start=baseline.get("is_cold_start", not baseline["has_sufficient_data"]),
        required_observations_count=baseline.get("required_observations_count", 5),
        personalized_model_min_days=baseline.get("personalized_model_min_days", 7),
        total_observations_count=baseline["total_observations_count"],
        unique_days_count=baseline.get("unique_days_count", 0),
        date_span_days=baseline.get("date_span_days", 0),
        history_progress_percent=baseline.get("history_progress_percent", 0.0),
        status_message=baseline.get("status_message", "Baseline summary"),
        reference_prior_note=baseline.get("reference_prior_note"),
        missing_indicators=baseline.get("missing_indicators", []),
        mean_resting_hr=baseline["mean_resting_hr"],
        mean_hrv_ms=baseline["mean_hrv_ms"],
        mean_sleep_hours=baseline["mean_sleep_hours"],
        mean_caffeine_cups=baseline["mean_caffeine_cups"],
        mean_anxiety_score=baseline["mean_anxiety_score"],
        std_resting_hr=baseline.get("std_resting_hr", 8.0),
        std_hrv_ms=baseline.get("std_hrv_ms", 12.0),
        std_sleep_hours=baseline.get("std_sleep_hours", 1.2),
        last_updated=last_snap.timestamp if last_snap else None,
        descriptive_baseline_ready=baseline.get("descriptive_baseline_ready", False),
        personalized_prediction_ready=baseline.get("personalized_prediction_ready", False),
        personalized_prediction_requirement=baseline.get(
            "personalized_prediction_requirement",
            "Requires at least 7 distinct days of prior historical observations strictly preceding prediction date."
        ),
    )


@router.get("/trends", response_model=LongitudinalTrendOut)
def get_longitudinal_trends(
    days: int = Query(30, ge=1, le=180),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    since_date = datetime.now(timezone.utc) - timedelta(days=days)

    snapshots = db.query(TwinStateSnapshot).filter(
        TwinStateSnapshot.user_id == current_user.id,
        TwinStateSnapshot.timestamp >= since_date,
    ).order_by(TwinStateSnapshot.timestamp.asc()).all()

    points: List[LongitudinalTrendPoint] = []
    for snap in snapshots:
        details = {}
        if snap.state_details_json:
            try:
                details = json.loads(snap.state_details_json)
            except Exception:
                pass

        points.append(
            LongitudinalTrendPoint(
                date=snap.timestamp.strftime("%Y-%m-%d"),
                timestamp=snap.timestamp.isoformat(),
                heart_rate=details.get("heart_rate_bpm"),
                hrv_ms=details.get("hrv_ms"),
                sleep_hours=details.get("sleep_hours"),
                caffeine_cups=details.get("caffeine_cups"),
                anxiety_score=details.get("anxiety_score"),
                composite_stress=snap.composite_stress_index,
                source_type=snap.source,
            )
        )

    return LongitudinalTrendOut(
        points=points,
        total_count=len(points),
    )


@router.post("/synthetic-stream")
def play_synthetic_research_stream(
    req: SyntheticPlaybackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Ingests synthetic stream data derived from authentic research study cohort (CC BY 4.0).
    Explicitly tags all ingested records with provenance: 'synthetic'.
    """
    data_path = "data/processed/merged_df.feather"
    try:
        df = pd.read_feather(data_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dataset not available: {e}")

    part_id = req.participant_id or "SYM2-1-285"
    patient_df = df[df["ID"] == part_id]
    if len(patient_df) == 0:
        patient_df = df.iloc[: req.days_to_stream]
    else:
        patient_df = patient_df.head(req.days_to_stream)

    ingested_count = 0
    now = datetime.now(timezone.utc)

    for i, (_, row) in enumerate(patient_df.iterrows()):
        day_offset = req.days_to_stream - i
        obs_date = now - timedelta(days=day_offset)
        date_str = obs_date.strftime("%Y-%m-%d")

        # 1. Physiological Observation
        hr_mean = float(row.get("HR_mean", 74.0))
        physio = PhysiologicalObservation(
            user_id=current_user.id,
            timestamp=obs_date,
            source_type="synthetic",
            heart_rate_bpm=round(hr_mean, 1),
            heart_rate_variability_ms=round(float(max(15.0, 75.0 - (hr_mean * 0.4))), 1),
            resting_heart_rate=round(hr_mean * 0.9, 1),
            steps_count=int(row.get("steps_mean", 45) * 80),
        )
        db.add(physio)

        # 2. Lifestyle Observation
        sleep_dur = float(row.get("sleep_duration", 7.0))
        caff = float(row.get("coffee", 1.0))
        lifestyle = LifestyleObservation(
            user_id=current_user.id,
            date=date_str,
            source_type="synthetic",
            sleep_hours=round(sleep_dur, 1),
            sleep_quality_score=3,
            caffeine_cups=round(caff, 1),
            alcohol_units=float(row.get("alcohol", 0.0)),
            exercise_minutes=float(row.get("exercise", 20.0)),
        )
        db.add(lifestyle)

        # 3. Anxiety Checkin
        anx_score = int(min(10, max(0, row.get("anxiety", 3.0))))
        checkin = AnxietyCheckin(
            user_id=current_user.id,
            timestamp=obs_date + timedelta(hours=12),
            source_type="synthetic",
            subjective_anxiety_score=anx_score,
            energy_level=3,
            somatic_symptoms=json.dumps(["palpitations"] if anx_score > 6 else []),
            triggers_noted=f"Research Cohort {part_id} Replay",
        )
        db.add(checkin)
        ingested_count += 1

    db.commit()

    # Recompute state
    latest_snap = trigger_state_update(current_user, db, source="synthetic_playback")

    return {
        "message": f"Successfully ingested {ingested_count} days of synthetic demonstration stream from research participant {part_id}.",
        "data_provenance": "synthetic",
        "latest_state_label": latest_snap.state_label,
        "composite_stress_index": latest_snap.composite_stress_index,
    }


@router.get("/evolution", response_model=LongitudinalBaselineEvolutionOut)
def get_baseline_evolution_endpoint(
    window_days: int = Query(7, ge=3, le=30),
    max_windows: int = Query(4, ge=2, le=12),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Computes multi-window baseline evolution strictly from genuine patient observations.
    Excludes synthetic playback and simulation artifacts.
    """
    return get_longitudinal_baseline_evolution(
        user_id=current_user.id,
        db=db,
        window_days=window_days,
        max_windows=max_windows,
    )


@router.get("/memory", response_model=List[DigitalTwinMemoryOut])
def list_digital_twin_memories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Inspects stored explainable Digital Twin Memory records for the authenticated user.
    """
    return get_digital_twin_memories(user_id=current_user.id, db=db)


@router.post("/memory/reset")
def reset_memory_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Resets derived personalization baseline memory without modifying genuine patient observations.
    """
    return reset_digital_twin_memory(user_id=current_user.id, db=db)


@router.post("/memory/snapshot", response_model=DigitalTwinMemoryOut)
def snapshot_memory_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Saves an explainable baseline version snapshot to Digital Twin Memory.
    """
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    physios = db.query(PhysiologicalObservation).filter(
        PhysiologicalObservation.user_id == current_user.id,
        PhysiologicalObservation.source_type.in_(DigitalTwinEngine.GENUINE_SOURCE_TYPES),
    ).all()
    lifestyles = db.query(LifestyleObservation).filter(
        LifestyleObservation.user_id == current_user.id,
        LifestyleObservation.source_type.in_(DigitalTwinEngine.GENUINE_SOURCE_TYPES),
    ).all()
    checkins = db.query(AnxietyCheckin).filter(
        AnxietyCheckin.user_id == current_user.id,
        AnxietyCheckin.source_type.in_(DigitalTwinEngine.GENUINE_SOURCE_TYPES),
    ).all()

    baseline = DigitalTwinEngine.calculate_personal_baseline(
        profile=profile,
        historical_physio=physios,
        historical_lifestyle=lifestyles,
        historical_checkins=checkins,
    )

    version_str = f"v2.0-{datetime.now(timezone.utc).strftime('%Y%W')}"
    metrics_data = {
        "mean_resting_hr": baseline.get("mean_resting_hr"),
        "mean_hrv_ms": baseline.get("mean_hrv_ms"),
        "mean_sleep_hours": baseline.get("mean_sleep_hours"),
        "mean_caffeine_cups": baseline.get("mean_caffeine_cups"),
        "mean_anxiety_score": baseline.get("mean_anxiety_score"),
        "has_sufficient_data": baseline.get("has_sufficient_data"),
    }
    source_refs = [
        {"type": "physio_count", "count": len(physios)},
        {"type": "lifestyle_count", "count": len(lifestyles)},
        {"type": "checkin_count", "count": len(checkins)},
    ]

    return record_digital_twin_memory(
        user_id=current_user.id,
        baseline_version=version_str,
        metrics=metrics_data,
        observation_count=baseline.get("total_observations_count", 0),
        source_refs=source_refs,
        db=db,
    )
