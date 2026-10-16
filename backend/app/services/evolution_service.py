"""
AnxietyTwin - Digital Twin Longitudinal Evolution & Memory Service
Calculates multi-period baseline evolution strictly over genuine historical patient observations,
provides transparent, grounded explanations for baseline shifts, and manages minimal
explainable Digital Twin Memory without storing speculative psychological profiles.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
import json
import numpy as np
from sqlalchemy.orm import Session

from backend.app.models.db_models import (
    User,
    UserProfile,
    PhysiologicalObservation,
    LifestyleObservation,
    AnxietyCheckin,
    DigitalTwinMemory,
)
from backend.app.models.schemas import (
    BaselineEvolutionWindow,
    LongitudinalBaselineEvolutionOut,
    DigitalTwinMemoryOut,
)
from backend.app.services.twin_engine import DigitalTwinEngine


def get_longitudinal_baseline_evolution(
    user_id: int,
    db: Session,
    window_days: int = 7,
    max_windows: int = 4,
) -> LongitudinalBaselineEvolutionOut:
    """
    Computes longitudinal baseline progression over consecutive historical windows
    using ONLY genuine authentic patient records (excludes synthetic simulation traces).
    """
    # 1. Fetch authentic records only using strict whitelist (excludes synthetic, simulated, null, or unverified traces)
    physios = (
        db.query(PhysiologicalObservation)
        .filter(
            PhysiologicalObservation.user_id == user_id,
            PhysiologicalObservation.source_type.in_(DigitalTwinEngine.GENUINE_SOURCE_TYPES),
        )
        .order_by(PhysiologicalObservation.timestamp.asc())
        .all()
    )

    lifestyles = (
        db.query(LifestyleObservation)
        .filter(
            LifestyleObservation.user_id == user_id,
            LifestyleObservation.source_type.in_(DigitalTwinEngine.GENUINE_SOURCE_TYPES),
        )
        .order_by(LifestyleObservation.date.asc())
        .all()
    )

    checkins = (
        db.query(AnxietyCheckin)
        .filter(
            AnxietyCheckin.user_id == user_id,
            AnxietyCheckin.source_type.in_(DigitalTwinEngine.GENUINE_SOURCE_TYPES),
        )
        .order_by(AnxietyCheckin.timestamp.asc())
        .all()
    )

    user_profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    now = datetime.now(timezone.utc)

    windows: List[BaselineEvolutionWindow] = []
    change_explanations: List[str] = []

    # If no authentic data at all, return empty windows with clear cold-start notice
    total_authentic_count = len(physios) + len(lifestyles) + len(checkins)
    if total_authentic_count == 0:
        return LongitudinalBaselineEvolutionOut(
            user_id=user_id,
            current_baseline_version="v0.0-uncalibrated",
            calculation_timestamp=now.isoformat(),
            windows=[],
            change_explanations=[
                "No authentic historical observations recorded yet. Digital twin baseline is operating in cold-start mode.",
                "Log at least 5 observations across 3 distinct days to establish your first individualized empirical baseline.",
            ],
            has_sufficient_longitudinal_data=False,
            isolation_notice="HISTORICAL BASELINE OBSERVATIONS — EXCLUDES ALL SYNTHETIC SIMULATION SCENARIOS",
        )

    # 2. Slice observations into sequential multi-day windows (most recent backwards)
    for w_idx in range(max_windows):
        end_offset = w_idx * window_days
        start_offset = (w_idx + 1) * window_days
        w_end = now - timedelta(days=end_offset)
        w_start = now - timedelta(days=start_offset)
        w_start_str = w_start.strftime("%Y-%m-%d")
        w_end_str = w_end.strftime("%Y-%m-%d")

        # Filter observations within this window
        w_physios = [
            p for p in physios
            if p.timestamp and w_start <= p.timestamp.replace(tzinfo=timezone.utc if p.timestamp.tzinfo is None else p.timestamp.tzinfo) <= w_end
        ]

        w_lifestyles = []
        for l in lifestyles:
            l_date = None
            if l.date:
                try:
                    l_date = datetime.strptime(str(l.date), "%Y-%m-%d").replace(tzinfo=timezone.utc)
                except Exception:
                    pass
            elif l.created_at:
                l_date = l.created_at.replace(tzinfo=timezone.utc if l.created_at.tzinfo is None else l.created_at.tzinfo)
            if l_date and w_start <= l_date <= w_end:
                w_lifestyles.append(l)

        w_checkins = [
            c for c in checkins
            if c.timestamp and w_start <= c.timestamp.replace(tzinfo=timezone.utc if c.timestamp.tzinfo is None else c.timestamp.tzinfo) <= w_end
        ]

        w_total_obs = len(w_physios) + len(w_lifestyles) + len(w_checkins)

        # Unique days
        w_dates = set()
        for p in w_physios:
            if p.timestamp:
                w_dates.add(p.timestamp.strftime("%Y-%m-%d"))
        for l in w_lifestyles:
            if l.date:
                w_dates.add(str(l.date))
        for c in w_checkins:
            if c.timestamp:
                w_dates.add(c.timestamp.strftime("%Y-%m-%d"))

        unique_days = len(w_dates)
        is_sufficient = w_total_obs >= 5 and unique_days >= 3

        hrs = [p.heart_rate_bpm for p in w_physios if p.heart_rate_bpm]
        hrvs = [p.heart_rate_variability_ms for p in w_physios if p.heart_rate_variability_ms]
        sleeps = [l.sleep_hours for l in w_lifestyles if l.sleep_hours]
        caffs = [l.caffeine_cups for l in w_lifestyles if l.caffeine_cups is not None]
        anxs = [c.subjective_anxiety_score for c in w_checkins if c.subjective_anxiety_score is not None]

        mean_hr = round(float(np.mean(hrs)), 1) if hrs else None
        mean_hrv = round(float(np.mean(hrvs)), 1) if hrvs else None
        mean_sleep = round(float(np.mean(sleeps)), 1) if sleeps else None
        mean_caff = round(float(np.mean(caffs)), 1) if caffs else None
        mean_anx = round(float(np.mean(anxs)), 1) if anxs else None

        # Synthetic CSI for this window
        csi = None
        if mean_hr is not None or mean_hrv is not None or mean_sleep is not None or mean_anx is not None:
            pseudo_base = {
                "mean_resting_hr": user_profile.baseline_resting_hr or 72.0 if user_profile else 72.0,
                "std_resting_hr": 8.0,
                "mean_hrv_ms": user_profile.baseline_hrv_ms or 45.0 if user_profile else 45.0,
                "std_hrv_ms": 12.0,
                "mean_sleep_hours": user_profile.baseline_sleep_hours or 7.5 if user_profile else 7.5,
                "mean_caffeine_cups": user_profile.baseline_caffeine_cups or 1.0 if user_profile else 1.0,
                "mean_anxiety_score": 2.5,
            }
            twin_calc = DigitalTwinEngine.compute_twin_state(
                baseline=pseudo_base,
                current_hr=mean_hr,
                current_hrv=mean_hrv,
                current_sleep_hours=mean_sleep,
                current_caffeine_cups=mean_caff,
                current_anxiety_score=int(round(mean_anx)) if mean_anx is not None else None,
            )
            csi = twin_calc["composite_stress_index"]

        dq_notes = []
        if len(hrs) < 3:
            dq_notes.append("Limited resting heart rate telemetry in this window.")
        if len(hrvs) < 3:
            dq_notes.append("HRV rMSSD observations below calibration threshold (3+ needed).")
        if len(sleeps) < 3:
            dq_notes.append("Sleep duration logs below window threshold.")
        if not dq_notes:
            dq_notes.append("Multi-modal sensor coverage verified across window.")

        label = f"Period {w_idx + 1} ({w_start_str} to {w_end_str})" if w_idx > 0 else f"Current Window ({w_start_str} to {w_end_str})"

        windows.append(
            BaselineEvolutionWindow(
                window_label=label,
                start_date=w_start_str,
                end_date=w_end_str,
                observation_count=w_total_obs,
                unique_days=unique_days,
                mean_resting_hr=mean_hr,
                mean_hrv_ms=mean_hrv,
                mean_sleep_hours=mean_sleep,
                mean_caffeine_cups=mean_caff,
                mean_anxiety_score=mean_anx,
                composite_stress_index=csi,
                delta_vs_prior=None,  # Populated in pass 2
                provenance="authentic_patient_record",
                sufficient_data=is_sufficient,
                data_quality_notes=dq_notes,
            )
        )

    # 3. Calculate deltas between consecutive windows
    for i in range(len(windows) - 1):
        curr = windows[i]
        prior = windows[i + 1]
        deltas: Dict[str, Optional[float]] = {}

        if curr.mean_resting_hr is not None and prior.mean_resting_hr is not None:
            deltas["delta_resting_hr"] = round(curr.mean_resting_hr - prior.mean_resting_hr, 1)
        else:
            deltas["delta_resting_hr"] = None

        if curr.mean_hrv_ms is not None and prior.mean_hrv_ms is not None:
            deltas["delta_hrv_ms"] = round(curr.mean_hrv_ms - prior.mean_hrv_ms, 1)
        else:
            deltas["delta_hrv_ms"] = None

        if curr.mean_sleep_hours is not None and prior.mean_sleep_hours is not None:
            deltas["delta_sleep_hours"] = round(curr.mean_sleep_hours - prior.mean_sleep_hours, 1)
        else:
            deltas["delta_sleep_hours"] = None

        if curr.mean_anxiety_score is not None and prior.mean_anxiety_score is not None:
            deltas["delta_anxiety_score"] = round(curr.mean_anxiety_score - prior.mean_anxiety_score, 1)
        else:
            deltas["delta_anxiety_score"] = None

        if curr.composite_stress_index is not None and prior.composite_stress_index is not None:
            deltas["delta_csi"] = round(curr.composite_stress_index - prior.composite_stress_index, 1)
        else:
            deltas["delta_csi"] = None

        curr.delta_vs_prior = deltas

        # Generate explainable change notes
        if deltas.get("delta_resting_hr") is not None and abs(deltas["delta_resting_hr"]) >= 2.0:
            change_explanations.append(
                f"Resting HR shifted by {deltas['delta_resting_hr']:+} BPM from {prior.window_label} to {curr.window_label} "
                f"based on {curr.observation_count} authentic sensor observations."
            )
        if deltas.get("delta_hrv_ms") is not None and abs(deltas["delta_hrv_ms"]) >= 3.0:
            change_explanations.append(
                f"Autonomic tone (HRV rMSSD) shifted by {deltas['delta_hrv_ms']:+} ms between observation windows."
            )
        if deltas.get("delta_sleep_hours") is not None and abs(deltas["delta_sleep_hours"]) >= 0.5:
            change_explanations.append(
                f"Average sleep duration shifted by {deltas['delta_sleep_hours']:+}h ({prior.mean_sleep_hours}h -> {curr.mean_sleep_hours}h)."
            )

    if not change_explanations:
        change_explanations.append(
            "Historical baseline averages remained in homeostatic equilibrium across measured windows."
        )

    change_explanations.append(
        "Evolution reflects strictly authentic historical observations and validated arithmetic baselines. "
        "The digital twin does NOT infer unsupported psychological traits or alter the production ML model weights."
    )

    has_suff = any(w.sufficient_data for w in windows)
    curr_version = f"v2.0-{now.strftime('%Y%W')}"

    return LongitudinalBaselineEvolutionOut(
        user_id=user_id,
        current_baseline_version=curr_version,
        calculation_timestamp=now.isoformat(),
        windows=windows,
        change_explanations=change_explanations,
        has_sufficient_longitudinal_data=has_suff,
        isolation_notice="HISTORICAL BASELINE OBSERVATIONS — EXCLUDES ALL SYNTHETIC SIMULATION SCENARIOS",
    )


def record_digital_twin_memory(
    user_id: int,
    baseline_version: str,
    metrics: Dict[str, Any],
    observation_count: int,
    source_refs: List[Any],
    db: Session,
    notes: Optional[str] = None,
) -> DigitalTwinMemory:
    """
    Saves minimal explainable memory record representing an authentic calculated baseline version.
    Contains no speculative personality or clinical diagnoses.
    """
    now = datetime.now(timezone.utc)
    # Check if an active memory record already exists for this user and baseline version
    existing = (
        db.query(DigitalTwinMemory)
        .filter(
            DigitalTwinMemory.user_id == user_id,
            DigitalTwinMemory.baseline_version == baseline_version,
            DigitalTwinMemory.is_active == True,
        )
        .first()
    )
    if existing:
        existing.metrics_included_json = json.dumps(metrics)
        existing.observation_count = observation_count
        existing.source_record_references_json = json.dumps(source_refs)
        existing.calculation_timestamp = now
        if notes:
            existing.notes = notes
        db.commit()
        db.refresh(existing)
        return existing

    mem = DigitalTwinMemory(
        user_id=user_id,
        baseline_version=baseline_version,
        reference_period_start=now - timedelta(days=30),
        reference_period_end=now,
        calculation_timestamp=now,
        calculation_version="2.0-adaptive",
        observation_count=observation_count,
        metrics_included_json=json.dumps(metrics),
        source_record_references_json=json.dumps(source_refs),
        is_active=True,
        notes=notes or "Empirical multi-modal longitudinal baseline calculated from genuine user telemetry.",
    )
    db.add(mem)
    db.commit()
    db.refresh(mem)
    return mem


def get_digital_twin_memories(user_id: int, db: Session) -> List[DigitalTwinMemory]:
    """
    Retrieves stored digital twin memory records for an authenticated user.
    """
    return (
        db.query(DigitalTwinMemory)
        .filter(DigitalTwinMemory.user_id == user_id, DigitalTwinMemory.is_active == True)
        .order_by(DigitalTwinMemory.calculation_timestamp.desc())
        .all()
    )


def reset_digital_twin_memory(user_id: int, db: Session) -> Dict[str, Any]:
    """
    Safely deactivates or clears derived digital twin memory snapshots
    WITHOUT deleting authentic physiological or lifestyle observations.
    """
    memories = db.query(DigitalTwinMemory).filter(DigitalTwinMemory.user_id == user_id).all()
    deactivated_count = len(memories)
    for m in memories:
        m.is_active = False

    db.commit()

    return {
        "status": "success",
        "message": f"Successfully reset {deactivated_count} derived Digital Twin memory snapshots.",
        "authentic_records_preserved": True,
        "detail": (
            "Derived personalization baselines were reset to cold-start state. "
            "All genuine medical observations, check-ins, and account credentials remain intact."
        ),
    }
