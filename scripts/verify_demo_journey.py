import os
import sys
import requests

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

BASE_URL = "http://127.0.0.1:8000/api"

class HttpClientWrapper:
    """Wrapper that supports both running against a live server or FastAPI TestClient."""
    def __init__(self):
        self.is_live = False
        try:
            r = requests.get("http://127.0.0.1:8000/api/health", timeout=1.0)
            if r.status_code == 200:
                self.is_live = True
                self.session = requests.Session()
                self.base_url = "http://127.0.0.1:8000/api"
                print("  -> Connected to active live backend server at http://127.0.0.1:8000")
        except Exception:
            pass

        if not self.is_live:
            from fastapi.testclient import TestClient
            from backend.app.main import app
            self.client = TestClient(app)
            self.base_url = "/api"
            print("  -> Connected via FastAPI TestClient (in-process ASGI)")

    def _url(self, url: str) -> str:
        if url.startswith("http://127.0.0.1:8000/api"):
            url = url.replace("http://127.0.0.1:8000/api", "")
        if self.is_live:
            return f"{self.base_url}{url}"
        return f"{self.base_url}{url}"

    def get(self, url, **kwargs):
        if self.is_live:
            return self.session.get(self._url(url), **kwargs)
        return self.client.get(self._url(url), **kwargs)

    def post(self, url, **kwargs):
        if self.is_live:
            return self.session.post(self._url(url), **kwargs)
        return self.client.post(self._url(url), **kwargs)

    def put(self, url, **kwargs):
        if self.is_live:
            return self.session.put(self._url(url), **kwargs)
        return self.client.put(self._url(url), **kwargs)

    def delete(self, url, **kwargs):
        if self.is_live:
            return self.session.delete(self._url(url), **kwargs)
        return self.client.delete(self._url(url), **kwargs)


def run_verification():
    print("=================================================================")
    print("ANXIETYTWIN PHASE 4.6 DEMONSTRATION JOURNEY VERIFICATION")
    print("=================================================================")

    session = HttpClientWrapper()

    # Step 1: Health check
    print("\n[Step 1] Checking backend health and diagnostics...")
    r = session.get(f"{BASE_URL}/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    health_data = r.json()
    print(f"  -> Health: {health_data['status']}, Database: {health_data['components']['database']}, ML: {health_data['components']['ml_inference']}")

    # Step 2: Register User 1
    print("\n[Step 2] Registering User 1 (Judge Tester)...")
    email_1 = "demo_judge@happiesthealth.org"
    password = "SecureJudge123!"
    r = session.post(f"{BASE_URL}/auth/register", json={
        "email": email_1,
        "password": password,
        "full_name": "Judge Tester"
    })
    if r.status_code == 400 and "already exists" in r.text:
        print("  -> User already registered, proceeding to login.")
    else:
        assert r.status_code == 201, f"Registration failed: {r.text}"
        print("  -> User 1 registered successfully.")

    # Step 3: Login & Complete Onboarding
    print("\n[Step 3] Logging in User 1 and completing onboarding...")
    r = session.post(f"{BASE_URL}/auth/login", json={"email": email_1, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
    token_1 = r.json()["access_token"]
    headers_1 = {"Authorization": f"Bearer {token_1}"}

    r = session.post(f"{BASE_URL}/auth/onboarding", headers=headers_1, json={
        "age": 28,
        "biological_sex": "F",
        "baseline_resting_hr": 70.0,
        "baseline_sleep_hours": 7.5,
        "baseline_caffeine_cups": 1.0,
        "has_panic_history": True,
        "trait_anxiety_score": 42.0,
        "consents": ["health_data_processing", "simulation_research"]
    })
    assert r.status_code == 200, f"Onboarding failed: {r.text}"
    print(f"  -> Onboarding completed: age={r.json()['age']}, baseline_hr={r.json()['baseline_resting_hr']}")

    # Step 4: Verify onboarding persistence on reload
    print("\n[Step 4] Verifying onboarding state persistence...")
    r = session.get(f"{BASE_URL}/auth/profile", headers=headers_1)
    assert r.status_code == 200
    assert r.json()["onboarding_completed"] is True
    print("  -> Profile persisted: onboarding_completed=True")

    # Step 5: Submit check-in with acute rating and inspect crisis resources
    print("\n[Step 5] Submitting acute check-in (score=8/10) with physiological/lifestyle data...")
    r = session.post(f"{BASE_URL}/checkins", headers=headers_1, json={
        "subjective_anxiety_score": 8,
        "energy_level": 2,
        "triggers_noted": "High-stakes presentation demo",
        "somatic_symptoms": ["tightness", "palpitations"],
        "sleep_hours": 6.5,
        "caffeine_cups": 2.0,
        "heart_rate_bpm": 78.0,
        "heart_rate_variability_ms": 38.0
    })
    assert r.status_code == 201, f"Checkin failed: {r.text}"
    checkin_data = r.json()
    checkin_id = checkin_data["checkin"]["id"]
    guidance = checkin_data.get("safety_guidance")
    assert guidance is not None, "Acute safety guidance was not attached"
    contacts = guidance["crisis_contacts"]
    print(f"  -> Checkin #{checkin_id} saved. Crisis contacts returned: {len(contacts)} items")
    for k, v in contacts.items():
        print(f"     - [{k}] {v}")

    # Step 6: Verify Dashboard twin state and cold-start baseline
    print("\n[Step 6] Verifying Digital Twin State and empirical vs cold-start baseline...")
    r_state = session.get(f"{BASE_URL}/twin/state", headers=headers_1)
    assert r_state.status_code == 200
    twin = r_state.json()
    print(f"  -> Twin State: {twin['state_label']}, CSI: {twin['composite_stress_index']}, Arousal: {twin['physiological_arousal_score']}")

    r_base = session.get(f"{BASE_URL}/twin/baseline", headers=headers_1)
    assert r_base.status_code == 200
    base = r_base.json()
    print(f"  -> Baseline Summary: total_obs={base['total_observations_count']}, unique_days={base['unique_days_count']}")
    print(f"     Descriptive ready: {base['descriptive_baseline_ready']}, ML personalized ready: {base['personalized_prediction_ready']}")

    # Step 7: Observation History & Edit Record
    print("\n[Step 7] Inspecting history and editing observation...")
    r_hist = session.get(f"{BASE_URL}/observations/history", headers=headers_1)
    assert r_hist.status_code == 200
    hist = r_hist.json()
    assert len(hist["checkins"]) > 0
    target_checkin = hist["checkins"][0]
    c_id = target_checkin["id"]

    # Edit check-in notes/score
    r_edit = session.put(f"{BASE_URL}/checkins/{c_id}", headers=headers_1, json={
        "subjective_anxiety_score": 6,
        "triggers_noted": "Updated: Moderate stress after debrief"
    })
    assert r_edit.status_code == 200, f"Edit check-in failed: {r_edit.text}"
    print(f"  -> Check-in #{c_id} edited: new score={r_edit.json()['subjective_anxiety_score']}")

    # Step 8: Delete an observation record and a check-in record
    print("\n[Step 8] Deleting an observation and check-in to verify lifecycle removal...")
    # Add temporary physiological record to delete
    temp_physio = session.post(f"{BASE_URL}/observations/physiological", headers=headers_1, json={
        "heart_rate_bpm": 88.0,
        "heart_rate_variability_ms": 32.0
    }).json()
    p_id = temp_physio["id"]
    print(f"  -> Created temporary physiological observation #{p_id}")

    # Delete physiological record
    del_r = session.delete(f"{BASE_URL}/observations/physiological/{p_id}", headers=headers_1)
    assert del_r.status_code == 204, f"Delete failed: {del_r.status_code}"

    # Confirm it is gone
    hist_after = session.get(f"{BASE_URL}/observations/history", headers=headers_1).json()
    physio_ids = [p["id"] for p in hist_after["physiological"]]
    assert p_id not in physio_ids, "Deleted observation still found in history"
    print(f"  -> Observation #{p_id} successfully deleted from database.")

    # Create temporary check-in to delete
    temp_checkin = session.post(f"{BASE_URL}/checkins", headers=headers_1, json={
        "subjective_anxiety_score": 4,
        "triggers_noted": "Temporary check-in to test deletion lifecycle"
    }).json()["checkin"]
    temp_c_id = temp_checkin["id"]
    del_c_res = session.delete(f"{BASE_URL}/checkins/{temp_c_id}", headers=headers_1)
    assert del_c_res.status_code == 204, f"Checkin delete failed: {del_c_res.status_code}"
    
    # Confirm checkin is gone
    hist_after_c = session.get(f"{BASE_URL}/observations/history", headers=headers_1).json()
    c_ids = [c["id"] for c in hist_after_c["checkins"]]
    assert temp_c_id not in c_ids, "Deleted checkin still found in history"
    print(f"  -> Check-in #{temp_c_id} successfully deleted from database.")

    # Step 9: Simulation Lab Run & Counterfactual Inference
    print("\n[Step 9] Running counterfactual simulation in Simulation Lab...")
    r_sim = session.post(f"{BASE_URL}/simulation/run", headers=headers_1, json={
        "scenario_name": "Hypothetical Sleep Deprivation",
        "sleep_hours": 4.5,
        "caffeine_cups": 4.0,
        "heart_rate_bpm": 82.0,
        "physical_activity_mins": 15.0,
        "self_reported_anxiety": 7
    })
    assert r_sim.status_code == 200, f"Simulation failed: {r_sim.text}"
    sim_out = r_sim.json()
    print(f"  -> Simulation Output: State={sim_out['twin_state']['state_label']}, CSI={sim_out['twin_state']['composite_stress_index']}")
    print(f"  -> Imputed feature disclosure count: {len(sim_out['imputed_features_disclosure'])} items")

    # Step 10: Scenario Comparison
    print("\n[Step 10] Performing Scenario Comparison...")
    r_comp = session.post(f"{BASE_URL}/simulation/compare", json={
        "scenario_a": {"sleep_duration": 8.0, "caffeine_intake": 1.0, "physical_activity_mins": 60.0},
        "scenario_b": {"sleep_duration": 4.5, "caffeine_intake": 4.0, "physical_activity_mins": 15.0}
    })
    assert r_comp.status_code == 200, f"Comparison failed: {r_comp.text}"
    comp_data = r_comp.json()
    print(f"  -> Scenario A State: {comp_data['scenario_a_result']['state_label']}")
    print(f"  -> Scenario B State: {comp_data['scenario_b_result']['state_label']}")
    print(f"  -> Delta predicted probability: {comp_data['delta_predicted_probability']}")
    print(f"  -> Non-causal disclaimer: {comp_data['non_causal_disclaimer'][:90]}...")

    # Step 11: Confirm reset scenario does not mutate actual baseline
    print("\n[Step 11] Confirming hypothetical scenario never modified user's persisted observations...")
    base_after_sim = session.get(f"{BASE_URL}/twin/baseline", headers=headers_1).json()
    assert base_after_sim["total_observations_count"] == base["total_observations_count"]
    print("  -> User's saved observations count is completely unchanged by simulation runs.")

    # Step 12: Logout and protected route security check
    print("\n[Step 12] Testing unauthenticated access rejection (Logout security)...")
    r_unauth = session.get(f"{BASE_URL}/auth/me")
    assert r_unauth.status_code == 401, "Protected endpoint allowed access without token!"
    print("  -> Unauthenticated request correctly rejected with HTTP 401 Unauthorized.")

    # Step 13: Second User Isolation Test
    print("\n[Step 13] Registering User 2 (Bob Isolation Test)...")
    email_2 = "judge_two@happiesthealth.org"
    session.post(f"{BASE_URL}/auth/register", json={"email": email_2, "password": password, "full_name": "Judge Two"})
    login_2 = session.post(f"{BASE_URL}/auth/login", json={"email": email_2, "password": password}).json()
    headers_2 = {"Authorization": f"Bearer {login_2['access_token']}"}

    hist_2 = session.get(f"{BASE_URL}/observations/history", headers=headers_2).json()
    assert len(hist_2["checkins"]) == 0, f"User 2 saw User 1's checkins: {hist_2['checkins']}"
    assert len(hist_2["physiological"]) == 0, "User 2 saw User 1's physiological data"
    print("  -> Strict Multi-Tenant Data Isolation Verified: User 2 sees 0 records from User 1.")

    # Step 14: Account Deletion (GDPR Right to Erasure)
    print("\n[Step 14] Testing complete account deletion and data erasure...")
    email_del = "judge_delete_test@happiesthealth.org"
    session.post(f"{BASE_URL}/auth/register", json={"email": email_del, "password": password, "full_name": "Erasure Test"})
    login_del = session.post(f"{BASE_URL}/auth/login", json={"email": email_del, "password": password}).json()
    headers_del = {"Authorization": f"Bearer {login_del['access_token']}"}

    # Add a checkin for erasure test user
    session.post(f"{BASE_URL}/checkins", headers=headers_del, json={"subjective_anxiety_score": 5})

    # Delete the account
    del_acc_res = session.delete(f"{BASE_URL}/auth/me", headers=headers_del)
    assert del_acc_res.status_code == 204, f"Account deletion failed: {del_acc_res.status_code}"

    # Verify subsequent requests are rejected
    del_verify_res = session.get(f"{BASE_URL}/auth/me", headers=headers_del)
    assert del_verify_res.status_code == 401, "Deleted user could still access /auth/me!"
    print("  -> Account deletion successfully executed with HTTP 204 and immediate token revocation.")

    print("\n=================================================================")
    print("ALL 14 DEMONSTRATION STEPS VERIFIED SUCCESSFULLY (PASS)")
    print("=================================================================")

if __name__ == "__main__":
    run_verification()
