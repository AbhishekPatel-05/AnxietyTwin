"""
clinician.py - Phase 6.2 Patient Review & Clinical Insight Workspace API Router
Enforces strict clinician role authentication, consent-based patient access grants,
longitudinal timeline collation, explainable twin insights, review notes, and PDF exports.
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.db_models import (
    User,
    PatientAccessGrant,
    ClinicianReviewNote,
    InterventionSession,
    ClinicianFollowUpTask,
    PrivacyAuditLog,
    AnxietyCheckin,
)
from backend.app.models.schemas import (
    PatientCardOut,
    PatientOverviewOut,
    TimelineEventOut,
    TwinInsightOut,
    ClinicianReviewNoteCreate,
    ClinicianReviewNoteUpdate,
    ClinicianReviewNoteOut,
    PatientAccessGrantCreate,
    PatientAccessGrantOut,
    PdfExportOptions,
    InterventionSessionOut,
    ClinicianFollowUpTaskCreate,
    ClinicianFollowUpTaskUpdate,
    ClinicianFollowUpTaskOut,
    ClinicianTasksOverviewOut,
    PatientTaskAcknowledge,
)
from backend.app.services.intervention_engine import InterventionEngine
import json
from datetime import timedelta
from backend.app.api.deps import get_current_clinician, get_current_user
from backend.app.services.clinical_service import (
    seed_or_reset_demo_patient,
    get_patient_timeline,
    calculate_clinical_twin_insights,
    get_authorized_patients_list,
    get_patient_overview,
    verify_patient_access,
    generate_patient_summary_pdf,
    DEMO_PATIENT_EMAIL,
)

router = APIRouter(prefix="/clinician", tags=["Clinician Workspace"])


# =========================================================================
# 1. PATIENT DISCOVERY & ACCESS CONTROL
# =========================================================================

@router.get("/patients", response_model=List[PatientCardOut])
def list_authorized_patients(
    current_clinician: User = Depends(get_current_clinician),
    db: Session = Depends(get_db),
):
    """
    Returns only patients where the clinician has an active, non-revoked consent grant,
    plus the isolated synthetic demo patient. Does not expose a public patient directory.
    """
    # Ensure synthetic demo patient is seeded and populated
    demo_pat = db.query(User).filter(User.email == DEMO_PATIENT_EMAIL).first()
    if not demo_pat or db.query(AnxietyCheckin).filter(AnxietyCheckin.user_id == demo_pat.id).count() < 5:
        seed_or_reset_demo_patient(db, clinician_id=current_clinician.id)

    return get_authorized_patients_list(current_clinician.id, db)


@router.get("/patients/{patient_id}/overview", response_model=PatientOverviewOut)
def get_patient_overview_endpoint(
    patient_id: int,
    current_clinician: User = Depends(get_current_clinician),
    db: Session = Depends(get_db),
):
    """
    Retrieves profile summary, baseline calibration status, and data completeness
    for an authorized patient.
    """
    verify_patient_access(patient_id, current_clinician, db)
    return get_patient_overview(patient_id, db)


# =========================================================================
# 2. LONGITUDINAL PATIENT TIMELINE
# =========================================================================

@router.get("/patients/{patient_id}/timeline", response_model=List[TimelineEventOut])
def get_timeline_endpoint(
    patient_id: int,
    days: Optional[int] = Query(None, ge=1, le=90),
    period_days: Optional[int] = Query(None, ge=1, le=90),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    include_simulated: bool = Query(False, description="Whether to include simulated telemetry. Default is False."),
    hide_simulated: Optional[bool] = Query(None, description="Inverted alias for include_simulated."),
    event_types: Optional[str] = Query(None, description="Comma-separated event types or single type."),
    current_clinician: User = Depends(get_current_clinician),
    db: Session = Depends(get_db),
):
    """
    Collatest multi-modal observations into a unified chronological feed.
    Simulated readings are hidden by default to prevent clinical confusion.
    """
    verify_patient_access(patient_id, current_clinician, db)
    effective_days = period_days if period_days is not None else (days or 30)
    effective_include_sim = not hide_simulated if hide_simulated is not None else include_simulated
    parsed_event_types = [e.strip() for e in event_types.split(",") if e.strip()] if event_types else None

    return get_patient_timeline(
        patient_id=patient_id,
        db=db,
        days=effective_days,
        start_date=start_date,
        end_date=end_date,
        include_simulated=effective_include_sim,
        event_types=parsed_event_types,
    )


# =========================================================================
# 3. EXPLAINABLE DIGITAL TWIN CLINICAL INSIGHTS
# =========================================================================

@router.get("/patients/{patient_id}/insights", response_model=List[TwinInsightOut])
def get_clinical_insights_endpoint(
    patient_id: int,
    days: Optional[int] = Query(None, ge=1, le=60),
    period_days: Optional[int] = Query(None, ge=1, le=60),
    current_clinician: User = Depends(get_current_clinician),
    db: Session = Depends(get_db),
):
    """
    Synthesizes data-driven insights with baseline comparison deltas,
    data limitations, non-causal disclosures, and linked supporting record IDs.
    """
    verify_patient_access(patient_id, current_clinician, db)
    effective_days = period_days if period_days is not None else (days or 14)
    return calculate_clinical_twin_insights(patient_id=patient_id, db=db, days=effective_days)


# =========================================================================
# 4. CLINICIAN REVIEW NOTES & FOLLOW-UP TRACKING
# =========================================================================

@router.get("/patients/{patient_id}/notes", response_model=List[ClinicianReviewNoteOut])
def list_patient_notes(
    patient_id: int,
    current_clinician: User = Depends(get_current_clinician),
    db: Session = Depends(get_db),
):
    verify_patient_access(patient_id, current_clinician, db)
    notes = db.query(ClinicianReviewNote).filter(
        ClinicianReviewNote.patient_id == patient_id
    ).order_by(ClinicianReviewNote.review_date.desc()).all()

    out: List[ClinicianReviewNoteOut] = []
    for n in notes:
        author = db.query(User).filter(User.id == n.clinician_id).first()
        out.append(ClinicianReviewNoteOut(
            id=n.id,
            patient_id=n.patient_id,
            clinician_id=n.clinician_id,
            clinician_name=author.full_name if author else "Clinician",
            review_date=n.review_date,
            reporting_period_start=n.reporting_period_start,
            reporting_period_end=n.reporting_period_end,
            summary_observations=n.summary_observations,
            discussion_topics=n.discussion_topics,
            follow_up_plan=n.follow_up_plan,
            follow_up_date=n.follow_up_date,
            follow_up_status=n.follow_up_status or "planned",
            created_at=n.created_at,
            updated_at=n.updated_at,
        ))
    return out


@router.post("/patients/{patient_id}/notes", response_model=ClinicianReviewNoteOut, status_code=status.HTTP_201_CREATED)
def create_patient_note(
    patient_id: int,
    note_in: ClinicianReviewNoteCreate,
    current_clinician: User = Depends(get_current_clinician),
    db: Session = Depends(get_db),
):
    verify_patient_access(patient_id, current_clinician, db)

    note = ClinicianReviewNote(
        patient_id=patient_id,
        clinician_id=current_clinician.id,
        review_date=datetime.now(timezone.utc),
        reporting_period_start=note_in.reporting_period_start,
        reporting_period_end=note_in.reporting_period_end,
        summary_observations=note_in.summary_observations,
        discussion_topics=note_in.discussion_topics,
        follow_up_plan=note_in.follow_up_plan,
        follow_up_date=note_in.follow_up_date,
        follow_up_status=note_in.follow_up_status or "planned",
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    return ClinicianReviewNoteOut(
        id=note.id,
        patient_id=note.patient_id,
        clinician_id=note.clinician_id,
        clinician_name=current_clinician.full_name or "Clinician",
        review_date=note.review_date,
        reporting_period_start=note.reporting_period_start,
        reporting_period_end=note.reporting_period_end,
        summary_observations=note.summary_observations,
        discussion_topics=note.discussion_topics,
        follow_up_plan=note.follow_up_plan,
        follow_up_date=note.follow_up_date,
        follow_up_status=note.follow_up_status,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.put("/patients/{patient_id}/notes/{note_id}", response_model=ClinicianReviewNoteOut)
def update_patient_note(
    patient_id: int,
    note_id: int,
    note_update: ClinicianReviewNoteUpdate,
    current_clinician: User = Depends(get_current_clinician),
    db: Session = Depends(get_db),
):
    verify_patient_access(patient_id, current_clinician, db)
    note = db.query(ClinicianReviewNote).filter(
        ClinicianReviewNote.id == note_id,
        ClinicianReviewNote.patient_id == patient_id,
    ).first()

    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found.")

    # Only author or admin can edit
    if note.clinician_id != current_clinician.id and current_clinician.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only edit notes you authored.")

    if note_update.summary_observations is not None:
        note.summary_observations = note_update.summary_observations
    if note_update.discussion_topics is not None:
        note.discussion_topics = note_update.discussion_topics
    if note_update.follow_up_plan is not None:
        note.follow_up_plan = note_update.follow_up_plan
    if note_update.follow_up_date is not None:
        note.follow_up_date = note_update.follow_up_date
    if note_update.follow_up_status is not None:
        note.follow_up_status = note_update.follow_up_status

    db.commit()
    db.refresh(note)

    return ClinicianReviewNoteOut(
        id=note.id,
        patient_id=note.patient_id,
        clinician_id=note.clinician_id,
        clinician_name=current_clinician.full_name or "Clinician",
        review_date=note.review_date,
        reporting_period_start=note.reporting_period_start,
        reporting_period_end=note.reporting_period_end,
        summary_observations=note.summary_observations,
        discussion_topics=note.discussion_topics,
        follow_up_plan=note.follow_up_plan,
        follow_up_date=note.follow_up_date,
        follow_up_status=note.follow_up_status,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


# =========================================================================
# 5. PATIENT SUMMARY PDF GENERATION
# =========================================================================

@router.post("/patients/{patient_id}/pdf-summary")
def generate_pdf_endpoint(
    patient_id: int,
    options: PdfExportOptions,
    current_clinician: User = Depends(get_current_clinician),
    db: Session = Depends(get_db),
):
    """
    Renders a professional ReportLab PDF clinical summary reflecting
    the clinician's chosen section selection options.
    """
    verify_patient_access(patient_id, current_clinician, db)
    pdf_bytes = generate_patient_summary_pdf(
        patient_id=patient_id,
        clinician_name=current_clinician.full_name or "Authorized Clinician",
        options=options,
        db=db,
    )

    filename = f"AnxietyTwin_Patient_{patient_id}_Clinical_Summary_{datetime.now().strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


# =========================================================================
# 6. CONSENT ACCESS GRANTS WORKFLOW
# =========================================================================

@router.post("/grants", response_model=PatientAccessGrantOut, status_code=status.HTTP_201_CREATED)
def create_access_grant(
    grant_in: PatientAccessGrantCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Establishes an explicit consent-based access grant from a patient to a clinician.
    If called by a patient, grants access to the specified clinician.
    If called by a clinician (e.g. during onboarding/demo), creates mutual grant if authorized.
    """
    target_patient_id = grant_in.patient_id or current_user.id
    if grant_in.patient_email:
        p = db.query(User).filter(User.email == grant_in.patient_email).first()
        if p:
            target_patient_id = p.id

    clinician_id = grant_in.clinician_id
    if not clinician_id and grant_in.clinician_email:
        c = db.query(User).filter(User.email == grant_in.clinician_email).first()
        if c:
            clinician_id = c.id

    if not clinician_id:
        if current_user.role == "clinician":
            clinician_id = current_user.id
        else:
            demo_clin = db.query(User).filter(User.email == DEMO_CLINICIAN_EMAIL).first()
            clinician_id = demo_clin.id if demo_clin else current_user.id

    grant = PatientAccessGrant(
        patient_id=target_patient_id,
        clinician_id=clinician_id,
        scope=grant_in.scope,
        is_active=True,
        notes=grant_in.notes or "Patient-authorized clinical review grant",
    )
    db.add(grant)
    db.commit()
    db.refresh(grant)

    patient_user = db.query(User).filter(User.id == target_patient_id).first()

    return PatientAccessGrantOut(
        id=grant.id,
        patient_id=grant.patient_id,
        clinician_id=grant.clinician_id,
        patient_email=patient_user.email if patient_user else None,
        patient_name=patient_user.full_name if patient_user else None,
        scope=grant.scope,
        is_active=grant.is_active,
        created_at=grant.created_at,
        revoked_at=grant.revoked_at,
        notes=grant.notes,
    )


@router.post("/grants/{grant_id}/revoke")
def revoke_access_grant(
    grant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Revokes patient consent grant immediately, instantly blocking subsequent access.
    """
    grant = db.query(PatientAccessGrant).filter(PatientAccessGrant.id == grant_id).first()
    if not grant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grant not found.")

    # Only patient or granted clinician can revoke
    if grant.patient_id != current_user.id and grant.clinician_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized to revoke this grant.")

    grant.is_active = False
    grant.revoked_at = datetime.now(timezone.utc)
    db.commit()

    return {"status": "success", "message": "Consent grant successfully revoked. Clinician access terminated immediately."}


# =========================================================================
# 7. 1-CLICK SYNTHETIC DEMO RESET
# =========================================================================

@router.post("/demo/reset")
def reset_synthetic_demo_endpoint(
    current_clinician: User = Depends(get_current_clinician),
    db: Session = Depends(get_db),
):
    """
    Restores the synthetic demo patient ('Alex Rivera') to initial 8-day baseline state.
    Does not modify or delete any genuine user records.
    """
    patient = seed_or_reset_demo_patient(db, clinician_id=current_clinician.id)
    return {
        "status": "success",
        "message": "Synthetic demo patient profile reset to initial reproducible baseline.",
        "patient_id": patient.id,
        "patient_email": DEMO_PATIENT_EMAIL,
    }


# =========================================================================
# 8. PATIENT EARLY-WARNING SIGNALS & INTERVENTIONS
# =========================================================================

@router.get("/patients/{patient_id}/interventions")
def get_patient_interventions(
    patient_id: int,
    current_clinician: User = Depends(get_current_clinician),
    db: Session = Depends(get_db),
    period_days: int = Query(30, ge=1, le=365),
    activity_type: Optional[str] = Query(None),
    signal_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    source_type: Optional[str] = Query(None),
    hide_simulated: bool = Query(False),
):
    """
    Retrieves authorized patient's early-warning signals, baseline comparisons,
    and longitudinal coping intervention feedback history.
    """
    patient = verify_patient_access(patient_id, current_clinician, db)
    status_out = InterventionEngine.evaluate_user_status(patient, db)

    start_dt = datetime.now(timezone.utc) - timedelta(days=period_days)
    query = db.query(InterventionSession).filter(
        InterventionSession.user_id == patient_id,
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

    sessions = query.order_by(InterventionSession.started_at.desc()).all()
    history = []
    for s in sessions:
        ctx = None
        if s.context_snapshot_json:
            try:
                ctx = json.loads(s.context_snapshot_json)
            except Exception:
                ctx = None
        history.append(
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

    return {
        "status": status_out,
        "history": history,
    }


# =========================================================================
# 6. FEATURE 5: CLINICIAN FOLLOW-UP & CARE COORDINATION
# =========================================================================

def _serialize_task(task: ClinicianFollowUpTask) -> ClinicianFollowUpTaskOut:
    p_name = task.patient.full_name or task.patient.email if task.patient else f"Patient #{task.patient_id}"
    c_name = task.clinician.full_name or task.clinician.email if task.clinician else f"Clinician #{task.clinician_id}"
    return ClinicianFollowUpTaskOut(
        id=task.id,
        patient_id=task.patient_id,
        patient_name=p_name,
        clinician_id=task.clinician_id,
        clinician_name=c_name,
        title=task.title,
        description=task.description,
        patient_visible_notes=task.patient_visible_notes,
        due_date=task.due_date,
        priority=task.priority,
        status=task.status,
        is_patient_visible=task.is_patient_visible,
        patient_acknowledged=task.patient_acknowledged,
        patient_response_notes=task.patient_response_notes,
        created_at=task.created_at,
        updated_at=task.updated_at,
        completed_at=task.completed_at,
    )


@router.get("/patients/{patient_id}/tasks", response_model=List[ClinicianFollowUpTaskOut])
def list_patient_follow_up_tasks(
    patient_id: int,
    current_clinician: User = Depends(get_current_clinician),
    db: Session = Depends(get_db),
):
    """
    Returns follow-up tasks for an authorized patient.
    Enforces active clinician access grant.
    """
    verify_patient_access(patient_id, current_clinician, db)
    tasks = (
        db.query(ClinicianFollowUpTask)
        .filter(ClinicianFollowUpTask.patient_id == patient_id)
        .order_by(ClinicianFollowUpTask.created_at.desc())
        .all()
    )
    return [_serialize_task(t) for t in tasks]


@router.post("/patients/{patient_id}/tasks", response_model=ClinicianFollowUpTaskOut, status_code=status.HTTP_201_CREATED)
def create_patient_follow_up_task(
    patient_id: int,
    task_in: ClinicianFollowUpTaskCreate,
    current_clinician: User = Depends(get_current_clinician),
    db: Session = Depends(get_db),
):
    """
    Creates a new clinical follow-up or care coordination task for an authorized patient.
    """
    verify_patient_access(patient_id, current_clinician, db)

    now = datetime.now(timezone.utc)
    new_task = ClinicianFollowUpTask(
        patient_id=patient_id,
        clinician_id=current_clinician.id,
        title=task_in.title,
        description=task_in.description,
        patient_visible_notes=task_in.patient_visible_notes,
        due_date=task_in.due_date,
        priority=task_in.priority or "medium",
        status="pending",
        is_patient_visible=task_in.is_patient_visible,
        patient_acknowledged=False,
        created_at=now,
        updated_at=now,
    )
    db.add(new_task)

    audit = PrivacyAuditLog(
        user_id=patient_id,
        action="clinician_task_created",
        performed_by_id=current_clinician.id,
        details_json=json.dumps({"title": task_in.title, "priority": task_in.priority}),
        timestamp=now,
    )
    db.add(audit)

    db.commit()
    db.refresh(new_task)
    return _serialize_task(new_task)


@router.patch("/tasks/{task_id}", response_model=ClinicianFollowUpTaskOut)
def update_clinician_task(
    task_id: int,
    task_update: ClinicianFollowUpTaskUpdate,
    current_clinician: User = Depends(get_current_clinician),
    db: Session = Depends(get_db),
):
    """
    Updates status, due date, priority, or notes of a follow-up task.
    Verifies clinician has active grant for the task's patient.
    """
    task = db.query(ClinicianFollowUpTask).filter(ClinicianFollowUpTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Follow-up task not found.")

    verify_patient_access(task.patient_id, current_clinician, db)

    now = datetime.now(timezone.utc)
    if task_update.title is not None:
        task.title = task_update.title
    if task_update.description is not None:
        task.description = task_update.description
    if task_update.patient_visible_notes is not None:
        task.patient_visible_notes = task_update.patient_visible_notes
    if task_update.due_date is not None:
        task.due_date = task_update.due_date
    if task_update.priority is not None:
        task.priority = task_update.priority
    if task_update.status is not None:
        task.status = task_update.status
        if task_update.status == "completed":
            task.completed_at = now
        elif task.completed_at and task_update.status != "completed":
            task.completed_at = None
    if task_update.is_patient_visible is not None:
        task.is_patient_visible = task_update.is_patient_visible

    task.updated_at = now

    audit = PrivacyAuditLog(
        user_id=task.patient_id,
        action="clinician_task_updated",
        performed_by_id=current_clinician.id,
        details_json=json.dumps({"task_id": task.id, "status": task.status}),
        timestamp=now,
    )
    db.add(audit)

    db.commit()
    db.refresh(task)
    return _serialize_task(task)


@router.get("/tasks/overview", response_model=ClinicianTasksOverviewOut)
def get_clinician_tasks_overview(
    current_clinician: User = Depends(get_current_clinician),
    db: Session = Depends(get_db),
):
    """
    Provides an aggregated dashboard of upcoming, overdue, and completed tasks
    across all authorized patients for this clinician.
    """
    # Get all authorized patient cards
    patient_cards = get_authorized_patients_list(current_clinician.id, db)
    patient_ids = [p.id for p in patient_cards]

    tasks = (
        db.query(ClinicianFollowUpTask)
        .filter(ClinicianFollowUpTask.patient_id.in_(patient_ids))
        .order_by(ClinicianFollowUpTask.due_date.asc())
        .all()
    )

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    upcoming = []
    overdue = []
    completed = []

    for t in tasks:
        serialized = _serialize_task(t)
        if t.status in ["completed", "cancelled"]:
            completed.append(serialized)
        else:
            if t.due_date and t.due_date < today_str:
                overdue.append(serialized)
            else:
                upcoming.append(serialized)

    return ClinicianTasksOverviewOut(
        total_active=len(upcoming) + len(overdue),
        upcoming_tasks=upcoming,
        overdue_tasks=overdue,
        completed_tasks=completed,
    )


@router.get("/patient-tasks", response_model=List[ClinicianFollowUpTaskOut])
def get_patient_visible_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Allows a patient to view all care coordination tasks assigned to them that are flagged patient-visible.
    """
    tasks = (
        db.query(ClinicianFollowUpTask)
        .filter(
            ClinicianFollowUpTask.patient_id == current_user.id,
            ClinicianFollowUpTask.is_patient_visible == True,
        )
        .order_by(ClinicianFollowUpTask.created_at.desc())
        .all()
    )
    return [_serialize_task(t) for t in tasks]


@router.post("/patient-tasks/{task_id}/acknowledge", response_model=ClinicianFollowUpTaskOut)
def acknowledge_patient_task(
    task_id: int,
    ack: PatientTaskAcknowledge,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Allows a patient to acknowledge a follow-up recommendation and provide feedback notes.
    """
    task = (
        db.query(ClinicianFollowUpTask)
        .filter(
            ClinicianFollowUpTask.id == task_id,
            ClinicianFollowUpTask.patient_id == current_user.id,
            ClinicianFollowUpTask.is_patient_visible == True,
        )
        .first()
    )
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found or not patient-accessible.")

    now = datetime.now(timezone.utc)
    task.patient_acknowledged = True
    if ack.patient_response_notes is not None:
        task.patient_response_notes = ack.patient_response_notes
    if task.status == "pending":
        task.status = "in_progress"
    task.updated_at = now

    audit = PrivacyAuditLog(
        user_id=current_user.id,
        action="patient_task_acknowledged",
        performed_by_id=current_user.id,
        details_json=json.dumps({"task_id": task.id}),
        timestamp=now,
    )
    db.add(audit)

    db.commit()
    db.refresh(task)
    return _serialize_task(task)
