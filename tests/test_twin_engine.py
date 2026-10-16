from types import SimpleNamespace
from backend.app.services.twin_engine import DigitalTwinEngine


def test_baseline_calculation_with_sparse_data():
    profile = SimpleNamespace(
        baseline_resting_hr=70.0,
        baseline_hrv_ms=50.0,
        baseline_sleep_hours=8.0,
        baseline_caffeine_cups=1.0,
    )
    baseline = DigitalTwinEngine.calculate_personal_baseline(
        profile=profile,
        historical_physio=[],
        historical_lifestyle=[],
        historical_checkins=[],
    )
    assert baseline["has_sufficient_data"] is False
    assert baseline["mean_resting_hr"] == 70.0
    assert baseline["mean_hrv_ms"] == 50.0
    assert baseline["mean_sleep_hours"] == 8.0


def test_baseline_calculation_with_rich_observations():
    profile = SimpleNamespace(
        baseline_resting_hr=72.0,
        baseline_hrv_ms=45.0,
        baseline_sleep_hours=7.5,
        baseline_caffeine_cups=1.0,
    )
    physios = [
        SimpleNamespace(heart_rate_bpm=65.0, heart_rate_variability_ms=55.0),
        SimpleNamespace(heart_rate_bpm=68.0, heart_rate_variability_ms=52.0),
        SimpleNamespace(heart_rate_bpm=66.0, heart_rate_variability_ms=56.0),
        SimpleNamespace(heart_rate_bpm=67.0, heart_rate_variability_ms=54.0),
        SimpleNamespace(heart_rate_bpm=69.0, heart_rate_variability_ms=53.0),
    ]
    lifestyles = [
        SimpleNamespace(sleep_hours=7.0, caffeine_cups=2.0),
        SimpleNamespace(sleep_hours=8.0, caffeine_cups=1.0),
        SimpleNamespace(sleep_hours=7.5, caffeine_cups=1.5),
        SimpleNamespace(sleep_hours=7.2, caffeine_cups=2.0),
        SimpleNamespace(sleep_hours=7.8, caffeine_cups=1.0),
    ]
    checkins = [
        SimpleNamespace(subjective_anxiety_score=2),
        SimpleNamespace(subjective_anxiety_score=3),
        SimpleNamespace(subjective_anxiety_score=2),
    ]
    baseline = DigitalTwinEngine.calculate_personal_baseline(
        profile=profile,
        historical_physio=physios,
        historical_lifestyle=lifestyles,
        historical_checkins=checkins,
    )
    assert baseline["has_sufficient_data"] is True
    assert 66.0 <= baseline["mean_resting_hr"] <= 68.0
    assert 53.0 <= baseline["mean_hrv_ms"] <= 55.0
    assert 7.2 <= baseline["mean_sleep_hours"] <= 7.6


def test_twin_state_computation_stable_vs_acute():
    baseline = {
        "mean_resting_hr": 70.0,
        "std_resting_hr": 7.0,
        "mean_hrv_ms": 50.0,
        "std_hrv_ms": 10.0,
        "mean_sleep_hours": 8.0,
        "mean_caffeine_cups": 1.0,
        "mean_anxiety_score": 2.0,
    }

    # Stable state
    stable_state = DigitalTwinEngine.compute_twin_state(
        baseline=baseline,
        current_hr=70.0,
        current_hrv=50.0,
        current_sleep_hours=8.0,
        current_caffeine_cups=1.0,
        current_anxiety_score=1,
    )
    assert stable_state["state_label"] == "STABLE_BASELINE"
    assert stable_state["composite_stress_index"] < 35.0

    # Acute high strain state
    acute_state = DigitalTwinEngine.compute_twin_state(
        baseline=baseline,
        current_hr=105.0,
        current_hrv=22.0,
        current_sleep_hours=4.0,
        current_caffeine_cups=4.5,
        current_anxiety_score=9,
        somatic_symptoms=["palpitations", "tightness", "trembling"],
    )
    assert acute_state["state_label"] == "HIGH_VULNERABILITY"
    assert acute_state["composite_stress_index"] > 65.0
    assert acute_state["physiological_arousal_score"] > 60.0
    assert acute_state["circadian_disruption_index"] > 50.0
