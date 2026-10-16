# AnxietyTwin Machine Learning Pipeline (v2.0.0)

## Overview
This directory contains the modular training pipelines, serialized production artifacts, and rigorous statistical validation reports for impending panic prediction (Day Before Panic / DBP) on prospective digital phenotyping data ([Jang et al., *Scientific Data / Nature*, 2024](https://doi.org/10.1038/s41597-024-04147-6)).

---

## Directory Structure
```
ml/
├── scripts/
│   ├── inspect_dataset.py     # Audit script for dataset, target, fingerprints, and missingness
│   ├── train_pipeline.py      # End-to-end reproducible training & cross-validation pipeline
│   └── evaluate_models.py     # Independent evaluation script for serialized artifacts
├── src/
│   ├── __init__.py
│   ├── data_loading.py        # Dataset loading and schema validation
│   ├── target_construction.py # Target label verification and Day of Panic exclusion checks
│   ├── feature_engineering.py # Modality partitioning (Research, Strict Dynamic, Personalized)
│   ├── preprocessing.py       # Training-only SimpleImputer & StandardScaler Pipelines
│   ├── training.py            # Estimators (Dummy baselines, LR, RF, XGBoost) with class weighting
│   ├── validation.py          # Cross-validation runners (Random, GroupKFold, Longitudinal)
│   ├── evaluation.py          # Metric suite, threshold selection, confusion matrices, Brier scores
│   └── inference.py           # Production inference engine with schema validation and defaults
├── models/
│   ├── production_model.joblib # Production pipeline (Imputer + Scaler + RandomForest)
│   ├── random_forest.joblib    # Validated dynamic Random Forest pipeline
│   ├── xgboost_model.joblib    # Validated dynamic XGBoost pipeline
│   ├── logistic_regression.joblib # Validated dynamic Logistic Regression pipeline
│   ├── scaler.joblib           # Fitted StandardScaler (backwards compatibility)
│   └── features_metadata.json  # Feature definitions, cohort medians, and model metadata
└── reports/
    ├── audit_report.md         # Baseline dataset and target audit report
    ├── leakage_investigation_report.md # Comprehensive analysis of leakage mechanisms
    ├── research_ml_report.md   # Detailed multi-regime scientific report
    ├── dataset_audit.json      # Structured audit findings
    ├── experiment_results.json # Full cross-validation results across all models and folds
    ├── held_out_predictions.csv # Serialized held-out predictions matrix
    ├── ml_model_comparison_report.md # Multi-model comparative report
    └── shap_summary.json       # Dynamic feature SHAP explainability rankings
```

---

## Key Experimental Results Summary

### 1. Benchmark Random 5-Fold CV (Paper Setup Replication)
- **Random Forest**: ROC-AUC = 0.9054 ± 0.0131 | PR-AUC = 0.5930 | Brier = 0.0721
- **XGBoost**: ROC-AUC = 0.9037 ± 0.0127 | PR-AUC = 0.5894 | Brier = 0.0721
- **Logistic Regression**: ROC-AUC = 0.8864 ± 0.0084 | PR-AUC = 0.5435 | Brier = 0.1186

### 2. Participant-Aware GroupKFold CV (Unseen Participants)
- **Research Features (66 feats, with static trait fingerprint)**:
  - Random Forest: ROC-AUC = 0.5824 ± 0.1512 | PR-AUC = 0.0936
  - XGBoost: ROC-AUC = 0.5602 ± 0.1581 | PR-AUC = 0.0932
- **Strict Dynamic Features (35 feats, leak-free pipeline)**:
  - **Random Forest**: **ROC-AUC = 0.7284 ± 0.1024** | **PR-AUC = 0.1827 ± 0.0984** | **Brier = 0.0932**
  - **Logistic Regression**: **ROC-AUC = 0.7203 ± 0.1005** | **PR-AUC = 0.1770 ± 0.1404** | **Brier = 0.1614**

### 3. Longitudinal Personalization Evaluation (Strict Causal Split)
- **Random Forest (Population Dynamic)**: ROC-AUC = 0.8272 | PR-AUC = 0.3462
- **Random Forest (Personalized Deviations)**: **ROC-AUC = 0.8504** | **PR-AUC = 0.4574** | **Brier = 0.0477**
- **XGBoost (Personalized Deviations)**: **ROC-AUC = 0.8436** | **PR-AUC = 0.4881** | **Brier = 0.0396**

---

## How to Reproduce

1. **Run Dataset Audit & Leakage Inspection**:
   ```bash
   python ml/scripts/inspect_dataset.py
   ```
2. **Run Full Training, CV & Report Generation**:
   ```bash
   python ml/scripts/train_pipeline.py
   ```
3. **Run Independent Model Artifact Evaluation**:
   ```bash
   python ml/scripts/evaluate_models.py
   ```
4. **Run Automated Test Suite**:
   ```bash
   pytest tests/test_ml_pipeline.py
   ```
