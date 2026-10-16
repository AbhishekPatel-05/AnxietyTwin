"""
AnxietyTwin - Model Definition & Training Module
Constructs candidate classifiers with controlled complexity, class weighting,
and wraps them in leak-free preprocessing pipelines.
"""

from typing import Dict, Any, Tuple
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier

from ml.src.preprocessing import build_preprocessing_pipeline


def get_candidate_models(random_state: int = 42) -> Dict[str, Dict[str, Any]]:
    """
    Returns candidate models and their pipeline specifications:
    - Dummy Baselines (majority class and prior prevalence)
    - Logistic Regression with L2 regularization and class weighting
    - Random Forest with controlled depth and balanced weights
    - XGBoost with positive weight balancing and tree regularization
    """
    return {
        "DummyMajority": {
            "constructor": lambda **kw: DummyClassifier(strategy="most_frequent"),
            "scale": False,
            "description": "Baseline predicting constant majority class (SD=0)",
        },
        "DummyPrior": {
            "constructor": lambda **kw: DummyClassifier(strategy="prior"),
            "scale": False,
            "description": "Baseline predicting class distribution prior (6.4% probability)",
        },
        "LogisticRegression": {
            "constructor": lambda **kw: LogisticRegression(
                max_iter=1000,
                class_weight="balanced",
                random_state=random_state,
                C=1.0,
            ),
            "scale": True,
            "description": "L2 Regularized Logistic Regression with standardized features and balanced weights",
        },
        "RandomForest": {
            "constructor": lambda **kw: RandomForestClassifier(
                n_estimators=100,
                max_depth=6,
                min_samples_leaf=4,
                class_weight="balanced",
                random_state=random_state,
                n_jobs=-1,
            ),
            "scale": False,
            "description": "Random Forest with controlled depth=6, min_samples_leaf=4, and balanced weights",
        },
        "XGBoost": {
            "constructor": lambda scale_pos_weight=14.6, **kw: XGBClassifier(
                n_estimators=100,
                max_depth=4,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                scale_pos_weight=scale_pos_weight,
                eval_metric="logloss",
                random_state=random_state,
                n_jobs=-1,
            ),
            "scale": False,
            "description": "Gradient Boosted Decision Trees with scale_pos_weight, subsample 0.8, depth 4",
        },
    }


def create_model_pipeline(
    model_name: str,
    pos_weight: float = 1.0,
    random_state: int = 42,
):
    """Creates a complete scikit-learn Pipeline for a named candidate model."""
    candidates = get_candidate_models(random_state=random_state)
    if model_name not in candidates:
        raise ValueError(f"Unknown model name '{model_name}'. Choose from: {list(candidates.keys())}")

    spec = candidates[model_name]
    estimator = spec["constructor"](scale_pos_weight=pos_weight)
    pipeline = build_preprocessing_pipeline(estimator=estimator, scale=spec["scale"])
    return pipeline
