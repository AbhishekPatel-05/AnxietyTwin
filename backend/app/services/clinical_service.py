"""
clinical_service.py - Phase 6.2 Patient Review & Clinical Insight Workspace Service
Handles:
1. Synthetic demo patient provisioning & 1-click deterministic reset.
2. Longitudinal multi-modal timeline collation and provenance tagging.
3. Explainable Digital Twin clinical insights calculation with evidence record linkage.
4. Professional ReportLab PDF generation for clinical and patient review.
"""

import io
import json
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

from sqlalchemy.orm import Session
from sqlalchemy import text
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
)

from backend.app.core.security import get_password_hash
from backend.app.models.db_models import (
    User,
    UserProfile,
    AnxietyCheckin,
    PhysiologicalObservation,
    LifestyleObservation,
    TwinStateSnapshot,
    PredictionRecord,
    PatientAccessGrant,
    ClinicianReviewNote,
    Consent,
    InterventionSession,
)
from backend.app.models.schemas import (
    TimelineEventOut,
    TwinInsightOut,
    PatientCardOut,
    PatientOverviewOut,
    ClinicianReviewNoteOut,
    PdfExportOptions,
)
from backend.app.services.twin_engine import DigitalTwinEngine
from backend.app.services.ml_service import ml_service
from backend.app.api.observations import trigger_state_update

DEMO_PATIENT_EMAIL = "alex.demo.patient@happiesthealth.org"
DEMO_CLINICIAN_EMAIL = "demo_clinician@happiesthealth.org"


def utc_now():
    return datetime.now(timezone.utc)


def make_aware(dt: datetime) -> datetime:
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# =========================================================================
# 1. SYNTHETIC DEMO PATIENT PROVISIONING & RESET
# =========================================================================

def seed_or_reset_demo_patient(db: Session, clinician_id: Optional[int] = None) -> User:
    """
    Seeds or resets a reproducible synthetic patient ('Alex Rivera') with 8 distinct
    days of realistic longitudinal history, varying distress, sleep shifts, caffeine,
    and resting vitals. Does not use real health data.
    """
    patient = db.query(User).filter(User.email == DEMO_PATIENT_EMAIL).first()
    if not patient:
        patient = User(
            email=DEMO_PATIENT_EMAIL,
            hashed_password=get_password_hash("DemoPatient2026!"),
            full_name="Alex Rivera (Student Cohort)",
            role="patient",
            is_active=True,
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)
    else:
        # Wipe previous records for clean reproducible reset
        db.query(AnxietyCheckin).filter(AnxietyCheckin.user_id == patient.id).delete()
        db.query(PhysiologicalObservation).filter(PhysiologicalObservation.user_id == patient.id).delete()
        db.query(LifestyleObservation).filter(LifestyleObservation.user_id == patient.id).delete()
        db.query(TwinStateSnapshot).filter(TwinStateSnapshot.user_id == patient.id).delete()
        db.query(PredictionRecord).filter(PredictionRecord.user_id == patient.id).delete()
        db.query(ClinicianReviewNote).filter(ClinicianReviewNote.patient_id == patient.id).delete()
        db.query(InterventionSession).filter(InterventionSession.user_id == patient.id).delete()
        db.commit()

    # User Profile
    profile = db.query(UserProfile).filter(UserProfile.user_id == patient.id).first()
    if not profile:
        profile = UserProfile(user_id=patient.id)
        db.add(profile)
    
    profile.age = 24
    profile.biological_sex = "F"
    profile.baseline_resting_hr = 70.0
    profile.baseline_sleep_hours = 7.5
    profile.baseline_caffeine_cups = 1.0
    profile.baseline_hrv_ms = 48.0
    profile.medical_history_notes = "College graduate student; episodes of situational panic triggered by academic deadlines."
    profile.has_panic_history = True
    profile.trait_anxiety_score = 44.0  # Moderate-high trait vulnerability
    profile.onboarding_completed = True
    db.commit()

    # Consents
    if not db.query(Consent).filter(Consent.user_id == patient.id).first():
        db.add(Consent(user_id=patient.id, consent_type="health_data_processing", consented=True))
        db.add(Consent(user_id=patient.id, consent_type="simulation_research", consented=True))
        db.commit()

    # 8 Days of Longitudinal History (from Day -7 to Day 0)
    base_date = datetime.now(timezone.utc).replace(hour=14, minute=0, second=0, microsecond=0)
    
    dataset_days = [
        # (day_offset, anxiety_score, hr, hrv, sleep, sleep_qual, caff, triggers, symptoms, notes)
        (-7, 3, 69.0, 52.0, 7.8, 4, 1.0, None, ["calm"], "Normal study day, felt rested."),
        (-6, 4, 71.0, 47.0, 7.2, 4, 1.5, "Evening studying", ["mild tension"], "A bit tired before bed."),
        (-5, 6, 78.0, 39.0, 5.5, 2, 3.0, "Exam preparation", ["palpitations", "restlessness"], "Studied until 1 AM, high caffeine."),
        (-4, 8, 88.0, 26.0, 4.2, 1, 4.0, "Midterm Exam Day", ["palpitations", "chest tightness", "sweating"], "Acute situational panic during morning exam; heart racing."),
        (-3, 7, 82.0, 32.0, 5.0, 2, 2.5, "Post-exam exhaustion", ["muscle tension", "fatigue"], "Slow recovery, sleep debt lingering."),
        (-2, 5, 74.0, 42.0, 6.8, 3, 2.0, "Group project meeting", ["mild anxiety"], "Better after going for an afternoon walk."),
        (-1, 4, 71.0, 48.0, 7.5, 4, 1.0, None, ["stable"], "Relaxed weekend morning, tried 4-7-8 breathing."),
        (0,  3, 70.0, 50.0, 8.0, 5, 1.0, None, ["calm"], "Fully rested; baseline equilibrium recovered."),
    ]

    for day_off, anx, hr_val, hrv_val, sleep_val, qual_val, caff_val, trig, symp, note_text in dataset_days:
        day_time = base_date + timedelta(days=day_off)
        date_str = day_time.strftime("%Y-%m-%d")

        # 1. Check-in
        checkin = AnxietyCheckin(
            user_id=patient.id,
            timestamp=day_time,
            source_type="user_entered",
            subjective_anxiety_score=anx,
            energy_level=3 if anx < 6 else 1,
            somatic_symptoms=json.dumps(symp) if symp else None,
            triggers_noted=trig,
            notes=note_text,
        )
        db.add(checkin)

        # 2. Physiological Observation (Some missing on Day -2 to demonstrate data completeness handling)
        if day_off != -2:
            physio = PhysiologicalObservation(
                user_id=patient.id,
                timestamp=day_time.replace(hour=8, minute=30),
                source_type="user_entered",
                heart_rate_bpm=hr_val,
                heart_rate_variability_ms=hrv_val,
                resting_heart_rate=hr_val,
                steps_count=4200 + abs(day_off) * 600,
            )
            db.add(physio)

        # 3. Lifestyle Observation
        lifestyle = LifestyleObservation(
            user_id=patient.id,
            date=date_str,
            source_type="user_entered",
            sleep_hours=sleep_val,
            sleep_quality_score=qual_val,
            caffeine_cups=caff_val,
            exercise_minutes=30.0 if anx <= 5 else 10.0,
        )
        db.add(lifestyle)

    db.commit()

    # Trigger twin state update
    trigger_state_update(patient, db, source="personal_mode")

    # Authorize clinician grant
    if clinician_id:
        grant = db.query(PatientAccessGrant).filter(
            PatientAccessGrant.patient_id == patient.id,
            PatientAccessGrant.clinician_id == clinician_id,
        ).first()
        if not grant:
            grant = PatientAccessGrant(
                patient_id=patient.id,
                clinician_id=clinician_id,
                scope="full_review",
                is_active=True,
                notes="Automatic demo access authorization.",
            )
            db.add(grant)
            db.commit()

    # Initial clinician review note
    if clinician_id:
        note = ClinicianReviewNote(
            patient_id=patient.id,
            clinician_id=clinician_id,
            review_date=utc_now() - timedelta(days=2),
            reporting_period_start=(base_date - timedelta(days=7)).strftime("%Y-%m-%d"),
            reporting_period_end=base_date.strftime("%Y-%m-%d"),
            summary_observations="Patient experienced acute sympathetic surge on Exam Day (Day -4) with HR 88 BPM and suppressed HRV 26 ms, triggered by severe sleep deficit (4.2h) and high caffeine intake (4 cups).",
            discussion_topics="1. Circadian sleep hygiene during exam periods. 2. Limiting caffeine after 2:00 PM. 3. Proactive use of voluntary 4-7-8 breathing pacer prior to testing.",
            follow_up_plan="Review follow-up check-in trajectory in 14 days. Evaluate whether pacing protocol assisted during next deadline.",
            follow_up_date=(base_date + timedelta(days=12)).strftime("%Y-%m-%d"),
            follow_up_status="planned",
        )
        db.add(note)
        db.commit()

    # Seed 3 realistic longitudinal intervention sessions for Alex Rivera
    int_1 = InterventionSession(
        user_id=patient.id,
        intervention_type="breathing_478",
        trigger_signal="composite_autonomic_strain",
        status="completed",
        pre_distress_rating=8.0,
        post_distress_rating=5.0,
        rating_delta=-3.0,
        helpfulness="helpful",
        user_notes="Used 4-7-8 breathing after exam surge. Heart rate calmed down noticeably.",
        source_type="user_entered",
        started_at=base_date - timedelta(days=4) + timedelta(hours=2),
        completed_at=base_date - timedelta(days=4) + timedelta(hours=2, minutes=6),
    )
    int_2 = InterventionSession(
        user_id=patient.id,
        intervention_type="grounding_54321",
        trigger_signal="elevated_distress",
        status="completed",
        pre_distress_rating=7.0,
        post_distress_rating=5.0,
        rating_delta=-2.0,
        helpfulness="helpful",
        user_notes="5-4-3-2-1 sensory grounding helped refocus attention away from exam stress.",
        source_type="user_entered",
        started_at=base_date - timedelta(days=3) + timedelta(hours=4),
        completed_at=base_date - timedelta(days=3) + timedelta(hours=4, minutes=5),
    )
    int_3 = InterventionSession(
        user_id=patient.id,
        intervention_type="sleep_hygiene",
        trigger_signal="disrupted_sleep",
        status="completed",
        pre_distress_rating=5.0,
        post_distress_rating=4.0,
        rating_delta=-1.0,
        helpfulness="somewhat_helpful",
        user_notes="Turned off phone screen 45 minutes before bedtime and avoided evening coffee.",
        source_type="user_entered",
        started_at=base_date - timedelta(days=2) + timedelta(hours=6),
        completed_at=base_date - timedelta(days=2) + timedelta(hours=6, minutes=4),
    )
    db.add_all([int_1, int_2, int_3])
    db.commit()

    return patient


# =========================================================================
# 2. LONGITUDINAL PATIENT TIMELINE ENGINE
# =========================================================================

def get_patient_timeline(
    patient_id: int,
    db: Session,
    days: int = 30,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    include_simulated: bool = False,
    event_types: Optional[List[str]] = None,
) -> List[TimelineEventOut]:
    """
    Collatest genuine, research, calculated, and optional simulated events
    into a unified chronological timeline with clear provenance tagging.
    """
    now = utc_now()
    if start_date and end_date:
        try:
            cutoff_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            cutoff_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        except Exception:
            cutoff_start = now - timedelta(days=days)
            cutoff_end = now + timedelta(days=1)
    else:
        cutoff_start = now - timedelta(days=days)
        cutoff_end = now + timedelta(days=1)

    # Convert to naive for DB column comparisons if needed
    cutoff_start_cmp = cutoff_start.replace(tzinfo=None)
    cutoff_end_cmp = cutoff_end.replace(tzinfo=None)

    events: List[TimelineEventOut] = []

    # 1. Anxiety Check-ins
    checkins = db.query(AnxietyCheckin).filter(
        AnxietyCheckin.user_id == patient_id,
        AnxietyCheckin.timestamp >= cutoff_start_cmp,
        AnxietyCheckin.timestamp <= cutoff_end_cmp,
    ).all()

    for c in checkins:
        is_sim = c.source_type in ["synthetic", "simulated"]
        if is_sim and not include_simulated:
            continue

        symptoms_list = []
        if c.somatic_symptoms:
            try:
                symptoms_list = json.loads(c.somatic_symptoms)
            except Exception:
                symptoms_list = [c.somatic_symptoms]

        summary_parts = [f"Distress Score: {c.subjective_anxiety_score}/10"]
        if c.triggers_noted:
            summary_parts.append(f"Trigger: {c.triggers_noted}")
        if symptoms_list:
            summary_parts.append(f"Symptoms: {', '.join(symptoms_list)}")

        events.append(TimelineEventOut(
            id=f"checkin_{c.id}",
            timestamp=make_aware(c.timestamp),
            event_type="checkin",
            source_type=c.source_type or "user_entered",
            is_simulated=is_sim,
            title=f"User Check-In ({c.subjective_anxiety_score}/10)",
            summary=" • ".join(summary_parts),
            values={
                "anxiety_score": c.subjective_anxiety_score,
                "energy_level": c.energy_level,
                "triggers": c.triggers_noted,
                "symptoms": symptoms_list,
                "notes": c.notes,
            },
            details={"raw_id": c.id, "created_at": make_aware(c.timestamp).isoformat()},
        ))

    # 2. Physiological Observations
    physios = db.query(PhysiologicalObservation).filter(
        PhysiologicalObservation.user_id == patient_id,
        PhysiologicalObservation.timestamp >= cutoff_start_cmp,
        PhysiologicalObservation.timestamp <= cutoff_end_cmp,
    ).all()

    for p in physios:
        is_sim = p.source_type in ["synthetic", "simulated"]
        if is_sim and not include_simulated:
            continue

        parts = []
        if p.heart_rate_bpm:
            parts.append(f"HR: {int(p.heart_rate_bpm)} BPM")
        if p.heart_rate_variability_ms:
            parts.append(f"HRV: {int(p.heart_rate_variability_ms)} ms")
        if p.steps_count:
            parts.append(f"Steps: {p.steps_count}")

        events.append(TimelineEventOut(
            id=f"physio_{p.id}",
            timestamp=make_aware(p.timestamp),
            event_type="physiological",
            source_type=p.source_type or "user_entered",
            is_simulated=is_sim,
            title="Physiological Vitals",
            summary=" • ".join(parts) if parts else "Vitals Recorded",
            values={
                "heart_rate_bpm": p.heart_rate_bpm,
                "hrv_ms": p.heart_rate_variability_ms,
                "steps": p.steps_count,
            },
            details={"raw_id": p.id},
        ))

    # 3. Lifestyle Observations
    lifestyles = db.query(LifestyleObservation).filter(
        LifestyleObservation.user_id == patient_id,
    ).all()

    for l in lifestyles:
        try:
            l_date = datetime.strptime(l.date, "%Y-%m-%d").replace(tzinfo=timezone.utc, hour=9)
        except Exception:
            l_date = make_aware(l.created_at) if l.created_at else now

        if make_aware(l_date) < cutoff_start or make_aware(l_date) > cutoff_end:
            continue

        is_sim = l.source_type in ["synthetic", "simulated"]
        if is_sim and not include_simulated:
            continue

        parts = [f"Sleep: {l.sleep_hours}h"]
        if l.caffeine_cups:
            parts.append(f"Caffeine: {l.caffeine_cups} cups")
        if l.exercise_minutes:
            parts.append(f"Exercise: {int(l.exercise_minutes)}m")

        events.append(TimelineEventOut(
            id=f"lifestyle_{l.id}",
            timestamp=make_aware(l_date),
            event_type="lifestyle",
            source_type=l.source_type or "user_entered",
            is_simulated=is_sim,
            title="Daily Lifestyle Record",
            summary=" • ".join(parts),
            values={
                "sleep_hours": l.sleep_hours,
                "sleep_quality": l.sleep_quality_score,
                "caffeine_cups": l.caffeine_cups,
                "exercise_minutes": l.exercise_minutes,
            },
            details={"raw_id": l.id, "date": l.date},
        ))

    # 4. Digital Twin State Snapshots
    twins = db.query(TwinStateSnapshot).filter(
        TwinStateSnapshot.user_id == patient_id,
        TwinStateSnapshot.timestamp >= cutoff_start_cmp,
        TwinStateSnapshot.timestamp <= cutoff_end_cmp,
    ).all()

    for t in twins:
        is_sim = t.source == "simulation_lab"
        if is_sim and not include_simulated:
            continue

        events.append(TimelineEventOut(
            id=f"twin_{t.id}",
            timestamp=make_aware(t.timestamp),
            event_type="twin_state",
            source_type="calculated",
            is_simulated=is_sim,
            title=f"Twin State: {t.state_label}",
            summary=f"CSI: {t.composite_stress_index:.1f}/100 • Arousal: {t.physiological_arousal_score:.1f} • ΔBase: {t.baseline_deviation_score:+.1f}",
            values={
                "state_label": t.state_label,
                "csi": t.composite_stress_index,
                "arousal": t.physiological_arousal_score,
                "circadian": t.circadian_disruption_index,
                "baseline_deviation": t.baseline_deviation_score,
            },
            details={"raw_id": t.id},
        ))

    # 5. Clinician Review Notes
    notes = db.query(ClinicianReviewNote).filter(
        ClinicianReviewNote.patient_id == patient_id,
        ClinicianReviewNote.review_date >= cutoff_start_cmp,
        ClinicianReviewNote.review_date <= cutoff_end_cmp,
    ).all()

    for n in notes:
        events.append(TimelineEventOut(
            id=f"note_{n.id}",
            timestamp=make_aware(n.review_date),
            event_type="clinician_note",
            source_type="clinician_authored",
            is_simulated=False,
            title="Clinician Clinical Review Note",
            summary=n.summary_observations[:140] + ("..." if len(n.summary_observations) > 140 else ""),
            values={
                "summary": n.summary_observations,
                "discussion_topics": n.discussion_topics,
                "follow_up_plan": n.follow_up_plan,
                "follow_up_date": n.follow_up_date,
                "status": n.follow_up_status,
            },
            details={"raw_id": n.id},
        ))

    # 6. Supportive Coping Interventions
    interventions = db.query(InterventionSession).filter(
        InterventionSession.user_id == patient_id,
        InterventionSession.started_at >= cutoff_start_cmp,
        InterventionSession.started_at <= cutoff_end_cmp,
    ).all()

    for s in interventions:
        is_sim = s.source_type in ["synthetic", "simulated"]
        if is_sim and not include_simulated:
            continue

        act_title = {
            "breathing_478": "4-7-8 Breathing Pacer",
            "grounding_54321": "5-4-3-2-1 Sensory Grounding",
            "sleep_hygiene": "Sleep Hygiene Protocol",
            "checkin_prompt": "Daily Check-In",
            "routine_monitoring": "Routine Monitoring",
        }.get(s.intervention_type, s.intervention_type.replace("_", " ").title())

        delta_str = f" (Δ {s.rating_delta:+.1f})" if s.rating_delta is not None else ""
        feedback_str = (
            f"Distress: {s.pre_distress_rating:.0f} → {s.post_distress_rating:.0f}{delta_str}"
            if (s.pre_distress_rating is not None and s.post_distress_rating is not None)
            else f"Status: {s.status.title()}"
        )
        if s.helpfulness:
            feedback_str += f" • Rated: {s.helpfulness.replace('_', ' ').title()}"

        events.append(TimelineEventOut(
            id=f"intervention_{s.id}",
            timestamp=make_aware(s.started_at),
            event_type="coping_exercise",
            source_type=s.source_type or "user_entered",
            is_simulated=is_sim,
            title=f"Supportive Activity: {act_title}",
            summary=feedback_str,
            values={
                "intervention_type": s.intervention_type,
                "trigger_signal": s.trigger_signal,
                "pre_distress": s.pre_distress_rating,
                "post_distress": s.post_distress_rating,
                "delta": s.rating_delta,
                "helpfulness": s.helpfulness,
                "notes": s.user_notes,
            },
            details={"raw_id": s.id},
        ))

    # Sort descending by timestamp safely
    events.sort(key=lambda e: make_aware(e.timestamp), reverse=True)

    # Optional event_types filtering
    if event_types:
        events = [e for e in events if e.event_type in event_types]

    return events


# =========================================================================
# 3. EXPLAINABLE DIGITAL TWIN CLINICAL INSIGHTS
# =========================================================================

def calculate_clinical_twin_insights(
    patient_id: int,
    db: Session,
    days: int = 14,
) -> List[TwinInsightOut]:
    """
    Computes data-driven, non-causal insights comparing recent longitudinal records
    against personal empirical baselines with explicit evidence record links.
    """
    cutoff = utc_now() - timedelta(days=days)
    cutoff_cmp = cutoff.replace(tzinfo=None)
    profile = db.query(UserProfile).filter(UserProfile.user_id == patient_id).first()
    
    base_hr = profile.baseline_resting_hr if profile and profile.baseline_resting_hr else 70.0
    base_hrv = profile.baseline_hrv_ms if profile and profile.baseline_hrv_ms else 48.0
    base_sleep = profile.baseline_sleep_hours if profile and profile.baseline_sleep_hours else 7.5
    base_caff = profile.baseline_caffeine_cups if profile and profile.baseline_caffeine_cups else 1.0

    checkins = db.query(AnxietyCheckin).filter(
        AnxietyCheckin.user_id == patient_id,
        AnxietyCheckin.timestamp >= cutoff_cmp,
    ).order_by(AnxietyCheckin.timestamp.asc()).all()

    physios = db.query(PhysiologicalObservation).filter(
        PhysiologicalObservation.user_id == patient_id,
        PhysiologicalObservation.timestamp >= cutoff_cmp,
    ).order_by(PhysiologicalObservation.timestamp.asc()).all()

    lifestyles = db.query(LifestyleObservation).filter(
        LifestyleObservation.user_id == patient_id,
    ).all()
    # Filter lifestyles by date window
    recent_lifestyles = []
    for l in lifestyles:
        try:
            d = datetime.strptime(l.date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            if make_aware(d) >= cutoff:
                recent_lifestyles.append(l)
        except Exception:
            pass

    insights: List[TwinInsightOut] = []

    # 1. Autonomic Vitals Shift (HR & HRV)
    if physios:
        hr_values = [p.heart_rate_bpm for p in physios if p.heart_rate_bpm is not None]
        hrv_values = [p.heart_rate_variability_ms for p in physios if p.heart_rate_variability_ms is not None]

        if hr_values:
            mean_hr = sum(hr_values) / len(hr_values)
            hr_delta = mean_hr - base_hr
            supporting_ids = [f"physio_{p.id}" for p in physios if p.heart_rate_bpm is not None]

            if abs(hr_delta) >= 3.0:
                insights.append(TwinInsightOut(
                    id="insight_autonomic_hr",
                    factor="Autonomic Heart Rate",
                    category="autonomic",
                    observation=f"Mean resting heart rate was {mean_hr:.1f} BPM ({hr_delta:+.1f} BPM relative to personal baseline of {base_hr:.1f} BPM) across {len(hr_values)} observations.",
                    comparison_baseline=f"Individual baseline reference: {base_hr:.1f} BPM",
                    baseline_value=base_hr,
                    current_value=round(mean_hr, 1),
                    delta=round(hr_delta, 1),
                    delta_unit="BPM",
                    time_window=f"Last {days} days",
                    source_provenance="user_entered",
                    data_limitation="Non-continuous spot readings; does not capture nocturnal continuous resting heart rate dip.",
                    non_causal_interpretation="Elevated heart rate reflects multi-factorial physical (caffeine, exertion) and emotional arousal; observational association does not establish causation or constitute a clinical diagnosis of panic.",
                    direction="elevated" if hr_delta > 0 else "suppressed",
                    significance="high" if abs(hr_delta) >= 8.0 else "moderate",
                    supporting_record_ids=supporting_ids[:5],
                ))

        if hrv_values:
            mean_hrv = sum(hrv_values) / len(hrv_values)
            hrv_delta = mean_hrv - base_hrv
            supporting_ids = [f"physio_{p.id}" for p in physios if p.heart_rate_variability_ms is not None]

            if abs(hrv_delta) >= 4.0:
                insights.append(TwinInsightOut(
                    id="insight_autonomic_hrv",
                    factor="Parasympathetic Tone (HRV rMSSD)",
                    category="autonomic",
                    observation=f"Mean HRV rMSSD was {mean_hrv:.1f} ms ({hrv_delta:+.1f} ms change from personal baseline of {base_hrv:.1f} ms).",
                    comparison_baseline=f"Individual baseline reference: {base_hrv:.1f} ms",
                    baseline_value=base_hrv,
                    current_value=round(mean_hrv, 1),
                    delta=round(hrv_delta, 1),
                    delta_unit="ms",
                    time_window=f"Last {days} days",
                    source_provenance="user_entered",
                    data_limitation="Self-recorded measurements; transient HRV changes occur during respiration, posture shifts, or hydration.",
                    non_causal_interpretation="Suppressed vagal tone co-occurs with physiological strain, but observational association does not establish causation or prove pathological anxiety.",
                    direction="suppressed" if hrv_delta < 0 else "elevated",
                    significance="high" if abs(hrv_delta) >= 10.0 else "moderate",
                    supporting_record_ids=supporting_ids[:5],
                ))

    # 2. Circadian Debt & Sleep Architecture
    if recent_lifestyles:
        sleep_vals = [l.sleep_hours for l in recent_lifestyles if l.sleep_hours is not None]
        if sleep_vals:
            mean_sleep = sum(sleep_vals) / len(sleep_vals)
            sleep_delta = mean_sleep - base_sleep
            deficit_nights = sum(1 for s in sleep_vals if s < 6.0)
            supporting_ids = [f"lifestyle_{l.id}" for l in recent_lifestyles]

            if deficit_nights > 0 or abs(sleep_delta) >= 0.7:
                insights.append(TwinInsightOut(
                    id="insight_circadian_sleep",
                    factor="Circadian Sleep Regularity",
                    category="circadian",
                    observation=f"Average sleep was {mean_sleep:.1f} hours ({sleep_delta:+.1f}h vs baseline {base_sleep:.1f}h), with {deficit_nights} nights recording severe sleep debt (< 6.0 hours).",
                    comparison_baseline=f"Individual baseline reference: {base_sleep:.1f} hours",
                    baseline_value=base_sleep,
                    current_value=round(mean_sleep, 1),
                    delta=round(sleep_delta, 1),
                    delta_unit="hours",
                    time_window=f"Last {days} days",
                    source_provenance="user_entered",
                    data_limitation="Self-reported sleep duration without polysomnographic sleep stage tracking.",
                    non_causal_interpretation="Sleep restriction impairs emotional regulation and increases autonomic reactivity, but individual sleep need varies; observational association does not establish causation.",
                    direction="suppressed" if sleep_delta < 0 else "elevated",
                    significance="high" if deficit_nights >= 2 else "moderate",
                    supporting_record_ids=supporting_ids[:5],
                ))

    # 3. Psychological Distress & Symptom Clustering
    if checkins:
        scores = [c.subjective_anxiety_score for c in checkins]
        mean_score = sum(scores) / len(scores)
        high_distress_days = [c for c in checkins if c.subjective_anxiety_score >= 7]
        supporting_ids = [f"checkin_{c.id}" for c in checkins]

        # Extract triggers
        triggers_list = [c.triggers_noted for c in checkins if c.triggers_noted]

        insights.append(TwinInsightOut(
            id="insight_psychological_distress",
            factor="Subjective Distress Trajectory",
            category="psychological",
            observation=f"Mean reported distress was {mean_score:.1f}/10 across {len(checkins)} check-ins, with {len(high_distress_days)} acute elevation days (score >= 7/10). " +
                        (f"Prevalent noted trigger: '{triggers_list[0]}'." if triggers_list else ""),
            comparison_baseline="Personal baseline score expectation: <= 3.0/10",
            baseline_value=3.0,
            current_value=round(mean_score, 1),
            delta=round(mean_score - 3.0, 1),
            delta_unit="rating",
            time_window=f"Last {days} days",
            source_provenance="user_reported",
            data_limitation="Voluntary self-report; susceptible to recall bias and acute situational mood fluctuations.",
            non_causal_interpretation="Self-reported distress captures voluntary subjective experience and does not replace standardized clinical psychometrics (e.g. GAD-7, STAI); observational association does not establish causation.",
            direction="elevated" if mean_score >= 5.0 else "stable",
            significance="high" if len(high_distress_days) >= 2 else "moderate",
            supporting_record_ids=[f"checkin_{c.id}" for c in high_distress_days] if high_distress_days else supporting_ids[:5],
        ))

    # 4. Data Sufficiency & Missing Records Insight
    total_obs = len(checkins) + len(physios) + len(recent_lifestyles)
    if total_obs < 5:
        insights.append(TwinInsightOut(
            id="insight_data_sufficiency",
            factor="Observation History Sufficiency",
            category="composite",
            observation=f"Only {total_obs} total observations recorded across the last {days} days. Longitudinal trend confidence is constrained.",
            comparison_baseline="Target clinical monitoring density: >= 1 daily check-in",
            baseline_value=float(days),
            current_value=float(total_obs),
            delta=float(total_obs - days),
            delta_unit="observations",
            time_window=f"Last {days} days",
            source_provenance="calculated",
            data_limitation="Sparse sampling limits statistical power for individual causal inference.",
            non_causal_interpretation="Absence of recorded data must not be interpreted as absence of symptoms; observational association does not establish causation.",
            direction="suppressed",
            significance="moderate",
            supporting_record_ids=[],
        ))

    return insights


# =========================================================================
# 4. PATIENT OVERVIEW & AUTHORIZATION HELPERS
# =========================================================================

def get_authorized_patients_list(clinician_id: int, db: Session) -> List[PatientCardOut]:
    """
    Returns the list of patients for whom the clinician has an active, non-revoked grant,
    plus the synthetic demo patient.
    """
    # Active grants
    grants = db.query(PatientAccessGrant).filter(
        PatientAccessGrant.clinician_id == clinician_id,
        PatientAccessGrant.is_active == True,
        PatientAccessGrant.revoked_at == None,
    ).all()

    patient_ids = {g.patient_id for g in grants}

    # Always include synthetic demo patient
    demo_pat = db.query(User).filter(User.email == DEMO_PATIENT_EMAIL).first()
    if demo_pat:
        patient_ids.add(demo_pat.id)

    cards: List[PatientCardOut] = []
    users = db.query(User).filter(User.id.in_(patient_ids)).all()

    for u in users:
        is_demo = (u.email == DEMO_PATIENT_EMAIL)
        prof = u.profile

        # Counts
        c_count = db.query(AnxietyCheckin).filter(AnxietyCheckin.user_id == u.id).count()
        p_count = db.query(PhysiologicalObservation).filter(PhysiologicalObservation.user_id == u.id).count()
        l_count = db.query(LifestyleObservation).filter(LifestyleObservation.user_id == u.id).count()
        tot_count = c_count + p_count + l_count

        # Recent check-in
        recent_c = db.query(AnxietyCheckin).filter(
            AnxietyCheckin.user_id == u.id
        ).order_by(AnxietyCheckin.timestamp.desc()).first()

        recent_date = recent_c.timestamp.strftime("%b %d, %Y") if recent_c else None
        recent_score = recent_c.subjective_anxiety_score if recent_c else None

        # Last reviewed note
        last_note = db.query(ClinicianReviewNote).filter(
            ClinicianReviewNote.patient_id == u.id
        ).order_by(ClinicianReviewNote.review_date.desc()).first()
        last_reviewed = last_note.review_date.strftime("%b %d, %Y") if last_note else None

        # Data completeness estimate (based on 14 day target)
        completeness = min(100, int((tot_count / 28.0) * 100)) if tot_count > 0 else 0

        baseline_status = "Empirical Baseline Active" if tot_count >= 10 else "Cold-Start Calibration"

        cards.append(PatientCardOut(
            id=u.id,
            display_name=u.full_name or u.email.split("@")[0],
            email=u.email,
            age_range=f"{prof.age - 2}-{prof.age + 2}" if (prof and prof.age) else "Adult",
            is_demo_patient=is_demo,
            total_observations_count=tot_count,
            recent_checkin_date=recent_date,
            recent_anxiety_score=recent_score,
            baseline_status=baseline_status,
            data_completeness_percent=completeness,
            last_reviewed_date=last_reviewed,
        ))

    # Sort demo patient first, then by name
    cards.sort(key=lambda c: (not c.is_demo_patient, c.display_name))
    return cards


def verify_patient_access(patient_id: int, clinician: User, db: Session) -> User:
    """
    Verifies that the clinician has valid authorization to view the patient.
    Raises HTTP 403 Forbidden if consent was revoked or never granted.
    """
    patient = db.query(User).filter(User.id == patient_id).first()
    if not patient:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    # Synthetic demo patient is accessible to authenticated clinicians
    if patient.email == DEMO_PATIENT_EMAIL:
        return patient

    # Explicit active access grant verification
    grant = db.query(PatientAccessGrant).filter(
        PatientAccessGrant.patient_id == patient_id,
        PatientAccessGrant.clinician_id == clinician.id,
        PatientAccessGrant.is_active == True,
        PatientAccessGrant.revoked_at == None,
    ).first()

    if not grant:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Active patient consent grant required. Patient consent grant is not active or has been revoked.",
        )

    return patient


def get_patient_overview(patient_id: int, db: Session) -> PatientOverviewOut:
    patient = db.query(User).filter(User.id == patient_id).first()
    profile = patient.profile if patient else None

    # Counts and distinct days
    checkins = db.query(AnxietyCheckin).filter(AnxietyCheckin.user_id == patient_id).all()
    physios = db.query(PhysiologicalObservation).filter(PhysiologicalObservation.user_id == patient_id).all()
    lifestyles = db.query(LifestyleObservation).filter(LifestyleObservation.user_id == patient_id).all()

    distinct_dates = set()
    for c in checkins:
        if c.timestamp:
            distinct_dates.add(c.timestamp.strftime("%Y-%m-%d"))
    for p in physios:
        if p.timestamp:
            distinct_dates.add(p.timestamp.strftime("%Y-%m-%d"))
    for l in lifestyles:
        if l.date:
            distinct_dates.add(str(l.date))

    tot_obs = len(checkins) + len(physios) + len(lifestyles)
    distinct_count = len(distinct_dates)

    # Latest twin state
    latest_twin = db.query(TwinStateSnapshot).filter(
        TwinStateSnapshot.user_id == patient_id
    ).order_by(TwinStateSnapshot.timestamp.desc()).first()

    twin_dict = None
    if latest_twin:
        twin_dict = {
            "state_label": latest_twin.state_label,
            "composite_stress_index": latest_twin.composite_stress_index,
            "physiological_arousal_score": latest_twin.physiological_arousal_score,
            "circadian_disruption_index": latest_twin.circadian_disruption_index,
            "baseline_deviation_score": latest_twin.baseline_deviation_score,
            "timestamp": latest_twin.timestamp.isoformat(),
        }

    # Latest review note
    latest_note = db.query(ClinicianReviewNote).filter(
        ClinicianReviewNote.patient_id == patient_id
    ).order_by(ClinicianReviewNote.review_date.desc()).first()

    note_out = None
    if latest_note:
        clinician_author = db.query(User).filter(User.id == latest_note.clinician_id).first()
        note_out = ClinicianReviewNoteOut(
            id=latest_note.id,
            patient_id=latest_note.patient_id,
            clinician_id=latest_note.clinician_id,
            clinician_name=clinician_author.full_name if clinician_author else "Clinician",
            review_date=latest_note.review_date,
            reporting_period_start=latest_note.reporting_period_start,
            reporting_period_end=latest_note.reporting_period_end,
            summary_observations=latest_note.summary_observations,
            discussion_topics=latest_note.discussion_topics,
            follow_up_plan=latest_note.follow_up_plan,
            follow_up_date=latest_note.follow_up_date,
            follow_up_status=latest_note.follow_up_status or "planned",
            created_at=latest_note.created_at,
            updated_at=latest_note.updated_at,
        )

    # Prediction eligibility (requires 7 distinct past days)
    if distinct_count >= 7:
        pred_avail = "available"
        pred_msg = None
    else:
        pred_avail = "unavailable_cold_start"
        pred_msg = f"Requires at least 7 distinct days of prior historical observations. Patient currently has {distinct_count}/7 recorded."

    return PatientOverviewOut(
        patient_id=patient.id,
        display_name=patient.full_name or patient.email.split("@")[0],
        email=patient.email,
        age=profile.age if profile else None,
        biological_sex=profile.biological_sex if profile else None,
        is_demo_patient=(patient.email == DEMO_PATIENT_EMAIL),
        trait_anxiety_score=profile.trait_anxiety_score if profile else None,
        has_panic_history=bool(profile.has_panic_history) if profile else False,
        baseline_status="Empirical Baseline Active" if distinct_count >= 3 and tot_obs >= 5 else "Cold-Start Calibration",
        mean_resting_hr=profile.baseline_resting_hr if profile else 70.0,
        mean_hrv_ms=profile.baseline_hrv_ms if profile else 48.0,
        mean_sleep_hours=profile.baseline_sleep_hours if profile else 7.5,
        mean_caffeine_cups=profile.baseline_caffeine_cups if profile else 1.0,
        total_observations=tot_obs,
        distinct_days=distinct_count,
        data_completeness_percent=min(100, int((tot_obs / 28.0) * 100)) if tot_obs > 0 else 0,
        latest_twin_state=twin_dict,
        prediction_availability=pred_avail,
        prediction_cold_start_message=pred_msg,
        latest_review_note=note_out,
    )


# =========================================================================
# 5. PROFESSIONAL REPORTLAB PDF GENERATOR
# =========================================================================

def generate_patient_summary_pdf(
    patient_id: int,
    clinician_name: str,
    options: PdfExportOptions,
    db: Session,
) -> bytes:
    """
    Renders a multi-page, professional clinical summary PDF adhering to healthcare
    document standards. Respects user-selected section options.
    """
    patient = db.query(User).filter(User.id == patient_id).first()
    overview = get_patient_overview(patient_id, db)
    insights = calculate_clinical_twin_insights(patient_id, db, days=options.reporting_days)
    timeline = get_patient_timeline(patient_id, db, days=options.reporting_days, include_simulated=options.include_simulated)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Custom Typography Styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0f172a"),
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#475569"),
    )
    h2_style = ParagraphStyle(
        "SectionHeader",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#0f766e"),  # Teal-700
        spaceBefore=14,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "BodyTextCustom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1e293b"),
    )
    body_bold = ParagraphStyle(
        "BodyBoldCustom",
        parent=body_style,
        fontName="Helvetica-Bold",
    )
    badge_style = ParagraphStyle(
        "BadgeText",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0f766e"),
    )
    disclaimer_style = ParagraphStyle(
        "DisclaimerText",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=7.5,
        leading=10.5,
        textColor=colors.HexColor("#64748b"),
    )

    story = []

    # 1. Header Banner
    story.append(Paragraph("ANXIETYTWIN CLINICAL SUMMARY REPORT", title_style))
    story.append(Paragraph(
        "Investigational Digital Twin Longitudinal Review & Physiological Decision Support Prototype",
        subtitle_style
    ))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0f766e"), spaceAfter=10))

    # 2. Patient & Report Metadata Table
    now_str = utc_now().strftime("%B %d, %Y at %H:%M UTC")
    meta_data = [
        [
            Paragraph("<b>Patient Identifier:</b>", body_style),
            Paragraph(overview.display_name + (" [SYNTHETIC DEMO]" if overview.is_demo_patient else ""), body_bold),
            Paragraph("<b>Reviewer:</b>", body_style),
            Paragraph(clinician_name, body_style),
        ],
        [
            Paragraph("<b>Reporting Period:</b>", body_style),
            Paragraph(f"Last {options.reporting_days} Days", body_style),
            Paragraph("<b>Generated Date:</b>", body_style),
            Paragraph(now_str, body_style),
        ],
        [
            Paragraph("<b>Baseline Calibration:</b>", body_style),
            Paragraph(overview.baseline_status, body_bold),
            Paragraph("<b>Data Completeness:</b>", body_style),
            Paragraph(f"{overview.data_completeness_percent}% ({overview.total_observations} records across {overview.distinct_days} days)", body_style),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[120, 160, 110, 150])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # 3. Digital Twin Baseline & Current State
    story.append(Paragraph("1. Digital Twin Autonomic Baseline & Current Status", h2_style))
    base_data = [
        [
            Paragraph("Metric", body_bold),
            Paragraph("Individual Baseline", body_bold),
            Paragraph("Recent Average", body_bold),
            Paragraph("Observed Deviation", body_bold),
            Paragraph("Clinical Context", body_bold),
        ],
        [
            Paragraph("Resting Heart Rate", body_style),
            Paragraph(f"{overview.mean_resting_hr:.1f} BPM", body_style),
            Paragraph(f"{insights[0].current_value:.1f} BPM" if insights and insights[0].current_value else "—", body_style),
            Paragraph(f"{insights[0].delta:+.1f} BPM" if insights and insights[0].delta else "0.0", body_style),
            Paragraph("Autonomic sympathetic equilibrium", disclaimer_style),
        ],
        [
            Paragraph("HRV rMSSD", body_style),
            Paragraph(f"{overview.mean_hrv_ms:.1f} ms", body_style),
            Paragraph(f"{insights[1].current_value:.1f} ms" if len(insights) > 1 and insights[1].current_value else "—", body_style),
            Paragraph(f"{insights[1].delta:+.1f} ms" if len(insights) > 1 and insights[1].delta else "0.0", body_style),
            Paragraph("Vagal parasympathetic tone marker", disclaimer_style),
        ],
        [
            Paragraph("Sleep Duration", body_style),
            Paragraph(f"{overview.mean_sleep_hours:.1f} hours", body_style),
            Paragraph(f"{insights[2].current_value:.1f} hrs" if len(insights) > 2 and insights[2].current_value else "—", body_style),
            Paragraph(f"{insights[2].delta:+.1f} hrs" if len(insights) > 2 and insights[2].delta else "0.0", body_style),
            Paragraph("Suprachiasmatic circadian hygiene", disclaimer_style),
        ],
    ]
    base_table = Table(base_data, colWidths=[120, 100, 100, 90, 130])
    base_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ccfbf1")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#0f766e")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(base_table)
    story.append(Spacer(1, 10))

    # 4. Explainable Digital Twin Insights
    if options.include_twin_insights and insights:
        story.append(Paragraph("2. Explainable Digital Twin Clinical Insights", h2_style))
        for ins in insights:
            ins_box = [
                [
                    Paragraph(f"<b>{ins.factor}</b> ({ins.category.upper()})", body_bold),
                    Paragraph(f"Significance: <b>{ins.significance.upper()}</b>", badge_style),
                ],
                [
                    Paragraph(ins.observation, body_style),
                    Paragraph(f"Window: {ins.time_window}", disclaimer_style),
                ],
                [
                    Paragraph(f"<b>Non-Causal Note:</b> {ins.non_causal_interpretation}", disclaimer_style),
                    Paragraph(f"Data source: {ins.source_provenance}", disclaimer_style),
                ],
            ]
            t_ins = Table(ins_box, colWidths=[380, 160])
            t_ins.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]))
            story.append(t_ins)
            story.append(Spacer(1, 4))
        story.append(Spacer(1, 6))

    # 5. Machine Learning Prospective Forecast
    if options.include_prediction:
        story.append(Paragraph("3. Machine Learning 24h Prospective Panic Forecast (DBP)", h2_style))
        if overview.prediction_availability == "available":
            pred_text = "Personalized machine learning inference evaluated on 7-day longitudinal deviation features. Horizon: ~24h impending panic risk. Experimental research prototype; not certified for diagnostic classification."
        else:
            pred_text = (
                f"<b>Prediction Unavailable:</b> {overview.prediction_cold_start_message or 'Requires 7 distinct historical observation days.'} "
                f"Personalized predictive inference is strictly withheld during cold-start to prevent deceptive forecasting."
            )
        pred_box = Table([[Paragraph(pred_text, body_style)]], colWidths=[540])
        pred_box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(pred_box)
        story.append(Spacer(1, 10))

    # 6. Longitudinal Check-Ins & Vitals History
    if options.include_checkins and timeline:
        story.append(Paragraph(f"4. Longitudinal Patient History (Last {options.reporting_days} Days)", h2_style))
        history_rows = [
            [
                Paragraph("Timestamp", body_bold),
                Paragraph("Event Type", body_bold),
                Paragraph("Summary Findings", body_bold),
                Paragraph("Provenance", body_bold),
            ]
        ]
        for ev in timeline[:12]:  # Top 12 events
            history_rows.append([
                Paragraph(ev.timestamp.strftime("%b %d, %H:%M"), body_style),
                Paragraph(ev.event_type.replace("_", " ").title(), body_style),
                Paragraph(ev.summary, body_style),
                Paragraph(f"<b>{ev.source_type}</b>" + (" [SIMULATED]" if ev.is_simulated else ""), disclaimer_style),
            ])
        hist_table = Table(history_rows, colWidths=[90, 95, 260, 95])
        hist_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(hist_table)
        story.append(Spacer(1, 10))

    # 7. Clinician Review Notes
    if options.include_clinician_notes and overview.latest_review_note:
        n = overview.latest_review_note
        story.append(Paragraph("5. Documented Clinician Review & Follow-Up Plan", h2_style))
        note_content = [
            [Paragraph("<b>Review Date:</b>", body_style), Paragraph(n.review_date.strftime("%B %d, %Y"), body_style)],
            [Paragraph("<b>Author:</b>", body_style), Paragraph(n.clinician_name or "Attending Clinician", body_style)],
            [Paragraph("<b>Clinical Observations:</b>", body_style), Paragraph(n.summary_observations, body_style)],
            [Paragraph("<b>Discussion Topics:</b>", body_style), Paragraph(n.discussion_topics or "None recorded", body_style)],
            [Paragraph("<b>Follow-Up Plan:</b>", body_style), Paragraph(n.follow_up_plan or "Routine follow-up", body_style)],
            [Paragraph("<b>Target Follow-Up Date:</b>", body_style), Paragraph(f"{n.follow_up_date or 'TBD'} (Status: {n.follow_up_status.title()})", body_style)],
        ]
        t_note = Table(note_content, colWidths=[130, 410])
        t_note.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fafaf9")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d6d3d1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e7e5e4")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(t_note)
        story.append(Spacer(1, 10))

    # 8. Supportive Coping Interventions & Patient Feedback
    include_ints = getattr(options, "include_interventions", True)
    if include_ints:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=options.reporting_days)
        ints_query = db.query(InterventionSession).filter(
            InterventionSession.user_id == patient_id,
            InterventionSession.started_at >= cutoff_date.replace(tzinfo=None),
        )
        if not options.include_simulated:
            ints_query = ints_query.filter(InterventionSession.source_type != "simulated")
        patient_ints = ints_query.order_by(InterventionSession.started_at.desc()).all()

        if patient_ints:
            story.append(Paragraph("6. Supportive Coping Interventions & Patient Feedback", h2_style))
            int_rows = [
                [
                    Paragraph("Timestamp", body_bold),
                    Paragraph("Activity Type", body_bold),
                    Paragraph("Pre → Post Distress", body_bold),
                    Paragraph("User Helpfulness Rating", body_bold),
                ]
            ]
            for itm in patient_ints[:8]:
                act_name = {
                    "breathing_478": "4-7-8 Breathing Pacer",
                    "grounding_54321": "5-4-3-2-1 Sensory Grounding",
                    "sleep_hygiene": "Sleep Hygiene Protocol",
                    "checkin_prompt": "Daily Check-In",
                    "routine_monitoring": "Routine Monitoring",
                }.get(itm.intervention_type, itm.intervention_type.replace("_", " ").title())

                delta_p = f" (Δ {itm.rating_delta:+.1f})" if itm.rating_delta is not None else ""
                score_cell = (
                    f"{itm.pre_distress_rating:.0f}/10 → {itm.post_distress_rating:.0f}/10{delta_p}"
                    if (itm.pre_distress_rating is not None and itm.post_distress_rating is not None)
                    else "Completed"
                )
                help_cell = (itm.helpfulness or "Not rated").replace("_", " ").title()

                int_rows.append([
                    Paragraph(itm.started_at.strftime("%b %d, %H:%M"), body_style),
                    Paragraph(act_name, body_style),
                    Paragraph(score_cell, body_style),
                    Paragraph(help_cell, disclaimer_style),
                ])

            t_ints = Table(int_rows, colWidths=[90, 160, 150, 140])
            t_ints.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]))
            story.append(t_ints)
            story.append(Spacer(1, 10))

    # 9. Regulatory, Safety, & Crisis Disclaimers
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8"), spaceAfter=8))
    disclaimer_p = (
        "<b>CLINICAL PROTOCOL & NON-DIAGNOSTIC DISCLAIMER:</b> AnxietyTwin is an investigational research prototype "
        "designed for educational digital-twin modeling and clinical decision-support demonstration. It is not an FDA-cleared "
        "or CE-marked medical device and does not substitute for clinical judgment, licensed psychiatric diagnosis, or emergency intervention. "
        "In case of immediate distress, contact local emergency services or national crisis helplines (US/Canada: 988, UK: 111, India: 14416)."
    )
    story.append(Paragraph(disclaimer_p, disclaimer_style))

    # Build PDF
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
