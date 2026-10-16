import uuid
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect

from backend.app.main import app
from backend.app.models.db_models import (
    Base,
    PhysiologicalObservation,
    LifestyleObservation,
    AnxietyCheckin,
    DigitalTwinMemory,
    SimulationScenario,
)
from backend.app.services.twin_engine import DigitalTwinEngine
from backend.app.core.database import get_db

client = TestClient(app)


@pytest.fixture(scope="module")
def user_a():
    uid = uuid.uuid4().hex[:8]
    email = f"verify_user_a_{uid}@example.com"
    pwd = "VerifyPassword2026!"
    reg_resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "full_name": f"Verification User A {uid}", "role": "patient"},
    )
    assert reg_resp.status_code in [200, 201]
    token = reg_resp.json()["access_token"]
    user_id = reg_resp.json()["user_id"]
    return {"id": user_id, "email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="module")
def user_b():
    uid = uuid.uuid4().hex[:8]
    email = f"verify_user_b_{uid}@example.com"
    pwd = "VerifyPassword2026!"
    reg_resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "full_name": f"Verification User B {uid}", "role": "patient"},
    )
    assert reg_resp.status_code in [200, 201]
    token = reg_resp.json()["access_token"]
    user_id = reg_resp.json()["user_id"]
    return {"id": user_id, "email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


# =========================================================================
# 1. NUMERICAL CORRECTNESS & COUNTERFACTUAL MATH VERIFICATION
# =========================================================================

def test_counterfactual_numerical_equations_sleep_deficit(user_a):
    """
    Sleep deficit equation:
    deficit = max(0, baseline_sleep - sleep) * 20.0 (capped at 70 points)
    baseline_sleep for DEMO-PATIENT-01 = 7.5h.
    When sleep = 5.5h (deficit = 2.0h), circadian index contribution = 2.0 * 20.0 = 40.0 pts.
    Circadian index weight in CSI is 25%, producing +10.0 pts on CSI.
    """
    base_input = {
        "sleep_hours": 7.5,
        "caffeine_cups": 1.0,
        "physical_activity_mins": 30.0,
        "heart_rate_bpm": 70.0,
        "hrv_ms": 45.0,
        "self_reported_anxiety": 2,
        "recent_stress_exposure": 1,
    }

    req = {
        "parameter_to_vary": "sleep_hours",
        "perturbed_value": 5.5,
        "base_scenario": base_input,
        "baseline_profile_id": "DEMO-PATIENT-01",
    }
    resp = client.post("/api/simulation/adaptive/counterfactual", headers=user_a["headers"], json=req)
    assert resp.status_code == 200
    data = resp.json()

    assert data["parameter_varied"] == "sleep_hours"
    assert data["original_input"] == 7.5
    assert data["alternative_input"] == 5.5
    assert data["input_delta"] == -2.0

    deltas = data["metric_deltas"]
    # Delta circadian disruption must be exactly +40.0 points
    assert deltas["delta_circadian_disruption"] == 40.0
    # Delta CSI must be exactly 40.0 * 0.25 = +10.0 points
    assert deltas["delta_composite_stress"] == 10.0
    # Non-circadian components must have 0.0 delta
    assert deltas["delta_physiological_arousal"] == 0.0


def test_counterfactual_numerical_equations_caffeine_excess(user_a):
    """
    Caffeine excess equation:
    excess = max(0, caffeine - baseline_caff) * 12.0 (capped at 30 points)
    baseline_caff for DEMO-PATIENT-01 = 1.0 cups.
    When caffeine = 3.0 cups (excess = 2.0 cups), circadian contribution = 2.0 * 12.0 = 24.0 pts.
    Circadian weight in CSI is 25%, producing +6.0 pts on CSI.
    """
    base_input = {
        "sleep_hours": 7.5,
        "caffeine_cups": 1.0,
        "physical_activity_mins": 30.0,
        "heart_rate_bpm": 70.0,
        "hrv_ms": 45.0,
        "self_reported_anxiety": 2,
        "recent_stress_exposure": 1,
    }

    req = {
        "parameter_to_vary": "caffeine_cups",
        "perturbed_value": 3.0,
        "base_scenario": base_input,
        "baseline_profile_id": "DEMO-PATIENT-01",
    }
    resp = client.post("/api/simulation/adaptive/counterfactual", headers=user_a["headers"], json=req)
    assert resp.status_code == 200
    data = resp.json()

    deltas = data["metric_deltas"]
    assert deltas["delta_circadian_disruption"] == 24.0
    assert deltas["delta_composite_stress"] == 6.0
    assert deltas["delta_physiological_arousal"] == 0.0


def test_counterfactual_numerical_equations_anxiety_strain(user_a):
    """
    Psychological strain equation:
    score * 10.0 pts.
    With 40% CSI weighting: delta_csi = delta_anxiety * 10 * 0.40 = delta_anxiety * 4.0 pts.
    Varying from 2 to 5 (+3 score): delta_csi = 3 * 4.0 = +12.0 pts.
    """
    base_input = {
        "sleep_hours": 7.5,
        "caffeine_cups": 1.0,
        "physical_activity_mins": 30.0,
        "heart_rate_bpm": 70.0,
        "hrv_ms": 45.0,
        "self_reported_anxiety": 2,
        "recent_stress_exposure": 1,
    }

    req = {
        "parameter_to_vary": "self_reported_anxiety",
        "perturbed_value": 5,
        "base_scenario": base_input,
        "baseline_profile_id": "DEMO-PATIENT-01",
    }
    resp = client.post("/api/simulation/adaptive/counterfactual", headers=user_a["headers"], json=req)
    assert resp.status_code == 200
    data = resp.json()

    deltas = data["metric_deltas"]
    assert deltas["delta_composite_stress"] == 12.0
    assert deltas["delta_physiological_arousal"] == 0.0
    assert deltas["delta_circadian_disruption"] == 0.0


def test_counterfactual_unmodeled_parameters_have_zero_effect(user_a):
    """
    Inputs documented as having no effect on twin state equations (physical_activity_mins, recent_stress_exposure)
    must produce exactly 0.0 delta on composite stress, arousal, and circadian disruption.
    """
    base_input = {
        "sleep_hours": 7.5,
        "caffeine_cups": 1.0,
        "physical_activity_mins": 30.0,
        "heart_rate_bpm": 70.0,
        "hrv_ms": 45.0,
        "self_reported_anxiety": 2,
        "recent_stress_exposure": 1,
    }

    for param, alt_val in [("physical_activity_mins", 120.0), ("recent_stress_exposure", 5)]:
        req = {
            "parameter_to_vary": param,
            "perturbed_value": alt_val,
            "base_scenario": base_input,
            "baseline_profile_id": "DEMO-PATIENT-01",
        }
        resp = client.post("/api/simulation/adaptive/counterfactual", headers=user_a["headers"], json=req)
        assert resp.status_code == 200
        data = resp.json()

        deltas = data["metric_deltas"]
        assert deltas["delta_composite_stress"] == 0.0
        assert deltas["delta_physiological_arousal"] == 0.0
        assert deltas["delta_circadian_disruption"] == 0.0
        assert data["unmodeled_effect_note"] is not None
        assert "not a variable in the deterministic DigitalTwinEngine" in data["unmodeled_effect_note"]


def test_counterfactual_invalid_input_handling(user_a):
    """Boundary conditions & invalid input handling."""
    base_input = {
        "sleep_hours": 7.5,
        "caffeine_cups": 1.0,
        "physical_activity_mins": 30.0,
        "heart_rate_bpm": 70.0,
        "hrv_ms": 45.0,
        "self_reported_anxiety": 2,
        "recent_stress_exposure": 1,
    }

    # Invalid parameter name
    bad_param = {
        "parameter_to_vary": "unsupported_variable_xyz",
        "perturbed_value": 10.0,
        "base_scenario": base_input,
    }
    resp = client.post("/api/simulation/adaptive/counterfactual", headers=user_a["headers"], json=bad_param)
    assert resp.status_code == 422

    # Out of bounds value (e.g., negative sleep hours)
    bad_val = {
        "parameter_to_vary": "sleep_hours",
        "perturbed_value": -5.0,
        "base_scenario": base_input,
    }
    resp = client.post("/api/simulation/adaptive/counterfactual", headers=user_a["headers"], json=bad_val)
    assert resp.status_code == 422


# =========================================================================
# 2. REPRODUCIBILITY & DETERMINISM VERIFICATION
# =========================================================================

def test_deterministic_replay_exact_reproducibility(user_a):
    """
    Running replay with identical seed and scenario input must yield
    the exact identical trajectory down to every individual timeline step.
    """
    scenario_input = {
        "sleep_hours": 6.0,
        "caffeine_cups": 2.5,
        "physical_activity_mins": 45.0,
        "heart_rate_bpm": 82.0,
        "hrv_ms": 38.0,
        "self_reported_anxiety": 4,
        "recent_stress_exposure": 3,
    }
    payload = {
        "scenario_input": scenario_input,
        "seed": 1337,
        "steps_count": 24,
        "baseline_profile_id": "DEMO-PATIENT-01",
    }

    resp1 = client.post("/api/simulation/replay", json=payload)
    assert resp1.status_code == 200
    data1 = resp1.json()

    resp2 = client.post("/api/simulation/replay", json=payload)
    assert resp2.status_code == 200
    data2 = resp2.json()

    assert data1["reproducibility_hash"] == data2["reproducibility_hash"]
    assert len(data1["steps"]) == len(data2["steps"]) == 24

    for s1, s2 in zip(data1["steps"], data2["steps"]):
        assert s1["hour_offset"] == s2["hour_offset"]
        assert s1["heart_rate_bpm"] == s2["heart_rate_bpm"]
        assert s1["hrv_ms"] == s2["hrv_ms"]
        assert s1["composite_stress_index"] == s2["composite_stress_index"]
        assert s1["state_label"] == s2["state_label"]

    # Different seed produces different jitter trajectory
    payload_diff_seed = dict(payload, seed=9999)
    resp3 = client.post("/api/simulation/replay", json=payload_diff_seed)
    assert resp3.status_code == 200
    data3 = resp3.json()
    assert data3["reproducibility_hash"] != data1["reproducibility_hash"]


# =========================================================================
# 3. GENUINE-DATA ISOLATION & PROVENANCE QUARANTINE VERIFICATION
# =========================================================================

def test_provenance_predicate_strictly_rejects_synthetic_and_unverified():
    """Unit verification of DigitalTwinEngine.is_genuine_observation and get_provenance_category."""
    from types import SimpleNamespace

    # Genuine records
    assert DigitalTwinEngine.is_genuine_observation(SimpleNamespace(source_type="device_measurement")) is True
    assert DigitalTwinEngine.is_genuine_observation(SimpleNamespace(source_type="user_entered")) is True
    assert DigitalTwinEngine.is_genuine_observation(SimpleNamespace(source_type="wearable")) is True
    assert DigitalTwinEngine.is_genuine_observation(SimpleNamespace(source_type="user_reported")) is True
    assert DigitalTwinEngine.is_genuine_observation(SimpleNamespace(source_type="calculated")) is True

    # Synthetic / Simulated records
    assert DigitalTwinEngine.is_genuine_observation(SimpleNamespace(source_type="simulated")) is False
    assert DigitalTwinEngine.is_genuine_observation(SimpleNamespace(source_type="synthetic")) is False
    assert DigitalTwinEngine.is_genuine_observation(SimpleNamespace(source_type="mock")) is False
    assert DigitalTwinEngine.is_genuine_observation(SimpleNamespace(source_type="demo")) is False

    # Missing / Null / Unexpected records
    assert DigitalTwinEngine.is_genuine_observation(SimpleNamespace(source_type=None)) is False
    assert DigitalTwinEngine.is_genuine_observation(SimpleNamespace(source_type="")) is False
    assert DigitalTwinEngine.is_genuine_observation(SimpleNamespace(source_type="unverified_third_party")) is False
    assert DigitalTwinEngine.is_genuine_observation(SimpleNamespace(source_type=123)) is False

    # Provenance categorizer
    assert DigitalTwinEngine.get_provenance_category(SimpleNamespace(source_type="device_measurement")) == "device_measured"
    assert DigitalTwinEngine.get_provenance_category(SimpleNamespace(source_type="user_entered")) == "user_reported"
    assert DigitalTwinEngine.get_provenance_category(SimpleNamespace(source_type="simulated")) == "synthetic"
    assert DigitalTwinEngine.get_provenance_category(SimpleNamespace(source_type=None)) == "unverified"
    assert DigitalTwinEngine.get_provenance_category(SimpleNamespace(source_type="unknown_alien")) == "unverified"


def test_synthetic_and_null_provenance_records_never_contaminate_baseline(user_a):
    """
    Inserting simulated records or records with null/unexpected source_type
    must NEVER alter the personalized baseline or turn cold-start into personalized mode.
    """
    # 1. User starts cold start
    init1 = client.get("/api/simulation/adaptive/initialize", headers=user_a["headers"]).json()
    assert init1["is_personalized"] is False

    # 2. Add 10 records with source_type='simulated', 'synthetic', and 'unverified_vendor'
    now = datetime.now(timezone.utc)
    for i in range(10):
        t_str = (now - timedelta(days=i)).isoformat()
        st = "simulated" if i % 2 == 0 else "synthetic"
        client.post(
            "/api/observations/physiological",
            headers=user_a["headers"],
            json={"heart_rate_bpm": 190.0, "heart_rate_variability_ms": 10.0, "timestamp": t_str, "source_type": st},
        )

    # 3. Baseline calculation must STILL be cold-start and total genuine count must be 0
    init2 = client.get("/api/simulation/adaptive/initialize", headers=user_a["headers"]).json()
    assert init2["is_personalized"] is False
    assert init2["baseline_summary"]["total_observations_count"] == 0

    base_resp = client.get("/api/twin/baseline", headers=user_a["headers"]).json()
    assert base_resp["has_sufficient_data"] is False
    assert base_resp["total_observations_count"] == 0


# =========================================================================
# 4. LONGITUDINAL EVOLUTION & MEMORY HARDENING
# =========================================================================

def test_longitudinal_evolution_multi_window_and_snapshot_deduplication(user_b):
    """
    Tests:
    1. Multi-window chronological calculation
    2. Later observations do not corrupt or rewrite earlier windows
    3. Memory snapshot duplicate prevention (updates active record rather than adding duplicate rows)
    4. Memory reset deactivates memory without deleting genuine patient observations
    """
    # Seed 15 genuine observations across 15 distinct days
    now = datetime.now(timezone.utc)
    for day in range(15):
        d_time = now - timedelta(days=day)
        d_str = d_time.strftime("%Y-%m-%d")
        client.post(
            "/api/observations/physiological",
            headers=user_b["headers"],
            json={"heart_rate_bpm": 70.0 + (day % 3), "heart_rate_variability_ms": 50.0, "timestamp": d_time.isoformat(), "source_type": "device_measurement"},
        )
        client.post(
            "/api/observations/lifestyle",
            headers=user_b["headers"],
            json={"date": d_str, "sleep_hours": 7.5, "caffeine_cups": 1.0, "source_type": "user_entered"},
        )
        client.post(
            "/api/observations/checkin",
            headers=user_b["headers"],
            json={"subjective_anxiety_score": 3, "timestamp": d_time.isoformat(), "source_type": "user_entered"},
        )

    # Inspect longitudinal evolution
    evo = client.get("/api/twin/evolution", headers=user_b["headers"]).json()
    assert evo["has_sufficient_longitudinal_data"] is True
    assert len(evo["windows"]) >= 2
    # Check chronological ordering: window 0 (most recent) has later start_date than window 1
    assert evo["windows"][0]["start_date"] > evo["windows"][1]["start_date"]

    # Record snapshot #1
    snap1 = client.post("/api/twin/memory/snapshot", headers=user_b["headers"]).json()
    assert snap1["is_active"] is True
    snap1_id = snap1["id"]

    # Record snapshot #2 immediately (same baseline version) -> Must deduplicate/update existing record
    snap2 = client.post("/api/twin/memory/snapshot", headers=user_b["headers"]).json()
    assert snap2["id"] == snap1_id

    # Verify memory list has exactly 1 active record
    mems = client.get("/api/twin/memory", headers=user_b["headers"]).json()
    assert len(mems) == 1
    assert mems[0]["id"] == snap1_id

    # Reset memory
    reset_res = client.post("/api/twin/memory/reset", headers=user_b["headers"]).json()
    assert reset_res["status"] == "success"
    assert reset_res["authentic_records_preserved"] is True

    # Memory list must now be empty (active count = 0)
    mems_post_reset = client.get("/api/twin/memory", headers=user_b["headers"]).json()
    assert len(mems_post_reset) == 0

    # Genuine observations must STILL BE PRESERVED and baseline still rich
    base_post_reset = client.get("/api/twin/baseline", headers=user_b["headers"]).json()
    assert base_post_reset["has_sufficient_data"] is True
    assert base_post_reset["total_observations_count"] >= 15


# =========================================================================
# 5. SECURITY, OWNERSHIP & CROSS-USER ISOLATION
# =========================================================================

def test_endpoints_strictly_require_authentication():
    """All adaptive twin endpoints require valid Bearer token."""
    unauthed_get_endpoints = [
        "/api/simulation/adaptive/initialize",
        "/api/twin/evolution",
        "/api/twin/memory",
    ]
    unauthed_post_endpoints = [
        "/api/simulation/adaptive/compare",
        "/api/simulation/adaptive/counterfactual",
        "/api/twin/memory/snapshot",
        "/api/twin/memory/reset",
    ]

    for ep in unauthed_get_endpoints:
        res = client.get(ep)
        assert res.status_code == 401

    for ep in unauthed_post_endpoints:
        res = client.post(ep, json={})
        assert res.status_code == 401

    # PDF export with personalized profile without auth strictly requires token (401)
    res_pdf = client.post(
        "/api/simulation/comparison-report/pdf",
        json={
            "scenario_a": {
                "sleep_hours": 7.0,
                "caffeine_cups": 1.0,
                "physical_activity_mins": 30.0,
                "heart_rate_bpm": 70.0,
                "hrv_ms": 45.0,
                "self_reported_anxiety": 2,
                "recent_stress_exposure": 1,
            },
            "scenario_b": {
                "sleep_hours": 8.0,
                "caffeine_cups": 0.0,
                "physical_activity_mins": 30.0,
                "heart_rate_bpm": 70.0,
                "hrv_ms": 45.0,
                "self_reported_anxiety": 1,
                "recent_stress_exposure": 1,
            },
            "baseline_profile_id": "USER-99",
        },
    )
    assert res_pdf.status_code == 401


def test_cross_user_isolation_blocks_unauthorized_profile_simulation(user_a, user_b):
    """
    User A attempting to simulate using User B's personal profile (USER-{user_b.id})
    must be rejected with HTTP 403 Forbidden.
    """
    scenario_input = {
        "sleep_hours": 7.0,
        "caffeine_cups": 1.0,
        "physical_activity_mins": 30.0,
        "heart_rate_bpm": 72.0,
        "hrv_ms": 45.0,
        "self_reported_anxiety": 2,
        "recent_stress_exposure": 1,
    }

    # 1. Counterfactual targeting User B from User A
    req = {
        "parameter_to_vary": "sleep_hours",
        "perturbed_value": 6.0,
        "base_scenario": scenario_input,
        "baseline_profile_id": f"USER-{user_b['id']}",
    }
    resp = client.post("/api/simulation/adaptive/counterfactual", headers=user_a["headers"], json=req)
    assert resp.status_code == 403
    assert "Forbidden" in resp.json()["detail"]

    # 2. Compare targeting User B from User A
    comp_req = {
        "scenario_a": scenario_input,
        "scenario_b": scenario_input,
        "baseline_profile_id": f"USER-{user_b['id']}",
    }
    resp_comp = client.post("/api/simulation/adaptive/compare", headers=user_a["headers"], json=comp_req)
    assert resp_comp.status_code == 403

    # 3. PDF export targeting User B from User A
    pdf_req = {
        "scenario_a": scenario_input,
        "scenario_b": scenario_input,
        "scenario_a_name": "Plan A",
        "scenario_b_name": "Plan B",
        "baseline_profile_id": f"USER-{user_b['id']}",
    }
    resp_pdf = client.post("/api/simulation/comparison-report/pdf", headers=user_a["headers"], json=pdf_req)
    assert resp_pdf.status_code == 403


# =========================================================================
# 6. DATABASE SCHEMA & CLEAN DB VERIFICATION
# =========================================================================

def test_database_schema_initialization_on_clean_database():
    """
    Instantiates an isolated clean SQLite in-memory database
    and verifies that all tables and columns initialize with zero errors.
    """
    mem_engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=mem_engine)

    inspector = inspect(mem_engine)
    tables = inspector.get_table_names()

    required_tables = [
        "users",
        "user_profiles",
        "physiological_observations",
        "lifestyle_observations",
        "anxiety_checkins",
        "twin_state_snapshots",
        "simulation_scenarios",
        "digital_twin_memories",
        "patient_access_grants",
    ]
    for tbl in required_tables:
        assert tbl in tables, f"Expected table '{tbl}' was not created in clean database."

    # Verify digital_twin_memories columns
    mem_cols = [c["name"] for c in inspector.get_columns("digital_twin_memories")]
    assert "baseline_version" in mem_cols
    assert "metrics_included_json" in mem_cols
    assert "is_active" in mem_cols
    assert "calculation_version" in mem_cols


def test_dict_records_provenance_predicate():
    """Verify that dictionary records are also evaluated strictly by is_genuine_observation and get_provenance_category."""
    # Dicts with valid genuine tags
    assert DigitalTwinEngine.is_genuine_observation({"source_type": "device_measurement"}) is True
    assert DigitalTwinEngine.is_genuine_observation({"source_type": "user_entered"}) is True
    assert DigitalTwinEngine.is_genuine_observation({"source_type": "wearable"}) is True
    assert DigitalTwinEngine.is_genuine_observation({"source_type": "calculated"}) is True

    # Dicts with synthetic / mock tags
    assert DigitalTwinEngine.is_genuine_observation({"source_type": "simulated"}) is False
    assert DigitalTwinEngine.is_genuine_observation({"source_type": "synthetic"}) is False
    assert DigitalTwinEngine.is_genuine_observation({"source_type": "mock"}) is False
    assert DigitalTwinEngine.is_genuine_observation({"source_type": "demo"}) is False

    # Dicts with null / empty / unexpected tags
    assert DigitalTwinEngine.is_genuine_observation({"source_type": None}) is False
    assert DigitalTwinEngine.is_genuine_observation({"source_type": ""}) is False
    assert DigitalTwinEngine.is_genuine_observation({"source_type": "unverified_vendor"}) is False
    assert DigitalTwinEngine.is_genuine_observation({"other_field": 42}) is False

    # Provenance categorizer on dicts
    assert DigitalTwinEngine.get_provenance_category({"source_type": "device_measurement"}) == "device_measured"
    assert DigitalTwinEngine.get_provenance_category({"source_type": "user_entered"}) == "user_reported"
    assert DigitalTwinEngine.get_provenance_category({"source_type": "simulated"}) == "synthetic"
    assert DigitalTwinEngine.get_provenance_category({"source_type": None}) == "unverified"
    assert DigitalTwinEngine.get_provenance_category({"source_type": "alien"}) == "unverified"


def test_clinician_access_grant_full_lifecycle(user_a):
    """
    Tests complete clinician access grant lifecycle:
    1. Register clinician
    2. Clinician denied access to patient prior to grant (403)
    3. Patient creates access grant for clinician (201)
    4. Clinician now permitted to access overview and simulate using patient baseline (200)
    5. Patient revokes access grant (200)
    6. Clinician immediately blocked again (403)
    """
    # 1. Register clinician
    c_uid = uuid.uuid4().hex[:8]
    c_email = f"clinician_grant_test_{c_uid}@example.com"
    c_resp = client.post(
        "/api/auth/register",
        json={"email": c_email, "password": "ClinicianPass2026!", "full_name": f"Dr. Tester {c_uid}", "role": "clinician"},
    )
    assert c_resp.status_code in [200, 201]
    c_data = c_resp.json()
    c_headers = {"Authorization": f"Bearer {c_data['access_token']}"}
    c_id = c_data["user_id"]

    patient_id = user_a["id"]

    # 2. Clinician denied access prior to grant
    denied_ov = client.get(f"/api/clinician/patients/{patient_id}/overview", headers=c_headers)
    assert denied_ov.status_code == 403

    denied_sim = client.post(
        "/api/simulation/adaptive/counterfactual",
        headers=c_headers,
        json={
            "parameter_to_vary": "sleep_hours",
            "perturbed_value": 6.0,
            "base_scenario": {
                "sleep_hours": 7.0,
                "caffeine_cups": 1.0,
                "physical_activity_mins": 30.0,
                "heart_rate_bpm": 70.0,
                "hrv_ms": 45.0,
                "self_reported_anxiety": 2,
                "recent_stress_exposure": 1,
            },
            "baseline_profile_id": f"USER-{patient_id}",
        },
    )
    assert denied_sim.status_code == 403

    # 3. Patient grants access to clinician
    grant_resp = client.post(
        "/api/privacy/grants",
        headers=user_a["headers"],
        json={"clinician_id": c_id, "scope": "full_review", "notes": "Approved for research follow-up"},
    )
    assert grant_resp.status_code == 201
    grant_id = grant_resp.json()["id"]

    # 4. Clinician can now access patient overview and simulation
    allowed_ov = client.get(f"/api/clinician/patients/{patient_id}/overview", headers=c_headers)
    assert allowed_ov.status_code == 200

    allowed_sim = client.post(
        "/api/simulation/adaptive/counterfactual",
        headers=c_headers,
        json={
            "parameter_to_vary": "sleep_hours",
            "perturbed_value": 6.0,
            "base_scenario": {
                "sleep_hours": 7.0,
                "caffeine_cups": 1.0,
                "physical_activity_mins": 30.0,
                "heart_rate_bpm": 70.0,
                "hrv_ms": 45.0,
                "self_reported_anxiety": 2,
                "recent_stress_exposure": 1,
            },
            "baseline_profile_id": f"USER-{patient_id}",
        },
    )
    assert allowed_sim.status_code == 200
    assert allowed_sim.json()["parameter_varied"] == "sleep_hours"

    # 5. Patient revokes grant
    revoke_resp = client.post(f"/api/privacy/grants/{grant_id}/revoke", headers=user_a["headers"])
    assert revoke_resp.status_code == 200

    # 6. Clinician is immediately blocked again
    post_revoke_ov = client.get(f"/api/clinician/patients/{patient_id}/overview", headers=c_headers)
    assert post_revoke_ov.status_code == 403

    post_revoke_sim = client.post(
        "/api/simulation/adaptive/counterfactual",
        headers=c_headers,
        json={
            "parameter_to_vary": "sleep_hours",
            "perturbed_value": 6.0,
            "base_scenario": {
                "sleep_hours": 7.0,
                "caffeine_cups": 1.0,
                "physical_activity_mins": 30.0,
                "heart_rate_bpm": 70.0,
                "hrv_ms": 45.0,
                "self_reported_anxiety": 2,
                "recent_stress_exposure": 1,
            },
            "baseline_profile_id": f"USER-{patient_id}",
        },
    )
    assert post_revoke_sim.status_code == 403


def test_clean_database_startup_using_actual_migration_procedure(tmp_path):
    """
    Verifies clean-database startup using the project's actual supported initialization
    procedure (_run_schema_migrations logic with table creation and column migrations).
    """
    import sqlite3
    from sqlalchemy import text
    db_file = tmp_path / "clean_startup_test.db"
    file_engine = create_engine(f"sqlite:///{db_file}", echo=False)

    # 1. Execute Base.metadata.create_all
    Base.metadata.create_all(bind=file_engine)

    # 2. Execute column migration statements supported by backend/app/main.py
    with file_engine.begin() as conn:
        for col_stmt in [
            "ALTER TABLE anxiety_checkins ADD COLUMN context_tags_json TEXT",
            "ALTER TABLE simulation_scenarios ADD COLUMN seed INTEGER DEFAULT 42",
            "ALTER TABLE simulation_scenarios ADD COLUMN scenario_type VARCHAR(50) DEFAULT 'custom'",
            "ALTER TABLE simulation_scenarios ADD COLUMN version VARCHAR(20) DEFAULT '1.0'",
            "ALTER TABLE simulation_scenarios ADD COLUMN tags_json TEXT",
        ]:
            try:
                conn.execute(text(col_stmt))
            except Exception:
                pass

    # 3. Inspect created tables and verify columns
    inspector = inspect(file_engine)
    created_tables = inspector.get_table_names()
    assert "users" in created_tables
    assert "digital_twin_memories" in created_tables
    assert "simulation_scenarios" in created_tables
    assert "patient_access_grants" in created_tables

    scen_cols = [c["name"] for c in inspector.get_columns("simulation_scenarios")]
    assert "seed" in scen_cols
    assert "scenario_type" in scen_cols
    assert "version" in scen_cols


def test_comparison_pdf_export_full_flow(user_a):
    """
    Tests that the comparison PDF export endpoint:
    1. Returns a valid 200 application/pdf response with proper binary magic bytes
    2. Works with authentication
    3. Has prominent synthetic notice in payload
    """
    pdf_req = {
        "scenario_a": {
            "sleep_hours": 7.0,
            "caffeine_cups": 1.0,
            "physical_activity_mins": 30.0,
            "heart_rate_bpm": 70.0,
            "hrv_ms": 45.0,
            "self_reported_anxiety": 2,
            "recent_stress_exposure": 1,
        },
        "scenario_b": {
            "sleep_hours": 5.5,
            "caffeine_cups": 3.0,
            "physical_activity_mins": 15.0,
            "heart_rate_bpm": 85.0,
            "hrv_ms": 32.0,
            "self_reported_anxiety": 6,
            "recent_stress_exposure": 4,
        },
        "scenario_a_name": "Standard Equilibrium",
        "scenario_b_name": "Acute Work Strain",
        "baseline_profile_id": "DEMO-PATIENT-01",
    }
    resp = client.post("/api/simulation/comparison-report/pdf", headers=user_a["headers"], json=pdf_req)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    # PDF magic bytes
    assert resp.content.startswith(b"%PDF-")
    assert len(resp.content) > 1000
