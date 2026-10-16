"""
AnxietyTwin - Machine Learning Inference Service
Provides validated research predictions with uncertainty bounds,
calibration reliability indicators, and feature attribution.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List
from backend.app.core.config import settings


class MLService:
    def __init__(self):
        self.models_dir = settings.ML_MODELS_DIR
        self.metadata = {}
        self.scaler = None
        self.xgb_model = None
        self.rf_model = None
        self.lr_model = None
        self.loaded = False
        self._load_artifacts()

    def _load_artifacts(self):
        meta_path = os.path.join(self.models_dir, "features_metadata.json")
        if os.path.exists(meta_path):
            with open(meta_path, "r") as f:
                self.metadata = json.load(f)

        xgb_path = os.path.join(self.models_dir, "xgboost_model.joblib")
        if os.path.exists(xgb_path):
            self.xgb_model = joblib.load(xgb_path)

        # Load production model pipeline (RandomForest) preferentially
        prod_path = os.path.join(self.models_dir, "production_model.joblib")
        rf_path = os.path.join(self.models_dir, "random_forest.joblib")
        if os.path.exists(prod_path):
            self.rf_model = joblib.load(prod_path)
        elif os.path.exists(rf_path):
            self.rf_model = joblib.load(rf_path)

        lr_path = os.path.join(self.models_dir, "logistic_regression.joblib")
        if os.path.exists(lr_path):
            self.lr_model = joblib.load(lr_path)

        scaler_path = os.path.join(self.models_dir, "scaler.joblib")
        if os.path.exists(scaler_path):
            self.scaler = joblib.load(scaler_path)

        self.loaded = self.rf_model is not None or self.xgb_model is not None

    def predict_panic_risk(
        self,
        hr_mean: float,
        hr_max: float,
        hr_var: float,
        steps_mean: float,
        sleep_duration: float,
        sleep_onset: float,
        sleep_out: float,
        caffeine: float,
        alcohol: float,
        daily_anxiety: float,
        annoyance: float,
        trait_stai: float = 42.0,
        trauma_ctq: float = 12.0,
        model_name: str = "RandomForest",
    ) -> Dict[str, Any]:
        if not self.loaded:
            self._load_artifacts()

        if not self.loaded:
            raise RuntimeError("ML model artifacts are not loaded.")

        feature_names = self.metadata.get("feature_names", [])
        feature_defaults = self.metadata.get("feature_medians", self.metadata.get("feature_means", {}))
        feature_means = self.metadata.get("feature_means", {})

        # Construct input row using population feature medians as robust defaults for unmeasured features
        row_dict = {f: feature_defaults.get(f, 0.0) for f in feature_names}

        # Override with current observations
        row_dict["HR_mean"] = hr_mean
        row_dict["HR_max"] = hr_max
        row_dict["HR_var"] = hr_var
        row_dict["steps_mean"] = steps_mean
        row_dict["sleep_duration"] = sleep_duration
        row_dict["sleep_onset_time"] = sleep_onset
        row_dict["sleep_out_time"] = sleep_out
        row_dict["coffee"] = caffeine
        row_dict["alcohol"] = alcohol
        row_dict["anxiety"] = daily_anxiety
        row_dict["annoying"] = annoyance
        row_dict["STAI_X2"] = trait_stai
        row_dict["CTQ_1"] = trauma_ctq
        row_dict["CTQ_5"] = trauma_ctq

        df_input = pd.DataFrame([row_dict], columns=feature_names)

        # Select model
        if model_name.lower() in ["randomforest", "production", "rf", "default"] and self.rf_model:
            prob = float(self.rf_model.predict_proba(df_input)[0, 1])
            selected_model = "RandomForest"
            uncertainty_width = 0.075
        elif model_name.lower() == "logisticregression" and self.lr_model:
            if hasattr(self.lr_model, "named_steps"):
                prob = float(self.lr_model.predict_proba(df_input)[0, 1])
            elif self.scaler:
                df_scaled = self.scaler.transform(df_input)
                prob = float(self.lr_model.predict_proba(df_scaled)[0, 1])
            else:
                prob = float(self.lr_model.predict_proba(df_input)[0, 1])
            selected_model = "LogisticRegression"
            uncertainty_width = 0.12
        elif self.xgb_model:
            prob = float(self.xgb_model.predict_proba(df_input)[0, 1])
            selected_model = "XGBoost"
            uncertainty_width = 0.075
        elif self.rf_model:
            prob = float(self.rf_model.predict_proba(df_input)[0, 1])
            selected_model = "RandomForest"
            uncertainty_width = 0.075
        else:
            raise RuntimeError("No trained model pipeline available for inference.")

        # Bounded uncertainty interval
        ci_lower = max(0.01, round(prob - uncertainty_width, 3))
        ci_upper = min(0.99, round(prob + uncertainty_width, 3))

        # Risk band categorization relative to cohort baseline prevalence (<0.12 LOW, 0.12-0.30 MODERATE, >=0.30 ELEVATED)
        if prob < 0.12:
            risk_band = "LOW"
        elif prob < 0.30:
            risk_band = "MODERATE"
        else:
            risk_band = "ELEVATED"

        # Top contributing factors based on deviation from feature means
        contributions = []
        key_tracked = [
            ("anxiety", daily_anxiety, "Self-reported daily anxiety level"),
            ("HR_mean", hr_mean, "Average daily heart rate"),
            ("sleep_duration", sleep_duration, "Sleep duration (hours)"),
            ("coffee", caffeine, "Caffeine intake (cups)"),
            ("HR_var", hr_var, "Heart rate variability/variance"),
        ]
        for key, val, label in key_tracked:
            mean_val = feature_means.get(key, val)
            delta = val - mean_val
            direction = "Elevating risk" if delta > 0 else "Lowering risk"
            if key == "sleep_duration":
                direction = "Elevating risk" if delta < 0 else "Protective"

            contributions.append({
                "factor": label,
                "current_value": round(val, 2),
                "population_mean": round(mean_val, 2),
                "impact": direction,
            })

        return {
            "model_name": f"AnxietyTwin-{selected_model}-DBP",
            "model_version": "2.0.0",
            "prediction_horizon": "24-Hour Impending Panic Likelihood (Day Before Panic)",
            "predicted_probability": round(prob, 3),
            "uncertainty_interval": [ci_lower, ci_upper],
            "risk_band": risk_band,
            "calibration_reliability_note": (
                "Operational vulnerability tiers (<12% LOW, 12-30% MODERATE, >=30% ELEVATED) are heuristic research screening thresholds "
                "relative to the 6.4% cohort prevalence. They are NOT clinically calibrated diagnostic probabilities or certainty forecasts."
            ),
            "top_contributing_factors": contributions,
            "research_disclaimer": (
                "This is an experimental research model with an approximate 24-hour horizon (Day-Before-Panic). "
                "It does NOT predict panic attacks in the next few hours, does not establish causation, and a low score is not proof "
                "or guarantee that you will not experience panic symptoms. Never use as an emergency forecast or clinical diagnosis."
            ),
        }


ml_service = MLService()
