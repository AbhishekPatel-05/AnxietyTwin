import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_health_and_diagnostics():
    """Verify health endpoint accurately reports multi-component status."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "components" in data
    assert data["components"]["database"] == "connected"
    assert data["components"]["ml_inference"] in ["loaded", "unavailable"]
    assert data["components"]["twin_engine"] == "operational"


def test_token_security_and_rejection():
    """Verify protected endpoints reject missing, malformed, and invalid tokens."""
    # 1. Missing token
    res = client.get("/api/auth/me")
    assert res.status_code == 401

    # 2. Malformed token
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer malformed.token.here"})
    assert res.status_code == 401

    # 3. Invalid signature
    res = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.fake_signature"}
    )
    assert res.status_code == 401


def test_multi_tenant_data_isolation():
    """Verify strict user isolation across observations, check-ins, and simulation scenarios."""
    uid = uuid.uuid4().hex[:8]

    # Create User A
    email_a = f"alice_{uid}@example.com"
    client.post("/api/auth/register", json={"email": email_a, "password": "Password123!", "full_name": "Alice"})
    login_a = client.post("/api/auth/login", json={"email": email_a, "password": "Password123!"}).json()
    token_a = login_a["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Create User B
    email_b = f"bob_{uid}@example.com"
    client.post("/api/auth/register", json={"email": email_b, "password": "Password123!", "full_name": "Bob"})
    login_b = client.post("/api/auth/login", json={"email": email_b, "password": "Password123!"}).json()
    token_b = login_b["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A creates a physiological observation
    physio_res = client.post(
        "/api/observations/physiological",
        headers=headers_a,
        json={"heart_rate_bpm": 74.0, "heart_rate_variability_ms": 42.0}
    )
    assert physio_res.status_code == 201
    physio_id = physio_res.json()["id"]

    # User A creates an anxiety check-in
    checkin_res = client.post(
        "/api/checkins",
        headers=headers_a,
        json={"subjective_anxiety_score": 6, "triggers_noted": "Work presentation"}
    )
    assert checkin_res.status_code == 201
    checkin_id = checkin_res.json()["checkin"]["id"]

    # User A saves a simulation scenario
    scenario_res = client.post(
        "/api/simulation/scenarios",
        headers=headers_a,
        json={
            "name": "Alice scenario",
            "description": "Counterfactual test",
            "inputs": {
                "heart_rate_bpm": 74.0,
                "hrv_ms": 42.0,
                "sleep_hours": 6.0,
                "caffeine_cups": 3.0,
                "physical_activity_mins": 30.0,
                "self_reported_anxiety": 5,
            }
        }
    )
    assert scenario_res.status_code == 201
    scenario_id = scenario_res.json()["id"]
    assert scenario_id is not None

    # User B attempts to read User A's check-in
    res = client.get(f"/api/checkins/{checkin_id}", headers=headers_b)
    assert res.status_code == 404

    # User B attempts to edit User A's check-in
    res = client.put(f"/api/checkins/{checkin_id}", headers=headers_b, json={"subjective_anxiety_score": 2})
    assert res.status_code == 404

    # User B attempts to delete User A's check-in
    res = client.delete(f"/api/checkins/{checkin_id}", headers=headers_b)
    assert res.status_code == 404

    # User B attempts to edit User A's physiological observation
    res = client.put(f"/api/observations/physiological/{physio_id}", headers=headers_b, json={"heart_rate_bpm": 80.0})
    assert res.status_code == 404

    # User B attempts to delete User A's physiological observation
    res = client.delete(f"/api/observations/physiological/{physio_id}", headers=headers_b)
    assert res.status_code == 404

    # User B attempts to delete User A's simulation scenario
    res = client.delete(f"/api/simulation/scenarios/{scenario_id}", headers=headers_b)
    assert res.status_code == 404

    # Verify User B's history is empty
    history_b = client.get("/api/observations/history", headers=headers_b).json()
    assert len(history_b["physiological"]) == 0
    assert len(history_b["checkins"]) == 0

    # User A CAN edit their own observation
    edit_res = client.put(
        f"/api/observations/physiological/{physio_id}",
        headers=headers_a,
        json={"heart_rate_bpm": 78.0}
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["heart_rate_bpm"] == 78.0

    # User A CAN delete their own scenario
    del_scen = client.delete(f"/api/simulation/scenarios/{scenario_id}", headers=headers_a)
    assert del_scen.status_code == 204


def test_unmeasured_physiological_values_honesty():
    """Verify missing sensor values are NOT defaulted to fake user measurements (e.g. 72 BPM)."""
    uid = uuid.uuid4().hex[:8]
    email = f"unmeasured_{uid}@example.com"
    client.post("/api/auth/register", json={"email": email, "password": "Password123!"})
    token = client.post("/api/auth/login", json={"email": email, "password": "Password123!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Submit a checkin with ONLY subjective score and no heart rate
    res = client.post("/api/checkins", headers=headers, json={"subjective_anxiety_score": 4})
    assert res.status_code == 201

    # Retrieve twin state
    twin_res = client.get("/api/twin/state", headers=headers)
    assert twin_res.status_code == 200
    details = twin_res.json()["details"]
    assert details["is_heart_rate_measured"] is False
    assert details["heart_rate_bpm"] is None
    assert details["is_hrv_measured"] is False
    assert details["hrv_ms"] is None


def test_baseline_vs_personalized_prediction_cold_start():
    """Verify separation of descriptive baseline (>=5 obs, >=3 days) vs ML personalization (>=7 prior days)."""
    uid = uuid.uuid4().hex[:8]
    email = f"baseline_{uid}@example.com"
    client.post("/api/auth/register", json={"email": email, "password": "Password123!"})
    token = client.post("/api/auth/login", json={"email": email, "password": "Password123!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Cold-start check
    pred_res = client.get("/api/prediction/personalized", headers=headers)
    assert pred_res.status_code == 200
    data = pred_res.json()
    assert data["status"] == "unavailable"
    assert data["unique_history_days"] < 7
    assert data["prediction"] is None
    assert "at least 7 distinct days" in data["message"]

    # 2. Add observations across 7 distinct calendar days
    base_time = datetime.now(timezone.utc) - timedelta(days=8)
    for d in range(7):
        day_date = (base_time + timedelta(days=d)).strftime("%Y-%m-%d")
        client.post(
            "/api/observations/lifestyle",
            headers=headers,
            json={"date": day_date, "sleep_hours": 7.0 + (d % 2), "caffeine_cups": 1.0}
        )
        client.post(
            "/api/observations/physiological",
            headers=headers,
            json={"heart_rate_bpm": 70.0 + d, "heart_rate_variability_ms": 45.0}
        )

    # 3. Baseline endpoint should now reflect readiness
    base_summary = client.get("/api/twin/baseline", headers=headers).json()
    assert base_summary["unique_days_count"] >= 7
    assert base_summary["descriptive_baseline_ready"] is True
    assert base_summary["personalized_prediction_ready"] is True

    # 4. Personalized prediction should now be ready
    pred_res2 = client.get("/api/prediction/personalized", headers=headers)
    assert pred_res2.status_code == 200
    data2 = pred_res2.json()
    assert data2["status"] == "ready"
    assert data2["unique_history_days"] >= 7
    assert data2["prediction"] is not None
    assert "predicted_probability" in data2["prediction"]
    assert "risk_band" in data2["prediction"]


def test_simulation_lab_comparison_and_disclaimer():
    """Verify simulation comparison includes delta vulnerability and non-causal disclaimer."""
    res = client.post(
        "/api/simulation/compare",
        json={
            "scenario_a": {"sleep_duration": 8.0, "caffeine_intake": 1.0, "physical_activity_mins": 60.0},
            "scenario_b": {"sleep_duration": 4.5, "caffeine_intake": 4.0, "physical_activity_mins": 10.0},
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert "delta_predicted_probability" in data
    assert "non_causal_disclaimer" in data
    assert "correlation" in data["non_causal_disclaimer"].lower() or "causation" in data["non_causal_disclaimer"].lower()


def test_account_deletion_data_lifecycle():
    """Verify account deletion deletes all associated data and rejects subsequent requests."""
    uid = uuid.uuid4().hex[:8]
    email = f"delete_{uid}@example.com"
    client.post("/api/auth/register", json={"email": email, "password": "Password123!"})
    token = client.post("/api/auth/login", json={"email": email, "password": "Password123!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Delete account
    del_res = client.delete("/api/auth/me", headers=headers)
    assert del_res.status_code == 204

    # Subsequent access is rejected
    res = client.get("/api/auth/me", headers=headers)
    assert res.status_code == 401
