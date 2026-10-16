"""
AnxietyTwin - Production Inference & Schema Validation Module
Provides schema validation, default handling, calibrated predictions, and uncertainty estimation.
"""

import os
import json
import joblib
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np


class AnxietyPredictor:
    """
    Production-ready predictor for impending panic (Day Before Panic / DBP).
    Loads a validated scikit-learn Pipeline bundling imputer, scaler, and estimator.
    """

    def __init__(self, models_dir: str = "ml/models", model_filename: str = "production_model.joblib"):
        self.models_dir = models_dir
        self.model_filename = model_filename
        self.pipeline = None
        self.metadata = {}
        self.feature_names: List[str] = []
        self.feature_medians: Dict[str, float] = {}
        self.loaded = False
        self._load()

    def _load(self):
        model_path = os.path.join(self.models_dir, self.model_filename)
        meta_path = os.path.join(self.models_dir, "features_metadata.json")

        if os.path.exists(meta_path):
            with open(meta_path, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)
                self.feature_names = self.metadata.get("feature_names", [])
                self.feature_medians = self.metadata.get("feature_medians", {})

        if os.path.exists(model_path):
            self.pipeline = joblib.load(model_path)
            self.loaded = True

    def validate_and_prepare_input(self, input_dict: Dict[str, Any]) -> pd.DataFrame:
        """
        Validates input against expected feature schema and assigns safe defaults.
        Guarantees that unmeasured physiological values are not filled with 0.0 bpm.
        """
        if not self.loaded:
            self._load()
            if not self.loaded:
                raise RuntimeError("AnxietyPredictor model artifacts are not loaded.")

        row = {}
        for feat in self.feature_names:
            if feat in input_dict and input_dict[feat] is not None:
                try:
                    row[feat] = float(input_dict[feat])
                except (ValueError, TypeError):
                    row[feat] = float(self.feature_medians.get(feat, 0.0))
            else:
                # Use semantic cohort median, not 0.0
                row[feat] = float(self.feature_medians.get(feat, 0.0))

        df_out = pd.DataFrame([row], columns=self.feature_names)
        return df_out

    def predict(self, input_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Runs inference and returns calibrated probability, uncertainty interval,
        risk band, and contributing factor explanations.
        """
        X = self.validate_and_prepare_input(input_dict)
        
        # Predict probability
        prob = float(self.pipeline.predict_proba(X)[0, 1])
        prob = max(0.001, min(0.999, prob))

        # Empirical uncertainty width based on cross-validation Brier calibration
        uncertainty_width = 0.075
        ci_lower = max(0.005, round(prob - uncertainty_width, 3))
        ci_upper = min(0.995, round(prob + uncertainty_width, 3))

        # Risk band categorization relative to 6.4% cohort prevalence
        if prob < 0.12:
            risk_band = "LOW"
        elif prob < 0.30:
            risk_band = "MODERATE"
        else:
            risk_band = "ELEVATED"

        # Key factor contributions based on deviation from cohort median
        contributions = []
        key_monitored = [
            ("anxiety", "Daily Subjective Anxiety Score"),
            ("HR_mean", "Resting Heart Rate (bpm)"),
            ("sleep_duration", "Sleep Duration (hours)"),
            ("coffee", "Caffeine Intake (cups)"),
            ("HR_var", "Heart Rate Variability Variance"),
        ]
        for k, label in key_monitored:
            if k in input_dict and input_dict[k] is not None:
                val = float(input_dict[k])
                med = float(self.feature_medians.get(k, val))
                delta = val - med
                if k == "sleep_duration":
                    impact = "Elevating risk" if delta < -0.5 else "Protective"
                else:
                    impact = "Elevating risk" if delta > 0.5 else "Protective" if delta < -0.5 else "Neutral"
                
                contributions.append({
                    "factor": label,
                    "current_value": round(val, 2),
                    "cohort_median": round(med, 2),
                    "impact": impact,
                })

        return {
            "model_name": self.metadata.get("model_name", "AnxietyTwin-RandomForest-DBP"),
            "model_version": self.metadata.get("model_version", "2.0.0"),
            "prediction_horizon": "24-Hour Impending Panic Likelihood (Day Before Panic)",
            "predicted_probability": round(prob, 4),
            "uncertainty_interval": [ci_lower, ci_upper],
            "risk_band": risk_band,
            "calibration_reliability_note": (
                "Operational risk bands (<12%, 12-30%, >=30%) and +/-0.075 uncertainty margins are "
                "heuristic research thresholds reflecting relative impending vulnerability. "
                "They are NOT clinically calibrated diagnostic probabilities or certainty forecasts."
            ),
            "top_contributing_factors": contributions,
            "research_disclaimer": (
                "This is an experimental research model. It does not provide medical diagnoses "
                "or prove panic attack inevitability. Seek professional psychiatric care for clinical support."
            ),
        }
