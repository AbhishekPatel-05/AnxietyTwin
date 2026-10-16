"""
AnxietyTwin - Machine Learning Automated Test Suite
Tests target label construction, participant isolation, temporal leakage safeguards,
preprocessing fit containment, model serialization, and inference validation.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
import pytest
from sklearn.model_selection import GroupKFold

from ml.src.data_loading import load_dataset, load_processed_panic_table
from ml.src.target_construction import verify_target_semantics
from ml.src.feature_engineering import (
    extract_strict_prediction_features,
    compute_personalized_longitudinal_features,
    DYNAMIC_FEATURE_COLUMNS,
)
from ml.src.training import create_model_pipeline
from ml.src.inference import AnxietyPredictor


def test_target_label_construction_and_verification():
    """Verify target label is binary, represents DBP, and DP days are excluded."""
    df = load_dataset()
    panic_proc = load_processed_panic_table()
    audit = verify_target_semantics(df, panic_proc=panic_proc)

    assert audit["is_binary"] is True
    assert set(audit["unique_target_values"]).issubset({0, 1})
    assert audit["positive_count_dbp"] == 254
    assert audit["negative_count_sd"] == 3715
    assert audit["day_of_panic_excluded"] is True
    assert audit["dp_contamination_count"] == 0
    assert 0.06 < audit["prevalence"] < 0.07


def test_participant_aware_group_splitting_isolation():
    """Verify strict participant isolation across GroupKFold splits (0 shared IDs)."""
    df = load_dataset()
    X, y, groups, features = extract_strict_prediction_features(df)
    
    gkf = GroupKFold(n_splits=5)
    for fold_idx, (train_idx, test_idx) in enumerate(gkf.split(X, y, groups=groups)):
        train_pids = set(groups.iloc[train_idx].unique())
        test_pids = set(groups.iloc[test_idx].unique())
        # Zero participant leakage allowed
        overlap = train_pids.intersection(test_pids)
        assert len(overlap) == 0, f"Fold {fold_idx} leaked participants: {overlap}"
        # Test fold must have positive cases
        val_pos = int((y.iloc[test_idx] == 1).sum())
        assert val_pos > 0, f"Fold {fold_idx} has 0 positive labels"


def test_temporal_leakage_safeguards_in_personalization():
    """Verify within-subject deviations are strictly causal (zero lookahead into future)."""
    df = load_dataset()
    df_pers, pers_cols = compute_personalized_longitudinal_features(df, min_history_days=7)

    # For any participant, days with hist_days_count < 7 must have deviation == 0.0
    early_days = df_pers[df_pers["hist_days_count"] < 7]
    assert (early_days["hr_mean_dev"] == 0.0).all()
    assert (early_days["sleep_duration_dev"] == 0.0).all()
    assert (early_days["anxiety_dev"] == 0.0).all()
    assert (early_days["prior_panic_rate"] == 0.0).all()

    # For days >= 7, deviations must be finite
    later_days = df_pers[df_pers["hist_days_count"] >= 7]
    assert np.isfinite(later_days["hr_mean_dev"].values).all()
    assert np.isfinite(later_days["sleep_duration_dev"].values).all()


def test_preprocessing_pipeline_training_only_fit():
    """Verify imputer and scaler are fitted strictly on training partition."""
    X_train = pd.DataFrame({
        "feat1": [10.0, 20.0, np.nan],
        "feat2": [100.0, 200.0, 300.0],
    })
    y_train = np.array([0, 1, 0])

    X_test = pd.DataFrame({
        "feat1": [np.nan, 50.0],
        "feat2": [400.0, 500.0],
    })

    pipe = create_model_pipeline("LogisticRegression", pos_weight=1.0)
    pipe.fit(X_train, y_train)

    # Imputer median for feat1 from X_train is 15.0
    imputer = pipe.named_steps["imputer"]
    assert imputer.statistics_[0] == 15.0
    # Test data should not change the fitted statistic
    test_transformed = imputer.transform(X_test)
    assert test_transformed[0, 0] == 15.0


def test_missing_and_malformed_data_handling():
    """Verify inference pipeline handles missing inputs gracefully using cohort medians."""
    predictor = AnxietyPredictor(models_dir="ml/models", model_filename="production_model.joblib")
    assert predictor.loaded is True

    # Pass sparse/empty dictionary
    sparse_input = {"anxiety": 5.0}
    df_prepared = predictor.validate_and_prepare_input(sparse_input)
    
    assert df_prepared.shape == (1, len(predictor.feature_names))
    # Unmeasured heart rate should receive cohort median (~79-80 bpm), NOT 0.0
    assert df_prepared["HR_mean"].iloc[0] > 60.0
    assert df_prepared["anxiety"].iloc[0] == 5.0

    # Ensure prediction succeeds and is finite
    res = predictor.predict(sparse_input)
    assert 0.0 <= res["predicted_probability"] <= 1.0
    assert res["risk_band"] in ["LOW", "MODERATE", "ELEVATED"]


def test_model_serialization_and_prediction_validity():
    """Verify saved model artifacts load cleanly and produce valid probability distributions."""
    models_to_test = ["production_model.joblib", "random_forest.joblib", "xgboost_model.joblib", "logistic_regression.joblib"]
    for m_file in models_to_test:
        path = os.path.join("ml/models", m_file)
        assert os.path.exists(path), f"Artifact missing: {path}"
        pipe = joblib.load(path)

        dummy_input = pd.DataFrame([
            {col: 1.0 for col in DYNAMIC_FEATURE_COLUMNS}
        ])
        probs = pipe.predict_proba(dummy_input)
        assert probs.shape == (1, 2)
        assert np.isclose(probs.sum(), 1.0, atol=1e-5)
        assert 0.0 <= probs[0, 1] <= 1.0


def test_feature_ordering_consistency():
    """Verify predictor maintains consistent feature ordering regardless of input dictionary order."""
    predictor = AnxietyPredictor(models_dir="ml/models", model_filename="production_model.joblib")
    
    dict_order_1 = {"anxiety": 3.0, "HR_mean": 75.0, "sleep_duration": 8.0}
    dict_order_2 = {"sleep_duration": 8.0, "anxiety": 3.0, "HR_mean": 75.0}

    df1 = predictor.validate_and_prepare_input(dict_order_1)
    df2 = predictor.validate_and_prepare_input(dict_order_2)

    pd.testing.assert_frame_equal(df1, df2)
    assert list(df1.columns) == predictor.feature_names


def test_production_artifact_inference_service_consistency():
    """
    Verifies that the actual production artifact (production_model.joblib) loads,
    verifies exact 35-feature schema ordering and input shape (1, 35),
    verifies finite calibrated probability outputs,
    and confirms 100% mathematical consistency with backend ml_service.
    """
    from backend.app.services.ml_service import ml_service

    prod_path = os.path.join("ml/models", "production_model.joblib")
    meta_path = os.path.join("ml/models", "features_metadata.json")
    assert os.path.exists(prod_path), f"Production artifact missing at {prod_path}"
    assert os.path.exists(meta_path), f"Metadata missing at {meta_path}"

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    expected_features = meta["feature_names"]
    assert len(expected_features) == 35, f"Expected 35 features, got {len(expected_features)}"
    assert meta["model_version"] == "2.0.0"

    # Load actual production model pipeline
    prod_pipe = joblib.load(prod_path)
    assert hasattr(prod_pipe, "predict_proba")
    assert "imputer" in prod_pipe.named_steps
    assert "model" in prod_pipe.named_steps

    # Instantiate predictor and verify schema
    predictor = AnxietyPredictor(models_dir="ml/models", model_filename="production_model.joblib")
    assert predictor.feature_names == expected_features

    # Construct valid inference input with typical wearable observations
    input_data = {
        "HR_mean": 78.5,
        "HR_max": 112.0,
        "HR_var": 110.0,
        "steps_mean": 42.0,
        "sleep_duration": 6.8,
        "sleep_onset_time": 0.5,
        "sleep_out_time": -7.0,
        "coffee": 2.0,
        "alcohol": 0.0,
        "anxiety": 4.0,
        "annoying": 2.0,
    }

    # Verify input DataFrame constructed by AnxietyPredictor
    df_prepared = predictor.validate_and_prepare_input(input_data)
    assert df_prepared.shape == (1, 35)
    assert list(df_prepared.columns) == expected_features

    # Run direct pipeline inference
    raw_probs = prod_pipe.predict_proba(df_prepared)
    assert raw_probs.shape == (1, 2)
    assert np.all(np.isfinite(raw_probs))
    assert 0.0 <= raw_probs[0, 1] <= 1.0

    # Run AnxietyPredictor inference
    res_pred = predictor.predict(input_data)
    assert np.isfinite(res_pred["predicted_probability"])
    assert 0.0 <= res_pred["predicted_probability"] <= 1.0
    assert res_pred["risk_band"] in ["LOW", "MODERATE", "ELEVATED"]

    # Run backend ml_service inference with identical physiological inputs
    res_service = ml_service.predict_panic_risk(
        hr_mean=78.5,
        hr_max=112.0,
        hr_var=110.0,
        steps_mean=42.0,
        sleep_duration=6.8,
        sleep_onset=0.5,
        sleep_out=-7.0,
        caffeine=2.0,
        alcohol=0.0,
        daily_anxiety=4.0,
        annoyance=2.0,
        model_name="RandomForest",
    )
    assert np.isfinite(res_service["predicted_probability"])
    assert 0.0 <= res_service["predicted_probability"] <= 1.0

    # Check consistency between predictor and backend service
    assert np.isclose(
        res_pred["predicted_probability"],
        res_service["predicted_probability"],
        atol=1e-3,
    )
    assert res_pred["risk_band"] == res_service["risk_band"]
    assert res_pred["uncertainty_interval"] == res_service["uncertainty_interval"]
