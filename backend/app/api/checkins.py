import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.db_models import User, AnxietyCheckin, PhysiologicalObservation, LifestyleObservation
from backend.app.models.schemas import AnxietyCheckinCreate, AnxietyCheckinOut, AnxietyCheckinUpdate
from backend.app.api.deps import get_current_user
from backend.app.api.observations import trigger_state_update

router = APIRouter(prefix="/checkins", tags=["Anxiety Check-ins"])

CRISIS_RESOURCES = {
    "us_canada": "USA & Canada: Call or Text 988 (24/7 Suicide & Crisis Lifeline)",
    "crisis_text": "USA & Canada: Text HOME to 741741 (Crisis Text Line) | UK: Text SHOUT to 85258",
    "uk": "United Kingdom: Call 111 (NHS Mental Health Services) or 999 (Emergencies) | Call 116 123 (Samaritans)",
    "eu": "European Union: Call 112 (Universal Emergency) or 116 123 (Emotional Support)",
    "australia": "Australia: Call 13 11 14 (Lifeline) or 000 (Emergencies)",
    "india": "India: Call 14416 / 1800-891-4416 (Tele-MANAS 24/7 Toll-Free)",
    "international": "International / Global: Visit findahelpline.com or befrienders.org for free confidential support in 130+ countries",
    "safety_message": "AnxietyTwin is an investigational research prototype and NOT an emergency response service. If you are in immediate danger or distress, contact your local emergency services or a crisis helpline immediately.",
}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_checkin(
    checkin_in: AnxietyCheckinCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    symptoms_json = json.dumps(checkin_in.somatic_symptoms) if checkin_in.somatic_symptoms else None
    context_tags_json = json.dumps(checkin_in.context_tags) if checkin_in.context_tags else None
    checkin_time = checkin_in.timestamp or datetime.now(timezone.utc)

    # 1. Save Anxiety Check-in
    checkin = AnxietyCheckin(
        user_id=current_user.id,
        timestamp=checkin_time,
        source_type=checkin_in.source_type or "user_entered",
        subjective_anxiety_score=checkin_in.subjective_anxiety_score,
        energy_level=checkin_in.energy_level,
        somatic_symptoms=symptoms_json,
        triggers_noted=checkin_in.triggers_noted,
        context_tags_json=context_tags_json,
        notes=checkin_in.notes,
    )
    db.add(checkin)

    # 2. Persist unified lifestyle metrics (sleep, caffeine) if provided
    if checkin_in.sleep_hours is not None or checkin_in.caffeine_cups is not None:
        date_str = checkin_time.strftime("%Y-%m-%d")
        existing_life = db.query(LifestyleObservation).filter(
            LifestyleObservation.user_id == current_user.id,
            LifestyleObservation.date == date_str,
        ).first()

        if existing_life:
            if checkin_in.sleep_hours is not None:
                existing_life.sleep_hours = checkin_in.sleep_hours
            if checkin_in.caffeine_cups is not None:
                existing_life.caffeine_cups = checkin_in.caffeine_cups
        else:
            new_life = LifestyleObservation(
                user_id=current_user.id,
                date=date_str,
                source_type=checkin_in.source_type or "user_entered",
                sleep_hours=checkin_in.sleep_hours if checkin_in.sleep_hours is not None else 7.5,
                caffeine_cups=checkin_in.caffeine_cups if checkin_in.caffeine_cups is not None else 0.0,
            )
            db.add(new_life)

    # 3. Persist unified physiological metrics (HR, steps, HRV) if provided
    if checkin_in.heart_rate_bpm is not None or checkin_in.steps_count is not None:
        hr_val = checkin_in.heart_rate_bpm if checkin_in.heart_rate_bpm is not None else 72.0
        new_physio = PhysiologicalObservation(
            user_id=current_user.id,
            timestamp=checkin_time,
            source_type=checkin_in.source_type or "user_entered",
            heart_rate_bpm=hr_val,
            heart_rate_variability_ms=checkin_in.heart_rate_variability_ms,
            resting_heart_rate=hr_val,
            steps_count=checkin_in.steps_count,
        )
        db.add(new_physio)

    db.commit()
    db.refresh(checkin)

    # Trigger twin state update
    snapshot = trigger_state_update(current_user, db)

    # Attach supportive safety feedback if score is acute
    safety_guidance = None
    if checkin_in.subjective_anxiety_score >= 8:
        safety_guidance = {
            "is_acute": True,
            "support_note": "You are experiencing intense anxiety right now. Remember that anxiety symptoms peak and pass. Take slow, even breaths.",
            "crisis_contacts": CRISIS_RESOURCES,
        }

    return {
        "checkin": {
            "id": checkin.id,
            "timestamp": checkin.timestamp.isoformat(),
            "subjective_anxiety_score": checkin.subjective_anxiety_score,
            "somatic_symptoms": checkin_in.somatic_symptoms,
            "triggers_noted": checkin_in.triggers_noted,
            "notes": checkin_in.notes,
            "sleep_hours": checkin_in.sleep_hours,
            "caffeine_cups": checkin_in.caffeine_cups,
            "heart_rate_bpm": checkin_in.heart_rate_bpm,
            "steps_count": checkin_in.steps_count,
        },
        "twin_state_updated": {
            "state_label": snapshot.state_label,
            "composite_stress_index": snapshot.composite_stress_index,
            "baseline_deviation_score": snapshot.baseline_deviation_score,
        },
        "safety_guidance": safety_guidance,
    }


@router.get("", response_model=List[AnxietyCheckinOut])
def get_checkins(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(AnxietyCheckin).filter(
        AnxietyCheckin.user_id == current_user.id
    ).order_by(AnxietyCheckin.timestamp.desc()).limit(limit).all()


@router.get("/{checkin_id}", response_model=AnxietyCheckinOut)
def get_single_checkin(
    checkin_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    checkin = db.query(AnxietyCheckin).filter(
        AnxietyCheckin.id == checkin_id,
        AnxietyCheckin.user_id == current_user.id,
    ).first()
    if not checkin:
        raise HTTPException(status_code=404, detail="Check-in record not found.")
    return checkin


@router.put("/{checkin_id}")
def update_checkin(
    checkin_id: int,
    update_in: AnxietyCheckinUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    checkin = db.query(AnxietyCheckin).filter(
        AnxietyCheckin.id == checkin_id,
        AnxietyCheckin.user_id == current_user.id,
    ).first()
    if not checkin:
        raise HTTPException(status_code=404, detail="Check-in record not found.")

    if update_in.subjective_anxiety_score is not None:
        checkin.subjective_anxiety_score = update_in.subjective_anxiety_score
    if update_in.energy_level is not None:
        checkin.energy_level = update_in.energy_level
    if update_in.somatic_symptoms is not None:
        checkin.somatic_symptoms = json.dumps(update_in.somatic_symptoms)
    if update_in.triggers_noted is not None:
        checkin.triggers_noted = update_in.triggers_noted
    if update_in.context_tags is not None:
        checkin.context_tags_json = json.dumps(update_in.context_tags)
    if update_in.notes is not None:
        checkin.notes = update_in.notes

    db.commit()
    db.refresh(checkin)

    snapshot = trigger_state_update(current_user, db)
    return {
        "message": "Check-in updated successfully.",
        "id": checkin.id,
        "subjective_anxiety_score": checkin.subjective_anxiety_score,
        "notes": checkin.notes,
        "twin_state_updated": {
            "state_label": snapshot.state_label,
            "composite_stress_index": snapshot.composite_stress_index,
        },
    }


@router.delete("/{checkin_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_checkin(
    checkin_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    checkin = db.query(AnxietyCheckin).filter(
        AnxietyCheckin.id == checkin_id,
        AnxietyCheckin.user_id == current_user.id,
    ).first()
    if not checkin:
        raise HTTPException(status_code=404, detail="Check-in record not found.")

    db.delete(checkin)
    db.commit()

    trigger_state_update(current_user, db)
    return None
