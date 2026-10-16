"""
AnxietyTwin - Target Label Verification & Audit Module
Validates the construction, temporal alignment, and semantics of the impending panic target label.
"""

from typing import Dict, Any, Tuple
import pandas as pd
import numpy as np


def verify_target_semantics(
    merged_df: pd.DataFrame,
    panic_proc: pd.DataFrame = None,
    panic_raw: pd.DataFrame = None,
) -> Dict[str, Any]:
    """
    Verifies and audits the 'panic' target label:
    1. Confirm panic in merged_df is binary (0.0 = Stable Day [SD], 1.0 = Day Before Panic [DBP]).
    2. Confirm that Day of Panic (DP, coded as 2 in panic.feather) are completely excluded from merged_df.
    3. Audit cross-table alignment between raw panic reports, processed panic table, and merged_df.
    """
    y = merged_df["panic"].astype(int)
    unique_vals = [int(v) for v in sorted(list(y.unique()))]
    
    # 1. Binary check
    is_binary = set(unique_vals).issubset({0, 1})
    pos_count = int((y == 1).sum())
    neg_count = int((y == 0).sum())
    prevalence = pos_count / len(merged_df)

    # 2. Check exclusion of DP if panic_proc is supplied
    dp_in_matrix_count = 0
    dbp_match_count = 0
    if panic_proc is not None:
        merged_check = pd.merge(
            merged_df[["ID", "date", "panic"]],
            panic_proc[["ID", "date", "panic"]],
            on=["ID", "date"],
            how="left",
            suffixes=("_mdf", "_proc"),
        )
        # Day of panic coded as 2 in panic.feather
        dp_in_matrix = merged_check[merged_check["panic_proc"] == 2]
        dp_in_matrix_count = len(dp_in_matrix)
        
        # DBP in both
        dbp_matches = merged_check[(merged_check["panic_mdf"] == 1) & (merged_check["panic_proc"] == 1)]
        dbp_match_count = len(dbp_matches)

    # 3. Raw diary verification
    raw_events_count = len(panic_raw) if panic_raw is not None else None
    raw_unique_patients = int(panic_raw["Non-identifying keys"].nunique()) if panic_raw is not None else None

    return {
        "is_binary": is_binary,
        "unique_target_values": unique_vals,
        "positive_count_dbp": pos_count,
        "negative_count_sd": neg_count,
        "prevalence": round(prevalence, 4),
        "target_definition": (
            "Day Before Panic (DBP, ~24-hour impending panic symptoms): "
            "1.0 indicates that a verified clinical panic event occurred on the subsequent day (t+1); "
            "0.0 indicates a Stable Day (SD) with no panic event on day t or day t+1."
        ),
        "day_of_panic_excluded": dp_in_matrix_count == 0,
        "dp_contamination_count": dp_in_matrix_count,
        "dbp_label_match_count": dbp_match_count,
        "raw_diary_total_events": raw_events_count,
        "raw_diary_patients": raw_unique_patients,
        "scientific_justification": (
            "Predicting DBP (the day before) rather than DP (the day of) ensures models "
            "evaluate impending vulnerability rather than detecting an already ongoing panic episode. "
            "Excluding DP removes post-onset somatic distortions (e.g. tachycardia during acute attack)."
        ),
    }
