"""
AnxietyTwin - Statistical Evaluation & Metrics Module
Computes discriminative performance, precision-recall trade-offs, calibration (Brier score),
and confusion matrices with threshold selection strictly on training data.
"""

from typing import Dict, Any, List, Tuple
import numpy as np
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    precision_score,
    recall_score,
    f1_score,
    brier_score_loss,
    confusion_matrix,
    precision_recall_curve,
)


def select_optimal_threshold(y_train: np.ndarray, y_train_probs: np.ndarray) -> float:
    """
    Selects the optimal decision threshold maximizing F1 on the TRAINING set only.
    Guarantees no held-out test label leakage occurs during threshold tuning.
    """
    precisions, recalls, thresholds = precision_recall_curve(y_train, y_train_probs)
    # Avoid zero division
    f1_scores = 2 * (precisions * recalls) / np.maximum(precisions + recalls, 1e-8)
    # Exclude boundary threshold
    if len(thresholds) > 0:
        best_idx = np.argmax(f1_scores[:-1])
        return float(thresholds[best_idx])
    return 0.5


def evaluate_predictions(
    y_true: np.ndarray,
    y_probs: np.ndarray,
    threshold: float = 0.5,
) -> Dict[str, Any]:
    """
    Computes a comprehensive suite of classification and calibration metrics.
    """
    y_true = np.asarray(y_true).astype(int)
    y_probs = np.asarray(y_probs).astype(float)
    y_preds = (y_probs >= threshold).astype(int)

    pos_count = int((y_true == 1).sum())
    neg_count = int((y_true == 0).sum())
    total = len(y_true)
    prevalence = pos_count / max(1, total)

    # ROC-AUC (requires at least 1 positive and 1 negative)
    if pos_count > 0 and neg_count > 0 and len(np.unique(y_probs)) > 1:
        roc_auc = float(roc_auc_score(y_true, y_probs))
        pr_auc = float(average_precision_score(y_true, y_probs))
    else:
        roc_auc = 0.5
        pr_auc = float(prevalence)

    # Confusion matrix
    cm = confusion_matrix(y_true, y_preds, labels=[0, 1])
    tn, fp, fn, tp = int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1])

    prec = float(precision_score(y_true, y_preds, zero_division=0))
    rec = float(recall_score(y_true, y_preds, zero_division=0))
    spec = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
    f1 = float(f1_score(y_true, y_preds, zero_division=0))
    brier = float(brier_score_loss(y_true, y_probs))

    return {
        "roc_auc": round(roc_auc, 4),
        "pr_auc": round(pr_auc, 4),
        "prevalence": round(prevalence, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "specificity": round(spec, 4),
        "f1": round(f1, 4),
        "brier_score": round(brier, 4),
        "decision_threshold": round(threshold, 4),
        "confusion_matrix": {
            "true_negatives": tn,
            "false_positives": fp,
            "false_negatives": fn,
            "true_positives": tp,
        },
    }


def aggregate_fold_metrics(fold_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregates metrics across cross-validation folds."""
    metric_keys = ["roc_auc", "pr_auc", "precision", "recall", "specificity", "f1", "brier_score"]
    agg = {}

    for k in metric_keys:
        vals = [f[k] for f in fold_results if k in f]
        agg[f"{k}_mean"] = round(float(np.mean(vals)), 4)
        agg[f"{k}_std"] = round(float(np.std(vals)), 4)

    # Sum confusion matrices
    total_tn = sum(f["confusion_matrix"]["true_negatives"] for f in fold_results)
    total_fp = sum(f["confusion_matrix"]["false_positives"] for f in fold_results)
    total_fn = sum(f["confusion_matrix"]["false_negatives"] for f in fold_results)
    total_tp = sum(f["confusion_matrix"]["true_positives"] for f in fold_results)

    agg["total_confusion_matrix"] = {
        "true_negatives": total_tn,
        "false_positives": total_fp,
        "false_negatives": total_fn,
        "true_positives": total_tp,
    }
    agg["fold_count"] = len(fold_results)
    return agg
