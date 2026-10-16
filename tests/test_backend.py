import uuid
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "version" in data
    assert data["ml_models_loaded"] is True


def test_auth_workflow_and_isolation():
    uid = uuid.uuid4().hex[:8]
    # 1. Register User A
    user_a_email = f"user_a_{uid}@example.com"
    reg_resp = client.post(
        "/api/auth/register",
        json={"email": user_a_email, "password": "Password123!", "full_name": "Test User A"},
    )
    assert reg_resp.status_code in [201, 400]
    
    # 2. Login User A
    login_resp = client.post(
        "/api/auth/login",
        json={"email": user_a_email, "password": "Password123!"},
    )
    assert login_resp.status_code == 200
    token_a = login_resp.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 3. Get User A profile
    prof_resp = client.get("/api/auth/profile", headers=headers_a)
    assert prof_resp.status_code == 200
    assert prof_resp.json()["baseline_resting_hr"] == 72.0

    # 4. Complete Onboarding
    onboard_resp = client.post(
        "/api/auth/onboarding",
        headers=headers_a,
        json={
            "age": 30,
            "biological_sex": "F",
            "baseline_resting_hr": 68.0,
            "baseline_sleep_hours": 8.0,
            "baseline_caffeine_cups": 1.0,
            "has_panic_history": True,
            "consents": ["health_data_processing", "simulation_research"],
        },
    )
    assert onboard_resp.status_code == 200
    assert onboard_resp.json()["onboarding_completed"] is True
    assert onboard_resp.json()["baseline_resting_hr"] == 68.0

    # 5. Add Physiological Observation
    physio_resp = client.post(
        "/api/observations/physiological",
        headers=headers_a,
        json={
            "heart_rate_bpm": 85.0,
            "heart_rate_variability_ms": 35.0,
            "resting_heart_rate": 68.0,
            "source_type": "user_entered",
        },
    )
    assert physio_resp.status_code == 201
    obs_id = physio_resp.json()["id"]

    # 6. Add Lifestyle Observation
    life_resp = client.post(
        "/api/observations/lifestyle",
        headers=headers_a,
        json={
            "date": "2026-10-09",
            "sleep_hours": 6.5,
            "sleep_quality_score": 3,
            "caffeine_cups": 2.0,
        },
    )
    assert life_resp.status_code == 201

    # 7. Add Anxiety Check-in with high score to trigger safety guidance
    checkin_resp = client.post(
        "/api/checkins",
        headers=headers_a,
        json={
            "subjective_anxiety_score": 9,
            "somatic_symptoms": ["tightness", "palpitations"],
            "triggers_noted": "Work presentation deadline",
        },
    )
    assert checkin_resp.status_code == 201
    chk_data = checkin_resp.json()
    assert chk_data["safety_guidance"] is not None
    assert chk_data["safety_guidance"]["is_acute"] is True

    # 8. Check Digital Twin State
    twin_resp = client.get("/api/twin/state", headers=headers_a)
    assert twin_resp.status_code == 200
    state_data = twin_resp.json()
    assert "composite_stress_index" in state_data
    assert "physiological_arousal_score" in state_data
    assert "state_label" in state_data
    # With HR 85, sleep 6.5, anxiety 9, state should be elevated
    assert state_data["state_label"] in ["ELEVATED_AROUSAL", "HIGH_VULNERABILITY", "MILD_STRAIN"]

    # 9. Verify Baseline Summary
    base_resp = client.get("/api/twin/baseline", headers=headers_a)
    assert base_resp.status_code == 200
    assert "mean_resting_hr" in base_resp.json()

    # 10. Run Prediction API
    pred_resp = client.post(
        "/api/prediction/predict",
        headers=headers_a,
        json={
            "heart_rate_mean": 82.0,
            "heart_rate_max": 115.0,
            "heart_rate_var": 130.0,
            "steps_mean": 60.0,
            "sleep_duration": 6.0,
            "sleep_onset_hour": -1.5,
            "sleep_out_hour": 6.5,
            "caffeine_intake": 2.0,
            "alcohol_intake": 0.0,
            "daily_anxiety_rating": 7.0,
            "annoyance_rating": 4.0,
            "model_choice": "XGBoost",
        },
    )
    assert pred_resp.status_code == 200
    pred_data = pred_resp.json()
    assert "predicted_probability" in pred_data
    assert "uncertainty_interval" in pred_data
    assert len(pred_data["uncertainty_interval"]) == 2
    assert "research_disclaimer" in pred_data

    # 11. Run Simulation Comparison
    sim_resp = client.post(
        "/api/simulation/compare",
        json={
            "scenario_a": {
                "sleep_hours": 8.0,
                "caffeine_cups": 1.0,
                "physical_activity_mins": 30.0,
                "heart_rate_bpm": 68.0,
                "hrv_ms": 55.0,
                "self_reported_anxiety": 2,
            },
            "scenario_b": {
                "sleep_hours": 4.5,
                "caffeine_cups": 4.0,
                "physical_activity_mins": 10.0,
                "heart_rate_bpm": 92.0,
                "hrv_ms": 28.0,
                "self_reported_anxiety": 8,
            },
        },
    )
    assert sim_resp.status_code == 200
    sim_data = sim_resp.json()
    assert sim_data["differential_analysis"]["delta_composite_stress"] > 0

    # 12. Register User B and verify isolation (cannot delete User A's observation)
    user_b_email = f"user_b_{uid}@example.com"
    client.post(
        "/api/auth/register",
        json={"email": user_b_email, "password": "Password123!", "full_name": "Test User B"},
    )
    login_b = client.post(
        "/api/auth/login",
        json={"email": user_b_email, "password": "Password123!"},
    )
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    del_resp = client.delete(f"/api/observations/physiological/{obs_id}", headers=headers_b)
    # User B must NOT be allowed to delete User A's observation -> returns 404 (not found in user B's scope)
    assert del_resp.status_code == 404


def test_unified_checkin_and_crud_lifecycle():
    uid = uuid.uuid4().hex[:8]
    user_email = f"unified_{uid}@example.com"
    reg_resp = client.post(
        "/api/auth/register",
        json={"email": user_email, "password": "Password123!", "full_name": "Unified User"},
    )
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Check initial cold-start baseline
    base_res = client.get("/api/twin/baseline", headers=headers)
    assert base_res.status_code == 200
    base_data = base_res.json()
    assert base_data["has_sufficient_data"] is False
    assert base_data["is_cold_start"] is True
    assert base_data["required_observations_count"] == 5
    assert "Cold-start" in base_data["status_message"]

    # 2. Submit unified daily check-in (mood + sleep + caffeine + steps + HR)
    checkin_payload = {
        "subjective_anxiety_score": 4,
        "energy_level": 3,
        "somatic_symptoms": ["Chest Tightness"],
        "triggers_noted": "Routine Daily Check-In",
        "notes": "Testing unified check-in flow.",
        "sleep_hours": 7.0,
        "caffeine_cups": 2.0,
        "heart_rate_bpm": 74.0,
        "steps_count": 6200,
    }
    create_res = client.post("/api/checkins", headers=headers, json=checkin_payload)
    assert create_res.status_code == 201
    created_chk = create_res.json()["checkin"]
    chk_id = created_chk["id"]
    assert created_chk["sleep_hours"] == 7.0
    assert created_chk["caffeine_cups"] == 2.0
    assert created_chk["heart_rate_bpm"] == 74.0

    # 3. Retrieve single check-in by ID
    get_res = client.get(f"/api/checkins/{chk_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == chk_id
    assert get_res.json()["subjective_anxiety_score"] == 4

    # 4. Update check-in
    update_res = client.put(
        f"/api/checkins/{chk_id}",
        headers=headers,
        json={"subjective_anxiety_score": 2, "notes": "Feeling calmer after grounding."},
    )
    assert update_res.status_code == 200
    assert update_res.json()["subjective_anxiety_score"] == 2

    # 5. Verify User B isolation: cannot view, update, or delete User A's check-in
    user_b_email = f"unified_b_{uid}@example.com"
    reg_b = client.post(
        "/api/auth/register",
        json={"email": user_b_email, "password": "Password123!", "full_name": "Unified User B"},
    )
    token_b = reg_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    get_b = client.get(f"/api/checkins/{chk_id}", headers=headers_b)
    assert get_b.status_code == 404

    put_b = client.put(f"/api/checkins/{chk_id}", headers=headers_b, json={"subjective_anxiety_score": 9})
    assert put_b.status_code == 404

    del_b = client.delete(f"/api/checkins/{chk_id}", headers=headers_b)
    assert del_b.status_code == 404

    # 6. Delete check-in by owner
    del_res = client.delete(f"/api/checkins/{chk_id}", headers=headers)
    assert del_res.status_code == 204
