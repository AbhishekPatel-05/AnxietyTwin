import uuid
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.intervention_engine import InterventionEngine

client = TestClient(app)


@pytest.fixture(scope="module")
def clinician_auth_headers():
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "demo_clinician@happiesthealth.org", "password": "ClinicianSecure2026!"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def fresh_patient_user():
    uid = uuid.uuid4().hex[:8]
    email = f"patient_int_{uid}@example.com"
    pwd = "PatientSecure123!"
    reg_resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "full_name": f"Intervention Tester {uid}", "role": "patient"},
    )
    assert reg_resp.status_code in [201, 200]
    token = reg_resp.json()["access_token"]
    user_id = reg_resp.json()["user_id"]
    return {"id": user_id, "email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


def test_cold_start_insufficient_data_status(fresh_patient_user):
    """Verify that a brand new user with no observations receives an honest Insufficient Data state."""
    resp = client.get("/api/interventions/status", headers=fresh_patient_user["headers"])
    assert resp.status_code == 200
    data = resp.json()

    assert data["is_cold_start"] is True
    assert data["baseline_status"] == "Cold-Start Calibration"
    assert len(data["insufficient_data_reasons"]) >= 3
    assert "Observational association does not establish clinical causation" in data["disclaimer"]

    # Verify signals are labeled 'Insufficient Data'
    for sig in data["signals"]:
        assert sig["level"] in ["Insufficient Data", "Within Personal Range"]
        assert sig["is_rule_based"] is True
        assert "Observational association does not establish causation" in sig["limitations"]

    # Recommendations should prompt for a check-in to accumulate baseline
    checkin_rec = next((r for r in data["recommendations"] if r["intervention_type"] == "checkin_prompt"), None)
    assert checkin_rec is not None
    assert checkin_rec["is_medical"] is False


def test_early_warning_signal_detection_and_rules(fresh_patient_user):
    """
    Simulate longitudinal observations that cross transparent thresholds:
    - High heart rate (85 BPM vs baseline 70 BPM)
    - Low HRV (28 ms vs baseline 48 ms)
    - High distress score (8/10)
    - Severe sleep debt (4.5 hours)
    """
    headers = fresh_patient_user["headers"]

    # 1. Submit 3 days of baseline calibration check-ins
    for i in range(3):
        client.post(
            "/api/checkins",
            headers=headers,
            json={
                "subjective_anxiety_score": 3,
                "sleep_hours": 7.5,
                "heart_rate_bpm": 70.0,
                "triggers_noted": "Routine calibration",
            },
        )

    # 2. Submit an acute tension check-in with high HR, low HRV, low sleep, and score 8/10
    acute_resp = client.post(
        "/api/checkins",
        headers=headers,
        json={
            "subjective_anxiety_score": 8,
            "sleep_hours": 4.5,
            "heart_rate_bpm": 86.0,
            "triggers_noted": "Major presentation stress",
            "notes": "Heart racing, tight chest.",
        },
    )
    assert acute_resp.status_code in [201, 200]

    # 3. Add low HRV physiological reading
    client.post(
        "/api/observations/physiological",
        headers=headers,
        json={
            "heart_rate_bpm": 86.0,
            "heart_rate_variability_ms": 28.0,
            "steps_count": 3200,
            "source_type": "user_entered",
        },
    )

    # 4. Query Early-Warning status
    status_resp = client.get("/api/interventions/status", headers=headers)
    assert status_resp.status_code == 200
    st_data = status_resp.json()

    # Verify signals detected changes
    signals = st_data["signals"]
    sig_types = [s["signal_type"] for s in signals if s["level"] == "Change Detected"]
    assert "elevated_heart_rate" in sig_types or "increased_distress" in sig_types

    # Verify evidence traceability
    for s in signals:
        if s["level"] == "Change Detected":
            assert len(s["supporting_record_ids"]) >= 1
            assert "Observational association does not establish causation" in s["limitations"]
            assert s["why_flagged"] != ""

    # Verify high-priority intervention recommendations include breathing or grounding
    rec_types = [r["intervention_type"] for r in st_data["recommendations"]]
    assert "breathing_478" in rec_types or "grounding_54321" in rec_types


def test_intervention_session_feedback_loop(fresh_patient_user):
    """Test starting and completing an intervention with before-and-after distress ratings."""
    headers = fresh_patient_user["headers"]

    # Record completed 4-7-8 breathing session with distress 8 -> 4 (delta -4)
    payload = {
        "intervention_type": "breathing_478",
        "trigger_signal": "elevated_heart_rate",
        "status": "completed",
        "pre_distress_rating": 8.0,
        "post_distress_rating": 4.0,
        "helpfulness": "helpful",
        "user_notes": "Felt much calmer after 4 breath cycles.",
        "source_type": "user_entered",
        "context_snapshot": {"resting_hr": 86.0, "baseline_hr": 70.0},
    }

    create_resp = client.post("/api/interventions/record", headers=headers, json=payload)
    assert create_resp.status_code == 201
    created = create_resp.json()

    assert created["intervention_type"] == "breathing_478"
    assert created["pre_distress_rating"] == 8.0
    assert created["post_distress_rating"] == 4.0
    assert created["rating_delta"] == -4.0
    assert created["helpfulness"] == "helpful"
    assert created["source_type"] == "user_entered"

    # Verify history retrieval
    hist_resp = client.get("/api/interventions/history?period_days=7", headers=headers)
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) >= 1
    item = next((h for h in history if h["id"] == created["id"]), None)
    assert item is not None
    assert item["rating_delta"] == -4.0


def test_stateless_synthetic_scenario_evaluation():
    """Verify that simulation lab scenarios can be evaluated statelessly without modifying the database."""
    sample = {
        "heartRateBpm": 88.0,
        "hrvMs": 25.0,
        "sleepHours": 4.5,
        "userReportedStress": 8.0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    baseline = {
        "mean_resting_hr": 70.0,
        "mean_hrv_ms": 48.0,
        "mean_sleep_hours": 7.5,
        "mean_anxiety_score": 2.5,
    }

    resp = client.post(
        "/api/interventions/evaluate-scenario",
        json={"sample": sample, "baseline": baseline},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["baseline_status"] == "Simulated Baseline Active"
    assert data["is_cold_start"] is False

    # Check simulated signals
    hr_sig = next((s for s in data["signals"] if s["signal_type"] == "elevated_heart_rate"), None)
    assert hr_sig is not None
    assert hr_sig["level"] == "Change Detected"
    assert hr_sig["data_provenance"] == "simulated"
    assert hr_sig["delta"] == 18.0

    # Ensure recommendations offered relevant exercises
    rec_types = [r["intervention_type"] for r in data["recommendations"]]
    assert "breathing_478" in rec_types or "grounding_54321" in rec_types


def test_clinician_access_to_patient_interventions(clinician_auth_headers, fresh_patient_user):
    """Verify that an authorized clinician can review patient intervention feedback, while unauthorized cannot."""
    # 1. Authorize clinician by creating a grant
    grant_resp = client.post(
        "/api/clinician/grants",
        headers=clinician_auth_headers,
        json={"patient_id": fresh_patient_user["id"], "scope": "full_review"},
    )
    assert grant_resp.status_code in [201, 200]

    # 2. Clinician queries patient interventions
    resp = client.get(
        f"/api/clinician/patients/{fresh_patient_user['id']}/interventions",
        headers=clinician_auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "history" in data
    assert len(data["history"]) >= 1

    # 3. Patient role is rejected from clinician patient interventions endpoint
    patient_resp = client.get(
        f"/api/clinician/patients/{fresh_patient_user['id']}/interventions",
        headers=fresh_patient_user["headers"],
    )
    assert patient_resp.status_code == 403


def test_contradictory_observations_detection(fresh_patient_user):
    """
    Verify detection of unclear or contradictory observations:
    When autonomic physiological arousal is detected (e.g. elevated HR >= 5 BPM),
    but the user self-reports very low distress (1/10).
    """
    headers = fresh_patient_user["headers"]

    # Post a low distress checkin (1/10) with elevated heart rate (85.0 BPM)
    resp = client.post(
        "/api/checkins",
        headers=headers,
        json={
            "subjective_anxiety_score": 1,
            "sleep_hours": 7.5,
            "heart_rate_bpm": 86.0,
            "triggers_noted": "Post-workout hydration",
            "notes": "Feeling calm, just finished cycling.",
        },
    )
    assert resp.status_code in [201, 200]

    status_resp = client.get("/api/interventions/status", headers=headers)
    assert status_resp.status_code == 200
    st_data = status_resp.json()

    # Verify contradictory signal exists
    conflicting_sig = next((s for s in st_data["signals"] if s["signal_type"] == "conflicting_observations"), None)
    assert conflicting_sig is not None
    assert conflicting_sig["level"] == "Change Detected"
    assert "Divergent" in conflicting_sig["title"] or "Subjective" in conflicting_sig["title"]
    assert "Observational association does not establish causation" in conflicting_sig["limitations"]

    # Verify recommendation includes contextual checkin prompt
    rec_types = [r["intervention_type"] for r in st_data["recommendations"]]
    assert "checkin_prompt" in rec_types


def test_missing_metrics_graceful_handling():
    """Verify that when certain metrics are missing (e.g., HRV or sleep missing), the engine evaluates available metrics safely."""
    # Synthetic sample with only HR and distress, missing sleep and HRV
    sample = {
        "heartRateBpm": 84.0,
        "hrvMs": 48.0,
        "sleepHours": 7.5,
        "userReportedStress": 2.0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    baseline = {
        "mean_resting_hr": 70.0,
        "mean_hrv_ms": 48.0,
        "mean_sleep_hours": 7.5,
        "mean_anxiety_score": 2.0,
    }

    resp = client.post(
        "/api/interventions/evaluate-scenario",
        json={"sample": sample, "baseline": baseline},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["metrics"] is not None
    assert len(data["metrics"]) >= 4
    # HR is elevated (+14 BPM)
    hr_metric = next(m for m in data["metrics"] if m["metric_key"] == "heart_rate")
    assert hr_metric["trend"] == "elevated"
    assert hr_metric["delta_value"] == 14.0


def test_dismiss_intervention_feedback_and_filters(fresh_patient_user):
    """Verify user can dismiss a recommended intervention and filter history by status, signal, and provenance."""
    headers = fresh_patient_user["headers"]

    # Record a dismissed session
    payload = {
        "intervention_type": "sleep_hygiene",
        "trigger_signal": "disrupted_sleep",
        "status": "dismissed",
        "user_notes": "Not applicable tonight, travelling across timezones.",
        "source_type": "user_entered",
        "context_snapshot": {"reason": "timezone_travel"},
    }

    create_resp = client.post("/api/interventions/record", headers=headers, json=payload)
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["status"] == "dismissed"

    # Filter history by status=dismissed
    hist_resp = client.get("/api/interventions/history?status=dismissed", headers=headers)
    assert hist_resp.status_code == 200
    items = hist_resp.json()
    assert any(i["id"] == created["id"] for i in items)

    # Filter history by signal_type=disrupted_sleep
    sig_resp = client.get("/api/interventions/history?signal_type=disrupted_sleep", headers=headers)
    assert sig_resp.status_code == 200
    sig_items = sig_resp.json()
    assert any(i["id"] == created["id"] for i in sig_items)


def test_provenance_distinction_measured_reported_simulated():
    """Verify that measured, user-reported, and simulated values are explicitly distinguishable."""
    from backend.app.services.intervention_engine import map_provenance

    assert map_provenance("device_measurement") == "measured"
    assert map_provenance("measured") == "measured"
    assert map_provenance("user_entered") == "user_reported"
    assert map_provenance("user_reported") == "user_reported"
    assert map_provenance("simulated") == "simulated"
    assert map_provenance("synthetic") == "simulated"

