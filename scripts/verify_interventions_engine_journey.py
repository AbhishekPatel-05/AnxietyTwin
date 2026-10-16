"""
verify_interventions_engine_journey.py - End-to-End Early-Warning & Personalized Intervention Engine Verification
for Happiest Health Digital Twin Challenge 2026.

Verifies the 10-step early-warning and intervention feedback loop:
1. Authenticate patient (Alex Rivera) and fetch personalized baseline comparison matrix.
2. Verify metrics table (HR, HRV, sleep duration, regularity, steps, distress) and trends.
3. Verify early-warning signals with transparent rule triggers and evidence traceability.
4. Verify explainable insight cards with non-causal disclosures and data quality provenance.
5. Verify evidence-based supportive intervention recommendations with non-medical labels.
6. Complete an interactive coping session with pre/post distress feedback loop.
7. Query longitudinal intervention history with filtering and delta tracking.
8. Evaluate synthetic Digital Twin scenario statelessly without genuine history contamination.
9. Clinician Workspace integration: Doctor Sarah Lin inspects patient's coping logs.
10. Security & role guard: Unauthorized patient cannot inspect another user's intervention records.
"""

import os
import sys
import uuid
from typing import Dict, Any

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

class HttpClientWrapper:
    """Wrapper that supports both running against a live server or FastAPI TestClient."""
    def __init__(self):
        self.is_live = False
        try:
            import requests
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

    def get(self, path: str, headers: Dict[str, str] = None, params: Dict[str, Any] = None):
        if self.is_live:
            return self.session.get(f"{self.base_url}{path}", headers=headers, params=params)
        return self.client.get(f"{self.base_url}{path}", headers=headers, params=params)

    def post(self, path: str, headers: Dict[str, str] = None, json: Any = None):
        if self.is_live:
            return self.session.post(f"{self.base_url}{path}", headers=headers, json=json)
        return self.client.post(f"{self.base_url}{path}", headers=headers, json=json)


def run_interventions_engine_journey():
    print("=========================================================================")
    print("ANXIETYTWIN — EARLY-WARNING & INTERVENTION ENGINE END-TO-END VERIFICATION")
    print("=========================================================================")

    client = HttpClientWrapper()

    # STEP 1: Authenticate Patient (Alex Rivera)
    print("\n[Step 1] Authenticating patient (Alex Rivera)...")
    patient_email = "alex.demo.patient@happiesthealth.org"
    patient_pwd = "DemoPatient2026!"
    login_resp = client.post("/auth/login", json={"email": patient_email, "password": patient_pwd})
    assert login_resp.status_code == 200, f"Patient login failed: {login_resp.text}"
    patient_token = login_resp.json()["access_token"]
    patient_headers = {"Authorization": f"Bearer {patient_token}"}
    patient_id = login_resp.json()["user_id"]
    print(f"  -> Patient authenticated: {patient_email} (ID: {patient_id})")

    # STEP 2: Query Baseline Matrix & Early-Warning Status
    print("\n[Step 2] Querying personalized baseline comparison matrix & signal engine...")
    status_resp = client.get("/interventions/status", headers=patient_headers)
    assert status_resp.status_code == 200, f"Status failed: {status_resp.text}"
    status_data = status_resp.json()

    print(f"  -> Baseline Status: {status_data['baseline_status']}")
    print(f"  -> Is Cold Start: {status_data['is_cold_start']}")
    print(f"  -> Total Metrics Analyzed: {len(status_data['metrics'])}")
    assert len(status_data["metrics"]) > 0, "Expected baseline metrics in comparison table"

    # STEP 3: Verify Metrics Table (HR, HRV, Sleep, Steps, Distress)
    print("\n[Step 3] Verifying metric benchmarks against personal baseline...")
    for m in status_data["metrics"]:
        print(f"     - {m['metric_label']}: current={m['current_value']} {m['unit']} (baseline={m['baseline_value']} {m['unit']}, delta={m['delta_value']}, status={m['status']})")
        assert "provenance" in m, f"Provenance missing for {m['metric_name']}"

    # STEP 4: Inspect Early-Warning Signals & Insight Cards
    print("\n[Step 4] Inspecting early-warning signals and explainable insight cards...")
    signals = status_data.get("signals", [])
    print(f"  -> Total Early-Warning Signals Detected: {len(signals)}")
    for sig in signals:
        print(f"     * [{sig['level'].upper()}] {sig['title']}")
        print(f"       Why Flagged: {sig['why_flagged']}")
        print(f"       Provenance: {sig['data_provenance']} | Quality: {sig['data_quality']}")
        print(f"       Limitation: {sig['limitations']}")
        assert sig["level"] in ["Within Personal Range", "Change Detected", "Insufficient Data"]
        assert "experimental" in sig["limitations"].lower() or "not a clinical" in sig["limitations"].lower() or "does not establish" in sig["limitations"].lower()
        assert len(sig["supporting_record_ids"]) > 0, "Signal must have traceable evidence records"

    # STEP 5: Verify Supportive Intervention Recommendations
    print("\n[Step 5] Verifying evidence-based supportive intervention recommendations...")
    recommendations = status_data.get("recommendations", [])
    assert len(recommendations) > 0, "Expected at least one supportive recommendation"
    for rec in recommendations:
        print(f"     + [{rec['priority'].upper()}] {rec['title']} ({rec['intervention_type']})")
        print(f"       Rationale: {rec['rational_summary']}")
        print(f"       Trigger: {rec['trigger_signal_id']}")
        assert rec["is_medical"] is False, "Interventions must not be represented as medical treatment"

    # STEP 6: Execute Interactive Coping Session with Pre/Post Distress Ratings
    print("\n[Step 6] Completing interactive coping session (4-7-8 Breathing Pacer)...")
    session_payload = {
        "intervention_type": "breathing_478",
        "trigger_signal": signals[0]["signal_id"] if signals else "elevated_heart_rate",
        "pre_distress_rating": 7.0,
        "post_distress_rating": 4.0,
        "helpfulness": "helpful",
        "user_notes": "Completed 4 breath cycles after studying for midterm exam. Chest feels lighter.",
        "source_type": "user_entered",
        "context_snapshot": {
            "hr_at_start": 84.0,
            "hrv_at_start": 28.0,
            "environment": "library_desk"
        }
    }
    rec_resp = client.post("/interventions/record", headers=patient_headers, json=session_payload)
    assert rec_resp.status_code == 200, f"Record session failed: {rec_resp.text}"
    rec_data = rec_resp.json()
    print(f"  -> Session ID: {rec_data['id']}")
    print(f"  -> Pre-Rating: {rec_data['pre_distress_rating']} / 10")
    print(f"  -> Post-Rating: {rec_data['post_distress_rating']} / 10")
    print(f"  -> Rating Delta: {rec_data['rating_delta']} (pre -> post reduction)")
    print(f"  -> Helpfulness: {rec_data['helpfulness']}")
    assert rec_data["rating_delta"] == -3, f"Expected delta of -3, got {rec_data['rating_delta']}"
    assert rec_data["status"] == "completed"

    # STEP 7: Query Longitudinal History with Filtering
    print("\n[Step 7] Querying longitudinal intervention feedback history...")
    history_resp = client.get("/interventions/history?period_days=30&hide_simulated=true", headers=patient_headers)
    assert history_resp.status_code == 200, f"History failed: {history_resp.text}"
    history_list = history_resp.json()
    print(f"  -> Total Genuine Interventions in History: {len(history_list)}")
    matching = [h for h in history_list if h["id"] == rec_data["id"]]
    assert len(matching) == 1, "Recorded session must appear in longitudinal history"
    print(f"  -> Verified recorded session {rec_data['id']} in longitudinal timeline.")

    # STEP 8: Stateless Digital Twin Scenario Evaluation
    print("\n[Step 8] Evaluating synthetic scenario statelessly (Scenario Lab Isolation)...")
    scenario_payload = {
        "scenario_name": "acute_panic_surge",
        "synthetic_heart_rate": 105.0,
        "synthetic_hrv": 18.0,
        "synthetic_sleep_hours": 4.5,
        "synthetic_distress_rating": 9
    }
    sim_resp = client.post("/interventions/evaluate-scenario", headers=patient_headers, json=scenario_payload)
    assert sim_resp.status_code == 200, f"Evaluate scenario failed: {sim_resp.text}"
    sim_data = sim_resp.json()
    print(f"  -> Synthetic Scenario Evaluated: {sim_data['scenario_name']}")
    print(f"  -> Synthetic Signals Detected: {len(sim_data['signals'])}")
    for s in sim_data["signals"]:
        print(f"     ~ [SIMULATED] {s['title']} ({s['level']})")
        assert s["data_provenance"] == "simulated", "Synthetic evaluations must flag provenance as simulated"

    # Verify patient's actual history was NOT mutated by scenario evaluation
    history_after = client.get("/interventions/history?hide_simulated=true", headers=patient_headers).json()
    assert len(history_after) == len(history_list), "Simulated scenario must not mutate patient history"
    print("  -> Confirmed: Synthetic evaluation did NOT pollute genuine patient records.")

    # STEP 9: Clinician Workspace Integration
    print("\n[Step 9] Authenticating clinician (Dr. Sarah Lin) & reviewing patient coping log...")
    clinician_login = client.post("/auth/login", json={
        "email": "demo_clinician@happiesthealth.org",
        "password": "ClinicianSecure2026!"
    })
    assert clinician_login.status_code == 200, f"Clinician login failed: {clinician_login.text}"
    clinician_token = clinician_login.json()["access_token"]
    clinician_headers = {"Authorization": f"Bearer {clinician_token}"}

    clin_resp = client.get(f"/clinician/patients/{patient_id}/interventions?period_days=30", headers=clinician_headers)
    assert clin_resp.status_code == 200, f"Clinician get interventions failed: {clin_resp.text}"
    clin_data = clin_resp.json()
    print(f"  -> Clinician retrieved status for patient {patient_id}")
    print(f"  -> Baseline Status: {clin_data['status']['baseline_status']}")
    print(f"  -> Coping Sessions in Patient History: {len(clin_data['history'])}")
    clin_matching = [h for h in clin_data["history"] if h["id"] == rec_data["id"]]
    assert len(clin_matching) == 1, "Clinician must see patient's completed coping session"

    # STEP 10: Role Guard & Privacy Isolation
    print("\n[Step 10] Verifying authorization guards and privacy isolation...")
    # Patient attempting to access clinician endpoint
    unauth_resp = client.get(f"/clinician/patients/{patient_id}/interventions", headers=patient_headers)
    assert unauth_resp.status_code == 403, f"Expected 403 Forbidden for patient accessing clinician API, got {unauth_resp.status_code}"
    print("  -> Confirmed: Role guard strictly rejected non-clinician role with 403 Forbidden.")

    print("\n=========================================================================")
    print("ALL 10 STEPS OF EARLY-WARNING & INTERVENTION ENGINE PASSED SUCCESSFULLY!")
    print("=========================================================================\n")


if __name__ == "__main__":
    run_interventions_engine_journey()
