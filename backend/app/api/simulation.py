import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.db_models import (
    User,
    UserProfile,
    PhysiologicalObservation,
    LifestyleObservation,
    AnxietyCheckin,
    SimulationScenario,
    PatientAccessGrant,
)
from backend.app.models.schemas import (
    SimulationScenarioInput,
    SimulationScenarioCreate,
    SimulationScenarioOut,
    ScenarioComparisonRequest,
    ScenarioComparisonResponse,
    ScenarioReplayRequest,
    ScenarioReplayResponse,
    ScenarioComparisonPdfRequest,
    BaselineSummaryOut,
    PersonalizedMetricSummary,
    PersonalizedInitializationResponse,
    ExplainableScenarioComparisonResponse,
    CounterfactualPerturbationRequest,
    CounterfactualPerturbationResponse,
)
from backend.app.services.twin_engine import DigitalTwinEngine
from backend.app.services.ml_service import ml_service
from backend.app.services.simulation_report_service import (
    generate_deterministic_replay,
    generate_scenario_comparison_pdf,
    explain_scenario_differences,
    run_counterfactual_analysis,
)
from backend.app.api.deps import get_current_user, get_current_user_optional

router = APIRouter(prefix="/simulation", tags=["Simulation Lab"])

DEMO_PROFILES = {
    "DEMO-PATIENT-01": {
        "name": "Alex - Standard Healthy Baseline",
        "description": "32yo outpatient with moderate baseline stress and stable circadian rhythm.",
        "mean_resting_hr": 70.0,
        "std_resting_hr": 7.0,
        "mean_hrv_ms": 48.0,
        "std_hrv_ms": 11.0,
        "mean_sleep_hours": 7.5,
        "mean_caffeine_cups": 1.0,
        "mean_anxiety_score": 2.0,
    },
    "DEMO-PATIENT-02": {
        "name": "Jordan - High Trait Anxiety & Poor Sleep",
        "description": "28yo with elevated trait anxiety (STAI 54) and chronic sleep fragmentation.",
        "mean_resting_hr": 80.0,
        "std_resting_hr": 9.0,
        "mean_hrv_ms": 32.0,
        "std_hrv_ms": 8.0,
        "mean_sleep_hours": 5.8,
        "mean_caffeine_cups": 3.0,
        "mean_anxiety_score": 5.0,
    },
    "DEMO-PATIENT-03": {
        "name": "Morgan - High Autonomic Reactivity",
        "description": "41yo with history of panic attacks and sharp heart rate surges during caffeine intake.",
        "mean_resting_hr": 76.0,
        "std_resting_hr": 12.0,
        "mean_hrv_ms": 38.0,
        "std_hrv_ms": 14.0,
        "mean_sleep_hours": 7.0,
        "mean_caffeine_cups": 1.5,
        "mean_anxiety_score": 3.5,
    },
}


@router.get("/profiles")
def get_simulation_profiles():
    return {
        "profiles": [
            {"id": k, **v} for k, v in DEMO_PROFILES.items()
        ]
    }


def _resolve_profile_for_simulation(
    profile_id: Optional[str],
    user: Optional[User] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    if profile_id and profile_id.startswith("USER-"):
        if not user or not db:
            raise HTTPException(status_code=401, detail="Authentication required to resolve personalized user profile.")
        parts = profile_id.split("-", 1)
        target_id = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else user.id

        # Strict cross-user tenant isolation
        if target_id != user.id:
            has_grant = False
            if user.role == "clinician":
                grant = db.query(PatientAccessGrant).filter(
                    PatientAccessGrant.patient_id == target_id,
                    PatientAccessGrant.clinician_id == user.id,
                    PatientAccessGrant.is_active == True,
                    PatientAccessGrant.revoked_at == None,
                ).first()
                if grant:
                    has_grant = True
            if not has_grant:
                raise HTTPException(
                    status_code=403,
                    detail="Forbidden: Cannot access or simulate using another user's personalized profile.",
                )
            target_user_id = target_id
            target_user = db.query(User).filter(User.id == target_id).first()
            user_label = target_user.full_name if target_user else f"Patient {target_id}"
        else:
            target_user_id = user.id
            user_label = user.full_name or "User"

        user_profile = db.query(UserProfile).filter(UserProfile.user_id == target_user_id).first()
        physios = db.query(PhysiologicalObservation).filter(
            PhysiologicalObservation.user_id == target_user_id,
            PhysiologicalObservation.source_type.in_(DigitalTwinEngine.GENUINE_SOURCE_TYPES),
        ).all()
        lifestyles = db.query(LifestyleObservation).filter(
            LifestyleObservation.user_id == target_user_id,
            LifestyleObservation.source_type.in_(DigitalTwinEngine.GENUINE_SOURCE_TYPES),
        ).all()
        checkins = db.query(AnxietyCheckin).filter(
            AnxietyCheckin.user_id == target_user_id,
            AnxietyCheckin.source_type.in_(DigitalTwinEngine.GENUINE_SOURCE_TYPES),
        ).all()
        baseline = DigitalTwinEngine.calculate_personal_baseline(
            profile=user_profile,
            historical_physio=physios,
            historical_lifestyle=lifestyles,
            historical_checkins=checkins,
        )
        return {
            "name": f"Personal Baseline ({user_label})",
            "description": "Authentic empirical baseline calculated from patient records.",
            "mean_resting_hr": baseline.get("mean_resting_hr") or 72.0,
            "std_resting_hr": baseline.get("std_resting_hr") or 8.0,
            "mean_hrv_ms": baseline.get("mean_hrv_ms") or 45.0,
            "std_hrv_ms": baseline.get("std_hrv_ms") or 12.0,
            "mean_sleep_hours": baseline.get("mean_sleep_hours") or 7.5,
            "mean_caffeine_cups": baseline.get("mean_caffeine_cups") or 1.0,
            "mean_anxiety_score": baseline.get("mean_anxiety_score") or 2.5,
        }
    return DEMO_PROFILES.get(profile_id or "DEMO-PATIENT-01", DEMO_PROFILES["DEMO-PATIENT-01"])


@router.get("/adaptive/initialize", response_model=PersonalizedInitializationResponse)
def get_adaptive_baseline_initialization(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Initializes the Adaptive Digital Twin workspace with authenticated user's genuine records.
    Provides transparent metrics, provenance tags, and clear generic demonstration mode fallback.
    """
    import numpy as np

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

    baseline_dict = DigitalTwinEngine.calculate_personal_baseline(
        profile=profile,
        historical_physio=physios,
        historical_lifestyle=lifestyles,
        historical_checkins=checkins,
    )

    has_data = baseline_dict.get("has_sufficient_data", False)
    last_physio = physios[-1] if physios else None
    last_lifestyle = lifestyles[-1] if lifestyles else None
    last_checkin = checkins[-1] if checkins else None

    sleep_hours_list = [l.sleep_hours for l in lifestyles if l.sleep_hours is not None]
    sleep_reg_std = float(np.std(sleep_hours_list)) if len(sleep_hours_list) >= 3 else None
    sleep_reg_score = round(max(0.0, 100.0 - (sleep_reg_std * 25.0)), 1) if sleep_reg_std is not None else None

    steps_list = [p.steps_count for p in physios if p.steps_count is not None]
    mean_steps = round(float(np.mean(steps_list)), 0) if steps_list else None
    last_steps = last_physio.steps_count if last_physio and last_physio.steps_count is not None else None

    period_str = f"{baseline_dict.get('unique_days_count', 0)} days ({baseline_dict.get('total_observations_count', 0)} readings)"

    metrics: List[PersonalizedMetricSummary] = [
        PersonalizedMetricSummary(
            metric_key="resting_heart_rate",
            display_name="Resting Heart Rate",
            current_value=last_physio.heart_rate_bpm if last_physio else None,
            baseline_value=baseline_dict.get("mean_resting_hr"),
            unit="BPM",
            observation_count=len([p for p in physios if p.heart_rate_bpm]),
            observation_period=period_str,
            most_recent_timestamp=last_physio.timestamp.isoformat() if last_physio and last_physio.timestamp else None,
            provenance="device_measured" if physios else "reference_demo",
            sufficient_data=baseline_dict.get("measured_flags", {}).get("heart_rate", False),
            status_note="Empirical baseline" if baseline_dict.get("measured_flags", {}).get("heart_rate") else "Insufficient observations (<3 readings)",
        ),
        PersonalizedMetricSummary(
            metric_key="hrv_rmssd",
            display_name="HRV (rMSSD)",
            current_value=last_physio.heart_rate_variability_ms if last_physio else None,
            baseline_value=baseline_dict.get("mean_hrv_ms"),
            unit="ms",
            observation_count=len([p for p in physios if p.heart_rate_variability_ms]),
            observation_period=period_str,
            most_recent_timestamp=last_physio.timestamp.isoformat() if last_physio and last_physio.timestamp else None,
            provenance="device_measured" if physios else "reference_demo",
            sufficient_data=baseline_dict.get("measured_flags", {}).get("hrv", False),
            status_note="Empirical baseline" if baseline_dict.get("measured_flags", {}).get("hrv") else "Insufficient observations (<3 readings)",
        ),
        PersonalizedMetricSummary(
            metric_key="sleep_duration",
            display_name="Sleep Duration",
            current_value=last_lifestyle.sleep_hours if last_lifestyle else None,
            baseline_value=baseline_dict.get("mean_sleep_hours"),
            unit="hours",
            observation_count=len(sleep_hours_list),
            observation_period=period_str,
            most_recent_timestamp=str(last_lifestyle.date) if last_lifestyle and last_lifestyle.date else None,
            provenance="user_reported" if lifestyles else "reference_demo",
            sufficient_data=baseline_dict.get("measured_flags", {}).get("sleep", False),
            status_note="Empirical baseline" if baseline_dict.get("measured_flags", {}).get("sleep") else "Insufficient sleep logs (<3 nights)",
        ),
        PersonalizedMetricSummary(
            metric_key="sleep_regularity",
            display_name="Sleep Regularity",
            current_value=sleep_reg_score,
            baseline_value=sleep_reg_score or 80.0,
            unit="consistency index (0-100)",
            observation_count=len(sleep_hours_list),
            observation_period=period_str,
            most_recent_timestamp=str(last_lifestyle.date) if last_lifestyle and last_lifestyle.date else None,
            provenance="derived",
            sufficient_data=len(sleep_hours_list) >= 3,
            status_note=f"Variance: ±{sleep_reg_std:.1f}h" if sleep_reg_std is not None else "Requires 3+ sleep records",
        ),
        PersonalizedMetricSummary(
            metric_key="activity_level",
            display_name="Physical Activity",
            current_value=float(last_steps) if last_steps is not None else None,
            baseline_value=float(mean_steps) if mean_steps is not None else 6500.0,
            unit="steps/day",
            observation_count=len(steps_list),
            observation_period=period_str,
            most_recent_timestamp=last_physio.timestamp.isoformat() if last_physio and last_physio.timestamp else None,
            provenance="device_measured" if steps_list else "reference_demo",
            sufficient_data=len(steps_list) >= 3,
            status_note="Activity tracking active" if len(steps_list) >= 3 else "Insufficient step telemetry",
        ),
        PersonalizedMetricSummary(
            metric_key="self_reported_distress",
            display_name="Self-Reported Distress",
            current_value=float(last_checkin.subjective_anxiety_score) if last_checkin else None,
            baseline_value=baseline_dict.get("mean_anxiety_score"),
            unit="rating (0-10)",
            observation_count=len(checkins),
            observation_period=period_str,
            most_recent_timestamp=last_checkin.timestamp.isoformat() if last_checkin and last_checkin.timestamp else None,
            provenance="user_reported" if checkins else "reference_demo",
            sufficient_data=baseline_dict.get("measured_flags", {}).get("anxiety", False),
            status_note="Empirical baseline" if baseline_dict.get("measured_flags", {}).get("anxiety") else "Insufficient check-in logs (<3 ratings)",
        ),
    ]

    base_out = BaselineSummaryOut(
        has_sufficient_data=has_data,
        is_cold_start=not has_data,
        required_observations_count=5,
        personalized_model_min_days=7,
        total_observations_count=baseline_dict.get("total_observations_count", 0),
        unique_days_count=baseline_dict.get("unique_days_count", 0),
        date_span_days=baseline_dict.get("date_span_days", 0),
        history_progress_percent=baseline_dict.get("history_progress_percent", 0.0),
        status_message=baseline_dict.get("status_message", ""),
        reference_prior_note=baseline_dict.get("reference_prior_note"),
        missing_indicators=baseline_dict.get("missing_indicators", []),
        mean_resting_hr=baseline_dict.get("mean_resting_hr"),
        mean_hrv_ms=baseline_dict.get("mean_hrv_ms"),
        mean_sleep_hours=baseline_dict.get("mean_sleep_hours"),
        mean_caffeine_cups=baseline_dict.get("mean_caffeine_cups"),
        mean_anxiety_score=baseline_dict.get("mean_anxiety_score"),
        std_resting_hr=baseline_dict.get("std_resting_hr", 8.0),
        std_hrv_ms=baseline_dict.get("std_hrv_ms", 12.0),
        std_sleep_hours=baseline_dict.get("std_sleep_hours", 1.2),
        last_updated=None,
        descriptive_baseline_ready=has_data,
        personalized_prediction_ready=baseline_dict.get("personalized_prediction_ready", False),
    )

    if has_data:
        data_mode = "personalized"
        profile_id = f"USER-{current_user.id}"
        profile_name = f"Personal Empirical Baseline ({current_user.full_name or 'User'})"
        disclaimer = "Personalized Digital Twin initialized from authentic longitudinal patient records. Excludes synthetic traces."
    else:
        data_mode = "generic_demo"
        profile_id = "DEMO-PATIENT-01"
        profile_name = "Alex - Standard Healthy Archetype (Generic Demonstration Mode)"
        disclaimer = "Insufficient historical records (<5 observations across 3 distinct days). Generic demonstration mode activated. Demonstration parameters do not represent genuine patient measurements."

    return PersonalizedInitializationResponse(
        user_id=current_user.id,
        is_personalized=has_data,
        data_mode=data_mode,
        profile_id=profile_id,
        profile_name=profile_name,
        baseline_summary=base_out,
        metrics=metrics,
        sufficient_data=has_data,
        disclaimer=disclaimer,
    )


@router.post("/run")
def run_simulation(
    scenario_input: SimulationScenarioInput,
    profile_id: str = "DEMO-PATIENT-01",
    include_prediction: bool = True,
):
    profile = DEMO_PROFILES.get(profile_id, DEMO_PROFILES["DEMO-PATIENT-01"])

    twin_state = DigitalTwinEngine.compute_twin_state(
        baseline=profile,
        current_hr=scenario_input.heart_rate_bpm,
        current_hrv=scenario_input.hrv_ms,
        current_sleep_hours=scenario_input.sleep_hours,
        current_caffeine_cups=scenario_input.caffeine_cups,
        current_anxiety_score=scenario_input.self_reported_anxiety,
        somatic_symptoms=["palpitations", "tightness"] if scenario_input.self_reported_anxiety >= 7 else [],
    )

    # Disclose explicit imputed features so unsupported inputs are not disguised as direct model features
    imputed_features = [
        {"feature": "HR_max", "imputed_value": round(scenario_input.heart_rate_bpm + 25.0, 1), "reason": "Heuristic estimate (+25 BPM surge above resting)"},
        {"feature": "HR_var", "imputed_value": 120.0, "reason": "Cohort median physiological variance"},
        {"feature": "steps_mean", "imputed_value": round(scenario_input.physical_activity_mins * 2.5, 1), "reason": "Linear activity duration scaling"},
        {"feature": "sleep_onset_time", "imputed_value": -1.0, "reason": "Standardized circadian nocturnal onset marker"},
        {"feature": "sleep_out_time", "imputed_value": round(scenario_input.sleep_hours - 1.0, 1), "reason": "Calculated nocturnal offset from duration"},
        {"feature": "alcohol", "imputed_value": 0.0, "reason": "Assumed non-drinking day baseline"},
        {"feature": "annoying", "imputed_value": float(min(10, scenario_input.recent_stress_exposure * 2)), "reason": "Scaled stress exposure proxy"},
    ]

    pred_result = None
    if include_prediction and ml_service.loaded:
        try:
            pred_result = ml_service.predict_panic_risk(
                hr_mean=scenario_input.heart_rate_bpm,
                hr_max=scenario_input.heart_rate_bpm + 25.0,
                hr_var=120.0,
                steps_mean=scenario_input.physical_activity_mins * 2.5,
                sleep_duration=scenario_input.sleep_hours,
                sleep_onset=-1.0,
                sleep_out=scenario_input.sleep_hours - 1.0,
                caffeine=scenario_input.caffeine_cups,
                alcohol=0.0,
                daily_anxiety=float(scenario_input.self_reported_anxiety),
                annoyance=float(min(10, scenario_input.recent_stress_exposure * 2)),
            )
        except Exception as e:
            pred_result = {"error": f"ML inference failed: {str(e)}"}
    elif include_prediction and not ml_service.loaded:
        pred_result = {"error": "ML model artifacts not loaded. Using pure virtual twin state engine."}

    return {
        "status": "success",
        "synthetic_notice": "ILLUSTRATIVE SIMULATION — SYNTHETIC LAB COUNTERFACTUAL EXPERIMENT",
        "patient_profile_applied": profile["name"],
        "inputs": scenario_input.model_dump(),
        "twin_state": twin_state,
        "research_prediction": pred_result,
        "imputed_features_disclosure": imputed_features,
        "disclaimer": (
            "Simulated outcomes are generated for research counterfactual exploration and do not establish "
            "clinical causation or prove that a panic attack will occur or be prevented. Never use for self-diagnosis."
        ),
    }


@router.post("/compare", response_model=ScenarioComparisonResponse)
def compare_scenarios(
    req: ScenarioComparisonRequest,
):
    profile = DEMO_PROFILES.get(req.baseline_profile_id, DEMO_PROFILES["DEMO-PATIENT-01"])

    state_a = DigitalTwinEngine.compute_twin_state(
        baseline=profile,
        current_hr=req.scenario_a.heart_rate_bpm,
        current_hrv=req.scenario_a.hrv_ms,
        current_sleep_hours=req.scenario_a.sleep_hours,
        current_caffeine_cups=req.scenario_a.caffeine_cups,
        current_anxiety_score=req.scenario_a.self_reported_anxiety,
    )

    state_b = DigitalTwinEngine.compute_twin_state(
        baseline=profile,
        current_hr=req.scenario_b.heart_rate_bpm,
        current_hrv=req.scenario_b.hrv_ms,
        current_sleep_hours=req.scenario_b.sleep_hours,
        current_caffeine_cups=req.scenario_b.caffeine_cups,
        current_anxiety_score=req.scenario_b.self_reported_anxiety,
    )

    delta_stress = round(state_b["composite_stress_index"] - state_a["composite_stress_index"], 1)
    delta_arousal = round(state_b["physiological_arousal_score"] - state_a["physiological_arousal_score"], 1)
    delta_circadian = round(state_b["circadian_disruption_index"] - state_a["circadian_disruption_index"], 1)

    diff_analysis = {
        "delta_composite_stress": delta_stress,
        "delta_physiological_arousal": delta_arousal,
        "delta_circadian_disruption": delta_circadian,
        "primary_divergence_driver": (
            "Circadian & Sleep Debt" if abs(delta_circadian) > abs(delta_arousal) else "Autonomic / Arousal Surge"
        ),
        "synthetic_label": "SIMULATION COMPARISON",
    }

    pred_a = None
    pred_b = None
    delta_prob = None

    if ml_service.loaded:
        try:
            pred_a = ml_service.predict_panic_risk(
                hr_mean=req.scenario_a.heart_rate_bpm,
                hr_max=req.scenario_a.heart_rate_bpm + 25.0,
                hr_var=120.0,
                steps_mean=req.scenario_a.physical_activity_mins * 2.5,
                sleep_duration=req.scenario_a.sleep_hours,
                sleep_onset=-1.0,
                sleep_out=req.scenario_a.sleep_hours - 1.0,
                caffeine=req.scenario_a.caffeine_cups,
                alcohol=0.0,
                daily_anxiety=float(req.scenario_a.self_reported_anxiety),
                annoyance=float(min(10, req.scenario_a.recent_stress_exposure * 2)),
            )
            pred_b = ml_service.predict_panic_risk(
                hr_mean=req.scenario_b.heart_rate_bpm,
                hr_max=req.scenario_b.heart_rate_bpm + 25.0,
                hr_var=120.0,
                steps_mean=req.scenario_b.physical_activity_mins * 2.5,
                sleep_duration=req.scenario_b.sleep_hours,
                sleep_onset=-1.0,
                sleep_out=req.scenario_b.sleep_hours - 1.0,
                caffeine=req.scenario_b.caffeine_cups,
                alcohol=0.0,
                daily_anxiety=float(req.scenario_b.self_reported_anxiety),
                annoyance=float(min(10, req.scenario_b.recent_stress_exposure * 2)),
            )
            delta_prob = round(pred_b["predicted_probability"] - pred_a["predicted_probability"], 3)
        except Exception:
            pass

    return ScenarioComparisonResponse(
        scenario_a_result=state_a,
        scenario_b_result=state_b,
        differential_analysis=diff_analysis,
        scenario_a_prediction=pred_a,
        scenario_b_prediction=pred_b,
        delta_predicted_probability=delta_prob,
        non_causal_disclaimer=(
            "Model sensitivity to hypothetical counterfactual inputs reflects statistical patterns in the research cohort. "
            "It does NOT establish clinical causation. Changing lifestyle variables does not guarantee prevention or cause of panic attacks."
        ),
    )


@router.post("/adaptive/compare", response_model=ExplainableScenarioComparisonResponse)
def compare_scenarios_adaptive_endpoint(
    req: ScenarioComparisonRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Compares Scenario A and Scenario B with rich, grounded mathematical explanations
    attributing output shifts to explicit formulas and disclosing unmodeled inputs.
    """
    profile = _resolve_profile_for_simulation(req.baseline_profile_id, current_user, db)

    state_a = DigitalTwinEngine.compute_twin_state(
        baseline=profile,
        current_hr=req.scenario_a.heart_rate_bpm,
        current_hrv=req.scenario_a.hrv_ms,
        current_sleep_hours=req.scenario_a.sleep_hours,
        current_caffeine_cups=req.scenario_a.caffeine_cups,
        current_anxiety_score=req.scenario_a.self_reported_anxiety,
    )

    state_b = DigitalTwinEngine.compute_twin_state(
        baseline=profile,
        current_hr=req.scenario_b.heart_rate_bpm,
        current_hrv=req.scenario_b.hrv_ms,
        current_sleep_hours=req.scenario_b.sleep_hours,
        current_caffeine_cups=req.scenario_b.caffeine_cups,
        current_anxiety_score=req.scenario_b.self_reported_anxiety,
    )

    delta_stress = round(state_b["composite_stress_index"] - state_a["composite_stress_index"], 1)
    delta_arousal = round(state_b["physiological_arousal_score"] - state_a["physiological_arousal_score"], 1)
    delta_circadian = round(state_b["circadian_disruption_index"] - state_a["circadian_disruption_index"], 1)

    diff_analysis = {
        "delta_composite_stress": delta_stress,
        "delta_physiological_arousal": delta_arousal,
        "delta_circadian_disruption": delta_circadian,
        "primary_divergence_driver": (
            "Circadian & Sleep Debt" if abs(delta_circadian) > abs(delta_arousal) else "Autonomic / Arousal Surge"
        ),
        "synthetic_label": "SIMULATION COMPARISON",
    }

    pred_a = None
    pred_b = None
    delta_prob = None

    if ml_service.loaded:
        try:
            pred_a = ml_service.predict_panic_risk(
                hr_mean=req.scenario_a.heart_rate_bpm,
                hr_max=req.scenario_a.heart_rate_bpm + 25.0,
                hr_var=120.0,
                steps_mean=req.scenario_a.physical_activity_mins * 2.5,
                sleep_duration=req.scenario_a.sleep_hours,
                sleep_onset=-1.0,
                sleep_out=req.scenario_a.sleep_hours - 1.0,
                caffeine=req.scenario_a.caffeine_cups,
                alcohol=0.0,
                daily_anxiety=float(req.scenario_a.self_reported_anxiety),
                annoyance=float(min(10, req.scenario_a.recent_stress_exposure * 2)),
            )
            pred_b = ml_service.predict_panic_risk(
                hr_mean=req.scenario_b.heart_rate_bpm,
                hr_max=req.scenario_b.heart_rate_bpm + 25.0,
                hr_var=120.0,
                steps_mean=req.scenario_b.physical_activity_mins * 2.5,
                sleep_duration=req.scenario_b.sleep_hours,
                sleep_onset=-1.0,
                sleep_out=req.scenario_b.sleep_hours - 1.0,
                caffeine=req.scenario_b.caffeine_cups,
                alcohol=0.0,
                daily_anxiety=float(req.scenario_b.self_reported_anxiety),
                annoyance=float(min(10, req.scenario_b.recent_stress_exposure * 2)),
            )
            delta_prob = round(pred_b["predicted_probability"] - pred_a["predicted_probability"], 3)
        except Exception:
            pass

    comp_res = ScenarioComparisonResponse(
        scenario_a_result=state_a,
        scenario_b_result=state_b,
        differential_analysis=diff_analysis,
        scenario_a_prediction=pred_a,
        scenario_b_prediction=pred_b,
        delta_predicted_probability=delta_prob,
    )

    return explain_scenario_differences(
        scenario_a=req.scenario_a,
        scenario_b=req.scenario_b,
        profile=profile,
        comp_res=comp_res,
        seed=42,
        engine_version="2.0-adaptive",
    )


@router.post("/adaptive/counterfactual", response_model=CounterfactualPerturbationResponse)
def run_counterfactual_endpoint(
    req: CounterfactualPerturbationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Runs single-variable counterfactual exploration holding all other variables constant.
    Returns direct metric attribution deltas and formula explanations.
    """
    profile = _resolve_profile_for_simulation(req.baseline_profile_id, current_user, db)
    try:
        return run_counterfactual_analysis(req, profile)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid counterfactual input: {str(e)}")


@router.post("/replay", response_model=ScenarioReplayResponse)
def replay_deterministic_scenario(
    req: ScenarioReplayRequest,
):
    """
    Runs a deterministic multi-step diurnal timeline replay of the digital twin
    using a reproducible random seed.
    """
    profile = DEMO_PROFILES.get(req.baseline_profile_id, DEMO_PROFILES["DEMO-PATIENT-01"])
    return generate_deterministic_replay(req, profile)


@router.post("/comparison-report/pdf")
def export_scenario_comparison_pdf_endpoint(
    req: ScenarioComparisonPdfRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Generates a professional, publication-grade ReportLab PDF comparing Scenario A and B
    with prominent counterfactual synthetic data disclaimers.
    """
    profile = _resolve_profile_for_simulation(req.baseline_profile_id, current_user, db)

    state_a = DigitalTwinEngine.compute_twin_state(
        baseline=profile,
        current_hr=req.scenario_a.heart_rate_bpm,
        current_hrv=req.scenario_a.hrv_ms,
        current_sleep_hours=req.scenario_a.sleep_hours,
        current_caffeine_cups=req.scenario_a.caffeine_cups,
        current_anxiety_score=req.scenario_a.self_reported_anxiety,
    )

    state_b = DigitalTwinEngine.compute_twin_state(
        baseline=profile,
        current_hr=req.scenario_b.heart_rate_bpm,
        current_hrv=req.scenario_b.hrv_ms,
        current_sleep_hours=req.scenario_b.sleep_hours,
        current_caffeine_cups=req.scenario_b.caffeine_cups,
        current_anxiety_score=req.scenario_b.self_reported_anxiety,
    )

    delta_stress = round(state_b["composite_stress_index"] - state_a["composite_stress_index"], 1)
    delta_arousal = round(state_b["physiological_arousal_score"] - state_a["physiological_arousal_score"], 1)
    delta_circadian = round(state_b["circadian_disruption_index"] - state_a["circadian_disruption_index"], 1)

    diff_analysis = {
        "delta_composite_stress": delta_stress,
        "delta_physiological_arousal": delta_arousal,
        "delta_circadian_disruption": delta_circadian,
        "primary_divergence_driver": (
            "Circadian & Sleep Debt" if abs(delta_circadian) > abs(delta_arousal) else "Autonomic / Arousal Surge"
        ),
        "synthetic_label": "SIMULATION COMPARISON",
    }

    comp_resp = ScenarioComparisonResponse(
        scenario_a_result=state_a,
        scenario_b_result=state_b,
        differential_analysis=diff_analysis,
        scenario_a_prediction=None,
        scenario_b_prediction=None,
        delta_predicted_probability=None,
    )

    pdf_bytes = generate_scenario_comparison_pdf(
        scenario_a_name=req.scenario_a_name,
        scenario_b_name=req.scenario_b_name,
        input_a=req.scenario_a,
        input_b=req.scenario_b,
        profile_name=profile["name"],
        comparison=comp_resp,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=AnxietyTwin_Scenario_Comparison_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.pdf"
        },
    )


@router.post("/scenarios", status_code=status.HTTP_201_CREATED)
def save_scenario(
    scenario_in: SimulationScenarioCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = DEMO_PROFILES.get(scenario_in.baseline_patient_id, DEMO_PROFILES["DEMO-PATIENT-01"])
    state = DigitalTwinEngine.compute_twin_state(
        baseline=profile,
        current_hr=scenario_in.inputs.heart_rate_bpm,
        current_hrv=scenario_in.inputs.hrv_ms,
        current_sleep_hours=scenario_in.inputs.sleep_hours,
        current_caffeine_cups=scenario_in.inputs.caffeine_cups,
        current_anxiety_score=scenario_in.inputs.self_reported_anxiety,
    )

    tags_json = json.dumps(scenario_in.tags) if scenario_in.tags else None
    db_rec = SimulationScenario(
        user_id=current_user.id,
        name=scenario_in.name,
        description=scenario_in.description,
        baseline_patient_id=scenario_in.baseline_patient_id or "DEMO-PATIENT-01",
        modified_inputs_json=json.dumps(scenario_in.inputs.model_dump()),
        resulting_state_json=json.dumps(state),
        seed=scenario_in.seed or 42,
        scenario_type=scenario_in.scenario_type or "custom",
        version=scenario_in.version or "1.0",
        tags_json=tags_json,
    )
    db.add(db_rec)
    db.commit()
    db.refresh(db_rec)

    return {
        "id": db_rec.id,
        "name": db_rec.name,
        "created_at": db_rec.created_at.isoformat(),
        "state_label": state["state_label"],
        "seed": db_rec.seed,
        "scenario_type": db_rec.scenario_type,
    }


@router.get("/scenarios")
def list_saved_scenarios(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scenarios = db.query(SimulationScenario).filter(
        SimulationScenario.user_id == current_user.id
    ).order_by(SimulationScenario.created_at.desc()).all()

    out = []
    for s in scenarios:
        tags = []
        if s.tags_json:
            try:
                tags = json.loads(s.tags_json)
            except Exception:
                tags = []
        out.append({
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "baseline_patient_id": s.baseline_patient_id,
            "modified_inputs": json.loads(s.modified_inputs_json),
            "resulting_state": json.loads(s.resulting_state_json),
            "seed": s.seed or 42,
            "scenario_type": s.scenario_type or "custom",
            "version": s.version or "1.0",
            "tags": tags,
            "created_at": s.created_at.isoformat(),
        })
    return out


@router.delete("/scenarios/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_scenario(
    scenario_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Enforces tenant isolation: users can only delete scenarios they own.
    """
    scenario = db.query(SimulationScenario).filter(
        SimulationScenario.id == scenario_id,
        SimulationScenario.user_id == current_user.id,
    ).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Simulation scenario record not found.")

    db.delete(scenario)
    db.commit()
    return None
