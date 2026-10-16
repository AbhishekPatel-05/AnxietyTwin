"""
test_advanced_features.py - Comprehensive Automated Test Suite for Features 1-8:
1. Personal Trigger & Pattern Discovery
2. Personalized Wellness Goals & Care Plan
3. Emotion Journal & Context Capture (with strict privacy and clinician isolation)
4. Digital Twin Confidence & Data Quality Center
5. Clinician Follow-up & Care Coordination (with RBAC and patient acknowledgment)
6. Scenario Replay & Comparison Reports (deterministic seed reproducibility & PDF export)
7. Weekly Personal Insights Report (dashboard and ReportLab PDF export)
8. Privacy & Consent Center (grant revocation, data export, and verified account deletion)
"""

import uuid
import json
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


@pytest.fixture
def auth_participant():
    """Registers and logs in a test patient."""
    uid = uuid.uuid4().hex[:8]
    email = f"patient_{uid}@example.com"
    pwd = "ParticipantPass123!"
    client.post("/api/auth/register", json={"email": email, "password": pwd, "full_name": f"Test Patient {uid}", "role": "patient"})
    resp = client.post("/api/auth/login", json={"email": email, "password": pwd})
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return {"headers": headers, "email": email, "password": pwd, "user_id": resp.json()["user_id"]}


@pytest.fixture
def auth_clinician():
    """Registers and logs in a test clinician."""
    uid = uuid.uuid4().hex[:8]
    email = f"clinician_{uid}@example.com"
    pwd = "ClinicianPass123!"
    client.post("/api/auth/register", json={"email": email, "password": pwd, "full_name": f"Dr. {uid}", "role": "clinician"})
    resp = client.post("/api/auth/login", json={"email": email, "password": pwd})
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return {"headers": headers, "email": email, "password": pwd, "user_id": resp.json()["user_id"]}


# =========================================================================
# FEATURE 1: PERSONAL TRIGGER & PATTERN DISCOVERY TESTS
# =========================================================================

def test_feature1_pattern_discovery_and_feedback(auth_participant):
    h = auth_participant["headers"]

    # 1. Log multiple check-ins with context tags and triggers
    for i in range(4):
        client.post(
            "/api/checkins",
            headers=h,
            json={
                "subjective_anxiety_score": 7 + (i % 2),
                "energy_level": 2,
                "triggers_noted": "Workload pressure",
                "context_tags": ["Workload", "Sleep disruption"],
                "sleep_hours": 5.5,
                "caffeine_cups": 3.0,
            },
        )

    # 2. Trigger pattern discovery
    disc_resp = client.post("/api/patterns/discover", headers=h)
    assert disc_resp.status_code == 200
    disc_data = disc_resp.json()
    assert disc_data["analyzed_checkin_count"] >= 4
    assert "Correlation does not imply causation" in disc_data["disclaimer"]
    patterns = disc_data["patterns"]
    assert len(patterns) >= 1

    pattern = patterns[0]
    assert pattern["confidence_level"] in ["preliminary", "moderate", "robust"]
    assert pattern["status"] == "active"
    assert "Does not infer causation" in pattern["non_causal_disclaimer"]

    # 3. User marks pattern as relevant
    pid = pattern["id"]
    fb_resp = client.patch(f"/api/patterns/{pid}/feedback", headers=h, json={"status": "relevant"})
    assert fb_resp.status_code == 200
    assert fb_resp.json()["status"] == "relevant"

    # 4. Summary trends endpoint
    summary_resp = client.get("/api/patterns/summary", headers=h)
    assert summary_resp.status_code == 200
    assert summary_resp.json()["total_checkins"] >= 4


# =========================================================================
# FEATURE 2: PERSONALIZED WELLNESS GOALS & CARE PLAN TESTS
# =========================================================================

def test_feature2_wellness_goals_and_care_plan(auth_participant):
    h = auth_participant["headers"]

    # 1. Get suggestions
    sug_resp = client.get("/api/goals/suggestions", headers=h)
    assert sug_resp.status_code == 200
    suggestions = sug_resp.json()
    assert len(suggestions) >= 2

    # 2. Create goal
    create_resp = client.post(
        "/api/goals",
        headers=h,
        json={
            "title": "4-7-8 Breathing Reset",
            "description": "Paced breathing practice",
            "category": "breathing",
            "target_frequency": "daily",
            "target_count": 4,
        },
    )
    assert create_resp.status_code == 201
    goal = create_resp.json()
    gid = goal["id"]
    assert goal["status"] == "active"
    assert goal["target_count"] == 4

    # 3. Log a breathing session to advance progress
    client.post(
        "/api/interventions/record",
        headers=h,
        json={
            "intervention_type": "breathing_478",
            "pre_distress_rating": 7.0,
            "post_distress_rating": 4.0,
            "helpfulness": "helpful",
            "status": "completed",
        },
    )

    # 4. Check goal progress
    list_resp = client.get("/api/goals", headers=h)
    assert list_resp.status_code == 200
    goals = list_resp.json()
    matched = next((g for g in goals if g["id"] == gid), None)
    assert matched is not None
    assert matched["current_week_progress"] >= 1

    # 5. Weekly summary view
    wk_resp = client.get("/api/goals/weekly-summary", headers=h)
    assert wk_resp.status_code == 200
    wk_data = wk_resp.json()
    assert wk_data["planned_goals_count"] >= 1
    assert "Voluntary wellness goals" in wk_data["disclaimer"]

    # 6. Pause and delete goal
    p_resp = client.patch(f"/api/goals/{gid}", headers=h, json={"status": "paused"})
    assert p_resp.status_code == 200
    assert p_resp.json()["status"] == "paused"

    del_resp = client.delete(f"/api/goals/{gid}", headers=h)
    assert del_resp.status_code == 204


# =========================================================================
# FEATURE 3: EMOTION JOURNAL & STRICT PRIVACY ISOLATION TESTS
# =========================================================================

def test_feature3_emotion_journal_and_clinician_isolation(auth_participant, auth_clinician):
    p_h = auth_participant["headers"]
    c_h = auth_clinician["headers"]
    pid = auth_participant["user_id"]

    # 1. Create a private journal entry (default is_private=True, shared_with_clinician=False)
    j_resp = client.post(
        "/api/journal",
        headers=p_h,
        json={
            "title": "Exam Week Reflection",
            "content": "Felt tense during the exam, but deep breathing helped recover composure.",
            "mood_tags": ["Tense", "Relieved"],
            "distress_rating": 6.0,
            "context_tags": ["Academic", "Exam"],
            "prompt_responses": {"What happened?": "Midterm test", "What helped cope?": "Grounding and 4-7-8 breathing"},
            "is_private": True,
            "shared_with_clinician": False,
        },
    )
    assert j_resp.status_code == 201
    entry = j_resp.json()
    jid = entry["id"]
    assert entry["is_private"] is True
    assert entry["shared_with_clinician"] is False

    # 2. Search & filter journal entries
    search_resp = client.get("/api/journal?search=exam&mood_tag=Tense", headers=p_h)
    assert search_resp.status_code == 200
    assert len(search_resp.json()) >= 1

    # 3. AI Theme Summary requires explicit user consent
    no_consent_resp = client.post("/api/journal/theme-summary", headers=p_h, json={"user_consent": False})
    assert no_consent_resp.status_code == 400

    consent_resp = client.post("/api/journal/theme-summary", headers=p_h, json={"user_consent": True})
    assert consent_resp.status_code == 200
    theme_data = consent_resp.json()
    assert theme_data["is_ai_generated"] is True
    assert "distinct from your authentic personal journal entries" in theme_data["distinction_notice"]

    # 4. Strict isolation: Clinician CANNOT view unshared journal entries in patient timeline
    # Grant access to clinician
    client.post(
        "/api/privacy/grants",
        headers=p_h,
        json={"clinician_id": auth_clinician["user_id"], "scope": "full_review"},
    )
    tl_resp = client.get(f"/api/clinician/patients/{pid}/timeline?period_days=14", headers=c_h)
    assert tl_resp.status_code == 200
    events = tl_resp.json()
    # Ensure no journal entry appears in clinician timeline
    journal_events = [e for e in events if e.get("event_type") == "journal_entry"]
    assert len(journal_events) == 0

    # 5. Clean deletion
    del_j = client.delete(f"/api/journal/{jid}", headers=p_h)
    assert del_j.status_code == 204


# =========================================================================
# FEATURE 4: DIGITAL TWIN CONFIDENCE & DATA QUALITY CENTER TESTS
# =========================================================================

def test_feature4_data_quality_center(auth_participant):
    h = auth_participant["headers"]

    # Retrieve data quality center metrics
    dq_resp = client.get("/api/data-quality/summary", headers=h)
    assert dq_resp.status_code == 200
    dq = dq_resp.json()

    assert "coverage" in dq
    assert "provenance" in dq
    assert "baseline_reliability" in dq
    assert "transparency_rules" in dq
    assert "warnings" in dq
    assert dq["synthetic_data_isolated"] is True
    assert "Data completeness does not equal clinical confidence" in dq["disclaimer"]

    # Check transparency rules detail XGBoost 24-hr DBP prediction horizon honestly
    xgb_rule = next((r for r in dq["transparency_rules"] if "XGBoost" in r["indicator_name"]), None)
    assert xgb_rule is not None
    assert "24-hour impending horizon" in xgb_rule["target_or_prediction_horizon"]
    assert "Does NOT predict acute panic attack events" in xgb_rule["known_limitations"]


# =========================================================================
# FEATURE 5: CLINICIAN FOLLOW-UP & CARE COORDINATION TESTS
# =========================================================================

def test_feature5_clinician_follow_up_tasks(auth_participant, auth_clinician):
    p_h = auth_participant["headers"]
    c_h = auth_clinician["headers"]
    pid = auth_participant["user_id"]
    cid = auth_clinician["user_id"]

    # 1. Unassigned clinician attempt without grant -> 403 Forbidden
    unauth_resp = client.post(
        f"/api/clinician/patients/{pid}/tasks",
        headers=c_h,
        json={"patient_id": pid, "title": "Check sleep regularity"},
    )
    assert unauth_resp.status_code == 403

    # 2. Grant access
    client.post("/api/privacy/grants", headers=p_h, json={"clinician_id": cid, "scope": "full_review"})

    # 3. Create follow-up task
    task_resp = client.post(
        f"/api/clinician/patients/{pid}/tasks",
        headers=c_h,
        json={
            "patient_id": pid,
            "title": "Establish 7-Hour Sleep Routine",
            "description": "Gradually shift bedtime earlier by 20 minutes each night.",
            "patient_visible_notes": "Please try to wind down 30 minutes before sleep without screens.",
            "priority": "high",
            "due_date": "2026-10-20",
            "is_patient_visible": True,
        },
    )
    assert task_resp.status_code == 201
    task = task_resp.json()
    tid = task["id"]
    assert task["status"] == "pending"

    # 4. Patient views their visible tasks
    pat_tasks_resp = client.get("/api/clinician/patient-tasks", headers=p_h)
    assert pat_tasks_resp.status_code == 200
    p_tasks = pat_tasks_resp.json()
    assert any(t["id"] == tid for t in p_tasks)

    # 5. Patient acknowledges task
    ack_resp = client.post(
        f"/api/clinician/patient-tasks/{tid}/acknowledge",
        headers=p_h,
        json={"patient_response_notes": "I will start the routine tonight."},
    )
    assert ack_resp.status_code == 200
    assert ack_resp.json()["patient_acknowledged"] is True
    assert ack_resp.json()["status"] == "in_progress"

    # 6. Clinician overview
    ov_resp = client.get("/api/clinician/tasks/overview", headers=c_h)
    assert ov_resp.status_code == 200
    assert ov_resp.json()["total_active"] >= 1


# =========================================================================
# FEATURE 6: SCENARIO REPLAY & COMPARISON REPORTS TESTS
# =========================================================================

def test_feature6_scenario_replay_and_pdf(auth_participant):
    h = auth_participant["headers"]

    # 1. Deterministic replay with reproducible seed
    req_body = {
        "scenario_input": {
            "sleep_hours": 6.0,
            "caffeine_cups": 2.0,
            "physical_activity_mins": 30.0,
            "heart_rate_bpm": 80.0,
            "hrv_ms": 38.0,
            "self_reported_anxiety": 5,
            "recent_stress_exposure": 3,
        },
        "seed": 42,
        "steps_count": 24,
    }

    rep_1 = client.post("/api/simulation/replay", json=req_body)
    assert rep_1.status_code == 200
    data_1 = rep_1.json()
    assert len(data_1["steps"]) == 24
    assert "SYNTHETIC DETERMINISTIC REPLAY" in data_1["synthetic_notice"]

    # Repeat with same seed: output hash and steps must be IDENTICAL
    rep_2 = client.post("/api/simulation/replay", json=req_body)
    assert rep_2.status_code == 200
    data_2 = rep_2.json()
    assert data_1["reproducibility_hash"] == data_2["reproducibility_hash"]
    assert data_1["steps"][0]["heart_rate_bpm"] == data_2["steps"][0]["heart_rate_bpm"]

    # 2. Comparison PDF report generation
    pdf_req = {
        "scenario_a": req_body["scenario_input"],
        "scenario_b": {
            "sleep_hours": 8.0,
            "caffeine_cups": 0.5,
            "physical_activity_mins": 45.0,
            "heart_rate_bpm": 68.0,
            "hrv_ms": 52.0,
            "self_reported_anxiety": 2,
            "recent_stress_exposure": 1,
        },
        "scenario_a_name": "Exam Week Stress Simulation",
        "scenario_b_name": "Restorative Vacation Simulation",
        "baseline_profile_id": "DEMO-PATIENT-01",
    }
    pdf_resp = client.post("/api/simulation/comparison-report/pdf", json=pdf_req)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert len(pdf_resp.content) > 1000
    assert pdf_resp.content.startswith(b"%PDF")


# =========================================================================
# FEATURE 7: WEEKLY PERSONAL INSIGHTS REPORT TESTS
# =========================================================================

def test_feature7_weekly_report_and_pdf(auth_participant):
    h = auth_participant["headers"]

    # 1. Fetch weekly dashboard JSON report
    rep_resp = client.get("/api/reports/weekly?include_journal_summary=false", headers=h)
    assert rep_resp.status_code == 200
    rep = rep_resp.json()
    assert "checkin_count" in rep
    assert "baseline_deviations" in rep
    assert rep["private_reflections_included"] is False
    assert "self-reflection and personal wellness awareness" in rep["disclaimer"]

    # 2. Export Weekly Report PDF
    pdf_resp = client.post(
        "/api/reports/weekly/pdf",
        headers=h,
        json={"include_journal_summary": False, "include_goals": True, "include_patterns": True},
    )
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert len(pdf_resp.content) > 1000
    assert pdf_resp.content.startswith(b"%PDF")


# =========================================================================
# FEATURE 8: PRIVACY & CONSENT CENTER TESTS
# =========================================================================

def test_feature8_privacy_export_revocation_and_deletion(auth_participant, auth_clinician):
    p_h = auth_participant["headers"]
    pwd = auth_participant["password"]
    pid = auth_participant["user_id"]
    cid = auth_clinician["user_id"]

    # 1. Privacy Dashboard
    dash_resp = client.get("/api/privacy/dashboard", headers=p_h)
    assert dash_resp.status_code == 200
    dash = dash_resp.json()
    assert len(dash["stored_categories"]) >= 5

    # 2. Grant and immediately Revoke
    g_resp = client.post("/api/privacy/grants", headers=p_h, json={"clinician_id": cid, "scope": "full_review"})
    assert g_resp.status_code == 201
    gid = g_resp.json()["id"]

    revoke_resp = client.post(f"/api/privacy/grants/{gid}/revoke", headers=p_h)
    assert revoke_resp.status_code == 200
    assert revoke_resp.json()["is_active"] is False

    # 3. Data Export bundle (JSON)
    export_resp = client.get("/api/privacy/export", headers=p_h)
    assert export_resp.status_code == 200
    assert export_resp.headers["content-type"] == "application/json"
    bundle = export_resp.json()
    assert bundle["export_metadata"]["user_id"] == pid
    assert "checkins" in bundle
    assert "physiological_observations" in bundle

    # 4. Audit Log
    audit_resp = client.get("/api/privacy/audit-log", headers=p_h)
    assert audit_resp.status_code == 200
    logs = audit_resp.json()
    assert len(logs) >= 1

    # 5. Account Deletion: Wrong confirmation phrase -> 400
    del_bad = client.post("/api/privacy/delete-account", headers=p_h, json={"password": pwd, "confirmation_phrase": "NO"})
    assert del_bad.status_code == 400

    # Correct deletion
    del_good = client.post("/api/privacy/delete-account", headers=p_h, json={"password": pwd, "confirmation_phrase": "DELETE MY ACCOUNT"})
    assert del_good.status_code == 200
    assert del_good.json()["status"] == "success"

    # Confirm login is now rejected (401)
    login_resp = client.post("/api/auth/login", json={"email": auth_participant["email"], "password": pwd})
    assert login_resp.status_code == 401


# =========================================================================
# FINAL AUDIT INTEGRATION & RELIABILITY VERIFICATION TESTS
# =========================================================================

def test_audit_feature1_data_sufficiency_and_synthetic_isolation(auth_participant):
    """Verifies pattern discovery reports data sufficiency honestly (<3 is insufficient)
    and synthetic records do not contaminate genuine pattern discovery."""
    h = auth_participant["headers"]
    uid = auth_participant["user_id"]

    # 0 checkins: insufficient_data must be True, patterns must be empty
    disc_empty = client.post("/api/patterns/discover", headers=h)
    assert disc_empty.status_code == 200
    assert disc_empty.json()["insufficient_data"] is True
    assert len(disc_empty.json()["patterns"]) == 0

    # Add 1 genuine checkin: still insufficient
    client.post(
        "/api/checkins",
        headers=h,
        json={
            "subjective_anxiety_score": 8,
            "triggers_noted": "Workload pressure",
            "context_tags": ["Workload"],
            "sleep_hours": 5.0,
        },
    )
    disc_1 = client.post("/api/patterns/discover", headers=h)
    assert disc_1.json()["insufficient_data"] is True
    assert len(disc_1.json()["patterns"]) == 0

    # Add synthetic checkin directly to DB: must NOT be counted as genuine
    from backend.app.core.database import SessionLocal
    from backend.app.models.db_models import AnxietyCheckin
    db = SessionLocal()
    synth_checkin = AnxietyCheckin(
        user_id=uid,
        subjective_anxiety_score=9,
        source_type="synthetic",
        triggers_noted="Synthetic Trigger",
    )
    db.add(synth_checkin)
    db.commit()
    db.close()

    disc_synth = client.post("/api/patterns/discover", headers=h)
    # Synthetic checkin must not inflate genuine analyzed_checkin_count
    assert disc_synth.json()["analyzed_checkin_count"] == 1
    assert disc_synth.json()["insufficient_data"] is True


def test_audit_feature2_wellness_goals_physical_activity_and_persistence(auth_participant):
    """Verifies wellness goals persist and progress calculates properly for physical_activity
    without AttributeError on steps_count."""
    h = auth_participant["headers"]

    create_resp = client.post(
        "/api/goals",
        headers=h,
        json={
            "title": "Daily 30-min Exercise or 4k Steps",
            "category": "physical_activity",
            "target_frequency": "daily",
            "target_count": 5,
        },
    )
    assert create_resp.status_code == 201
    goal = create_resp.json()
    gid = goal["id"]

    # Record lifestyle observation with exercise_minutes >= 15
    client.post(
        "/api/observations/lifestyle",
        headers=h,
        json={
            "date": "2026-10-11",
            "sleep_hours": 7.5,
            "exercise_minutes": 30.0,
        },
    )

    # Record physiological observation with steps_count >= 4000
    client.post(
        "/api/observations/physiological",
        headers=h,
        json={
            "heart_rate_bpm": 72.0,
            "steps_count": 5200,
        },
    )

    list_resp = client.get("/api/goals", headers=h)
    assert list_resp.status_code == 200
    matched = next((g for g in list_resp.json() if g["id"] == gid), None)
    assert matched is not None
    assert matched["current_week_progress"] >= 1


def test_audit_feature3_journal_cross_patient_authorization(auth_participant, auth_clinician):
    """Verifies strict cross-patient isolation and clinician denial on journal entries."""
    p_h = auth_participant["headers"]
    c_h = auth_clinician["headers"]

    # Create private journal entry
    j_resp = client.post(
        "/api/journal",
        headers=p_h,
        json={"title": "Private Diary", "content": "Confidential personal thoughts.", "is_private": True},
    )
    jid = j_resp.json()["id"]

    # Clinician directly calls /api/journal/{jid} -> 404 (strictly scoped to user)
    clin_attempt = client.get(f"/api/journal/{jid}", headers=c_h)
    assert clin_attempt.status_code == 404

    # Another patient calls /api/journal/{jid} -> 404
    uid2 = uuid.uuid4().hex[:8]
    p2_email = f"patient_{uid2}@example.com"
    p2_pwd = "Password123!"
    client.post("/api/auth/register", json={"email": p2_email, "password": p2_pwd, "full_name": "P2", "role": "patient"})
    p2_tok = client.post("/api/auth/login", json={"email": p2_email, "password": p2_pwd}).json()["access_token"]
    p2_attempt = client.get(f"/api/journal/{jid}", headers={"Authorization": f"Bearer {p2_tok}"})
    assert p2_attempt.status_code == 404

    # AI Theme summary cross-patient leakage test: P2 tries to pass P1's entry_id
    p2_ai = client.post(
        "/api/journal/theme-summary",
        headers={"Authorization": f"Bearer {p2_tok}"},
        json={"entry_ids": [jid], "user_consent": True},
    )
    assert p2_ai.status_code == 200
    assert p2_ai.json()["entry_count"] == 0  # Cannot see P1's entries


def test_audit_feature5_clinician_tasks_cross_patient_and_revocation(auth_participant, auth_clinician):
    """Verifies clinician cannot access tasks after grant revocation, and patients cannot acknowledge others' tasks."""
    p_h = auth_participant["headers"]
    c_h = auth_clinician["headers"]
    pid = auth_participant["user_id"]
    cid = auth_clinician["user_id"]

    # Grant access
    g_resp = client.post("/api/privacy/grants", headers=p_h, json={"clinician_id": cid, "scope": "full_review"})
    gid = g_resp.json()["id"]

    # Create task
    t_resp = client.post(
        f"/api/clinician/patients/{pid}/tasks",
        headers=c_h,
        json={"patient_id": pid, "title": "Check HRV baseline", "is_patient_visible": True},
    )
    assert t_resp.status_code == 201
    tid = t_resp.json()["id"]

    # Revoke grant
    client.post(f"/api/privacy/grants/{gid}/revoke", headers=p_h)

    # Clinician update task now rejected with 403 Forbidden
    up_resp = client.patch(f"/api/clinician/tasks/{tid}", headers=c_h, json={"status": "completed"})
    assert up_resp.status_code == 403

    # Clinician list tasks now rejected with 403 Forbidden
    list_resp = client.get(f"/api/clinician/patients/{pid}/tasks", headers=c_h)
    assert list_resp.status_code == 403

    # Other patient cannot acknowledge this task
    uid3 = uuid.uuid4().hex[:8]
    p3_email = f"patient_{uid3}@example.com"
    p3_pwd = "Password123!"
    client.post("/api/auth/register", json={"email": p3_email, "password": p3_pwd, "full_name": "P3", "role": "patient"})
    p3_tok = client.post("/api/auth/login", json={"email": p3_email, "password": p3_pwd}).json()["access_token"]
    p3_ack = client.post(
        f"/api/clinician/patient-tasks/{tid}/acknowledge",
        headers={"Authorization": f"Bearer {p3_tok}"},
        json={"patient_response_notes": "Malicious ack"},
    )
    assert p3_ack.status_code == 404


def test_audit_feature7_weekly_report_date_range_and_pdf_exclusions(auth_participant):
    """Verifies that weekly report respects date range and excludes sensitive sections when requested."""
    h = auth_participant["headers"]

    # 1. Custom date range filtering
    rep_resp = client.get(
        "/api/reports/weekly?start_date=2026-10-01&end_date=2026-10-07&include_journal_summary=false&include_goals=false&include_patterns=false",
        headers=h,
    )
    assert rep_resp.status_code == 200
    data = rep_resp.json()
    assert data["period_start"] == "2026-10-01"
    assert data["period_end"] == "2026-10-07"
    assert data["private_reflections_included"] is False
    assert len(data["recurring_patterns"]) == 0
    assert len(data["wellness_goals_progress"]) == 0

    # 2. PDF generation with exclusions
    pdf_resp = client.post(
        "/api/reports/weekly/pdf",
        headers=h,
        json={
            "start_date": "2026-10-01",
            "end_date": "2026-10-07",
            "include_journal_summary": False,
            "include_goals": False,
            "include_patterns": False,
        },
    )
    assert pdf_resp.status_code == 200
    assert pdf_resp.content.startswith(b"%PDF")

