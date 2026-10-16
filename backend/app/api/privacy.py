"""
privacy.py - Feature 8: Privacy & Consent Center API Router
Handles clinician access grant management, instant revocation, privacy category transparency,
full personal data export, password-verified account deletion, and privacy audit logging.
Strict backend authorization checks: never relies on frontend hiding.
"""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import json
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.security import verify_password
from backend.app.models.db_models import (
    User,
    UserProfile,
    Consent,
    PatientAccessGrant,
    AnxietyCheckin,
    PhysiologicalObservation,
    LifestyleObservation,
    InterventionSession,
    DiscoveredPattern,
    WellnessGoal,
    EmotionJournalEntry,
    PrivacyAuditLog,
)
from backend.app.models.schemas import (
    PrivacyDashboardOut,
    PrivacyAuditLogOut,
    AccountDeletionRequest,
    AccountDeletionResponse,
    PatientAccessGrantOut,
    PatientAccessGrantCreate,
)
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/privacy", tags=["Privacy & Consent Center"])


@router.get("/dashboard", response_model=PrivacyDashboardOut)
def get_privacy_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns comprehensive transparency information regarding stored categories,
    role-based permissions, active clinician grants, and retention policies.
    """
    active_grants = (
        db.query(PatientAccessGrant)
        .filter(PatientAccessGrant.patient_id == current_user.id, PatientAccessGrant.is_active == True, PatientAccessGrant.revoked_at == None)
        .count()
    )
    revoked_grants = (
        db.query(PatientAccessGrant)
        .filter(PatientAccessGrant.patient_id == current_user.id, (PatientAccessGrant.is_active == False) | (PatientAccessGrant.revoked_at != None))
        .count()
    )
    audit_count = db.query(PrivacyAuditLog).filter(PrivacyAuditLog.user_id == current_user.id).count()

    categories = [
        {
            "category_name": "Account Credentials & Profile",
            "data_type": "Identity & Baseline Metrics",
            "provenance": "User-Reported",
            "accessible_by": "Participant only (Clinicians can view age/sex baseline during active grant)",
            "retention": "Persisted until account deletion",
        },
        {
            "category_name": "Subjective Anxiety Check-ins",
            "data_type": "Distress ratings, somatic symptoms, context tags",
            "provenance": "User-Reported",
            "accessible_by": "Participant and Authorized Clinicians (with active consent grant)",
            "retention": "Persisted until account deletion",
        },
        {
            "category_name": "Physiological & Lifestyle Telemetry",
            "data_type": "Resting HR, HRV, sleep duration, caffeine, steps",
            "provenance": "Measured / User-Reported",
            "accessible_by": "Participant and Authorized Clinicians (with active consent grant)",
            "retention": "Persisted until account deletion",
        },
        {
            "category_name": "Emotion Journal Reflections",
            "data_type": "Qualitative thoughts, emotion tags, structured prompts",
            "provenance": "User-Reported",
            "accessible_by": "Strictly Participant-Only by default (Clinicians only see explicitly shared entries)",
            "retention": "Persisted until account deletion or entry deletion",
        },
        {
            "category_name": "Digital Twin Calculations & ML Predictions",
            "data_type": "Arousal scores, composite index, 24h DBP risk band",
            "provenance": "Derived / Experimental ML",
            "accessible_by": "Participant and Authorized Clinicians",
            "retention": "Dynamic state snapshots stored for longitudinal trend analysis",
        },
        {
            "category_name": "Simulation Lab Experiments",
            "data_type": "Counterfactual synthetic scenarios",
            "provenance": "Synthetic Simulation",
            "accessible_by": "Participant only",
            "retention": "Quarantined; never mixed with personal health history",
        },
    ]

    role_matrix = [
        {"role": "Participant (You)", "access_level": "Full Ownership (Read, Write, Export, Delete)", "scope": "All personal records"},
        {"role": "Authorized Clinician", "access_level": "Review & Coordination (Read timeline, Add review notes, Follow-up tasks)", "scope": "Subject to active consent grant; cannot read private journal"},
        {"role": "System / ML Engine", "access_level": "Automated Inference & Calculation", "scope": "Calculates composite stress index; no external third-party sale or telemetry transfer"},
    ]

    return PrivacyDashboardOut(
        user_email=current_user.email,
        stored_categories=categories,
        role_access_matrix=role_matrix,
        active_grants_count=active_grants,
        revoked_grants_count=revoked_grants,
        recent_audit_count=audit_count,
        retention_policy_summary="User data is retained for your personal longitudinal reflection. Full data export and complete account deletion are supported at any time with immediate effect.",
    )


@router.get("/grants", response_model=List[PatientAccessGrantOut])
def list_patient_grants(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lists all clinician access grants (active, revoked, expired) with consent details.
    """
    grants = (
        db.query(PatientAccessGrant)
        .filter(PatientAccessGrant.patient_id == current_user.id)
        .order_by(PatientAccessGrant.created_at.desc())
        .all()
    )
    return grants


@router.post("/grants", response_model=PatientAccessGrantOut, status_code=status.HTTP_201_CREATED)
def grant_clinician_access(
    grant_in: PatientAccessGrantCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Grants explicit consent access to a clinician.
    """
    target_patient_id = current_user.id
    clinician_id = grant_in.clinician_id
    if not clinician_id and grant_in.clinician_email:
        c = db.query(User).filter(User.email == grant_in.clinician_email).first()
        if c:
            clinician_id = c.id

    if not clinician_id:
        raise HTTPException(status_code=400, detail="Clinician ID or email required.")

    now = datetime.now(timezone.utc)
    grant = PatientAccessGrant(
        patient_id=target_patient_id,
        clinician_id=clinician_id,
        scope=grant_in.scope or "full_review",
        is_active=True,
        notes=grant_in.notes or "Consent granted via Privacy Center",
        created_at=now,
    )
    db.add(grant)

    audit = PrivacyAuditLog(
        user_id=target_patient_id,
        action="clinician_grant_created",
        performed_by_id=current_user.id,
        details_json=json.dumps({"clinician_id": clinician_id, "scope": grant.scope}),
        timestamp=now,
    )
    db.add(audit)

    db.commit()
    db.refresh(grant)
    return PatientAccessGrantOut(
        id=grant.id,
        patient_id=grant.patient_id,
        clinician_id=grant.clinician_id,
        patient_email=current_user.email,
        patient_name=current_user.full_name,
        scope=grant.scope,
        is_active=grant.is_active,
        created_at=grant.created_at,
        revoked_at=grant.revoked_at,
        notes=grant.notes,
    )


@router.post("/grants/{grant_id}/revoke")
def revoke_clinician_grant(
    grant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Immediately revokes an authorized clinician access grant.
    Enforces immediate cessation of clinician visibility across all backend review endpoints.
    """
    grant = (
        db.query(PatientAccessGrant)
        .filter(PatientAccessGrant.id == grant_id, PatientAccessGrant.patient_id == current_user.id)
        .first()
    )
    if not grant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access grant not found.")

    now = datetime.now(timezone.utc)
    grant.is_active = False
    grant.revoked_at = now

    audit = PrivacyAuditLog(
        user_id=current_user.id,
        action="clinician_grant_revoked",
        performed_by_id=current_user.id,
        details_json=json.dumps({"grant_id": grant.id, "clinician_id": grant.clinician_id}),
        timestamp=now,
    )
    db.add(audit)

    db.commit()
    db.refresh(grant)
    return {
        "message": "Clinician access grant successfully revoked with immediate effect.",
        "grant_id": grant.id,
        "is_active": grant.is_active,
        "revoked_at": grant.revoked_at.isoformat(),
    }


@router.get("/audit-log", response_model=List[PrivacyAuditLogOut])
def list_privacy_audit_logs(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns immutable audit history for consent, access grant, and export actions.
    """
    logs = (
        db.query(PrivacyAuditLog)
        .filter(PrivacyAuditLog.user_id == current_user.id)
        .order_by(PrivacyAuditLog.timestamp.desc())
        .limit(limit)
        .all()
    )
    return logs


@router.get("/export")
def export_user_data_bundle(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generates a complete, downloadable JSON archive of all personal records.
    Excludes sensitive credentials and system secret tokens.
    """
    now = datetime.now(timezone.utc)

    # 1. User profile
    profile = current_user.profile
    profile_data = {
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        "age": profile.age if profile else None,
        "biological_sex": profile.biological_sex if profile else None,
        "baseline_resting_hr": profile.baseline_resting_hr if profile else 72.0,
        "baseline_sleep_hours": profile.baseline_sleep_hours if profile else 7.5,
        "baseline_hrv_ms": profile.baseline_hrv_ms if profile else 45.0,
    }

    # 2. Check-ins
    checkins = db.query(AnxietyCheckin).filter(AnxietyCheckin.user_id == current_user.id).all()
    checkin_list = [
        {
            "id": c.id,
            "timestamp": c.timestamp.isoformat() if c.timestamp else None,
            "distress_score": c.subjective_anxiety_score,
            "energy_level": c.energy_level,
            "somatic_symptoms": c.somatic_symptoms,
            "triggers_noted": c.triggers_noted,
            "context_tags": c.context_tags,
            "notes": c.notes,
        }
        for c in checkins
    ]

    # 3. Observations
    physios = db.query(PhysiologicalObservation).filter(PhysiologicalObservation.user_id == current_user.id).all()
    physio_list = [
        {
            "id": p.id,
            "timestamp": p.timestamp.isoformat() if p.timestamp else None,
            "heart_rate_bpm": p.heart_rate_bpm,
            "hrv_ms": p.heart_rate_variability_ms,
            "steps": p.steps_count,
            "source": p.source_type,
        }
        for p in physios
    ]

    lifestyles = db.query(LifestyleObservation).filter(LifestyleObservation.user_id == current_user.id).all()
    lifestyle_list = [
        {
            "id": l.id,
            "date": l.date,
            "sleep_hours": l.sleep_hours,
            "caffeine_cups": l.caffeine_cups,
            "exercise_minutes": l.exercise_minutes,
        }
        for l in lifestyles
    ]

    # 4. Interventions
    sessions = db.query(InterventionSession).filter(InterventionSession.user_id == current_user.id).all()
    session_list = [
        {
            "id": s.id,
            "type": s.intervention_type,
            "status": s.status,
            "pre_distress": s.pre_distress_rating,
            "post_distress": s.post_distress_rating,
            "rating_delta": s.rating_delta,
            "helpfulness": s.helpfulness,
            "notes": s.user_notes,
            "started_at": s.started_at.isoformat() if s.started_at else None,
        }
        for s in sessions
    ]

    # 5. Wellness Goals
    goals = db.query(WellnessGoal).filter(WellnessGoal.user_id == current_user.id).all()
    goal_list = [
        {
            "id": g.id,
            "title": g.title,
            "category": g.category,
            "target_frequency": g.target_frequency,
            "target_count": g.target_count,
            "status": g.status,
        }
        for g in goals
    ]

    # 6. Emotion Journal
    journals = db.query(EmotionJournalEntry).filter(EmotionJournalEntry.user_id == current_user.id).all()
    journal_list = [
        {
            "id": j.id,
            "title": j.title,
            "content": j.content,
            "mood_tags": j.mood_tags,
            "context_tags": j.context_tags,
            "distress_rating": j.distress_rating,
            "prompt_responses": j.prompt_responses,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        }
        for j in journals
    ]

    export_bundle = {
        "export_metadata": {
            "application": "AnxietyTwin",
            "export_timestamp": now.isoformat(),
            "user_id": current_user.id,
            "user_email": current_user.email,
            "version": "1.0.0",
        },
        "profile": profile_data,
        "checkins": checkin_list,
        "physiological_observations": physio_list,
        "lifestyle_observations": lifestyle_list,
        "coping_interventions": session_list,
        "wellness_goals": goal_list,
        "emotion_journal_entries": journal_list,
    }

    # Log export audit event
    audit = PrivacyAuditLog(
        user_id=current_user.id,
        action="personal_data_exported",
        performed_by_id=current_user.id,
        details_json=json.dumps({"record_counts": {
            "checkins": len(checkin_list),
            "physios": len(physio_list),
            "lifestyles": len(lifestyle_list),
            "journals": len(journal_list),
        }}),
        timestamp=now,
    )
    db.add(audit)
    db.commit()

    export_json = json.dumps(export_bundle, indent=2)
    filename = f"AnxietyTwin_Data_Export_{now.strftime('%Y%m%d_%H%M%S')}.json"

    return Response(
        content=export_json,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/delete-account", response_model=AccountDeletionResponse)
def delete_user_account(
    req: AccountDeletionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Permanently deletes user account and cascades deletion of all associated observations,
    check-ins, journal entries, goals, and simulation runs.
    Requires password re-authentication and typing confirmation phrase 'DELETE MY ACCOUNT'.
    """
    if req.confirmation_phrase.strip() != "DELETE MY ACCOUNT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation phrase must exactly match 'DELETE MY ACCOUNT'.",
        )

    if not verify_password(req.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Re-authentication failed.",
        )

    user_email = current_user.email
    now = datetime.now(timezone.utc)

    # Clean up dependent records and user via cascade
    db.query(PrivacyAuditLog).filter(PrivacyAuditLog.performed_by_id == current_user.id).delete(synchronize_session=False)
    db.delete(current_user)
    db.commit()

    return AccountDeletionResponse(
        status="success",
        message="Your AnxietyTwin account and all associated personal observations have been permanently deleted.",
        deleted_account_email=user_email,
        deleted_at=now,
    )
