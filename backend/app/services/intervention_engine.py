"""
intervention_engine.py - AnxietyTwin Early-Warning & Personalized Intervention Engine

Connects longitudinal observations, personal baselines, digital twin state,
and evidence-based supportive wellness activities into one continuous workflow.

Key Design Principles:
1. Transparent, explainable rule-based signal detection with configurable thresholds.
2. Honest handling of data sufficiency and cold-start calibration.
3. Every insight card exposes exact underlying records, timestamps, and provenance.
4. Non-causal scientific disclaimers: Experimental indicators, NOT medical diagnoses or panic predictors.
5. Personalized supportive interventions: 4-7-8 Breathing, 5-4-3-2-1 Grounding, Sleep Hygiene, Check-in.
6. Before-and-after distress rating feedback loop with persistent storage.
7. Symmetric support for genuine patient data and simulation lab scenarios without contamination.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
import numpy as np
from sqlalchemy.orm import Session

from backend.app.models.db_models import (
    User,
    UserProfile,
    PhysiologicalObservation,
    LifestyleObservation,
    AnxietyCheckin,
    TwinStateSnapshot,
    InterventionSession,
)
from backend.app.models.schemas import (
    BaselineComparisonMetric,
    EarlyWarningSignal,
    InterventionRecommendation,
    InterventionsStatusOut,
)
from backend.app.services.twin_engine import DigitalTwinEngine


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def make_aware(dt: Optional[datetime]) -> datetime:
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def map_provenance(source_type: Optional[str]) -> str:
    """Standardizes observation source into measured, user_reported, or simulated."""
    if not source_type:
        return "user_reported"
    st = source_type.lower()
    if st in ["device_measurement", "measured", "sensor"]:
        return "measured"
    if st in ["simulated", "synthetic"]:
        return "simulated"
    return "user_reported"


class InterventionEngine:
    # Configurable detection thresholds
    HR_ELEVATION_THRESHOLD_BPM = 5.0
    HRV_REDUCTION_THRESHOLD_MS = -5.0
    SLEEP_DEBT_THRESHOLD_HOURS = -1.5
    MIN_SLEEP_HOURS_ABSOLUTE = 6.0
    DISTRESS_ELEVATION_DELTA = 2.0
    ACUTE_DISTRESS_THRESHOLD_SCORE = 6.0

    @classmethod
    def evaluate_user_status(
        cls,
        user: User,
        db: Session,
        window_hours: int = 72,
    ) -> InterventionsStatusOut:
        """
        Evaluates the user's recent observations against their empirical baseline,
        detects early-warning signals, and generates personalized recommendations.
        """
        now = utc_now()
        window_start = now - timedelta(hours=window_hours)

        # 1. Fetch user profile
        profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        if not profile:
            profile = UserProfile(user_id=user.id)
            db.add(profile)
            db.commit()

        # 2. Fetch all historical observations for baseline
        physios = db.query(PhysiologicalObservation).filter(
            PhysiologicalObservation.user_id == user.id
        ).order_by(PhysiologicalObservation.timestamp.asc()).all()

        lifestyles = db.query(LifestyleObservation).filter(
            LifestyleObservation.user_id == user.id
        ).order_by(LifestyleObservation.date.asc()).all()

        checkins = db.query(AnxietyCheckin).filter(
            AnxietyCheckin.user_id == user.id
        ).order_by(AnxietyCheckin.timestamp.asc()).all()

        # 3. Calculate personal baseline
        baseline = DigitalTwinEngine.calculate_personal_baseline(
            profile=profile,
            historical_physio=physios,
            historical_lifestyle=lifestyles,
            historical_checkins=checkins,
        )

        has_baseline = baseline.get("has_sufficient_data", False)
        is_cold_start = not has_baseline

        # 4. Extract recent observations within evaluation window
        recent_physios = [p for p in physios if make_aware(p.timestamp) >= window_start]
        # Fallback to latest observation if none in recent window
        latest_physio = physios[-1] if physios else None
        latest_lifestyle = lifestyles[-1] if lifestyles else None
        latest_checkin = checkins[-1] if checkins else None

        # 5. Build Baseline Comparison Metrics
        metrics: List[BaselineComparisonMetric] = []
        insufficient_reasons: List[str] = []

        # --- A. Resting Heart Rate ---
        base_hr = baseline.get("mean_resting_hr")
        recent_hrs = [p.heart_rate_bpm for p in (recent_physios or ([latest_physio] if latest_physio else [])) if p and p.heart_rate_bpm]
        curr_hr = float(np.mean(recent_hrs)) if recent_hrs else (latest_physio.heart_rate_bpm if latest_physio and latest_physio.heart_rate_bpm else None)
        
        hr_metric = cls._build_hr_metric(curr_hr, base_hr, physios, latest_physio, has_baseline)
        metrics.append(hr_metric)
        if hr_metric.status == "insufficient_data":
            insufficient_reasons.append("Heart rate baseline requires >= 3 physiological readings.")

        # --- B. Parasympathetic Tone (HRV rMSSD) ---
        base_hrv = baseline.get("mean_hrv_ms")
        recent_hrvs = [p.heart_rate_variability_ms for p in (recent_physios or ([latest_physio] if latest_physio else [])) if p and p.heart_rate_variability_ms]
        curr_hrv = float(np.mean(recent_hrvs)) if recent_hrvs else (latest_physio.heart_rate_variability_ms if latest_physio and latest_physio.heart_rate_variability_ms else None)
        
        hrv_metric = cls._build_hrv_metric(curr_hrv, base_hrv, physios, latest_physio, has_baseline)
        metrics.append(hrv_metric)
        if hrv_metric.status == "insufficient_data":
            insufficient_reasons.append("HRV rMSSD baseline requires >= 3 autonomic readings.")

        # --- C. Sleep Duration ---
        base_sleep = baseline.get("mean_sleep_hours")
        curr_sleep = latest_lifestyle.sleep_hours if latest_lifestyle else None
        sleep_metric = cls._build_sleep_metric(curr_sleep, base_sleep, lifestyles, latest_lifestyle, has_baseline)
        metrics.append(sleep_metric)
        if sleep_metric.status == "insufficient_data":
            insufficient_reasons.append("Sleep baseline requires >= 3 recorded sleep logs.")

        # --- D. Sleep Regularity ---
        sleep_reg_metric = cls._build_sleep_regularity_metric(lifestyles, has_baseline)
        metrics.append(sleep_reg_metric)

        # --- E. Daily Steps / Physical Activity ---
        recent_steps = [p.steps_count for p in (recent_physios or ([latest_physio] if latest_physio else [])) if p and p.steps_count is not None]
        curr_steps = float(np.mean(recent_steps)) if recent_steps else (float(latest_physio.steps_count) if latest_physio and latest_physio.steps_count is not None else None)
        steps_metric = cls._build_steps_metric(curr_steps, physios, latest_physio)
        metrics.append(steps_metric)

        # --- F. Subjective Distress ---
        base_distress = baseline.get("mean_anxiety_score", 2.5) or 2.5
        curr_distress = float(latest_checkin.subjective_anxiety_score) if latest_checkin else None
        distress_metric = cls._build_distress_metric(curr_distress, base_distress, checkins, latest_checkin, has_baseline)
        metrics.append(distress_metric)
        if distress_metric.status == "insufficient_data":
            insufficient_reasons.append("Subjective distress baseline requires >= 3 check-in entries.")

        # 6. Evaluate Early-Warning Signals
        signals: List[EarlyWarningSignal] = []

        # Signal 1: Autonomic Heart Rate Elevation
        hr_signal = cls._detect_hr_signal(hr_metric, physios, latest_physio, has_baseline)
        signals.append(hr_signal)

        # Signal 2: Parasympathetic HRV Suppression
        hrv_signal = cls._detect_hrv_signal(hrv_metric, physios, latest_physio, has_baseline)
        signals.append(hrv_signal)

        # Signal 3: Sleep Debt & Rhythm Disruption
        sleep_signal = cls._detect_sleep_signal(sleep_metric, lifestyles, latest_lifestyle, has_baseline)
        signals.append(sleep_signal)

        # Signal 4: Subjective Distress Surge
        distress_signal = cls._detect_distress_signal(distress_metric, checkins, latest_checkin, has_baseline)
        signals.append(distress_signal)

        # Signal 5: Composite Autonomic & Subjective Strain
        composite_signal = cls._detect_composite_signal(hr_signal, hrv_signal, distress_signal, latest_physio, latest_checkin, has_baseline)
        if composite_signal:
            signals.insert(0, composite_signal)  # Highest priority at top

        # Signal 6: Unclear or Contradictory Observations
        contradictory_signal = cls._detect_contradictory_signal(hr_signal, hrv_signal, distress_signal, latest_physio, latest_checkin, has_baseline)
        if contradictory_signal:
            signals.append(contradictory_signal)

        # 7. Generate Personalized Intervention Recommendations
        recommendations = cls._generate_recommendations(signals, metrics, is_cold_start)

        baseline_status_label = "Empirical Baseline Active" if has_baseline else "Cold-Start Calibration"

        return InterventionsStatusOut(
            baseline_status=baseline_status_label,
            is_cold_start=is_cold_start,
            metrics=metrics,
            signals=signals,
            recommendations=recommendations,
            insufficient_data_reasons=insufficient_reasons,
        )

    # -------------------------------------------------------------------------
    # Metric Builders
    # -------------------------------------------------------------------------

    @classmethod
    def _build_hr_metric(cls, curr: Optional[float], base: Optional[float], physios: List[Any], latest: Any, has_base: bool) -> BaselineComparisonMetric:
        ts = latest.timestamp.isoformat() if latest and latest.timestamp else None
        provenance = map_provenance(getattr(latest, "source_type", "user_entered") if latest else "user_entered")
        count = len([p for p in physios if p.heart_rate_bpm is not None])
        eff_base = base if base is not None else 72.0

        if curr is None:
            return BaselineComparisonMetric(
                metric_key="heart_rate",
                metric_name="Resting Heart Rate",
                current_value=None,
                baseline_value=round(eff_base, 1),
                delta_value=None,
                unit="BPM",
                trend="unknown",
                status="insufficient_data",
                observations_count=count,
                provenance=provenance,
                latest_timestamp=ts,
            )

        delta = round(curr - eff_base, 1)
        if delta >= cls.HR_ELEVATION_THRESHOLD_BPM:
            trend = "elevated"
            status = "change_detected"
        elif delta <= -cls.HR_ELEVATION_THRESHOLD_BPM:
            trend = "reduced"
            status = "within_range"
        else:
            trend = "stable"
            status = "within_range"

        return BaselineComparisonMetric(
            metric_key="heart_rate",
            metric_name="Resting Heart Rate",
            current_value=round(curr, 1),
            baseline_value=round(eff_base, 1),
            delta_value=delta,
            unit="BPM",
            trend=trend,
            status=status,
            observations_count=count,
            provenance=provenance,
            latest_timestamp=ts,
        )

    @classmethod
    def _build_hrv_metric(cls, curr: Optional[float], base: Optional[float], physios: List[Any], latest: Any, has_base: bool) -> BaselineComparisonMetric:
        ts = latest.timestamp.isoformat() if latest and latest.timestamp else None
        provenance = map_provenance(getattr(latest, "source_type", "user_entered") if latest else "user_entered")
        count = len([p for p in physios if p.heart_rate_variability_ms is not None])
        eff_base = base if base is not None else 45.0

        if curr is None:
            return BaselineComparisonMetric(
                metric_key="hrv",
                metric_name="Parasympathetic Tone (HRV rMSSD)",
                current_value=None,
                baseline_value=round(eff_base, 1),
                delta_value=None,
                unit="ms",
                trend="unknown",
                status="insufficient_data",
                observations_count=count,
                provenance=provenance,
                latest_timestamp=ts,
            )

        delta = round(curr - eff_base, 1)
        if delta <= cls.HRV_REDUCTION_THRESHOLD_MS:
            trend = "reduced"
            status = "change_detected"
        elif delta >= abs(cls.HRV_REDUCTION_THRESHOLD_MS):
            trend = "elevated"
            status = "within_range"
        else:
            trend = "stable"
            status = "within_range"

        return BaselineComparisonMetric(
            metric_key="hrv",
            metric_name="Parasympathetic Tone (HRV rMSSD)",
            current_value=round(curr, 1),
            baseline_value=round(eff_base, 1),
            delta_value=delta,
            unit="ms",
            trend=trend,
            status=status,
            observations_count=count,
            provenance=provenance,
            latest_timestamp=ts,
        )

    @classmethod
    def _build_sleep_metric(cls, curr: Optional[float], base: Optional[float], lifestyles: List[Any], latest: Any, has_base: bool) -> BaselineComparisonMetric:
        ts = latest.created_at.isoformat() if latest and latest.created_at else None
        provenance = map_provenance(getattr(latest, "source_type", "user_entered") if latest else "user_entered")
        count = len([l for l in lifestyles if l.sleep_hours is not None])
        eff_base = base if base is not None else 7.5

        if curr is None:
            return BaselineComparisonMetric(
                metric_key="sleep_duration",
                metric_name="Sleep Duration",
                current_value=None,
                baseline_value=round(eff_base, 1),
                delta_value=None,
                unit="hours",
                trend="unknown",
                status="insufficient_data",
                observations_count=count,
                provenance=provenance,
                latest_timestamp=ts,
            )

        delta = round(curr - eff_base, 1)
        if delta <= cls.SLEEP_DEBT_THRESHOLD_HOURS or curr < cls.MIN_SLEEP_HOURS_ABSOLUTE:
            trend = "disrupted"
            status = "change_detected"
        elif delta >= 1.5:
            trend = "elevated"
            status = "within_range"
        else:
            trend = "stable"
            status = "within_range"

        return BaselineComparisonMetric(
            metric_key="sleep_duration",
            metric_name="Sleep Duration",
            current_value=round(curr, 1),
            baseline_value=round(eff_base, 1),
            delta_value=delta,
            unit="hours",
            trend=trend,
            status=status,
            observations_count=count,
            provenance=provenance,
            latest_timestamp=ts,
        )

    @classmethod
    def _build_sleep_regularity_metric(cls, lifestyles: List[Any], has_base: bool) -> BaselineComparisonMetric:
        sleep_vals = [l.sleep_hours for l in lifestyles if l.sleep_hours is not None]
        count = len(sleep_vals)
        if count < 3:
            return BaselineComparisonMetric(
                metric_key="sleep_regularity",
                metric_name="Sleep Regularity (Variance)",
                current_value=None,
                baseline_value=None,
                delta_value=None,
                unit="std dev (h)",
                trend="unknown",
                status="insufficient_data",
                observations_count=count,
                provenance="user_reported",
                latest_timestamp=None,
            )

        std_dev = round(float(np.std(sleep_vals)), 1)
        trend = "disrupted" if std_dev >= 1.5 else "stable"
        status = "change_detected" if std_dev >= 1.5 else "within_range"

        return BaselineComparisonMetric(
            metric_key="sleep_regularity",
            metric_name="Sleep Regularity (Variance)",
            current_value=std_dev,
            baseline_value=0.8,
            delta_value=round(std_dev - 0.8, 1),
            unit="std dev (h)",
            trend=trend,
            status=status,
            observations_count=count,
            provenance="user_reported",
            latest_timestamp=lifestyles[-1].created_at.isoformat() if lifestyles[-1].created_at else None,
        )

    @classmethod
    def _build_steps_metric(cls, curr: Optional[float], physios: List[Any], latest: Any) -> BaselineComparisonMetric:
        count = len([p for p in physios if p.steps_count is not None])
        ts = latest.timestamp.isoformat() if latest and latest.timestamp else None
        provenance = map_provenance(getattr(latest, "source_type", "user_entered") if latest else "user_entered")

        if curr is None:
            return BaselineComparisonMetric(
                metric_key="physical_activity",
                metric_name="Physical Activity (Daily Steps)",
                current_value=None,
                baseline_value=6000.0,
                delta_value=None,
                unit="steps",
                trend="unknown",
                status="insufficient_data",
                observations_count=count,
                provenance=provenance,
                latest_timestamp=ts,
            )

        delta = round(curr - 6000.0, 0)
        trend = "reduced" if delta < -2500 else ("elevated" if delta > 2500 else "stable")

        return BaselineComparisonMetric(
            metric_key="physical_activity",
            metric_name="Physical Activity (Daily Steps)",
            current_value=round(curr, 0),
            baseline_value=6000.0,
            delta_value=delta,
            unit="steps",
            trend=trend,
            status="within_range",
            observations_count=count,
            provenance=provenance,
            latest_timestamp=ts,
        )

    @classmethod
    def _build_distress_metric(cls, curr: Optional[float], base: Optional[float], checkins: List[Any], latest: Any, has_base: bool) -> BaselineComparisonMetric:
        ts = latest.timestamp.isoformat() if latest and latest.timestamp else None
        provenance = map_provenance(getattr(latest, "source_type", "user_reported") if latest else "user_reported")
        count = len(checkins)
        eff_base = base if base is not None else 2.5

        if curr is None:
            return BaselineComparisonMetric(
                metric_key="subjective_distress",
                metric_name="Subjective Distress Rating",
                current_value=None,
                baseline_value=round(eff_base, 1),
                delta_value=None,
                unit="rating (0-10)",
                trend="unknown",
                status="insufficient_data",
                observations_count=count,
                provenance=provenance,
                latest_timestamp=ts,
            )

        delta = round(curr - eff_base, 1)
        if curr >= cls.ACUTE_DISTRESS_THRESHOLD_SCORE or delta >= cls.DISTRESS_ELEVATION_DELTA:
            trend = "elevated"
            status = "change_detected"
        elif delta <= -1.5:
            trend = "reduced"
            status = "within_range"
        else:
            trend = "stable"
            status = "within_range"

        return BaselineComparisonMetric(
            metric_key="subjective_distress",
            metric_name="Subjective Distress Rating",
            current_value=round(curr, 1),
            baseline_value=round(eff_base, 1),
            delta_value=delta,
            unit="rating (0-10)",
            trend=trend,
            status=status,
            observations_count=count,
            provenance=provenance,
            latest_timestamp=ts,
        )

    # -------------------------------------------------------------------------
    # Signal Detectors
    # -------------------------------------------------------------------------

    @classmethod
    def _detect_hr_signal(cls, m: BaselineComparisonMetric, physios: List[Any], latest: Any, has_base: bool) -> EarlyWarningSignal:
        if m.status == "insufficient_data":
            return EarlyWarningSignal(
                signal_id="sig_hr_insuff",
                signal_type="elevated_heart_rate",
                title="Autonomic Heart Rate Signal",
                level="Insufficient Data",
                what_changed="Resting heart rate baseline is not yet established.",
                why_flagged="Requires at least 3 physiological resting observations across multiple calendar days.",
                evidence_summary=f"Logged {m.observations_count} observations. Cold-start calibration active.",
                current_value=m.current_value,
                baseline_value=m.baseline_value,
                delta=None,
                unit="BPM",
                timestamps=[m.latest_timestamp] if m.latest_timestamp else [],
                supporting_record_ids=[f"physio_{p.id}" for p in physios[:3]],
                data_quality="Cold-start calibration; insufficient readings for personal calibration.",
                data_provenance=m.provenance,
                suggested_activity="Log regular morning resting check-ins with pulse reading.",
                suggested_intervention_type="checkin_prompt",
                limitations="Observational association does not establish causation. Not a clinical diagnostic indicator.",
            )

        if m.status == "change_detected":
            rec_ids = [f"physio_{p.id}" for p in physios[-3:]]
            ts = [p.timestamp.isoformat() for p in physios[-3:] if p.timestamp]
            return EarlyWarningSignal(
                signal_id="sig_hr_elevated",
                signal_type="elevated_heart_rate",
                title="Elevated Resting Heart Rate",
                level="Change Detected",
                what_changed=f"Recent resting heart rate ({m.current_value} BPM) is elevated relative to personal baseline ({m.baseline_value} BPM).",
                why_flagged=f"Observed difference (+{m.delta_value} BPM) exceeds the empirical stability threshold (>= +{cls.HR_ELEVATION_THRESHOLD_BPM} BPM).",
                evidence_summary=f"Current: {m.current_value} BPM vs Baseline: {m.baseline_value} BPM (+{m.delta_value} BPM shift).",
                current_value=m.current_value,
                baseline_value=m.baseline_value,
                delta=m.delta_value,
                unit="BPM",
                timestamps=ts,
                supporting_record_ids=rec_ids,
                data_quality=f"Calculated from {m.observations_count} longitudinal records.",
                data_provenance=m.provenance,
                suggested_activity="Engage in 4-7-8 Paced Diaphragmatic Breathing to activate parasympathetic feedback.",
                suggested_intervention_type="breathing_478",
                limitations="Observational association does not establish causation. Physiological arousal does not confirm anxiety or panic attacks.",
            )

        return EarlyWarningSignal(
            signal_id="sig_hr_range",
            signal_type="elevated_heart_rate",
            title="Resting Heart Rate within Range",
            level="Within Personal Range",
            what_changed="Resting heart rate is concordant with established individual baseline.",
            why_flagged=f"Observed delta ({m.delta_value:+0.1f} BPM) is within expected normal physiological bounds (+/- {cls.HR_ELEVATION_THRESHOLD_BPM} BPM).",
            evidence_summary=f"Current: {m.current_value} BPM vs Baseline: {m.baseline_value} BPM.",
            current_value=m.current_value,
            baseline_value=m.baseline_value,
            delta=m.delta_value,
            unit="BPM",
            timestamps=[m.latest_timestamp] if m.latest_timestamp else [],
            supporting_record_ids=[f"physio_{latest.id}"] if latest else [],
            data_quality="High reliability with longitudinal concordance.",
            data_provenance=m.provenance,
            suggested_activity="Maintain routine monitoring.",
            suggested_intervention_type="routine_monitoring",
            limitations="Observational association does not establish causation.",
        )

    @classmethod
    def _detect_hrv_signal(cls, m: BaselineComparisonMetric, physios: List[Any], latest: Any, has_base: bool) -> EarlyWarningSignal:
        if m.status == "insufficient_data":
            return EarlyWarningSignal(
                signal_id="sig_hrv_insuff",
                signal_type="reduced_hrv",
                title="Parasympathetic Tone Signal",
                level="Insufficient Data",
                what_changed="HRV rMSSD personal baseline not yet calibrated.",
                why_flagged="Requires at least 3 longitudinal autonomic observations.",
                evidence_summary=f"Recorded {m.observations_count} HRV observations.",
                current_value=m.current_value,
                baseline_value=m.baseline_value,
                delta=None,
                unit="ms",
                timestamps=[m.latest_timestamp] if m.latest_timestamp else [],
                supporting_record_ids=[f"physio_{p.id}" for p in physios[:3]],
                data_quality="Cold-start calibration in progress.",
                data_provenance=m.provenance,
                suggested_activity="Record resting autonomic readings when convenient.",
                suggested_intervention_type="checkin_prompt",
                limitations="Observational association does not establish causation.",
            )

        if m.status == "change_detected":
            rec_ids = [f"physio_{p.id}" for p in physios[-3:]]
            ts = [p.timestamp.isoformat() for p in physios[-3:] if p.timestamp]
            return EarlyWarningSignal(
                signal_id="sig_hrv_reduced",
                signal_type="reduced_hrv",
                title="Reduced Parasympathetic Tone (HRV rMSSD)",
                level="Change Detected",
                what_changed=f"Recent HRV rMSSD ({m.current_value} ms) shows vagal withdrawal compared to baseline ({m.baseline_value} ms).",
                why_flagged=f"Observed drop ({m.delta_value} ms) exceeds the physiological tolerance threshold (<= {cls.HRV_REDUCTION_THRESHOLD_MS} ms).",
                evidence_summary=f"Current: {m.current_value} ms vs Baseline: {m.baseline_value} ms ({m.delta_value} ms delta).",
                current_value=m.current_value,
                baseline_value=m.baseline_value,
                delta=m.delta_value,
                unit="ms",
                timestamps=ts,
                supporting_record_ids=rec_ids,
                data_quality="Derived from chronologically sequenced autonomic readings.",
                data_provenance=m.provenance,
                suggested_activity="Try 5-4-3-2-1 Sensory Grounding or Paced Breathing to ease autonomic tension.",
                suggested_intervention_type="grounding_54321",
                limitations="Observational association does not establish causation. Lower HRV can result from exercise, caffeine, or digestion.",
            )

        return EarlyWarningSignal(
            signal_id="sig_hrv_range",
            signal_type="reduced_hrv",
            title="Parasympathetic Tone within Range",
            level="Within Personal Range",
            what_changed="HRV rMSSD is consistent with individual resting vagal activity.",
            why_flagged=f"Current delta ({m.delta_value:+0.1f} ms) remains within personal reference limits.",
            evidence_summary=f"Current: {m.current_value} ms vs Baseline: {m.baseline_value} ms.",
            current_value=m.current_value,
            baseline_value=m.baseline_value,
            delta=m.delta_value,
            unit="ms",
            timestamps=[m.latest_timestamp] if m.latest_timestamp else [],
            supporting_record_ids=[f"physio_{latest.id}"] if latest else [],
            data_quality="Concordant longitudinal observations.",
            data_provenance=m.provenance,
            suggested_activity="Continue routine baseline tracking.",
            suggested_intervention_type="routine_monitoring",
            limitations="Observational association does not establish causation.",
        )

    @classmethod
    def _detect_sleep_signal(cls, m: BaselineComparisonMetric, lifestyles: List[Any], latest: Any, has_base: bool) -> EarlyWarningSignal:
        if m.status == "insufficient_data":
            return EarlyWarningSignal(
                signal_id="sig_sleep_insuff",
                signal_type="disrupted_sleep",
                title="Circadian Sleep Signal",
                level="Insufficient Data",
                what_changed="Sleep baseline not yet established.",
                why_flagged="Requires at least 3 logged sleep nights to establish individual sleep duration expectation.",
                evidence_summary=f"Recorded {m.observations_count} sleep entries.",
                current_value=m.current_value,
                baseline_value=m.baseline_value,
                delta=None,
                unit="hours",
                timestamps=[m.latest_timestamp] if m.latest_timestamp else [],
                supporting_record_ids=[f"lifestyle_{l.id}" for l in lifestyles[:3]],
                data_quality="Cold-start calibration active.",
                data_provenance=m.provenance,
                suggested_activity="Log your recent wake time and sleep duration in your daily check-in.",
                suggested_intervention_type="checkin_prompt",
                limitations="Observational association does not establish causation.",
            )

        if m.status == "change_detected":
            rec_ids = [f"lifestyle_{l.id}" for l in lifestyles[-3:]]
            ts = [l.created_at.isoformat() for l in lifestyles[-3:] if l.created_at]
            return EarlyWarningSignal(
                signal_id="sig_sleep_debt",
                signal_type="disrupted_sleep",
                title="Sleep Debt & Circadian Disruption",
                level="Change Detected",
                what_changed=f"Recorded sleep duration ({m.current_value} hours) fell below personal baseline ({m.baseline_value} hours).",
                why_flagged=f"Observed deficit ({m.delta_value} hours) indicates acute sleep debt (< {cls.MIN_SLEEP_HOURS_ABSOLUTE} hours total or <= {cls.SLEEP_DEBT_THRESHOLD_HOURS}h delta).",
                evidence_summary=f"Logged {m.current_value}h sleep vs personal average of {m.baseline_value}h.",
                current_value=m.current_value,
                baseline_value=m.baseline_value,
                delta=m.delta_value,
                unit="hours",
                timestamps=ts,
                supporting_record_ids=rec_ids,
                data_quality="Based on self-reported lifestyle logs.",
                data_provenance=m.provenance,
                suggested_activity="Review evidence-based Sleep Hygiene guidance to protect circadian recovery.",
                suggested_intervention_type="sleep_hygiene",
                limitations="Observational association does not establish causation. Sleep changes do not prove clinical insomnia or distress.",
            )

        return EarlyWarningSignal(
            signal_id="sig_sleep_range",
            signal_type="disrupted_sleep",
            title="Sleep Duration within Range",
            level="Within Personal Range",
            what_changed="Recorded sleep duration is in alignment with personal target.",
            why_flagged=f"Sleep deficit is negligible ({m.delta_value:+0.1f} hours vs baseline).",
            evidence_summary=f"Recent: {m.current_value}h vs Baseline: {m.baseline_value}h.",
            current_value=m.current_value,
            baseline_value=m.baseline_value,
            delta=m.delta_value,
            unit="hours",
            timestamps=[m.latest_timestamp] if m.latest_timestamp else [],
            supporting_record_ids=[f"lifestyle_{latest.id}"] if latest else [],
            data_quality="Concordant lifestyle logs.",
            data_provenance=m.provenance,
            suggested_activity="Maintain consistent wake time and evening routine.",
            suggested_intervention_type="routine_monitoring",
            limitations="Observational association does not establish causation.",
        )

    @classmethod
    def _detect_distress_signal(cls, m: BaselineComparisonMetric, checkins: List[Any], latest: Any, has_base: bool) -> EarlyWarningSignal:
        if m.status == "insufficient_data":
            return EarlyWarningSignal(
                signal_id="sig_distress_insuff",
                signal_type="increased_distress",
                title="Subjective Distress Trajectory",
                level="Insufficient Data",
                what_changed="Subjective distress baseline not yet established.",
                why_flagged="Requires at least 3 longitudinal mood check-ins.",
                evidence_summary=f"Logged {m.observations_count} check-ins.",
                current_value=m.current_value,
                baseline_value=m.baseline_value,
                delta=None,
                unit="rating (0-10)",
                timestamps=[m.latest_timestamp] if m.latest_timestamp else [],
                supporting_record_ids=[f"checkin_{c.id}" for c in checkins[:3]],
                data_quality="Cold-start calibration active.",
                data_provenance=m.provenance,
                suggested_activity="Complete a quick 1-minute subjective check-in.",
                suggested_intervention_type="checkin_prompt",
                limitations="Observational association does not establish causation.",
            )

        if m.status == "change_detected":
            rec_ids = [f"checkin_{c.id}" for c in checkins[-2:]]
            ts = [c.timestamp.isoformat() for c in checkins[-2:] if c.timestamp]
            trigger_note = f" (Reported trigger: '{latest.triggers_noted}')" if latest and latest.triggers_noted else ""
            return EarlyWarningSignal(
                signal_id="sig_distress_surge",
                signal_type="increased_distress",
                title="Elevated Subjective Distress",
                level="Change Detected",
                what_changed=f"User-reported distress score ({m.current_value}/10) is elevated above personal baseline ({m.baseline_value}/10){trigger_note}.",
                why_flagged=f"Score is >= {cls.ACUTE_DISTRESS_THRESHOLD_SCORE}/10 or delta exceeds +{cls.DISTRESS_ELEVATION_DELTA} points above typical mood.",
                evidence_summary=f"Reported {m.current_value}/10 vs Baseline {m.baseline_value}/10 (+{m.delta_value} shift).",
                current_value=m.current_value,
                baseline_value=m.baseline_value,
                delta=m.delta_value,
                unit="rating (0-10)",
                timestamps=ts,
                supporting_record_ids=rec_ids,
                data_quality="User-reported subjective reflection.",
                data_provenance=m.provenance,
                suggested_activity="Try a 4-7-8 Breathing session or 5-4-3-2-1 Grounding exercise.",
                suggested_intervention_type="breathing_478",
                limitations="Observational association does not establish causation. Subjective distress ratings reflect temporary emotional state, not a psychiatric diagnosis.",
            )

        return EarlyWarningSignal(
            signal_id="sig_distress_range",
            signal_type="increased_distress",
            title="Subjective Distress within Range",
            level="Within Personal Range",
            what_changed="Reported distress level is consistent with typical baseline.",
            why_flagged=f"Score ({m.current_value}/10) is below acute tension threshold (<= 5/10).",
            evidence_summary=f"Reported: {m.current_value}/10 vs Baseline: {m.baseline_value}/10.",
            current_value=m.current_value,
            baseline_value=m.baseline_value,
            delta=m.delta_value,
            unit="rating (0-10)",
            timestamps=[m.latest_timestamp] if m.latest_timestamp else [],
            supporting_record_ids=[f"checkin_{latest.id}"] if latest else [],
            data_quality="Concordant self-reported data.",
            data_provenance=m.provenance,
            suggested_activity="Continue mindful reflection and periodic check-ins.",
            suggested_intervention_type="routine_monitoring",
            limitations="Observational association does not establish causation.",
        )

    @classmethod
    def _detect_composite_signal(
        cls,
        hr_sig: EarlyWarningSignal,
        hrv_sig: EarlyWarningSignal,
        dist_sig: EarlyWarningSignal,
        latest_physio: Any,
        latest_checkin: Any,
        has_base: bool,
    ) -> Optional[EarlyWarningSignal]:
        """
        Detects multi-modal autonomic + subjective strain when BOTH physiological arousal
        (elevated HR or suppressed HRV) AND high subjective distress are concurrently detected.
        """

        autonomic_arousal = hr_sig.level == "Change Detected" or hrv_sig.level == "Change Detected"
        subjective_strain = dist_sig.level == "Change Detected"

        if autonomic_arousal and subjective_strain:
            rec_ids = []
            if latest_physio:
                rec_ids.append(f"physio_{latest_physio.id}")
            if latest_checkin:
                rec_ids.append(f"checkin_{latest_checkin.id}")

            timestamps = []
            if latest_physio and latest_physio.timestamp:
                timestamps.append(latest_physio.timestamp.isoformat())
            if latest_checkin and latest_checkin.timestamp:
                timestamps.append(latest_checkin.timestamp.isoformat())

            return EarlyWarningSignal(
                signal_id="sig_composite_strain",
                signal_type="composite_autonomic_strain",
                title="Composite Autonomic & Subjective Strain",
                level="Change Detected",
                what_changed="Concurrent autonomic arousal and elevated subjective distress detected in recent records.",
                why_flagged="Both physiological markers (HR/HRV) and self-reported distress exceeded individual baseline thresholds.",
                evidence_summary=(
                    f"HR: {hr_sig.current_value} BPM ({hr_sig.delta:+0.1f}), "
                    f"HRV: {hrv_sig.current_value} ms ({hrv_sig.delta:+0.1f}), "
                    f"Distress: {dist_sig.current_value}/10 ({dist_sig.delta:+0.1f})."
                ),
                current_value=dist_sig.current_value,
                baseline_value=dist_sig.baseline_value,
                delta=dist_sig.delta,
                unit="composite",
                timestamps=timestamps,
                supporting_record_ids=rec_ids,
                data_quality="Multi-modal cross-validated observations (Physiological + Subjective).",
                data_provenance="multi_modal",
                suggested_activity="Start 5-4-3-2-1 Sensory Grounding followed by 4-7-8 Breathing Pacer.",
                suggested_intervention_type="grounding_54321",
                limitations="Observational association does not establish causation. This multi-metric indicator does NOT constitute medical validation or predict panic attacks.",
            )

        return None

    @classmethod
    def _detect_contradictory_signal(
        cls,
        hr_sig: EarlyWarningSignal,
        hrv_sig: EarlyWarningSignal,
        dist_sig: EarlyWarningSignal,
        latest_physio: Any,
        latest_checkin: Any,
        has_base: bool,
    ) -> Optional[EarlyWarningSignal]:
        """
        Detects unclear or contradictory observations when physiological autonomic arousal
        diverges from subjective distress ratings (e.g., autonomic tachycardia with very low distress,
        or acute subjective panic with calm resting baseline).
        """
        autonomic_arousal = hr_sig.level == "Change Detected" or hrv_sig.level == "Change Detected"
        distress_elevated = dist_sig.level == "Change Detected"

        # Case A: Autonomic arousal detected, but subjective distress is very low (<= 2/10) and within range
        if autonomic_arousal and dist_sig.current_value is not None and dist_sig.current_value <= 2.0 and not distress_elevated:
            rec_ids = []
            if latest_physio:
                rec_ids.append(f"physio_{latest_physio.id}")
            if latest_checkin:
                rec_ids.append(f"checkin_{latest_checkin.id}")

            timestamps = []
            if latest_physio and latest_physio.timestamp:
                timestamps.append(latest_physio.timestamp.isoformat())
            if latest_checkin and latest_checkin.timestamp:
                timestamps.append(latest_checkin.timestamp.isoformat())

            return EarlyWarningSignal(
                signal_id="sig_conflicting_observations",
                signal_type="conflicting_observations",
                title="Divergent Physiological & Subjective Signals",
                level="Change Detected",
                what_changed=(
                    f"Autonomic markers show physiological shift (HR: {hr_sig.current_value} BPM, HRV: {hrv_sig.current_value} ms), "
                    f"yet self-reported distress is low ({dist_sig.current_value}/10)."
                ),
                why_flagged="Physiological arousal without subjective distress frequently reflects exercise, caffeine, or digestion rather than psychological tension.",
                evidence_summary=(
                    f"Physiological delta: HR ({hr_sig.delta:+0.1f} BPM), HRV ({hrv_sig.delta:+0.1f} ms) vs "
                    f"Reported distress: {dist_sig.current_value}/10 (calm)."
                ),
                current_value=dist_sig.current_value,
                baseline_value=dist_sig.baseline_value,
                delta=dist_sig.delta,
                unit="rating (0-10)",
                timestamps=timestamps,
                supporting_record_ids=rec_ids,
                data_quality="Cross-modal verification: physiological and subjective streams diverge.",
                data_provenance="multi_modal",
                suggested_activity="Complete a quick 1-minute check-in to contextualize caffeine, physical exertion, or recent activity.",
                suggested_intervention_type="checkin_prompt",
                limitations="Observational association does not establish causation. Physiological changes alone do not diagnose anxiety or predict panic attacks.",
            )

        # Case B: High subjective distress reported (>= 6/10), but autonomic markers are within personal range
        if distress_elevated and dist_sig.current_value is not None and dist_sig.current_value >= cls.ACUTE_DISTRESS_THRESHOLD_SCORE and hr_sig.level == "Within Personal Range" and hrv_sig.level == "Within Personal Range":
            rec_ids = []
            if latest_physio:
                rec_ids.append(f"physio_{latest_physio.id}")
            if latest_checkin:
                rec_ids.append(f"checkin_{latest_checkin.id}")

            timestamps = []
            if latest_physio and latest_physio.timestamp:
                timestamps.append(latest_physio.timestamp.isoformat())
            if latest_checkin and latest_checkin.timestamp:
                timestamps.append(latest_checkin.timestamp.isoformat())

            return EarlyWarningSignal(
                signal_id="sig_conflicting_observations",
                signal_type="conflicting_observations",
                title="Subjective Distress without Autonomic Surge",
                level="Change Detected",
                what_changed=(
                    f"Self-reported distress is elevated ({dist_sig.current_value}/10), "
                    f"while resting autonomic markers remain stable (HR: {hr_sig.current_value} BPM, HRV: {hrv_sig.current_value} ms)."
                ),
                why_flagged="Subjective emotional tension is present without sympathetic autonomic hyperactivity, characteristic of cognitive worry or anticipatory fatigue.",
                evidence_summary=(
                    f"Reported distress: {dist_sig.current_value}/10 vs Autonomic: HR {hr_sig.current_value} BPM (delta {hr_sig.delta:+0.1f}), HRV {hrv_sig.current_value} ms."
                ),
                current_value=dist_sig.current_value,
                baseline_value=dist_sig.baseline_value,
                delta=dist_sig.delta,
                unit="rating (0-10)",
                timestamps=timestamps,
                supporting_record_ids=rec_ids,
                data_quality="Cross-modal verification: cognitive/subjective tension without autonomic tachycardia.",
                data_provenance="multi_modal",
                suggested_activity="Complete a check-in or try 5-4-3-2-1 Grounding to ease cognitive rumination.",
                suggested_intervention_type="checkin_prompt",
                limitations="Observational association does not establish causation. Subjective distress reflects perceived state, not a physiological emergency.",
            )

        return None

    # -------------------------------------------------------------------------
    # Personalized Intervention Recommendations
    # -------------------------------------------------------------------------

    @classmethod
    def _generate_recommendations(
        cls,
        signals: List[EarlyWarningSignal],
        metrics: List[BaselineComparisonMetric],
        is_cold_start: bool,
    ) -> List[InterventionRecommendation]:
        recs: List[InterventionRecommendation] = []

        # Find active signals
        composite = next((s for s in signals if s.signal_type == "composite_autonomic_strain" and s.level == "Change Detected"), None)
        conflicting = next((s for s in signals if s.signal_type == "conflicting_observations" and s.level == "Change Detected"), None)
        distress = next((s for s in signals if s.signal_type == "increased_distress" and s.level == "Change Detected"), None)
        hr = next((s for s in signals if s.signal_type == "elevated_heart_rate" and s.level == "Change Detected"), None)
        hrv = next((s for s in signals if s.signal_type == "reduced_hrv" and s.level == "Change Detected"), None)
        sleep = next((s for s in signals if s.signal_type == "disrupted_sleep" and s.level == "Change Detected"), None)

        if conflicting:
            recs.append(InterventionRecommendation(
                id="rec_checkin_conflicting",
                intervention_type="checkin_prompt",
                title="Contextual Check-In for Unclear Observations",
                description="Your physiological sensors and subjective ratings show diverging patterns. Complete a quick 1-minute check-in to clarify current context (caffeine, exercise, physical fatigue).",
                rational_summary="Recommended due to unclear or conflicting observations between autonomic and subjective indicators.",
                priority="high",
                estimated_duration_min=2,
                trigger_signal_id=conflicting.signal_id,
            ))

        if composite:
            recs.append(InterventionRecommendation(
                id="rec_grounding_composite",
                intervention_type="grounding_54321",
                title="5-4-3-2-1 Sensory Grounding",
                description="Interactive somatic grounding exercise engaging the 5 senses to disrupt sensory overwhelm and restore orienting attention.",
                rational_summary="Recommended due to concurrent autonomic arousal and elevated distress.",
                priority="high",
                estimated_duration_min=4,
                trigger_signal_id=composite.signal_id,
            ))
            recs.append(InterventionRecommendation(
                id="rec_breathing_composite",
                intervention_type="breathing_478",
                title="4-7-8 Breathing Pacer",
                description="Evidence-based diaphragmatic breathing technique (inhale 4s, hold 7s, exhale 8s) to stimulate vagal parasympathetic recovery.",
                rational_summary="Recommended to complement grounding and lower autonomic arousal.",
                priority="high",
                estimated_duration_min=5,
                trigger_signal_id=composite.signal_id,
            ))

        elif distress:
            recs.append(InterventionRecommendation(
                id="rec_breathing_distress",
                intervention_type="breathing_478",
                title="4-7-8 Breathing Pacer",
                description="Guided visual breathing pacer designed to down-regulate sympathetic tone during acute subjective distress.",
                rational_summary="Recommended based on recent self-reported distress surge.",
                priority="high",
                estimated_duration_min=5,
                trigger_signal_id=distress.signal_id,
            ))
            recs.append(InterventionRecommendation(
                id="rec_grounding_distress",
                intervention_type="grounding_54321",
                title="5-4-3-2-1 Sensory Grounding",
                description="Structured sensory checklist to gently shift focus away from catastrophic thoughts back to the immediate environment.",
                rational_summary="Alternative somatic stabilization option.",
                priority="moderate",
                estimated_duration_min=4,
                trigger_signal_id=distress.signal_id,
            ))

        elif hr or hrv:
            recs.append(InterventionRecommendation(
                id="rec_breathing_autonomic",
                intervention_type="breathing_478",
                title="4-7-8 Parasympathetic Breathing",
                description="Slow-paced breathwork to enhance heart rate variability (HRV) and buffer elevated resting heart rate.",
                rational_summary="Recommended due to autonomic deviation from personal resting baseline.",
                priority="high",
                estimated_duration_min=5,
                trigger_signal_id=hr.signal_id if hr else hrv.signal_id,
            ))

        if sleep:
            recs.append(InterventionRecommendation(
                id="rec_sleep_hygiene",
                intervention_type="sleep_hygiene",
                title="Circadian Sleep Hygiene Protocol",
                description="Practical evidence-based guidance: 60-min pre-bed screen cutoff, caffeine boundary timing, and fixed morning wake anchoring.",
                rational_summary="Recommended due to recorded sleep debt relative to personal baseline.",
                priority="moderate",
                estimated_duration_min=3,
                trigger_signal_id=sleep.signal_id,
            ))

        # Stale data / check-in prompt
        missing_count = len([m for m in metrics if m.status == "insufficient_data"])
        if missing_count >= 2 or is_cold_start:
            recs.append(InterventionRecommendation(
                id="rec_checkin_prompt",
                intervention_type="checkin_prompt",
                title="Quick Multi-Modal Check-In",
                description="Log your current subjective tension, morning resting pulse, and sleep hours to calibrate your Digital Twin baseline.",
                rational_summary="Recommended to accumulate the 3-5 distinct observation days required to establish an accurate personal baseline.",
                priority="informational",
                estimated_duration_min=2,
            ))

        # Default routine monitoring if everything is stable
        if not recs:
            recs.append(InterventionRecommendation(
                id="rec_routine_monitoring",
                intervention_type="routine_monitoring",
                title="Routine Observational Monitoring",
                description="All available physiological and lifestyle metrics remain within your established personal baseline bounds.",
                rational_summary="No acute change detected. Continue routine daily check-ins.",
                priority="low",
                estimated_duration_min=1,
            ))

        return recs

    # -------------------------------------------------------------------------
    # Synthetic Scenario Evaluation (For Simulation Lab Integration)
    # -------------------------------------------------------------------------

    @classmethod
    def evaluate_synthetic_sample(
        cls,
        sample: Dict[str, Any],
        baseline: Dict[str, Any],
    ) -> InterventionsStatusOut:
        """
        Pure, in-memory, stateless evaluation of a synthetic simulation sample
        against a synthetic baseline. Never touches the database, guaranteeing 0% contamination.
        """
        base_hr = baseline.get("mean_resting_hr", 70.0) or 70.0
        base_hrv = baseline.get("mean_hrv_ms", 48.0) or 48.0
        base_sleep = baseline.get("mean_sleep_hours", 7.5) or 7.5
        base_distress = baseline.get("mean_anxiety_score", 2.5) or 2.5

        curr_hr = sample.get("heartRateBpm", 70.0)
        curr_hrv = sample.get("hrvMs", 48.0)
        curr_sleep = sample.get("sleepHours", 7.5)
        curr_distress = sample.get("userReportedStress", 3.0)

        delta_hr = round(curr_hr - base_hr, 1)
        delta_hrv = round(curr_hrv - base_hrv, 1)
        delta_sleep = round(curr_sleep - base_sleep, 1)
        delta_distress = round(curr_distress - base_distress, 1)

        metrics = [
            BaselineComparisonMetric(
                metric_key="heart_rate",
                metric_name="Resting Heart Rate",
                current_value=round(curr_hr, 1),
                baseline_value=round(base_hr, 1),
                delta_value=delta_hr,
                unit="BPM",
                trend="elevated" if delta_hr >= cls.HR_ELEVATION_THRESHOLD_BPM else "stable",
                status="change_detected" if delta_hr >= cls.HR_ELEVATION_THRESHOLD_BPM else "within_range",
                observations_count=1,
                provenance="simulated",
            ),
            BaselineComparisonMetric(
                metric_key="hrv",
                metric_name="Parasympathetic Tone (HRV rMSSD)",
                current_value=round(curr_hrv, 1),
                baseline_value=round(base_hrv, 1),
                delta_value=delta_hrv,
                unit="ms",
                trend="reduced" if delta_hrv <= cls.HRV_REDUCTION_THRESHOLD_MS else "stable",
                status="change_detected" if delta_hrv <= cls.HRV_REDUCTION_THRESHOLD_MS else "within_range",
                observations_count=1,
                provenance="simulated",
            ),
            BaselineComparisonMetric(
                metric_key="sleep_duration",
                metric_name="Sleep Duration",
                current_value=round(curr_sleep, 1),
                baseline_value=round(base_sleep, 1),
                delta_value=delta_sleep,
                unit="hours",
                trend="disrupted" if delta_sleep <= cls.SLEEP_DEBT_THRESHOLD_HOURS else "stable",
                status="change_detected" if delta_sleep <= cls.SLEEP_DEBT_THRESHOLD_HOURS else "within_range",
                observations_count=1,
                provenance="simulated",
            ),
            BaselineComparisonMetric(
                metric_key="subjective_distress",
                metric_name="Subjective Distress Rating",
                current_value=round(curr_distress, 1),
                baseline_value=round(base_distress, 1),
                delta_value=delta_distress,
                unit="rating (0-10)",
                trend="elevated" if curr_distress >= cls.ACUTE_DISTRESS_THRESHOLD_SCORE else "stable",
                status="change_detected" if curr_distress >= cls.ACUTE_DISTRESS_THRESHOLD_SCORE else "within_range",
                observations_count=1,
                provenance="simulated",
            ),
        ]

        signals = []
        # HR signal
        if delta_hr >= cls.HR_ELEVATION_THRESHOLD_BPM:
            signals.append(EarlyWarningSignal(
                signal_id="sim_hr_elevated",
                signal_type="elevated_heart_rate",
                title="Elevated Resting Heart Rate (Simulated)",
                level="Change Detected",
                what_changed=f"Synthetic heart rate ({curr_hr} BPM) is elevated relative to simulated baseline ({base_hr} BPM).",
                why_flagged=f"Observed simulated delta (+{delta_hr} BPM) exceeds threshold (+{cls.HR_ELEVATION_THRESHOLD_BPM} BPM).",
                evidence_summary=f"Simulated sample: {curr_hr} BPM vs Baseline: {base_hr} BPM.",
                current_value=curr_hr,
                baseline_value=base_hr,
                delta=delta_hr,
                unit="BPM",
                timestamps=[sample.get("timestamp", utc_now().isoformat())],
                supporting_record_ids=["sim_sample_live"],
                data_quality="Synthetically generated sample; deterministic PRNG model.",
                data_provenance="simulated",
                suggested_activity="Test 4-7-8 Breathing Pacer response in simulation.",
                suggested_intervention_type="breathing_478",
                limitations="Observational association does not establish causation. Simulated prototype data.",
            ))
        else:
            signals.append(EarlyWarningSignal(
                signal_id="sim_hr_stable",
                signal_type="elevated_heart_rate",
                title="Heart Rate within Range (Simulated)",
                level="Within Personal Range",
                what_changed="Synthetic heart rate is within baseline boundaries.",
                why_flagged=f"Delta ({delta_hr:+0.1f} BPM) within normal variation.",
                evidence_summary=f"Simulated: {curr_hr} BPM vs Baseline: {base_hr} BPM.",
                current_value=curr_hr,
                baseline_value=base_hr,
                delta=delta_hr,
                unit="BPM",
                timestamps=[sample.get("timestamp", utc_now().isoformat())],
                supporting_record_ids=["sim_sample_live"],
                data_quality="Synthetic prototype stream.",
                data_provenance="simulated",
                suggested_activity="Maintain monitoring.",
                suggested_intervention_type="routine_monitoring",
                limitations="Observational association does not establish causation.",
            ))

        # HRV signal
        if delta_hrv <= cls.HRV_REDUCTION_THRESHOLD_MS:
            signals.append(EarlyWarningSignal(
                signal_id="sim_hrv_reduced",
                signal_type="reduced_hrv",
                title="Reduced Parasympathetic Tone (HRV rMSSD) (Simulated)",
                level="Change Detected",
                what_changed=f"Synthetic HRV rMSSD ({curr_hrv} ms) shows vagal suppression below simulated baseline ({base_hrv} ms).",
                why_flagged=f"Observed simulated delta ({delta_hrv} ms) exceeds tolerance threshold (<= {cls.HRV_REDUCTION_THRESHOLD_MS} ms).",
                evidence_summary=f"Simulated sample: {curr_hrv} ms vs Baseline: {base_hrv} ms ({delta_hrv} ms delta).",
                current_value=curr_hrv,
                baseline_value=base_hrv,
                delta=delta_hrv,
                unit="ms",
                timestamps=[sample.get("timestamp", utc_now().isoformat())],
                supporting_record_ids=["sim_sample_live"],
                data_quality="Synthetically generated sample; deterministic PRNG model.",
                data_provenance="simulated",
                suggested_activity="Test 5-4-3-2-1 Sensory Grounding or Paced Breathing in simulation.",
                suggested_intervention_type="grounding_54321",
                limitations="Observational association does not establish causation. Simulated prototype data.",
            ))
        else:
            signals.append(EarlyWarningSignal(
                signal_id="sim_hrv_stable",
                signal_type="reduced_hrv",
                title="Parasympathetic Tone within Range (Simulated)",
                level="Within Personal Range",
                what_changed="Synthetic HRV rMSSD is consistent with simulated baseline vagal tone.",
                why_flagged=f"Observed simulated delta ({delta_hrv:+0.1f} ms) remains within normal bounds.",
                evidence_summary=f"Simulated sample: {curr_hrv} ms vs Baseline: {base_hrv} ms.",
                current_value=curr_hrv,
                baseline_value=base_hrv,
                delta=delta_hrv,
                unit="ms",
                timestamps=[sample.get("timestamp", utc_now().isoformat())],
                supporting_record_ids=["sim_sample_live"],
                data_quality="Synthetic prototype stream.",
                data_provenance="simulated",
                suggested_activity="Maintain monitoring.",
                suggested_intervention_type="routine_monitoring",
                limitations="Observational association does not establish causation.",
            ))

        # Sleep signal
        if delta_sleep <= cls.SLEEP_DEBT_THRESHOLD_HOURS or curr_sleep < cls.MIN_SLEEP_HOURS_ABSOLUTE:
            signals.append(EarlyWarningSignal(
                signal_id="sim_sleep_debt",
                signal_type="disrupted_sleep",
                title="Sleep Debt & Circadian Disruption (Simulated)",
                level="Change Detected",
                what_changed=f"Synthetic sleep duration ({curr_sleep} hrs) fell below simulated baseline ({base_sleep} hrs).",
                why_flagged=f"Observed simulated deficit ({delta_sleep} hrs) indicates circadian debt (< {cls.MIN_SLEEP_HOURS_ABSOLUTE}h total or <= {cls.SLEEP_DEBT_THRESHOLD_HOURS}h delta).",
                evidence_summary=f"Simulated sleep: {curr_sleep}h vs Baseline: {base_sleep}h ({delta_sleep}h delta).",
                current_value=curr_sleep,
                baseline_value=base_sleep,
                delta=delta_sleep,
                unit="hours",
                timestamps=[sample.get("timestamp", utc_now().isoformat())],
                supporting_record_ids=["sim_sample_live"],
                data_quality="Simulated scenario parameter.",
                data_provenance="simulated",
                suggested_activity="Review Circadian Sleep Hygiene guidance in simulation.",
                suggested_intervention_type="sleep_hygiene",
                limitations="Observational association does not establish causation.",
            ))
        else:
            signals.append(EarlyWarningSignal(
                signal_id="sim_sleep_stable",
                signal_type="disrupted_sleep",
                title="Sleep Duration within Range (Simulated)",
                level="Within Personal Range",
                what_changed="Synthetic sleep duration matches simulated baseline target.",
                why_flagged=f"Deficit is negligible ({delta_sleep:+0.1f} hrs vs baseline).",
                evidence_summary=f"Simulated sleep: {curr_sleep}h vs Baseline: {base_sleep}h.",
                current_value=curr_sleep,
                baseline_value=base_sleep,
                delta=delta_sleep,
                unit="hours",
                timestamps=[sample.get("timestamp", utc_now().isoformat())],
                supporting_record_ids=["sim_sample_live"],
                data_quality="Synthetic prototype stream.",
                data_provenance="simulated",
                suggested_activity="Maintain consistent wake time.",
                suggested_intervention_type="routine_monitoring",
                limitations="Observational association does not establish causation.",
            ))

        # Distress signal
        if curr_distress >= cls.ACUTE_DISTRESS_THRESHOLD_SCORE:
            signals.append(EarlyWarningSignal(
                signal_id="sim_distress_elevated",
                signal_type="increased_distress",
                title="Elevated Distress Surge (Simulated)",
                level="Change Detected",
                what_changed=f"Synthetic distress ({curr_distress}/10) indicates acute strain.",
                why_flagged=f"Score exceeds acute distress threshold (>= {cls.ACUTE_DISTRESS_THRESHOLD_SCORE}/10).",
                evidence_summary=f"Simulated distress: {curr_distress}/10 vs Baseline: {base_distress}/10.",
                current_value=curr_distress,
                baseline_value=base_distress,
                delta=delta_distress,
                unit="rating (0-10)",
                timestamps=[sample.get("timestamp", utc_now().isoformat())],
                supporting_record_ids=["sim_sample_live"],
                data_quality="Simulated scenario parameter.",
                data_provenance="simulated",
                suggested_activity="Test 5-4-3-2-1 Sensory Grounding or 4-7-8 Breathing.",
                suggested_intervention_type="breathing_478",
                limitations="Observational association does not establish causation.",
            ))
        else:
            signals.append(EarlyWarningSignal(
                signal_id="sim_distress_stable",
                signal_type="increased_distress",
                title="Subjective Distress within Range (Simulated)",
                level="Within Personal Range",
                what_changed="Synthetic distress score is consistent with simulated baseline.",
                why_flagged=f"Score ({curr_distress}/10) is below acute tension threshold.",
                evidence_summary=f"Simulated distress: {curr_distress}/10 vs Baseline: {base_distress}/10.",
                current_value=curr_distress,
                baseline_value=base_distress,
                delta=delta_distress,
                unit="rating (0-10)",
                timestamps=[sample.get("timestamp", utc_now().isoformat())],
                supporting_record_ids=["sim_sample_live"],
                data_quality="Synthetic prototype stream.",
                data_provenance="simulated",
                suggested_activity="Maintain monitoring.",
                suggested_intervention_type="routine_monitoring",
                limitations="Observational association does not establish causation.",
            ))

        # Composite & Conflicting check
        hr_sim = next(s for s in signals if s.signal_type == "elevated_heart_rate")
        hrv_sim = next(s for s in signals if s.signal_type == "reduced_hrv")
        dist_sim = next(s for s in signals if s.signal_type == "increased_distress")

        if (hr_sim.level == "Change Detected" or hrv_sim.level == "Change Detected") and dist_sim.level == "Change Detected":
            signals.insert(0, EarlyWarningSignal(
                signal_id="sim_composite_strain",
                signal_type="composite_autonomic_strain",
                title="Composite Autonomic & Subjective Strain (Simulated)",
                level="Change Detected",
                what_changed="Simulated multi-modal autonomic arousal and high subjective distress.",
                why_flagged="Both physiological markers and distress exceeded simulated thresholds.",
                evidence_summary=f"HR: {curr_hr} BPM (+{delta_hr}), HRV: {curr_hrv} ms ({delta_hrv}), Distress: {curr_distress}/10.",
                current_value=curr_distress,
                baseline_value=base_distress,
                delta=delta_distress,
                unit="composite",
                timestamps=[sample.get("timestamp", utc_now().isoformat())],
                supporting_record_ids=["sim_sample_live"],
                data_quality="Synthetic multi-modal stream.",
                data_provenance="simulated",
                suggested_activity="Test 5-4-3-2-1 Sensory Grounding.",
                suggested_intervention_type="grounding_54321",
                limitations="Observational association does not establish causation. Simulated data.",
            ))
        elif (hr_sim.level == "Change Detected" or hrv_sim.level == "Change Detected") and curr_distress <= 2.0:
            signals.append(EarlyWarningSignal(
                signal_id="sim_conflicting",
                signal_type="conflicting_observations",
                title="Divergent Physiological & Subjective Signals (Simulated)",
                level="Change Detected",
                what_changed=f"Synthetic physiological arousal (HR: {curr_hr} BPM) with low distress ({curr_distress}/10).",
                why_flagged="Simulated autonomic shift diverges from subjective mood rating.",
                evidence_summary=f"Simulated HR delta: +{delta_hr} BPM vs Distress: {curr_distress}/10.",
                current_value=curr_distress,
                baseline_value=base_distress,
                delta=delta_distress,
                unit="rating (0-10)",
                timestamps=[sample.get("timestamp", utc_now().isoformat())],
                supporting_record_ids=["sim_sample_live"],
                data_quality="Synthetic multi-modal divergent stream.",
                data_provenance="simulated",
                suggested_activity="Test contextual check-in.",
                suggested_intervention_type="checkin_prompt",
                limitations="Observational association does not establish causation.",
            ))

        recs = cls._generate_recommendations(signals, metrics, is_cold_start=False)

        return InterventionsStatusOut(
            baseline_status="Simulated Baseline Active",
            is_cold_start=False,
            metrics=metrics,
            signals=signals,
            recommendations=recs,
            insufficient_data_reasons=[],
            disclaimer="Simulated scenario indicators generated for live prototype demonstration. Does not reflect real human measurements.",
        )
