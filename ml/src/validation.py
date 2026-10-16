"""
AnxietyTwin - Cross-Validation & Experiment Execution Module
Executes the three mandated evaluation regimes:
1. Experiment A: Reproducibility Baseline (Random 5-Fold CV)
2. Experiment B: Unseen-Participant Generalization (GroupKFold CV on participant ID)
3. Experiment C: Personalized Longitudinal Evaluation (Strict Causal Future-Period Split)
"""

from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd
from sklearn.model_selection import KFold, GroupKFold

from ml.src.training import get_candidate_models, create_model_pipeline
from ml.src.evaluation import (
    select_optimal_threshold,
    evaluate_predictions,
    aggregate_fold_metrics,
)


def run_cross_validation(
    X: pd.DataFrame,
    y: pd.Series,
    groups: pd.Series = None,
    cv_type: str = "group",
    n_splits: int = 5,
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    Runs cross-validation across all candidate models for a given feature matrix and CV regime.
    cv_type: 'group' (GroupKFold on participant ID) or 'random' (KFold with shuffle).
    """
    candidates = get_candidate_models(random_state=random_state)
    
    if cv_type == "group":
        if groups is None:
            raise ValueError("groups array must be provided for GroupKFold cross-validation.")
        splitter = GroupKFold(n_splits=n_splits)
        splits = list(splitter.split(X, y, groups=groups))
    else:
        splitter = KFold(n_splits=n_splits, shuffle=True, random_state=random_state)
        splits = list(splitter.split(X, y))

    # Log fold compositions
    fold_summaries = []
    for f_idx, (tr_idx, val_idx) in enumerate(splits):
        y_val_f = y.iloc[val_idx]
        pts_val = groups.iloc[val_idx].nunique() if groups is not None else None
        fold_summaries.append({
            "fold_index": f_idx,
            "train_days": len(tr_idx),
            "val_days": len(val_idx),
            "val_positives": int((y_val_f == 1).sum()),
            "val_negatives": int((y_val_f == 0).sum()),
            "val_prevalence": round(float((y_val_f == 1).mean()), 4),
            "val_participants": pts_val,
        })

    model_evaluations = {}

    for model_name, spec in candidates.items():
        fold_results = []
        for fold_idx, (train_idx, val_idx) in enumerate(splits):
            X_train, X_val = X.iloc[train_idx].copy(), X.iloc[val_idx].copy()
            y_train, y_val = y.iloc[train_idx].values, y.iloc[val_idx].values

            # Compute positive class weight on training fold only
            pos_c = max(1, int((y_train == 1).sum()))
            neg_c = int((y_train == 0).sum())
            train_pos_weight = float(neg_c / pos_c)

            # Build pipeline
            pipeline = create_model_pipeline(
                model_name=model_name,
                pos_weight=train_pos_weight,
                random_state=random_state,
            )

            # Fit pipeline strictly on training fold
            pipeline.fit(X_train, y_train)

            # Predict probabilities
            if hasattr(pipeline, "predict_proba"):
                train_probs = pipeline.predict_proba(X_train)[:, 1]
                val_probs = pipeline.predict_proba(X_val)[:, 1]
            else:
                train_probs = pipeline.predict(X_train).astype(float)
                val_probs = pipeline.predict(X_val).astype(float)

            # Threshold selection on training predictions only
            if model_name.startswith("Dummy"):
                opt_thresh = 0.5
            else:
                opt_thresh = select_optimal_threshold(y_train, train_probs)

            # Evaluate fold test predictions
            fold_metrics = evaluate_predictions(y_val, val_probs, threshold=opt_thresh)
            fold_metrics["fold_index"] = fold_idx
            fold_results.append(fold_metrics)

        # Aggregate across folds
        agg_metrics = aggregate_fold_metrics(fold_results)
        agg_metrics["fold_details"] = fold_results
        model_evaluations[model_name] = agg_metrics

    return {
        "cv_type": cv_type,
        "n_splits": n_splits,
        "fold_summaries": fold_summaries,
        "model_results": model_evaluations,
    }


def run_longitudinal_personalization_eval(
    df_with_pers: pd.DataFrame,
    dynamic_features: List[str],
    pers_features: List[str],
    min_participant_days: int = 30,
    history_ratio: float = 0.6,
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    Executes Experiment C: Strictly causal future-period personalization evaluation.
    1. Filters for participants with >= min_participant_days.
    2. Splits each participant's timeline chronologically: earlier portion for baseline history,
       strictly subsequent days for future evaluation.
    3. Evaluates both a Population Dynamic Model and a Personalized Deviation Model on the identical test days.
    """
    df_sorted = df_with_pers.copy()
    df_sorted["date_dt"] = pd.to_datetime(df_sorted["date"])
    df_sorted = df_sorted.sort_values(["ID", "date_dt"]).reset_index(drop=True)

    eligible_pids = [pid for pid, g in df_sorted.groupby("ID") if len(g) >= min_participant_days]
    excluded_pids = [pid for pid, g in df_sorted.groupby("ID") if len(g) < min_participant_days]

    train_rows = []
    test_rows = []

    for pid in eligible_pids:
        g = df_sorted[df_sorted["ID"] == pid].copy()
        n = len(g)
        split_idx = int(n * history_ratio)
        train_rows.append(g.iloc[:split_idx])
        test_rows.append(g.iloc[split_idx:])

    df_train = pd.concat(train_rows, ignore_index=True)
    df_test = pd.concat(test_rows, ignore_index=True)

    y_train = df_train["panic"].astype(int).values
    y_test = df_test["panic"].astype(int).values

    train_pos_weight = float((y_train == 0).sum() / max(1, (y_train == 1).sum()))

    eval_comparisons = {}

    for name, feat_list in [
        ("Population_Dynamic", dynamic_features),
        ("Personalized_Deviations", pers_features),
    ]:
        # We evaluate RandomForest and LogisticRegression
        for algo in ["RandomForest", "LogisticRegression", "XGBoost"]:
            pipe = create_model_pipeline(
                model_name=algo,
                pos_weight=train_pos_weight,
                random_state=random_state,
            )
            pipe.fit(df_train[feat_list], y_train)

            tr_probs = pipe.predict_proba(df_train[feat_list])[:, 1]
            te_probs = pipe.predict_proba(df_test[feat_list])[:, 1]

            thresh = select_optimal_threshold(y_train, tr_probs)
            metrics = evaluate_predictions(y_test, te_probs, threshold=thresh)
            eval_comparisons[f"{algo}_{name}"] = metrics

    return {
        "eligible_participants_count": len(eligible_pids),
        "excluded_participants_count": len(excluded_pids),
        "min_history_threshold_days": min_participant_days,
        "history_split_ratio": history_ratio,
        "train_days_total": len(df_train),
        "train_positives_total": int((y_train == 1).sum()),
        "test_days_total": len(df_test),
        "test_positives_total": int((y_test == 1).sum()),
        "test_prevalence": round(float((y_test == 1).mean()), 4),
        "model_comparisons": eval_comparisons,
    }
