# AnxietyTwin ML Audit Report (Phase 1 & Phase 2)

## Executive Summary
This report documents the rigorous baseline audit of the AnxietyTwin machine learning pipeline, data artifacts, target label definitions, and model dependencies.

---

## 1. Dataset Loading and Preprocessing
- **Source Analytical Matrix**: [`data/processed/merged_df.feather`](../../data/processed/merged_df.feather)
- **Rows**: 3,969 daily participant records across 43 adult outpatients.
- **Columns**: 71 (2 identifiers: `ID`, `date`; 1 binary target: `panic`; 68 features).
- **Previous Preprocessing Defect**:
  - Missing numeric values were uniformly coerced via `.fillna(0.0)`.
  - Replacing missing physiological measurements with zero imputed physiologically impossible signals (e.g. Heart Rate = 0 bpm).
  - Repaired by implementing training-fold `SimpleImputer(strategy='median')` wrapped in scikit-learn Pipelines.

---

## 2. Target-Label Construction
- **Target Column**: `panic`
- **Semantics**:
  - `1.0` = **Day Before Panic (DBP)**: Indicates that a documented, clinically verified panic episode occurred on the subsequent calendar day ($t+1$).
  - `0.0` = **Stable Day (SD)**: Indicates that no panic attack occurred on day $t$ or day $t+1$.
- **Day of Panic (DP) Exclusion**:
  - Days where a panic episode actually occurred (coded as `panic == 2` in [`data/processed/panic.feather`](../../data/processed/panic.feather)) are **completely excluded** from the modeling matrix.
  - Verification: Cross-tabulation confirmed exactly 0 rows with `panic_proc == 2` exist in `merged_df.feather`.
  - Scientific justification: Distinguishes *impending vulnerability* from acute attack detection and avoids tachycardia post-onset distortion.
- **Class Distribution**:
  - 254 positive DBP events (6.40% prevalence).
  - 3,715 negative Stable Days (93.60% prevalence).
  - Severe class imbalance ratio: 14.63 : 1.

---

## 3. Participant Identifiers & Temporal Alignment
- **Unique Participants**: 43 adult outpatients with mood and anxiety disorders (Chungnam National University Sejong Hospital & Korea University Anam Hospital).
- **Date Range**: 2021-05-14 to 2023-12-16.
- **Participant Positive Event Concentration**:
  - 24 of 43 participants (55.8%) experienced **0 panic events** during the study.
  - Only 19 participants ever experienced a panic episode.
  - The top 5 participants accounted for 194 of 254 positive events (**76.38% of all positive labels**).

---

## 4. Modality Categorization (66 Input Features)
1. **Static Trait Fingerprints (19 features)**:
   - Baseline clinical questionnaires: `BRIAN`, `CSM`, `CTQ_1` to `CTQ_5`, `KRQ`, `MDQ`, `SPAQ_1`, `SPAQ_2`, `STAI_X2`.
   - Sociodemographics: `biological_sex`, `marriage`, `job`, `smkHx`, `drinkHx`, `suicideHx`, `suicide_need`.
   - *Audit Finding*: Every single one of the 43 participants possesses a 100% unique combination of these 19 static traits.
2. **Ultra-Sparse Periodic Questionnaires (12 features with >97% zero-fills)**:
   - `BFNE` (99.7%), `SADS` (99.7%), `KOSSSF` (99.1%), `ACQ` (98.9%), `BSQ` (98.9%), `CES_D` (98.9%), `APPQ_1-3` (97.8%), `STAI_X1` (97.5%), `PHQ_9` (97.2%), `GAD_7` (97.8%).
3. **Dynamic Continuous Wearable Features (24 features)**:
   - Heart rate aggregates: `HR_mean`, `HR_max`, `HR_var`, `HR_hvar_mean`.
   - Physical activity: `steps_mean`, `steps_maximum`, `foot_var`, `steps_hvar_mean`.
   - Circadian Cosinor parameters: `HR_acrophase`, `HR_amplitude`, `HR_mesor`, and 1-day/2-day differences.
   - Spectral bandpowers (4 frequency bands).
   - Sleep: `sleep_duration`, `sleep_onset_time`, `sleep_out_time`.
4. **Dynamic Smartphone Daily Logs (11 features)**:
   - Lifestyle: `alcohol`, `coffee`, `smoking`, `exercise`, `menstruation`.
   - Daily subjective mood ratings: `anxiety`, `annoying`, `positive_feeling`, `negative`, `positive_E`, `negative_E`.
