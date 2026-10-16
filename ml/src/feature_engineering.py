"""
AnxietyTwin - Feature Engineering & Modality Partitioning Module
Constructs three distinct, auditable feature sets:
1. Research Comparison Feature Set (66 features - paper replication)
2. Strict Prediction-Time Feature Set (35 dynamic features - clean generalization)
3. Personalized Longitudinal Feature Set (35 dynamic + past-only causal deviation baselines)
"""

from typing import List, Dict, Any, Tuple
import pandas as pd
import numpy as np


# The 35 dynamic features (physiological lifelog + daily smartphone reports)
DYNAMIC_FEATURE_COLUMNS = [
    # Wearable Heart Rate (4)
    "HR_mean", "HR_max", "HR_var", "HR_hvar_mean",
    # Wearable Steps / Activity (4)
    "steps_mean", "steps_maximum", "foot_var", "steps_hvar_mean",
    # Wearable Circadian Cosinor (9)
    "HR_acrophase", "HR_amplitude", "HR_mesor",
    "HR_acrophase_difference", "HR_acrophase_difference_2d",
    "HR_amplitude_difference", "HR_amplitude_difference_2d",
    "HR_mesor_difference", "HR_mesor_difference_2d",
    # Spectral Bandpowers (4)
    "bandpower(0.001-0.0005Hz)",
    "bandpower(0.0005-0.0001Hz)",
    "bandpower(0.0001-0.00005Hz)",
    "bandpower(0.00005-0.00001Hz)",
    # Sleep Parameters (3)
    "sleep_duration", "sleep_onset_time", "sleep_out_time",
    # Daily Smartphone Lifestyle Logs (5)
    "alcohol", "coffee", "smoking", "exercise", "menstruation",
    # Daily Subjective Emotion & Mood Ratings (6)
    "anxiety", "annoying", "positive_feeling", "negative", "positive_E", "negative_E",
]

# Static Clinical Traits & Demographic Features (19 features)
STATIC_TRAIT_COLUMNS = [
    "BRIAN", "CSM", "CTQ_1", "CTQ_2", "CTQ_3", "CTQ_4", "CTQ_5",
    "KRQ", "MDQ", "SPAQ_1", "SPAQ_2", "STAI_X2",
    "marriage", "job", "smkHx", "drinkHx", "suicideHx", "suicide_need",
    "biological_sex"
]

# Ultra-Sparse Periodic Scales (12 features with >97% zero-fills)
SPARSE_CLINICAL_COLUMNS = [
    "BFNE", "SADS", "KOSSSF", "ACQ", "BSQ", "CES_D",
    "APPQ_1", "APPQ_2", "APPQ_3", "STAI_X1", "PHQ_9", "GAD_7"
]


def extract_research_feature_matrix(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series, pd.Series, List[str]]:
    """
    Extracts Feature Set 1: Full Research Comparison Feature Set (66 features).
    Matches the original published setup.
    """
    df_clean = df.copy()
    if "biological_sex" not in df_clean.columns and "age" in df_clean.columns:
        df_clean["biological_sex"] = (df_clean["age"] == "M").astype(int)

    exclude_cols = ["ID", "date", "panic", "age", "gender", "medication_in_month"]
    feature_cols = [c for c in df_clean.columns if c not in exclude_cols]

    X = df_clean[feature_cols].apply(pd.to_numeric, errors="coerce")
    y = df_clean["panic"].astype(int)
    groups = df_clean["ID"]

    return X, y, groups, feature_cols


def extract_strict_prediction_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series, pd.Series, List[str]]:
    """
    Extracts Feature Set 2: Strict Prediction-Time Dynamic Feature Set (35 features).
    Excludes static participant fingerprints and ultra-sparse scales to evaluate
    generalizable physiological and behavioral state shifts on unseen participants.
    """
    df_clean = df.copy()
    present_cols = [c for c in DYNAMIC_FEATURE_COLUMNS if c in df_clean.columns]

    X = df_clean[present_cols].apply(pd.to_numeric, errors="coerce")
    y = df_clean["panic"].astype(int)
    groups = df_clean["ID"]

    return X, y, groups, present_cols


def compute_personalized_longitudinal_features(
    df: pd.DataFrame,
    min_history_days: int = 7,
) -> Tuple[pd.DataFrame, List[str]]:
    """
    Extracts Feature Set 3: Personalized Longitudinal Feature Set.
    Computes within-person deviation z-scores and rolling baselines using
    ONLY historical observations strictly preceding day t.
    Zero future leakage guaranteed.
    """
    df_sorted = df.copy()
    df_sorted["date_dt"] = pd.to_datetime(df_sorted["date"])
    df_sorted = df_sorted.sort_values(["ID", "date_dt"]).reset_index(drop=True)

    records = []
    pers_added_cols = ["hr_mean_dev", "sleep_duration_dev", "anxiety_dev", "prior_panic_rate", "hist_days_count"]

    for pid, group in df_sorted.groupby("ID", sort=False):
        group = group.copy().reset_index(drop=True)
        n = len(group)
        hr = pd.to_numeric(group["HR_mean"], errors="coerce").values
        sleep = pd.to_numeric(group["sleep_duration"], errors="coerce").values
        anx = pd.to_numeric(group["anxiety"], errors="coerce").values
        panic = pd.to_numeric(group["panic"], errors="coerce").values

        hr_dev = np.zeros(n)
        sleep_dev = np.zeros(n)
        anx_dev = np.zeros(n)
        prior_panic_rate = np.zeros(n)
        hist_days = np.arange(n)

        for i in range(n):
            if i >= min_history_days:
                past_hr = hr[:i]
                past_sleep = sleep[:i]
                past_anx = anx[:i]
                past_panic = panic[:i]

                # Robust median and MAD
                valid_hr = past_hr[~np.isnan(past_hr)]
                if len(valid_hr) > 0:
                    med_hr = np.median(valid_hr)
                    mad_hr = np.median(np.abs(valid_hr - med_hr))
                    hr_dev[i] = (hr[i] - med_hr) / (mad_hr + 1.0) if not np.isnan(hr[i]) else 0.0

                valid_sleep = past_sleep[~np.isnan(past_sleep)]
                if len(valid_sleep) > 0:
                    med_sleep = np.median(valid_sleep)
                    mad_sleep = np.median(np.abs(valid_sleep - med_sleep))
                    sleep_dev[i] = (sleep[i] - med_sleep) / (mad_sleep + 0.5) if not np.isnan(sleep[i]) else 0.0

                valid_anx = past_anx[~np.isnan(past_anx)]
                if len(valid_anx) > 0:
                    med_anx = np.median(valid_anx)
                    anx_dev[i] = (anx[i] - med_anx) if not np.isnan(anx[i]) else 0.0

                valid_panic = past_panic[~np.isnan(past_panic)]
                if len(valid_panic) > 0:
                    prior_panic_rate[i] = np.mean(valid_panic)

        group["hr_mean_dev"] = hr_dev
        group["sleep_duration_dev"] = sleep_dev
        group["anxiety_dev"] = anx_dev
        group["prior_panic_rate"] = prior_panic_rate
        group["hist_days_count"] = hist_days
        records.append(group)

    df_result = pd.concat(records, ignore_index=True)
    all_pers_features = [c for c in DYNAMIC_FEATURE_COLUMNS if c in df_result.columns] + pers_added_cols

    return df_result, all_pers_features
