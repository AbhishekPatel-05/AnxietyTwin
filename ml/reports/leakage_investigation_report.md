# AnxietyTwin Data Leakage Investigation Report (Phase 3)

## 1. Executive Summary
A comprehensive statistical and algorithmic investigation was performed to identify why the published study reported an XGBoost ROC-AUC of ~0.905 under random cross-validation, while participant-aware GroupKFold evaluation collapsed to ~0.560.

**Core Discovery**:
The drop was primarily caused by **Participant Identity Fingerprint Leakage** facilitated by static clinical questionnaires. Under random splitting, static trait combinations allowed tree ensembles to recognize individual patients across repeated longitudinal records and predict their historical event rate, rather than learning generalizable temporal precursors of panic.

When evaluated strictly on dynamic physiological and behavioral variables with training-fold imputation, **unseen participant generalization (GroupKFold) rose from 0.560 to 0.728 ROC-AUC**.

---

## 2. Leakage Analysis by Category

### A. Participant Leakage (Critical Severity)
- **Mechanism**:
  - The cohort contains 43 participants contributing an average of ~92 longitudinal days each.
  - 19 features (e.g. Childhood Trauma Questionnaire `CTQ_1-5`, `STAI_X2`, `BRIAN`, `marriage`, `suicide_need`) are static traits collected once at intake and repeated identically across all days of that participant.
  - Across the 43 patients, there are 43 completely unique combinations of these 19 static traits (100% uniqueness).
  - 24 of 43 patients never experienced panic, while 5 patients accounted for 76.4% of all positive labels (including one patient with 71 panic events in 74 days, 95.9% positive).
- **Empirical Proof**:
  - Training an XGBoost classifier using **ONLY the 19 static traits** (with zero wearable data, zero sleep, zero mood) under Random 5-Fold CV achieved an **ROC-AUC of 0.9101 ± 0.0098**!
  - When that exact same static trait model was evaluated under GroupKFold (unseen patients), performance dropped to **ROC-AUC 0.4295 ± 0.1240** (worse than random guessing).
  - *Conclusion*: In random splits, the model used static traits as a hash table lookup for participant identity.

### B. Temporal Leakage (Moderate Severity)
- **Audit Findings**:
  - Circadian differences (`HR_acrophase_difference`, `HR_acrophase_difference_2d`) were verified against chronological formulas. The difference was computed as $t - (t-1)$ (previous day), not $(t+1) - t$. No forward temporal look-ahead leakage exists in circadian features.
  - Sleep duration and sleep timing (`sleep_duration`, `sleep_onset_time`, `sleep_out_time`) reflect the sleep that completed during Day $t$.
  - Evening mood logs (`anxiety`, `annoying`, `negative_feeling`, etc.) are submitted once daily in the evening of Day $t$.
  - **Availability Cutoff**: Because evening logs and 24-hour wearable statistics require the full day, the prediction cutoff is established at **End-of-Day $t$ (Bedtime / 23:59)** predicting the subsequent 24-hour calendar day $t+1$ (Day Before Panic).
  - Intraday prediction (e.g. predicting 1-2 hours ahead) is temporally invalid with this dataset because lifestyle logs are collected only in the evening.

### C. Label Leakage (Verified Clean)
- **Audit Findings**:
  - No features are derived from the panic diary itself (`Panic Diary.xlsx`).
  - Days of panic (DP) are strictly purged from `merged_df.feather`, ensuring that somatic symptoms from an acute attack are not present in predictors.

### D. Preprocessing Leakage (Repaired)
- **Defect in Phase 1**:
  - Missing values were previously zero-filled globally across all rows before splitting.
  - In linear models, global standardization parameters could influence feature weights across folds.
- **Repair in Phase 2**:
  - All preprocessing is encapsulated within scikit-learn `Pipeline` objects.
  - `SimpleImputer(strategy='median')` and `StandardScaler` are fitted strictly on training fold indices and applied to held-out test folds without refitting.

### E. Duplicate and Overlap Checks (Clean)
- No duplicate `(ID, date)` records exist in `merged_df.feather` (3,969 unique pairs).
- Zero participant records cross fold boundaries in GroupKFold evaluation.
