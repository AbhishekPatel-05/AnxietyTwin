"""
AnxietyTwin - Machine Learning Research, Training & Rigorous Validation Pipeline (v2.0.0)
Reproducible training, leakage-free cross-validation, and explainability on the
2024 Nature Scientific Data digital phenotyping dataset (Jang et al. 11:1264, 2024).

Implements three distinct evaluation regimes:
1. Experiment A: Benchmark Random 5-Fold CV (Paper Setup Reproduction)
2. Experiment B: Participant-Aware GroupKFold CV (Unseen Patient Generalization)
   - Evaluated on Research Feature Set (66 features)
   - Evaluated on Strict Prediction-Time Dynamic Feature Set (35 features)
3. Experiment C: Personalized Longitudinal Evaluation (Strict Causal Future Period)
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
import shap

# Ensure workspace root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from ml.src.data_loading import load_dataset, get_dataset_summary
from ml.src.target_construction import verify_target_semantics
from ml.src.feature_engineering import (
    extract_research_feature_matrix,
    extract_strict_prediction_features,
    compute_personalized_longitudinal_features,
    DYNAMIC_FEATURE_COLUMNS,
)
from ml.src.training import create_model_pipeline, get_candidate_models
from ml.src.validation import (
    run_cross_validation,
    run_longitudinal_personalization_eval,
)

MODELS_DIR = os.path.join("ml", "models")
REPORTS_DIR = os.path.join("ml", "reports")
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)


def main():
    print("=" * 70)
    print("ANXIETYTWIN ML PIPELINE v2.0: AUDIT, REPAIR, TRAIN & VALIDATE")
    print("=" * 70)

    # 1. Load Data
    df = load_dataset()
    summary = get_dataset_summary(df)
    print(f"Loaded dataset: {summary['total_rows']} rows, {summary['unique_participants']} participants")
    print(f"Target prevalence: {summary['positive_label_count']} DBP (pos), {summary['negative_label_count']} SD (neg) -> {summary['prevalence']*100:.2f}%")

    # 2. Extract Feature Sets
    print("\n--- Constructing Feature Sets ---")
    X_research, y_research, groups_research, feat_research = extract_research_feature_matrix(df)
    print(f"Feature Set 1 (Research Benchmark): {len(feat_research)} features")

    X_dynamic, y_dynamic, groups_dynamic, feat_dynamic = extract_strict_prediction_features(df)
    print(f"Feature Set 2 (Strict Dynamic Prediction-Time): {len(feat_dynamic)} features")

    df_pers, feat_pers = compute_personalized_longitudinal_features(df, min_history_days=7)
    print(f"Feature Set 3 (Personalized Longitudinal): {len(feat_pers)} features")

    results = {
        "metadata": {
            "pipeline_version": "2.0.0",
            "study_reference": "Jang et al. Scientific Data 11:1264, 2024 (Nature)",
            "total_rows": summary["total_rows"],
            "unique_participants": summary["unique_participants"],
            "positive_label_count": summary["positive_label_count"],
            "negative_label_count": summary["negative_label_count"],
            "cohort_prevalence": summary["prevalence"],
            "target_definition": "Day Before Panic (DBP, ~24h lookahead)",
        },
        "experiment_a_random_cv": {},
        "experiment_b_group_cv_research_features": {},
        "experiment_b_group_cv_dynamic_features": {},
        "experiment_c_longitudinal_personalization": {},
    }

    # =========================================================================
    # EXPERIMENT A: Benchmark Random 5-Fold CV (Paper Replication)
    # =========================================================================
    print("\n" + "=" * 60)
    print("EXPERIMENT A: Benchmark Random 5-Fold CV (Paper Setup Replication)")
    print("=" * 60)
    exp_a = run_cross_validation(
        X=X_research,
        y=y_research,
        groups=None,
        cv_type="random",
        n_splits=5,
        random_state=42,
    )
    results["experiment_a_random_cv"] = exp_a["model_results"]
    for m_name, m_res in exp_a["model_results"].items():
        print(f"  {m_name:20s}: ROC-AUC = {m_res['roc_auc_mean']:.4f} +/- {m_res['roc_auc_std']:.4f} | PR-AUC = {m_res['pr_auc_mean']:.4f} | Brier = {m_res['brier_score_mean']:.4f}")

    # =========================================================================
    # EXPERIMENT B1: GroupKFold on Research Feature Set (Leakage Demonstration)
    # =========================================================================
    print("\n" + "=" * 60)
    print("EXPERIMENT B1: Participant-Aware GroupKFold on Research Features (66 feats)")
    print("=" * 60)
    exp_b1 = run_cross_validation(
        X=X_research,
        y=y_research,
        groups=groups_research,
        cv_type="group",
        n_splits=5,
        random_state=42,
    )
    results["experiment_b_group_cv_research_features"] = exp_b1["model_results"]
    for m_name, m_res in exp_b1["model_results"].items():
        print(f"  {m_name:20s}: ROC-AUC = {m_res['roc_auc_mean']:.4f} +/- {m_res['roc_auc_std']:.4f} | PR-AUC = {m_res['pr_auc_mean']:.4f} | Brier = {m_res['brier_score_mean']:.4f}")

    # =========================================================================
    # EXPERIMENT B2: GroupKFold on Strict Prediction-Time Dynamic Features (35 feats)
    # =========================================================================
    print("\n" + "=" * 60)
    print("EXPERIMENT B2: Participant-Aware GroupKFold on Strict Dynamic Features (35 feats)")
    print("=" * 60)
    exp_b2 = run_cross_validation(
        X=X_dynamic,
        y=y_dynamic,
        groups=groups_dynamic,
        cv_type="group",
        n_splits=5,
        random_state=42,
    )
    results["experiment_b_group_cv_dynamic_features"] = exp_b2["model_results"]
    for m_name, m_res in exp_b2["model_results"].items():
        print(f"  {m_name:20s}: ROC-AUC = {m_res['roc_auc_mean']:.4f} +/- {m_res['roc_auc_std']:.4f} | PR-AUC = {m_res['pr_auc_mean']:.4f} | Brier = {m_res['brier_score_mean']:.4f}")

    # =========================================================================
    # EXPERIMENT C: Personalized Longitudinal Evaluation (Strict Causal Future)
    # =========================================================================
    print("\n" + "=" * 60)
    print("EXPERIMENT C: Personalized Future-Period Evaluation (Causal Split)")
    print("=" * 60)
    exp_c = run_longitudinal_personalization_eval(
        df_with_pers=df_pers,
        dynamic_features=feat_dynamic,
        pers_features=feat_pers,
        min_participant_days=30,
        history_ratio=0.6,
        random_state=42,
    )
    results["experiment_c_longitudinal_personalization"] = exp_c
    print(f"  Eligible participants (>=30 days): {exp_c['eligible_participants_count']} (Excluded: {exp_c['excluded_participants_count']})")
    print(f"  Test days: {exp_c['test_days_total']} (Positives: {exp_c['test_positives_total']}, Prev: {exp_c['test_prevalence']*100:.2f}%)")
    for comp_name, comp_res in exp_c["model_comparisons"].items():
        print(f"  {comp_name:35s}: ROC-AUC = {comp_res['roc_auc']:.4f} | PR-AUC = {comp_res['pr_auc']:.4f} | Brier = {comp_res['brier_score']:.4f}")

    # =========================================================================
    # PRODUCTION MODEL TRAINING & ARTIFACT SERIALIZATION
    # =========================================================================
    print("\n" + "=" * 60)
    print("PRODUCTION MODEL TRAINING & SERIALIZATION")
    print("=" * 60)
    
    # We select Random Forest and XGBoost trained on the validated Dynamic Feature Set
    # with leak-free preprocessing (Median Imputation + Scaling)
    pos_ratio = float((y_dynamic == 0).sum() / max(1, (y_dynamic == 1).sum()))
    
    rf_pipeline = create_model_pipeline("RandomForest", pos_weight=pos_ratio, random_state=42)
    rf_pipeline.fit(X_dynamic, y_dynamic)

    xgb_pipeline = create_model_pipeline("XGBoost", pos_weight=pos_ratio, random_state=42)
    xgb_pipeline.fit(X_dynamic, y_dynamic)

    lr_pipeline = create_model_pipeline("LogisticRegression", pos_weight=pos_ratio, random_state=42)
    lr_pipeline.fit(X_dynamic, y_dynamic)

    # Save complete pipelines
    joblib.dump(rf_pipeline, os.path.join(MODELS_DIR, "production_model.joblib"))
    joblib.dump(rf_pipeline, os.path.join(MODELS_DIR, "random_forest.joblib"))
    joblib.dump(xgb_pipeline, os.path.join(MODELS_DIR, "xgboost_model.joblib"))
    joblib.dump(lr_pipeline, os.path.join(MODELS_DIR, "logistic_regression.joblib"))

    # Also save fitted scaler alone for backwards compatibility with any legacy code
    scaler = rf_pipeline.named_steps.get("scaler")
    if scaler is not None:
        joblib.dump(scaler, os.path.join(MODELS_DIR, "scaler.joblib"))

    # Feature metadata dictionary
    feat_meta = {
        "model_version": "2.0.0",
        "model_name": "AnxietyTwin-RandomForest-DBP",
        "training_dataset_version": "1.0.0 (Nature Scientific Data 2024)",
        "prediction_horizon": "24-Hour Impending Panic Likelihood (Day Before Panic)",
        "feature_set_type": "Strict Prediction-Time Dynamic Features",
        "feature_count": len(feat_dynamic),
        "feature_names": feat_dynamic,
        "feature_medians": {c: float(np.nanmedian(X_dynamic[c])) for c in feat_dynamic},
        "feature_means": {c: float(np.nanmean(X_dynamic[c])) for c in feat_dynamic},
        "feature_stds": {c: float(np.nanstd(X_dynamic[c])) for c in feat_dynamic},
        "feature_mins": {c: float(np.nanmin(X_dynamic[c])) for c in feat_dynamic},
        "feature_maxs": {c: float(np.nanmax(X_dynamic[c])) for c in feat_dynamic},
        "validation_metrics": {
            "group_kfold_roc_auc_mean": exp_b2["model_results"]["RandomForest"]["roc_auc_mean"],
            "group_kfold_pr_auc_mean": exp_b2["model_results"]["RandomForest"]["pr_auc_mean"],
            "group_kfold_brier_mean": exp_b2["model_results"]["RandomForest"]["brier_score_mean"],
            "longitudinal_roc_auc": exp_c["model_comparisons"]["RandomForest_Population_Dynamic"]["roc_auc"],
            "longitudinal_personalized_roc_auc": exp_c["model_comparisons"]["RandomForest_Personalized_Deviations"]["roc_auc"],
        },
        "intended_use": (
            "Research-oriented prospective impending panic vulnerability prediction over ~24-hour horizon. "
            "Informs personalized baseline monitoring within AnxietyTwin Digital Twin framework."
        ),
        "known_limitations": (
            "Does NOT predict intraday panic attacks occurring within the next 1-2 hours due to lack of continuous streaming signals. "
            "Prevalence is 6.4%, requiring personalized baseline calibration for clinical relevance."
        ),
    }

    with open(os.path.join(MODELS_DIR, "features_metadata.json"), "w", encoding="utf-8") as f:
        json.dump(feat_meta, f, indent=2)

    # Save full experiment results
    with open(os.path.join(REPORTS_DIR, "experiment_results.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    # =========================================================================
    # SHAP EXPLAINABILITY ON VALIDATED DYNAMIC MODEL
    # =========================================================================
    print("\nComputing SHAP values on validated dynamic pipeline...")
    # Extract underlying tree model from pipeline
    rf_model = rf_pipeline.named_steps["model"]
    # Sample 300 transformed rows
    imputer = rf_pipeline.named_steps["imputer"]
    X_imputed = pd.DataFrame(imputer.transform(X_dynamic), columns=feat_dynamic)
    sample_idx = np.random.RandomState(42).choice(len(X_imputed), size=min(300, len(X_imputed)), replace=False)
    X_sample = X_imputed.iloc[sample_idx]

    explainer = shap.TreeExplainer(rf_model)
    shap_values = explainer.shap_values(X_sample)
    
    # In binary classification, shap_values is a list of [neg_shap, pos_shap] or 3D array
    if isinstance(shap_values, list) and len(shap_values) == 2:
        pos_shap = shap_values[1]
    elif isinstance(shap_values, np.ndarray) and len(shap_values.shape) == 3:
        pos_shap = shap_values[:, :, 1]
    else:
        pos_shap = shap_values

    mean_abs_shap = np.abs(pos_shap).mean(axis=0)
    shap_ranking = dict(
        sorted(
            zip(feat_dynamic, [float(x) for x in mean_abs_shap]),
            key=lambda item: item[1],
            reverse=True,
        )
    )
    results["top_shap_features"] = dict(list(shap_ranking.items())[:15])

    with open(os.path.join(REPORTS_DIR, "shap_summary.json"), "w", encoding="utf-8") as f:
        json.dump(results["top_shap_features"], f, indent=2)

    print("\nTop 10 Influential Dynamic Features (SHAP):")
    for i, (feat, score) in enumerate(list(results["top_shap_features"].items())[:10]):
        print(f"  {i+1:2d}. {feat:30s}: Mean |SHAP| = {score:.4f}")

    print("\nTraining and validation complete! All artifacts saved.")


if __name__ == "__main__":
    main()
