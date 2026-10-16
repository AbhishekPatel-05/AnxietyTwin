from datetime import datetime, timezone
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

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
    PhysiologicalObservationCreate,
    PhysiologicalObservationOut,
    PhysiologicalObservationUpdate,
    LifestyleObservationCreate,
    LifestyleObservationOut,
    LifestyleObservationUpdate,
)
from backend.app.services.twin_engine import DigitalTwinEngine
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/observations", tags=["Observations"])


def trigger_state_update(user: User, db: Session, source="personal_mode"):
    """
    Trigger internal Digital Twin state snapshot computation using all user observations.
    """
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        db.commit()

    physios = db.query(PhysiologicalObservation).filter(
        PhysiologicalObservation.user_id == user.id,
        PhysiologicalObservation.source_type.in_(DigitalTwinEngine.GENUINE_SOURCE_TYPES),
    ).order_by(PhysiologicalObservation.timestamp.desc()).limit(30).all()

    lifestyles = db.query(LifestyleObservation).filter(
        LifestyleObservation.user_id == user.id,
        LifestyleObservation.source_type.in_(DigitalTwinEngine.GENUINE_SOURCE_TYPES),
    ).order_by(LifestyleObservation.date.desc()).limit(30).all()

    checkins = db.query(AnxietyCheckin).filter(
        AnxietyCheckin.user_id == user.id,
        AnxietyCheckin.source_type.in_(DigitalTwinEngine.GENUINE_SOURCE_TYPES),
    ).order_by(AnxietyCheckin.timestamp.desc()).limit(30).all()

    baseline = DigitalTwinEngine.calculate_personal_baseline(
        profile=profile,
        historical_physio=physios,
        historical_lifestyle=lifestyles,
        historical_checkins=checkins,
    )

    latest_physio = physios[0] if physios else None
    latest_lifestyle = lifestyles[0] if lifestyles else None
    latest_checkin = checkins[0] if checkins else None

    current_hr = latest_physio.heart_rate_bpm if latest_physio else None
    current_hrv = latest_physio.heart_rate_variability_ms if latest_physio else None
    current_sleep = latest_lifestyle.sleep_hours if latest_lifestyle else None
    current_caff = latest_lifestyle.caffeine_cups if latest_lifestyle else None
    current_anx = latest_checkin.subjective_anxiety_score if latest_checkin else None

    symptoms = []
    if latest_checkin and latest_checkin.somatic_symptoms:
        try:
            symptoms = json.loads(latest_checkin.somatic_symptoms)
        except Exception:
            symptoms = [latest_checkin.somatic_symptoms]

    last_snap = db.query(TwinStateSnapshot).filter(
        TwinStateSnapshot.user_id == user.id
    ).order_by(TwinStateSnapshot.timestamp.desc()).first()
    prev_label = last_snap.state_label if last_snap else None

    state = DigitalTwinEngine.compute_twin_state(
        baseline=baseline,
        current_hr=current_hr,
        current_hrv=current_hrv,
        current_sleep_hours=current_sleep,
        current_caffeine_cups=current_caff,
        current_anxiety_score=current_anx,
        somatic_symptoms=symptoms,
        previous_state_label=prev_label,
    )

    snapshot = TwinStateSnapshot(
        user_id=user.id,
        timestamp=datetime.now(timezone.utc),
        source=source,
        composite_stress_index=state["composite_stress_index"],
        physiological_arousal_score=state["physiological_arousal_score"],
        circadian_disruption_index=state["circadian_disruption_index"],
        baseline_deviation_score=state["baseline_deviation_score"],
        state_label=state["state_label"],
        state_details_json=json.dumps(state["details"]),
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


@router.post("/physiological", response_model=PhysiologicalObservationOut, status_code=status.HTTP_201_CREATED)
def create_physiological_observation(
    obs_in: PhysiologicalObservationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    obs = PhysiologicalObservation(
        user_id=current_user.id,
        timestamp=obs_in.timestamp or datetime.now(timezone.utc),
        source_type=obs_in.source_type or "user_entered",
        heart_rate_bpm=obs_in.heart_rate_bpm,
        heart_rate_variability_ms=obs_in.heart_rate_variability_ms,
        resting_heart_rate=obs_in.resting_heart_rate,
        steps_count=obs_in.steps_count,
    )
    db.add(obs)
    db.commit()
    db.refresh(obs)

    # Update Twin State
    trigger_state_update(current_user, db)

    return obs


@router.get("/physiological", response_model=List[PhysiologicalObservationOut])
def get_physiological_observations(
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(PhysiologicalObservation).filter(
        PhysiologicalObservation.user_id == current_user.id
    ).order_by(PhysiologicalObservation.timestamp.desc()).limit(limit).all()


@router.post("/lifestyle", response_model=LifestyleObservationOut, status_code=status.HTTP_201_CREATED)
def create_lifestyle_observation(
    obs_in: LifestyleObservationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    obs = LifestyleObservation(
        user_id=current_user.id,
        date=obs_in.date,
        source_type=obs_in.source_type or "user_entered",
        sleep_hours=obs_in.sleep_hours,
        sleep_quality_score=obs_in.sleep_quality_score,
        caffeine_cups=obs_in.caffeine_cups or 0.0,
        alcohol_units=obs_in.alcohol_units or 0.0,
        exercise_minutes=obs_in.exercise_minutes or 0.0,
        smoking_count=obs_in.smoking_count or 0,
    )
    db.add(obs)
    db.commit()
    db.refresh(obs)

    # Update Twin State
    trigger_state_update(current_user, db)

    return obs


@router.get("/lifestyle", response_model=List[LifestyleObservationOut])
def get_lifestyle_observations(
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(LifestyleObservation).filter(
        LifestyleObservation.user_id == current_user.id
    ).order_by(LifestyleObservation.date.desc()).limit(limit).all()


@router.get("/history")
def get_observation_history(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    physios = db.query(PhysiologicalObservation).filter(
        PhysiologicalObservation.user_id == current_user.id
    ).order_by(PhysiologicalObservation.timestamp.desc()).limit(limit).all()

    lifestyles = db.query(LifestyleObservation).filter(
        LifestyleObservation.user_id == current_user.id
    ).order_by(LifestyleObservation.date.desc()).limit(limit).all()

    checkins = db.query(AnxietyCheckin).filter(
        AnxietyCheckin.user_id == current_user.id
    ).order_by(AnxietyCheckin.timestamp.desc()).limit(limit).all()

    return {
        "physiological": [
            {
                "id": p.id,
                "timestamp": p.timestamp.isoformat(),
                "source_type": p.source_type,
                "heart_rate_bpm": p.heart_rate_bpm,
                "heart_rate_variability_ms": p.heart_rate_variability_ms,
                "steps_count": p.steps_count,
            }
            for p in physios
        ],
        "lifestyle": [
            {
                "id": l.id,
                "date": l.date,
                "source_type": l.source_type,
                "sleep_hours": l.sleep_hours,
                "sleep_quality_score": l.sleep_quality_score,
                "caffeine_cups": l.caffeine_cups,
                "alcohol_units": l.alcohol_units,
                "exercise_minutes": l.exercise_minutes,
            }
            for l in lifestyles
        ],
        "checkins": [
            {
                "id": c.id,
                "timestamp": c.timestamp.isoformat(),
                "source_type": c.source_type,
                "subjective_anxiety_score": c.subjective_anxiety_score,
                "somatic_symptoms": json.loads(c.somatic_symptoms) if c.somatic_symptoms else [],
                "triggers_noted": c.triggers_noted,
            }
            for c in checkins
        ],
    }


@router.put("/physiological/{obs_id}", response_model=PhysiologicalObservationOut)
def update_physiological_observation(
    obs_id: int,
    obs_in: PhysiologicalObservationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update physiological observation with tenant isolation.
    """
    obs = db.query(PhysiologicalObservation).filter(
        PhysiologicalObservation.id == obs_id,
        PhysiologicalObservation.user_id == current_user.id,
    ).first()
    if not obs:
        raise HTTPException(status_code=404, detail="Observation record not found.")

    update_data = obs_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None:
            setattr(obs, field, val)

    db.commit()
    db.refresh(obs)
    trigger_state_update(current_user, db)
    return obs


@router.put("/lifestyle/{obs_id}", response_model=LifestyleObservationOut)
def update_lifestyle_observation(
    obs_id: int,
    obs_in: LifestyleObservationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update lifestyle observation with tenant isolation.
    """
    obs = db.query(LifestyleObservation).filter(
        LifestyleObservation.id == obs_id,
        LifestyleObservation.user_id == current_user.id,
    ).first()
    if not obs:
        raise HTTPException(status_code=404, detail="Observation record not found.")

    update_data = obs_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None:
            setattr(obs, field, val)

    db.commit()
    db.refresh(obs)
    trigger_state_update(current_user, db)
    return obs


@router.delete("/{obs_type}/{obs_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_observation(
    obs_type: str,
    obs_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Enforces user isolation: only the owner can delete an observation record.
    """
    if obs_type == "physiological":
        rec = db.query(PhysiologicalObservation).filter(
            PhysiologicalObservation.id == obs_id,
            PhysiologicalObservation.user_id == current_user.id,
        ).first()
    elif obs_type == "lifestyle":
        rec = db.query(LifestyleObservation).filter(
            LifestyleObservation.id == obs_id,
            LifestyleObservation.user_id == current_user.id,
        ).first()
    elif obs_type == "checkin":
        rec = db.query(AnxietyCheckin).filter(
            AnxietyCheckin.id == obs_id,
            AnxietyCheckin.user_id == current_user.id,
        ).first()
    else:
        raise HTTPException(status_code=400, detail="Invalid observation type.")

    if not rec:
        raise HTTPException(status_code=404, detail="Observation record not found.")

    db.delete(rec)
    db.commit()

    # Recompute state
    trigger_state_update(current_user, db)
    return None
