"""
AnxietyTwin - Dataset Inspection & Leakage Audit Script
Executes thorough audit of data/raw, data/processed, target labels, static fingerprints,
and temporal structures.
"""

import os
import sys
import json
import pandas as pd
import numpy as np

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from ml.src.data_loading import (
    load_dataset,
    load_processed_panic_table,
    load_raw_panic_diary,
    get_dataset_summary,
)
from ml.src.target_construction import verify_target_semantics
from ml.src.feature_engineering import (
    STATIC_TRAIT_COLUMNS,
    DYNAMIC_FEATURE_COLUMNS,
    SPARSE_CLINICAL_COLUMNS,
)


def run_inspection() -> dict:
    print("=" * 60)
    print("ANXIETYTWIN ML AUDIT: DATASET & TARGET VERIFICATION")
    print("=" * 60)

    # 1. Load data
    mdf = load_dataset()
    panic_proc = load_processed_panic_table()
    panic_raw = load_raw_panic_diary()

    summary = get_dataset_summary(mdf)
    print(f"Loaded merged analytical matrix: {summary['total_rows']} rows, {summary['total_columns']} cols")
    print(f"Unique participants: {summary['unique_participants']}")
    print(f"Target distribution: {summary['positive_label_count']} DBP (pos), {summary['negative_label_count']} SD (neg)")
    print(f"Date range: {summary['date_min']} to {summary['date_max']}")

    # 2. Target Semantics
    target_audit = verify_target_semantics(mdf, panic_proc=panic_proc, panic_raw=panic_raw)
    print("\n--- Target Verification ---")
    print(f"Target binary: {target_audit['is_binary']}")
    print(f"Day of Panic (DP) excluded: {target_audit['day_of_panic_excluded']} (count in matrix = {target_audit['dp_contamination_count']})")
    print(f"Raw diary total events: {target_audit['raw_diary_total_events']} across {target_audit['raw_diary_patients']} patients")

    # 3. Static trait fingerprinting check
    if "biological_sex" not in mdf.columns and "age" in mdf.columns:
        mdf["biological_sex"] = (mdf["age"] == "M").astype(int)

    static_cols = [c for c in STATIC_TRAIT_COLUMNS if c in mdf.columns]
    pt_static = mdf.groupby("ID")[static_cols].first()
    unique_profiles = len(pt_static.drop_duplicates())
    print("\n--- Participant Fingerprint Check ---")
    print(f"Total participants: {len(pt_static)}")
    print(f"Unique static trait profiles: {unique_profiles} / {len(pt_static)}")
    print(f"Fingerprint uniqueness: {unique_profiles == len(pt_static)} (Static traits uniquely hash patient identity!)")

    # 4. Distribution of positive events across participants
    panic_by_p = mdf.groupby("ID")["panic"].agg(["count", "sum"]).sort_values("sum", ascending=False)
    pts_with_zero = int((panic_by_p["sum"] == 0).sum())
    top5_pos = int(panic_by_p["sum"].head(5).sum())
    top5_pct = round(top5_pos / max(1, summary["positive_label_count"]) * 100, 2)
    print(f"Participants with 0 positive events: {pts_with_zero} / {len(pt_static)}")
    print(f"Top 5 participants account for {top5_pos} / {summary['positive_label_count']} positive events ({top5_pct}%)")

    # 5. Missingness and zero rates
    zero_rates = {}
    for col in mdf.columns:
        if col not in ["ID", "date"]:
            s = pd.to_numeric(mdf[col], errors="coerce")
            zero_rates[col] = round(float((s == 0).mean() * 100), 2)

    high_zero_cols = {k: v for k, v in zero_rates.items() if v > 80}
    print(f"\nFeatures with >80% zeros ({len(high_zero_cols)} features):")
    for k, v in sorted(high_zero_cols.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"  {k:30s}: {v}% zeros")

    audit_results = {
        "dataset_summary": summary,
        "target_verification": target_audit,
        "static_fingerprint_check": {
            "participant_count": len(pt_static),
            "unique_profiles_count": unique_profiles,
            "static_columns_count": len(static_cols),
            "static_fingerprinting_confirmed": unique_profiles == len(pt_static),
        },
        "class_concentration": {
            "participants_with_zero_positives": pts_with_zero,
            "top_5_participants_positive_events": top5_pos,
            "top_5_participants_percentage": top5_pct,
        },
        "high_zero_features": high_zero_cols,
    }

    # Save audit report JSON
    os.makedirs("ml/reports", exist_ok=True)
    with open("ml/reports/dataset_audit.json", "w", encoding="utf-8") as f:
        json.dump(audit_results, f, indent=2)

    print("\nSaved inspection results to 'ml/reports/dataset_audit.json'.")
    return audit_results


if __name__ == "__main__":
    run_inspection()
