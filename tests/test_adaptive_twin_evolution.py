import uuid
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


@pytest.fixture(scope="module")
def fresh_user():
    uid = uuid.uuid4().hex[:8]
    email = f"adaptive_twin_{uid}@example.com"
    pwd = "AdaptiveTest2026!"
    reg_resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "full_name": f"Adaptive Tester {uid}", "role": "patient"},
    )
    assert reg_resp.status_code in [201, 200]
    token = reg_resp.json()["access_token"]
    user_id = reg_resp.json()["user_id"]
    return {"id": user_id, "email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="module")
def other_user():
    uid = uuid.uuid4().hex[:8]
    email = f"other_twin_{uid}@example.com"
    pwd = "OtherSecure2026!"
    reg_resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "full_name": f"Other User {uid}", "role": "patient"},
    )
    assert reg_resp.status_code in [201, 200]
    token = reg_resp.json()["access_token"]
    user_id = reg_resp.json()["user_id"]
    return {"id": user_id, "email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


def test_adaptive_initialization_cold_start(fresh_user):
    """When a user has no/insufficient historical data, initialization activates generic demonstration mode."""
    resp = client.get("/api/simulation/adaptive/initialize", headers=fresh_user["headers"])
    assert resp.status_code == 200
    data = resp.json()

    assert data["is_personalized"] is False
    assert data["data_mode"] == "generic_demo"
    assert data["profile_id"] == "DEMO-PATIENT-01"
    assert "Generic Demonstration Mode" in data["profile_name"]
    assert data["sufficient_data"] is False
    assert len(data["metrics"]) >= 5
    for m in data["metrics"]:
        assert m["sufficient_data"] is False
        assert m["provenance"] in ["reference_demo", "derived"]


def test_adaptive_initialization_with_sufficient_data(fresh_user):
    """After sufficient authentic observations across 3+ days, personalized mode activates."""
    now = datetime.now(timezone.utc)
    # Seed 6 authentic observations across 4 days
    for day in range(4):
        obs_date = (now - timedelta(days=day)).strftime("%Y-%m-%d")
        obs_ts = (now - timedelta(days=day)).isoformat()

        # Physio
        client.post(
            "/api/observations/physiological",
            headers=fresh_user["headers"],
            json={"heart_rate_bpm": 68.0 + day, "heart_rate_variability_ms": 52.0 - day, "steps_count": 7200, "timestamp": obs_ts},
        )
        # Lifestyle
        client.post(
            "/api/observations/lifestyle",
            headers=fresh_user["headers"],
            json={"date": obs_date, "sleep_hours": 7.8 - (day * 0.2), "caffeine_cups": 1.0, "exercise_minutes": 30.0},
        )
        # Checkin
        client.post(
            "/api/checkins",
            headers=fresh_user["headers"],
            json={"subjective_anxiety_score": 2 + (day % 2), "energy_level": 3, "timestamp": obs_ts},
        )

    resp = client.get("/api/simulation/adaptive/initialize", headers=fresh_user["headers"])
    assert resp.status_code == 200
    data = resp.json()

    assert data["is_personalized"] is True
    assert data["data_mode"] == "personalized"
    assert data["profile_id"].startswith("USER-")
    assert data["sufficient_data"] is True
    assert len(data["metrics"]) >= 5

    # Check resting HR metric
    hr_metric = next(m for m in data["metrics"] if m["metric_key"] == "resting_heart_rate")
    assert hr_metric["sufficient_data"] is True
    assert hr_metric["baseline_value"] is not None
    assert hr_metric["provenance"] == "device_measured"


def test_explainable_scenario_comparison(fresh_user):
    """Verifies that scenario comparison attributes differences to deterministic formulas and flags unmodeled inputs."""
    payload = {
        "scenario_a": {
            "sleep_hours": 8.0,
            "caffeine_cups": 1.0,
            "physical_activity_mins": 45.0,
            "heart_rate_bpm": 66.0,
            "hrv_ms": 55.0,
            "self_reported_anxiety": 2,
            "recent_stress_exposure": 1,
        },
        "scenario_b": {
            "sleep_hours": 4.5,
            "caffeine_cups": 3.5,
            "physical_activity_mins": 15.0,  # Unmodeled input for twin state
            "heart_rate_bpm": 88.0,
            "hrv_ms": 30.0,
            "self_reported_anxiety": 7,
            "recent_stress_exposure": 4,  # Unmodeled input for twin state
        },
        "baseline_profile_id": "DEMO-PATIENT-01",
    }

    resp = client.post("/api/simulation/adaptive/compare", headers=fresh_user["headers"], json=payload)
    assert resp.status_code == 200
    data = resp.json()

    # Output changes
    outputs = {o["metric"]: o for o in data["outputs_changed"]}
    assert "composite_stress_index" in outputs
    assert outputs["composite_stress_index"]["delta"] > 0  # Scenario B has higher stress

    # Inputs changed
    input_keys = [i["parameter"] for i in data["inputs_changed"]]
    assert "sleep_hours" in input_keys
    assert "caffeine_cups" in input_keys
    assert "heart_rate_bpm" in input_keys
    assert "physical_activity_mins" in input_keys

    # Check unmodeled inputs
    assert len(data["unmodeled_inputs"]) >= 2
    unmodeled_text = " ".join(data["unmodeled_inputs"])
    assert "Physical Activity" in unmodeled_text
    assert "Recent Stress Exposure" in unmodeled_text
    assert "NO modeled effect" in unmodeled_text

    # Check calculation explanations
    assert len(data["calculation_explanations"]) >= 3
    assert len(data["scientific_limitations"]) >= 3
    assert len(data["reproducibility_hash"]) == 16


def test_counterfactual_single_variable_perturbation(fresh_user):
    """Verifies that 1-variable counterfactual test attributes changes strictly to the perturbed variable."""
    # 1. Perturb sleep only
    sleep_payload = {
        "parameter_to_vary": "sleep_hours",
        "perturbed_value": 4.0,
        "base_scenario": {
            "sleep_hours": 8.0,
            "caffeine_cups": 1.0,
            "physical_activity_mins": 30.0,
            "heart_rate_bpm": 70.0,
            "hrv_ms": 48.0,
            "self_reported_anxiety": 2,
            "recent_stress_exposure": 1,
        },
        "baseline_profile_id": "DEMO-PATIENT-01",
    }
    resp = client.post("/api/simulation/adaptive/counterfactual", headers=fresh_user["headers"], json=sleep_payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["parameter_varied"] == "sleep_hours"
    assert data["original_input"] == 8.0
    assert data["alternative_input"] == 4.0
    assert data["input_delta"] == -4.0
    assert data["metric_deltas"]["delta_circadian_disruption"] > 0
    assert data["metric_deltas"]["delta_physiological_arousal"] == 0  # Arousal unaffected
    assert "Sleep deficit penalty formula" in data["simulation_rule_explanation"]

    # 2. Perturb unmodeled variable (activity)
    act_payload = {
        "parameter_to_vary": "physical_activity_mins",
        "perturbed_value": 90.0,
        "base_scenario": {
            "sleep_hours": 7.5,
            "caffeine_cups": 1.0,
            "physical_activity_mins": 20.0,
            "heart_rate_bpm": 70.0,
            "hrv_ms": 48.0,
            "self_reported_anxiety": 2,
            "recent_stress_exposure": 1,
        },
        "baseline_profile_id": "DEMO-PATIENT-01",
    }
    resp_act = client.post("/api/simulation/adaptive/counterfactual", headers=fresh_user["headers"], json=act_payload)
    assert resp_act.status_code == 200
    data_act = resp_act.json()
    assert data_act["metric_deltas"]["delta_composite_stress"] == 0.0
    assert data_act["unmodeled_effect_note"] is not None
    assert "zero change in CSI" in data_act["unmodeled_effect_note"]


def test_longitudinal_baseline_evolution_and_isolation(fresh_user):
    """Historical evolution relies only on genuine observations and strictly excludes synthetic simulation records."""
    # Insert a synthetic observation that would heavily bias the mean if mixed
    client.post(
        "/api/observations/physiological",
        headers=fresh_user["headers"],
        json={"heart_rate_bpm": 195.0, "heart_rate_variability_ms": 10.0, "source_type": "simulated"},
    )

    resp = client.get("/api/twin/evolution?window_days=7&max_windows=4", headers=fresh_user["headers"])
    assert resp.status_code == 200
    data = resp.json()

    assert data["user_id"] == fresh_user["id"]
    assert "EXCLUDES ALL SYNTHETIC SIMULATION SCENARIOS" in data["isolation_notice"]
    assert len(data["windows"]) >= 1

    # Verify that the 195 BPM simulated spike did NOT pollute the resting HR mean
    current_window = data["windows"][0]
    if current_window.get("mean_resting_hr") is not None:
        assert current_window["mean_resting_hr"] < 100.0  # Around ~70 BPM, not ~195!


def test_digital_twin_memory_lifecycle_and_reset(fresh_user, other_user):
    """Tests saving baseline memory snapshots and verifying that reset does NOT delete genuine patient data."""
    # 1. Snapshot memory
    snap_resp = client.post("/api/twin/memory/snapshot", headers=fresh_user["headers"])
    assert snap_resp.status_code == 200
    snap_data = snap_resp.json()
    assert snap_data["user_id"] == fresh_user["id"]
    assert snap_data["is_active"] is True
    assert "mean_resting_hr" in snap_data["metrics_included"]

    # 2. List memories
    list_resp = client.get("/api/twin/memory", headers=fresh_user["headers"])
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1

    # 3. Tenant isolation: other user cannot see fresh user's memory
    other_list = client.get("/api/twin/memory", headers=other_user["headers"])
    assert other_list.status_code == 200
    assert len(other_list.json()) == 0

    # 4. Reset memory
    reset_resp = client.post("/api/twin/memory/reset", headers=fresh_user["headers"])
    assert reset_resp.status_code == 200
    reset_data = reset_resp.json()
    assert reset_data["status"] == "success"
    assert reset_data["authentic_records_preserved"] is True

    # Check memory list is now empty for active snapshots
    list_after = client.get("/api/twin/memory", headers=fresh_user["headers"])
    assert list_after.status_code == 200
    assert len(list_after.json()) == 0

    # Verify genuine observations still exist
    checkin_resp = client.get("/api/checkins?limit=10", headers=fresh_user["headers"])
    assert checkin_resp.status_code == 200
    checkins_list = checkin_resp.json()
    assert len(checkins_list) > 0  # Real data preserved!
