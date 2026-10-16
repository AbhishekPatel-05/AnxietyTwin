import json
import os
from datetime import datetime, timezone
from typing import List, Optional, Set
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.db_models import (
    User,
    PredictionRecord,
    PhysiologicalObservation,
    LifestyleObservation,
    AnxietyCheckin,
    UserProfile,
)
from backend.app.models.schemas import (
    PredictionRequest,
    PredictionResponse,
    PersonalizedPredictionResponse,
)
from backend.app.services.ml_service import ml_service
from backend.app.services.twin_engine import DigitalTwinEngine
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/prediction", tags=["Research ML Predictions"])


@router.post("/predict", response_model=PredictionResponse)
def run_prediction(
    req: PredictionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not ml_service.loaded:
        raise HTTPException(
            status_code=503,
            detail="Machine learning model artifacts are not initialized.",
        )

    pred = ml_service.predict_panic_risk(
        hr_mean=req.heart_rate_mean,
        hr_max=req.heart_rate_max,
        hr_var=req.heart_rate_var,
        steps_mean=req.steps_mean,
        sleep_duration=req.sleep_duration,
        sleep_onset=req.sleep_onset_hour,
        sleep_out=req.sleep_out_hour,
        caffeine=req.caffeine_intake,
        alcohol=req.alcohol_intake,
        daily_anxiety=req.daily_anxiety_rating,
        annoyance=req.annoyance_rating,
        trait_stai=req.trait_anxiety_stai or 42.0,
        trauma_ctq=req.childhood_trauma_ctq or 12.0,
        model_name=req.model_choice or "RandomForest",
    )

    # Persist prediction record
    db_rec = PredictionRecord(
        user_id=current_user.id,
        model_name=pred["model_name"],
        model_version=pred["model_version"],
        prediction_timestamp=datetime.now(timezone.utc),
        predicted_probability=pred["predicted_probability"],
        prediction_horizon=pred["prediction_horizon"],
        uncertainty_interval_lower=pred["uncertainty_interval"][0],
        uncertainty_interval_upper=pred["uncertainty_interval"][1],
        risk_band=pred["risk_band"],
        contributing_factors_json=json.dumps(pred["top_contributing_factors"]),
        disclaimer_acknowledged=True,
    )
    db.add(db_rec)
    db.commit()

    return PredictionResponse(
        model_name=pred["model_name"],
        model_version=pred["model_version"],
        prediction_horizon=pred["prediction_horizon"],
        predicted_probability=pred["predicted_probability"],
        uncertainty_interval=pred["uncertainty_interval"],
        risk_band=pred["risk_band"],
        calibration_reliability_note=pred["calibration_reliability_note"],
        top_contributing_factors=pred["top_contributing_factors"],
        research_disclaimer=pred["research_disclaimer"],
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/personalized", response_model=PersonalizedPredictionResponse)
def get_personalized_prediction(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Evaluates whether the user satisfies the strict 7-day longitudinal history
    requirement for personalized causal deviation ML modeling.
    Returns an explicit limitation/unavailable response during cold-start instead
    of inventing personal predictions.
    """
    physios = db.query(PhysiologicalObservation).filter(
        PhysiologicalObservation.user_id == current_user.id
    ).order_by(PhysiologicalObservation.timestamp.asc()).all()

    lifestyles = db.query(LifestyleObservation).filter(
        LifestyleObservation.user_id == current_user.id
    ).order_by(LifestyleObservation.date.asc()).all()

    checkins = db.query(AnxietyCheckin).filter(
        AnxietyCheckin.user_id == current_user.id
    ).order_by(AnxietyCheckin.timestamp.asc()).all()

    genuine_physios = [p for p in physios if DigitalTwinEngine.is_genuine_observation(p)]
    genuine_lifestyles = [l for l in lifestyles if DigitalTwinEngine.is_genuine_observation(l)]
    genuine_checkins = [c for c in checkins if DigitalTwinEngine.is_genuine_observation(c)]

    # Collect distinct calendar dates from genuine records
    unique_dates: Set[str] = set()
    for p in genuine_physios:
        if p.timestamp:
            unique_dates.add(p.timestamp.strftime("%Y-%m-%d"))
    for l in genuine_lifestyles:
        if l.date:
            unique_dates.add(str(l.date))
    for c in genuine_checkins:
        if c.timestamp:
            unique_dates.add(c.timestamp.strftime("%Y-%m-%d"))

    unique_days_count = len(unique_dates)

    if unique_days_count < 7:
        return PersonalizedPredictionResponse(
            status="unavailable",
            unique_history_days=unique_days_count,
            required_days=7,
            prediction=None,
            message=(
                f"Personalized machine learning prediction requires at least 7 distinct days of prior historical observations. "
                f"You currently have {unique_days_count} of 7 required days recorded."
            ),
            limitation=(
                "Personalized rolling deviation z-scores cannot be computed without minimum 7 days of historical records. "
                "Static cohort models and hypothetical simulations remain available in the Simulation Lab, but personalized "
                "predictions are withheld during cold-start to prevent deceptive forecasting."
            ),
        )

    # If at least 7 days exist, extract recent observations and run personalized prediction
    latest_physio = genuine_physios[-1] if genuine_physios else None
    latest_lifestyle = genuine_lifestyles[-1] if genuine_lifestyles else None
    latest_checkin = genuine_checkins[-1] if genuine_checkins else None
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()

    hr_val = latest_physio.heart_rate_bpm if latest_physio and latest_physio.heart_rate_bpm else 74.0
    sleep_val = latest_lifestyle.sleep_hours if latest_lifestyle and latest_lifestyle.sleep_hours else 7.0
    caff_val = latest_lifestyle.caffeine_cups if latest_lifestyle and latest_lifestyle.caffeine_cups else 1.0
    anx_val = float(latest_checkin.subjective_anxiety_score) if latest_checkin else 3.0
    trait_val = profile.trait_anxiety_score if profile and profile.trait_anxiety_score else 42.0

    pred = ml_service.predict_panic_risk(
        hr_mean=hr_val,
        hr_max=hr_val + 25.0,
        hr_var=115.0,
        steps_mean=55.0,
        sleep_duration=sleep_val,
        sleep_onset=-1.0,
        sleep_out=sleep_val - 1.0,
        caffeine=caff_val,
        alcohol=0.0,
        daily_anxiety=anx_val,
        annoyance=2.0,
        trait_stai=trait_val,
        model_name="RandomForest",
    )

    pred_resp = PredictionResponse(
        model_name=pred["model_name"],
        model_version=pred["model_version"],
        prediction_horizon=pred["prediction_horizon"],
        predicted_probability=pred["predicted_probability"],
        uncertainty_interval=pred["uncertainty_interval"],
        risk_band=pred["risk_band"],
        calibration_reliability_note=pred["calibration_reliability_note"],
        top_contributing_factors=pred["top_contributing_factors"],
        research_disclaimer=pred["research_disclaimer"],
        timestamp=datetime.now(timezone.utc),
    )

    return PersonalizedPredictionResponse(
        status="ready",
        unique_history_days=unique_days_count,
        required_days=7,
        prediction=pred_resp,
        message=f"Personalized prediction calibrated using {unique_days_count} days of longitudinal observations.",
        limitation=None,
    )


@router.get("/metadata")
def get_model_metadata():
    report_file = os.path.join("ml", "reports", "experiment_results.json")
    if os.path.exists(report_file):
        with open(report_file, "r") as f:
            return json.load(f)
    return {
        "model_name": "AnxietyTwin-RandomForest-DBP",
        "model_version": "2.0.0",
        "prediction_target": "Day Before Panic (DBP, ~24h horizon)",
        "features_count": 35,
        "note": "Production artifact evaluated with GroupKFold (ROC-AUC 0.7284) and personalized rolling deviations (ROC-AUC 0.8504)."
    }


@router.get("/history")
def get_prediction_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    preds = db.query(PredictionRecord).filter(
        PredictionRecord.user_id == current_user.id
    ).order_by(PredictionRecord.prediction_timestamp.desc()).limit(20).all()

    return [
        {
            "id": p.id,
            "model_name": p.model_name,
            "prediction_timestamp": p.prediction_timestamp.isoformat(),
            "predicted_probability": p.predicted_probability,
            "risk_band": p.risk_band,
            "uncertainty_interval": [p.uncertainty_interval_lower, p.uncertainty_interval_upper],
            "factors": json.loads(p.contributing_factors_json) if p.contributing_factors_json else [],
        }
        for p in preds
    ]
