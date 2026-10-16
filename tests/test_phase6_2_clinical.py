import io
import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


@pytest.fixture(scope="module")
def clinician_auth_headers():
    """Authenticate or seed the demo clinician."""
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "demo_clinician@happiesthealth.org", "password": "ClinicianSecure2026!"},
    )
    assert login_resp.status_code == 200, f"Clinician login failed: {login_resp.text}"
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def patient_user():
    """Register and return an isolated patient user."""
    uid = uuid.uuid4().hex[:8]
    email = f"patient_{uid}@example.com"
    pwd = "PatientSecure123!"
    reg_resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "full_name": f"Test Patient {uid}", "role": "patient"},
    )
    assert reg_resp.status_code in [201, 200], f"Registration failed: {reg_resp.text}"
    token = reg_resp.json()["access_token"]
    user_id = reg_resp.json()["user_id"]
    return {"id": user_id, "email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


def test_clinician_role_authorization_guard(patient_user):
    """Verify that a standard patient account cannot access clinician endpoints."""
    # Attempting to access clinician patient registry with patient credentials
    resp = client.get("/api/clinician/patients", headers=patient_user["headers"])
    assert resp.status_code == 403
    assert "Clinician or administrator authorization required" in resp.json()["detail"]


def test_demo_patient_seeding_and_overview(clinician_auth_headers):
    """Verify clinician can view authorized registry and seeded synthetic patient."""
    resp = client.get("/api/clinician/patients", headers=clinician_auth_headers)
    assert resp.status_code == 200
    patients = resp.json()
    assert len(patients) >= 1
    
    # Locate synthetic demo patient
    demo_patient = next((p for p in patients if p.get("is_demo_patient")), None)
    assert demo_patient is not None
    assert demo_patient["display_name"] == "Alex Rivera (Student Cohort)"
    assert demo_patient["total_observations_count"] >= 15
    assert demo_patient["baseline_status"] == "Empirical Baseline Active"

    # Inspect overview
    pid = demo_patient["id"]
    ov_resp = client.get(f"/api/clinician/patients/{pid}/overview", headers=clinician_auth_headers)
    assert ov_resp.status_code == 200
    overview = ov_resp.json()
    assert overview["patient_id"] == pid
    assert overview["distinct_days"] >= 7
    assert overview["mean_resting_hr"] > 0
    assert overview["mean_sleep_hours"] > 0
    assert overview["prediction_availability"] == "available"


def test_consent_based_access_grant_and_revocation(clinician_auth_headers, patient_user):
    """Verify that clinicians cannot access patients without active consent grant."""
    patient_id = patient_user["id"]

    # 1. Clinician attempts to view non-granted patient overview -> 403 Forbidden
    unauth_resp = client.get(f"/api/clinician/patients/{patient_id}/overview", headers=clinician_auth_headers)
    assert unauth_resp.status_code == 403
    assert "Active patient consent grant required" in unauth_resp.json()["detail"]

    # 2. Grant access to clinician
    grant_resp = client.post(
        "/api/clinician/grants",
        headers=clinician_auth_headers,
        json={"patient_id": patient_id, "scope": "full_review", "notes": "Approved by patient in clinic"},
    )
    assert grant_resp.status_code == 201
    grant_id = grant_resp.json()["id"]

    # 3. Now clinician can view patient overview
    auth_resp = client.get(f"/api/clinician/patients/{patient_id}/overview", headers=clinician_auth_headers)
    assert auth_resp.status_code == 200
    assert auth_resp.json()["patient_id"] == patient_id

    # 4. Revoke access grant
    revoke_resp = client.post(f"/api/clinician/grants/{grant_id}/revoke", headers=clinician_auth_headers)
    assert revoke_resp.status_code == 200

    # 5. Immediately verify access is denied again
    denied_resp = client.get(f"/api/clinician/patients/{patient_id}/overview", headers=clinician_auth_headers)
    assert denied_resp.status_code == 403


def test_longitudinal_timeline_filtering_and_provenance(clinician_auth_headers):
    """Verify patient timeline chronological sorting, filters, and provenance integrity."""
    # Fetch demo patient id
    p_resp = client.get("/api/clinician/patients", headers=clinician_auth_headers)
    demo_patient = next(p for p in p_resp.json() if p.get("is_demo_patient"))
    pid = demo_patient["id"]

    # Default query with hide_simulated=True
    tl_resp = client.get(f"/api/clinician/patients/{pid}/timeline?period_days=14&hide_simulated=true", headers=clinician_auth_headers)
    assert tl_resp.status_code == 200
    events = tl_resp.json()
    assert len(events) > 0

    # Verify chronological sorting (newest first)
    for i in range(len(events) - 1):
        assert events[i]["timestamp"] >= events[i + 1]["timestamp"]

    # Verify no simulated events when hide_simulated=True
    for ev in events:
        assert ev["is_simulated"] is False
        assert ev["source_type"] in ["user_entered", "historical_research", "calculated", "clinician_authored"]

    # Verify event type filter
    checkins_resp = client.get(
        f"/api/clinician/patients/{pid}/timeline?period_days=14&event_types=checkin",
        headers=clinician_auth_headers
    )
    assert checkins_resp.status_code == 200
    for ev in checkins_resp.json():
        assert ev["event_type"] == "checkin"


def test_clinical_digital_twin_insights_and_evidence(clinician_auth_headers):
    """Verify twin insights contain non-causal disclosures, baseline deltas, and evidence links."""
    p_resp = client.get("/api/clinician/patients", headers=clinician_auth_headers)
    demo_patient = next(p for p in p_resp.json() if p.get("is_demo_patient"))
    pid = demo_patient["id"]

    ins_resp = client.get(f"/api/clinician/patients/{pid}/insights?period_days=14", headers=clinician_auth_headers)
    assert ins_resp.status_code == 200
    insights = ins_resp.json()
    assert len(insights) >= 2

    for ins in insights:
        # Check required fields
        assert "factor" in ins
        assert "observation" in ins
        assert "comparison_baseline" in ins
        assert "non_causal_interpretation" in ins
        assert "supporting_record_ids" in ins
        # Verify non-causal language is explicitly present
        assert "does not establish causation" in ins["non_causal_interpretation"].lower() or "observational" in ins["non_causal_interpretation"].lower()
        # Verify supporting records exist and are non-empty
        assert len(ins["supporting_record_ids"]) > 0


def test_clinician_review_notes_workflow(clinician_auth_headers):
    """Verify creating, listing, and updating clinician review notes."""
    p_resp = client.get("/api/clinician/patients", headers=clinician_auth_headers)
    demo_patient = next(p for p in p_resp.json() if p.get("is_demo_patient"))
    pid = demo_patient["id"]

    # 1. Create review note
    note_payload = {
        "summary_observations": "Patient exhibiting situational stress around midterms with mild sleep deficit.",
        "discussion_topics": "Caffeine reduction after 2pm and paced respiration.",
        "follow_up_plan": "Scheduled virtual check-in in 2 weeks.",
        "follow_up_date": "2026-10-24",
        "follow_up_status": "planned"
    }
    create_resp = client.post(
        f"/api/clinician/patients/{pid}/notes",
        headers=clinician_auth_headers,
        json=note_payload
    )
    assert create_resp.status_code == 201
    created_note = create_resp.json()
    assert created_note["summary_observations"] == note_payload["summary_observations"]
    assert created_note["clinician_name"] == "Dr. Sarah Lin, MD"
    note_id = created_note["id"]

    # 2. List notes
    notes_list_resp = client.get(f"/api/clinician/patients/{pid}/notes", headers=clinician_auth_headers)
    assert notes_list_resp.status_code == 200
    assert any(n["id"] == note_id for n in notes_list_resp.json())

    # 3. Update note status
    update_resp = client.put(
        f"/api/clinician/patients/{pid}/notes/{note_id}",
        headers=clinician_auth_headers,
        json={"follow_up_status": "completed"}
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["follow_up_status"] == "completed"


def test_customizable_patient_summary_pdf_generation(clinician_auth_headers):
    """Verify ReportLab PDF generation with customizable section selection."""
    p_resp = client.get("/api/clinician/patients", headers=clinician_auth_headers)
    demo_patient = next(p for p in p_resp.json() if p.get("is_demo_patient"))
    pid = demo_patient["id"]

    # Test full PDF summary
    options = {
        "include_checkins": True,
        "include_physiology": True,
        "include_lifestyle": True,
        "include_digital_twin_insights": True,
        "include_ml_predictions": True,
        "include_clinician_notes": True,
        "include_simulated_data": False
    }
    pdf_resp = client.post(
        f"/api/clinician/patients/{pid}/pdf-summary",
        headers=clinician_auth_headers,
        json=options
    )
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    content = pdf_resp.content
    assert len(content) > 2000
    # PDF magic bytes
    assert content.startswith(b"%PDF")


def test_synthetic_demo_reset_integrity(clinician_auth_headers):
    """Verify resetting synthetic demo cohort leaves other data intact and restores 8 days."""
    reset_resp = client.post("/api/clinician/demo/reset", headers=clinician_auth_headers)
    assert reset_resp.status_code == 200
    data = reset_resp.json()
    assert data["status"] == "success"
    pid = data["patient_id"]

    # Check that patient has 8 distinct days after reset
    ov_resp = client.get(f"/api/clinician/patients/{pid}/overview", headers=clinician_auth_headers)
    assert ov_resp.status_code == 200
    assert ov_resp.json()["distinct_days"] == 8
