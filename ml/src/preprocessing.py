"""
AnxietyTwin - Leak-Free Preprocessing Pipeline Module
Provides scikit-learn compatible pipelines ensuring all learned transformations
(imputation, scaling) are strictly fitted on training data and never leak test distributions.
"""

from typing import Optional, Any
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler


def build_preprocessing_pipeline(
    estimator: Any,
    scale: bool = True,
    impute_strategy: str = "median",
) -> Pipeline:
    """
    Builds a leak-free scikit-learn Pipeline containing:
    1. Training-fold SimpleImputer (median strategy by default - handles physiological variables safely)
    2. Optional training-fold StandardScaler (fitted only on training data)
    3. Target Estimator / Classifier

    Guarantees no test-fold distribution information leaks into training.
    """
    steps = [
        ("imputer", SimpleImputer(strategy=impute_strategy)),
    ]
    if scale:
        steps.append(("scaler", StandardScaler()))

    steps.append(("model", estimator))

    return Pipeline(steps)
