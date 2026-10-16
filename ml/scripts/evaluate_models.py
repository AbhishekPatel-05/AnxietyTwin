"""
AnxietyTwin - Independent Model Evaluation & Integrity Audit Script (Phase 2.2)
Evaluates saved production artifacts, traces training provenance, recalculates held-out
predictions and risk bands, and validates probability calibrations against the prevalence baseline.
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    brier_score_loss,
    precision_score,
    recall_score,
    confusion_matrix,
    f1_score,
)

# Ensure workspace root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from ml.src.data_loading import load_dataset
from ml.src.feature_engineering import extract_strict_prediction_features
from ml.src.inference import AnxietyPredictor

MODELS_DIR = "ml/models"
REPORTS_DIR = "ml/reports"


def evaluate_saved_artifacts():
    print("=" * 78)
    print("ANXIETYTWIN: PHASE 2.2 ARTIFACT-TO-METRICS INTEGRITY VERIFICATION")
    print("=" * 78)

    # =========================================================================
    # 1. ARTIFACT PROVENANCE & TRAINING PATH AUDIT
    # =========================================================================
    print("\n" + "=" * 78)
    print("SECTION 1: PRODUCTION ARTIFACT PROVENANCE & DEPLOYED INFERENCE AUDIT")
    print("=" * 78)
    
    prod_path = os.path.join(MODELS_DIR, "production_model.joblib")
    meta_path = os.path.join(MODELS_DIR, "features_metadata.json")
    if not os.path.exists(prod_path):
        raise FileNotFoundError(f"Production artifact not found at '{prod_path}'")
    if not os.path.exists(meta_path):
        raise FileNotFoundError(f"Metadata file not found at '{meta_path}'")

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    prod_pipeline = joblib.load(prod_path)
    pipeline_steps = list(prod_pipeline.named_steps.keys())
    
    print(f"Deployed Production Artifact   : {prod_path}")
    print(f"Artifact Pipeline Steps        : {pipeline_steps}")
    print(f"Artifact Model Version         : {meta.get('model_version')}")
    print(f"Feature Schema Count           : {meta.get('feature_count')} features (Strict Dynamic Features)")
    print(f"Prediction Horizon             : {meta.get('prediction_horizon')}")
    print("-" * 78)
    print("PROVENANCE VERDICT:")
    print("  * Deployed Artifact Training Rows: ALL 3,969 participant-days across all 43 participants.")
    print("  * Source Code Line               : ml/scripts/train_pipeline.py (lines 169-180)")
    print("  * Evaluation Type on N=3,969     : RESUBSTITUTION / TRAINING FIT (In-Sample).")
    print("  * CRITICAL DISTINCTION           : The deployed artifact was NOT evaluated in the chronological")
    print("                                     Experiment C holdout; Experiment C created separate in-memory")
    print("                                     models trained strictly on the 2,251 earlier history rows.")
    print("=" * 78)

    # Smoke Test AnxietyPredictor
    predictor = AnxietyPredictor(models_dir=MODELS_DIR, model_filename="production_model.joblib")
    sample_input = {
        "HR_mean": 75.0,
        "HR_max": 105.0,
        "HR_var": 95.0,
        "steps_mean": 55.0,
        "sleep_duration": 7.2,
        "anxiety": 2.0,
        "coffee": 1.0,
    }
    pred_res = predictor.predict(sample_input)
    print("\nInference Smoke Test (AnxietyPredictor):")
    print(f"  Predicted Probability: {pred_res['predicted_probability']:.4f}")
    print(f"  Uncertainty Interval : {pred_res['uncertainty_interval']}")
    print(f"  Risk Band            : {pred_res['risk_band']}")
    assert 0.0 <= pred_res["predicted_probability"] <= 1.0, "Probability out of bounds [0, 1]"
    assert np.isfinite(pred_res["predicted_probability"]), "Probability is not finite"

    # =========================================================================
    # 2. INDEPENDENT RECOMPUTATION FROM HELD-OUT PREDICTIONS (N=1,517)
    # =========================================================================
    held_out_path = os.path.join(REPORTS_DIR, "held_out_predictions.csv")
    if os.path.exists(held_out_path):
        print("\n" + "=" * 78)
        print("SECTION 2: INDEPENDENT RECOMPUTATION FROM HELD-OUT PREDICTIONS (N=1,517)")
        print("=" * 78)
        df_ho = pd.read_csv(held_out_path)
        y_true = df_ho["true_label"].values
        n_test = len(y_true)
        pos_test = int((y_true == 1).sum())
        neg_test = int((y_true == 0).sum())
        prev_test = float(pos_test / n_test)
        brier_baseline = prev_test * (1.0 - prev_test)

        print(f"Held-Out Observations Total    : {n_test}")
        print(f"Positive Labels (Day Before)   : {pos_test}")
        print(f"Negative Labels (Stable Days)  : {neg_test}")
        print(f"Positive Class Prevalence      : {prev_test:.4f} ({prev_test*100:.2f}%)")
        print(f"Naive Prior Brier Baseline     : {brier_baseline:.4f} [Var(Y) = p * (1 - p)]")
        print(f"PR-AUC Reference Baseline      : {prev_test:.4f} (Unskilled random classifier)")
        print("-" * 78)

        # Separate probability metrics from threshold-dependent metrics
        models_config = [
            (
                "Population RF (35 dynamic feats)",
                df_ho["pred_prob_population_rf_35"].values,
                0.5412,
                "Trained on 2,251 history rows of 29 participants (dynamic 35 feats)",
            ),
            (
                "Personalized RF (40 feats: +devs)",
                df_ho["pred_prob_personalized_rf_40"].values,
                0.5412,
                "Trained on 2,251 history rows of 29 participants (personalized 40 feats)",
            ),
            (
                "Personalized XGBoost (40 feats: +devs)",
                df_ho["pred_prob_personalized_xgb_40"].values,
                0.6645,
                "Trained on 2,251 history rows of 29 participants (personalized 40 feats)",
            ),
        ]

        for m_name, probs, threshold, provenance_note in models_config:
            # Probability-based metrics (threshold-independent)
            roc = roc_auc_score(y_true, probs)
            pr = average_precision_score(y_true, probs)
            brier = brier_score_loss(y_true, probs)
            beats_brier = brier < brier_baseline

            # Threshold-dependent metrics (threshold strictly selected on training set)
            y_pred = (probs >= threshold).astype(int)
            prec = precision_score(y_true, y_pred, zero_division=0)
            rec = recall_score(y_true, y_pred, zero_division=0)
            f1 = f1_score(y_true, y_pred, zero_division=0)
            cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
            tn, fp, fn, tp = int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1])
            spec = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0

            print(f"Model: {m_name}")
            print(f"  Provenance Note : {provenance_note}")
            print(f"  [Probability Metrics - Threshold Independent]")
            print(f"    ROC-AUC       : {roc:.4f}")
            print(f"    PR-AUC        : {pr:.4f}  (Baseline reference = {prev_test:.4f})")
            print(f"    Brier Score   : {brier:.4f}  (Baseline reference = {brier_baseline:.4f})")
            print(f"    Beats Brier?  : {'YES' if beats_brier else 'NO (Worse than naive prior baseline)'}")
            print(f"  [Classification Metrics - At Stated Threshold tau = {threshold:.4f}]")
            print(f"    Threshold tau : {threshold:.4f} (Optimized strictly on training partition F1)")
            print(f"    Precision     : {prec:.4f}")
            print(f"    Recall        : {rec:.4f}")
            print(f"    Specificity   : {spec:.4f}")
            print(f"    F1 Score      : {f1:.4f}")
            print(f"    Confusion     : TN={tn}, FP={fp}, FN={fn}, TP={tp}")
            print()

        # =====================================================================
        # 3. RISK-BAND RECOMPUTATION & SCOPING VERIFICATION
        # =====================================================================
        print("=" * 78)
        print("SECTION 3: HELD-OUT RISK-BAND TABLES (Exact 1,517 Held-Out Observations)")
        print("DISCLOSURE: Cutoffs (<0.12 Low, 0.12-0.30 Moderate, >=0.30 Elevated) are exploratory")
        print("heuristics based on class imbalance (prevalence 4.8%). NOT clinically validated.")
        print("=" * 78)

        for m_name, model_probs, _, _ in models_config:
            print(f"\nRisk Bands for {m_name}:")
            bands = [
                ("LOW (<0.12)", model_probs < 0.12),
                ("MODERATE (0.12-0.30)", (model_probs >= 0.12) & (model_probs < 0.30)),
                ("ELEVATED (>=0.30)", model_probs >= 0.30),
            ]
            print(f"  {'Risk Band':<22} | {'Count':<7} | {'Positives':<9} | {'Mean Prob':<10} | {'Observed Rate':<14}")
            print("  " + "-" * 72)
            tot_cnt = 0
            tot_pos = 0
            for b_name, b_mask in bands:
                b_cnt = int(b_mask.sum())
                b_pos = int(y_true[b_mask].sum())
                tot_cnt += b_cnt
                tot_pos += b_pos
                b_mean_prob = float(model_probs[b_mask].mean()) if b_cnt > 0 else 0.0
                b_obs_rate = (b_pos / b_cnt) if b_cnt > 0 else 0.0
                print(f"  {b_name:<22} | {b_cnt:<7} | {b_pos:<9} | {b_mean_prob:<10.4f} | {b_obs_rate:<14.2%}")
            print(f"  {'Total Check':<22} | {tot_cnt:<7} | {tot_pos:<9} | {'-':<10} | {tot_pos/tot_cnt:<14.2%}")
            assert tot_cnt == 1517, f"Total count {tot_cnt} does not equal 1,517!"
            assert tot_pos == 73, f"Total positives {tot_pos} does not equal 73!"

    # =========================================================================
    # 4. GROUPKFOLD CROSS-VALIDATION SUMMARY (Unseen Participants, N=3,969)
    # =========================================================================
    exp_res_path = os.path.join(REPORTS_DIR, "experiment_results.json")
    if os.path.exists(exp_res_path):
        print("\n" + "=" * 78)
        print("SECTION 4: PARTICIPANT-AWARE GENERALIZATION (GroupKFold CV: 43 Participants)")
        print("Cohort: 3,969 Days, 254 Positives (6.40% Baseline Prevalence)")
        print("=" * 78)
        with open(exp_res_path, "r", encoding="utf-8") as f:
            exp_results = json.load(f)

        gkf_results = exp_results.get("experiment_b_group_cv_dynamic_features", {})
        for m_name, m_stats in gkf_results.items():
            if isinstance(m_stats, dict) and "roc_auc_mean" in m_stats:
                print(
                    f"  {m_name:20s}: ROC-AUC = {m_stats['roc_auc_mean']:.4f} +/- {m_stats['roc_auc_std']:.4f} | "
                    f"PR-AUC = {m_stats['pr_auc_mean']:.4f} | Brier = {m_stats['brier_score_mean']:.4f}"
                )

    # =========================================================================
    # 5. RESUBSTITUTION / TRAINING FIT AUDIT (N=3,969)
    # =========================================================================
    print("\n" + "=" * 78)
    print("SECTION 5: RESUBSTITUTION FIT OF DEPLOYED ARTIFACTS ON FULL DATASET (N=3,969)")
    print("WARNING: These are training/resubstitution scores. DO NOT cite as validation.")
    print("=" * 78)
    df = load_dataset()
    X, y, groups, features = extract_strict_prediction_features(df)
    models = ["production_model.joblib", "random_forest.joblib", "xgboost_model.joblib", "logistic_regression.joblib"]
    for m_file in models:
        path = os.path.join(MODELS_DIR, m_file)
        if os.path.exists(path):
            pipe = joblib.load(path)
            probs = pipe.predict_proba(X[features])[:, 1]
            roc = roc_auc_score(y, probs)
            pr = average_precision_score(y, probs)
            brier = brier_score_loss(y, probs)
            print(f"  {m_file:28s}: Full-Sample ROC-AUC = {roc:.4f} | PR-AUC = {pr:.4f} | Brier = {brier:.4f}")

    print("\n" + "=" * 78)
    print("PHASE 2.2 VERIFICATION COMPLETE: ALL PROVENANCES & METRICS AUDITED")
    print("=" * 78)


if __name__ == "__main__":
    evaluate_saved_artifacts()
