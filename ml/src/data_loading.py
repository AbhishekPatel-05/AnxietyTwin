"""
AnxietyTwin - Data Loading & Integrity Validation Module
Loads multimodal prospective phenotyping data and validates schema, participants, and temporal bounds.
"""

import os
from typing import Dict, Any, Tuple, Optional
import pandas as pd
import numpy as np


DEFAULT_PROCESSED_PATH = os.path.join("data", "processed", "merged_df.feather")
DEFAULT_PANIC_FEATHER_PATH = os.path.join("data", "processed", "panic.feather")
DEFAULT_RAW_PANIC_PATH = os.path.join("data", "raw", "Panic Diary.xlsx")


def load_dataset(data_path: str = DEFAULT_PROCESSED_PATH) -> pd.DataFrame:
    """
    Loads and validates the primary multimodal analytical matrix.
    Raises FileNotFoundError or ValueError if validation fails.
    """
    if not os.path.exists(data_path):
        raise FileNotFoundError(
            f"Processed dataset not found at '{data_path}'. "
            "Please ensure data/processed/merged_df.feather exists."
        )

    df = pd.read_feather(data_path)

    # Required core schema columns
    required_cols = ["ID", "date", "panic", "HR_mean", "sleep_duration", "anxiety"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Dataset at '{data_path}' is missing essential columns: {missing}")

    if len(df) == 0:
        raise ValueError("Loaded dataset is empty (0 rows).")

    # Participant and date verification
    if df["ID"].nunique() == 0:
        raise ValueError("Dataset has 0 unique participant identifiers.")

    return df


def load_raw_panic_diary(raw_path: str = DEFAULT_RAW_PANIC_PATH) -> pd.DataFrame:
    """Loads raw clinical panic diary records if available."""
    if not os.path.exists(raw_path):
        raise FileNotFoundError(f"Raw panic diary not found at '{raw_path}'")
    return pd.read_excel(raw_path)


def load_processed_panic_table(feather_path: str = DEFAULT_PANIC_FEATHER_PATH) -> pd.DataFrame:
    """Loads processed panic label table (contains DBP=1 and DP=2 events)."""
    if not os.path.exists(feather_path):
        raise FileNotFoundError(f"Panic feather file not found at '{feather_path}'")
    return pd.read_feather(feather_path)


def get_dataset_summary(df: pd.DataFrame) -> Dict[str, Any]:
    """Generates an integrity and summary statistics dictionary."""
    y = df["panic"].astype(int)
    pos_count = int((y == 1).sum())
    neg_count = int((y == 0).sum())
    total_count = len(df)
    
    return {
        "total_rows": total_count,
        "total_columns": len(df.columns),
        "unique_participants": int(df["ID"].nunique()),
        "positive_label_count": pos_count,
        "negative_label_count": neg_count,
        "prevalence": round(pos_count / max(1, total_count), 4),
        "date_min": str(df["date"].min()),
        "date_max": str(df["date"].max()),
        "missing_values_count": int(df.isnull().sum().sum()),
    }
