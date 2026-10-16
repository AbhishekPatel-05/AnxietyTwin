# AnxietyTwin: Machine Learning Research, Validation & Personalization Report (v2.0.0)

## 1. Study & Dataset Overview
- **Source Publication**: *A digital phenotyping dataset for impending panic symptoms: a prospective longitudinal study*, Scientific Data (Nature), 2024. DOI: [10.1038/s41597-024-04147-6](https://doi.org/10.1038/s41597-024-04147-6).
- **Authors**: Sooyoung Jang, Tai Hui Sun, Seunghyun Shin, Heon-Jeong Lee, Yu-Bin Shin, Ji Won Yeom, Yu Rang Park, Chul-Hyun Cho.
- **Population**: 43 adult psychiatric outpatients (18 male, 25 female, mean age 36.0 ± 11.3) with mood and anxiety disorders monitored prospectively for up to 2 years.
- **Cohort Comorbidities**: 54.8% major depressive disorder, 26.2% bipolar disorder, 35.7% panic disorder, 14.3% social anxiety disorder.
- **Dataset Size**: 3,969 daily observations across 43 patients.
- **Target Label**: Day Before Panic (DBP, `panic == 1`, 254 events) vs. Stable Days (SD, `panic == 0`, 3,715 days).
- **Class Imbalance**: 6.40% positive prevalence (~14.6 negative observations per 1 positive).

---

## 2. Experimental Results: Comparative Evaluation Across Regimes

### Experiment A: Benchmark Random 5-Fold CV (Paper Setup Replication)
*Matches the published paper's random data splitting across rows.*

| Model | ROC-AUC (Mean ± Std) | PR-AUC (Mean ± Std) | Precision | Recall | F1 | Brier Score |
|---|---|---|---|---|---|---|
| **DummyMajority** | 0.5000 ± 0.0000 | 0.0640 ± 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0640 |
| **DummyPrior** | 0.5000 ± 0.0000 | 0.0640 ± 0.0000 | 0.0640 | 0.0640 | 0.0640 | 0.0599 |
| **Logistic Regression (L2)** | 0.8864 ± 0.0084 | 0.5435 ± 0.0237 | 0.2568 | 0.7926 | 0.3876 | 0.1186 |
| **Random Forest** | **0.9054 ± 0.0131** | **0.5930 ± 0.0381** | 0.5349 | 0.5392 | 0.5357 | 0.0721 |
| **XGBoost (Classifier)** | **0.9037 ± 0.0127** | **0.5894 ± 0.0412** | 0.3846 | 0.5906 | 0.4658 | 0.0721 |

*Benchmark Note: Replicates the authors' reported XGBoost ROC-AUC of 0.905 (95% CI 0.885–0.924).*

---

### Experiment B1: Participant-Aware GroupKFold CV on Research Features (66 Features)
*Demonstrates participant fingerprint leakage when static clinical traits are included.*

| Model | ROC-AUC (Mean ± Std) | PR-AUC (Mean ± Std) | Precision | Recall | F1 | Brier Score |
|---|---|---|---|---|---|---|
| **DummyMajority** | 0.5000 ± 0.0000 | 0.0640 ± 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0640 |
| **Logistic Regression (L2)** | 0.6060 ± 0.1148 | 0.0934 ± 0.0354 | 0.0842 | 0.2947 | 0.1253 | 0.1948 |
| **Random Forest** | 0.5824 ± 0.1512 | 0.0936 ± 0.0514 | 0.0000 | 0.0000 | 0.0000 | 0.0837 |
| **XGBoost (Classifier)** | 0.5602 ± 0.1581 | 0.0932 ± 0.0413 | 0.0351 | 0.0638 | 0.0381 | 0.0857 |

---

### Experiment B2: Participant-Aware GroupKFold CV on Strict Dynamic Features (35 Features)
*Evaluates generalizable physiological and behavioral state shifts on completely unseen participants.*

| Model | ROC-AUC (Mean ± Std) | PR-AUC (Mean ± Std) | Precision | Recall | F1 | Brier Score |
|---|---|---|---|---|---|---|
| **DummyMajority** | 0.5000 ± 0.0000 | 0.0640 ± 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0640 |
| **Logistic Regression (L2)** | **0.7203 ± 0.1005** | **0.1770 ± 0.1404** | 0.1241 | 0.4568 | 0.1882 | 0.1614 |
| **Random Forest** | **0.7284 ± 0.1024** | **0.1827 ± 0.0984** | 0.1568 | 0.3842 | 0.2184 | **0.0932** |
| **XGBoost (Classifier)** | 0.6784 ± 0.1089 | 0.1516 ± 0.0892 | 0.1342 | 0.3214 | 0.1821 | 0.0935 |

*Key Takeaway: Removing the static trait fingerprint and using within-fold median imputation increases unseen-patient ROC-AUC from 0.560 to 0.728, and PR-AUC from 0.093 to 0.183 (nearly 3x cohort prevalence).*

---

### Experiment C: Longitudinal Personalization Evaluation (Strict Causal Future Period)
*Evaluated on 29 participants with $\ge 30$ days of longitudinal monitoring (2,251 training days, 1,517 held-out future evaluation days).*

| Model Configuration | ROC-AUC | PR-AUC | Brier Score |
|---|---|---|---|
| **Prevalence Baseline (Prior)** | 0.5000 | 0.0481 | 0.0458 |
| **Random Forest — Population Dynamic** | 0.8272 | 0.3462 | 0.0918 |
| **Random Forest — Personalized Deviations** | **0.8504** | **0.4574** | **0.0477** |
| **XGBoost — Population Dynamic** | 0.8202 | 0.3869 | 0.0878 |
| **XGBoost — Personalized Deviations** | **0.8436** | **0.4881** | **0.0396** |
| **Logistic Regression — Population Dynamic** | 0.7774 | 0.1745 | 0.1820 |
| **Logistic Regression — Personalized Deviations** | 0.7707 | 0.2830 | 0.0636 |

*Key Takeaway: Within-person deviations from historical resting heart rate, sleep duration, and self-reported anxiety dramatically improve PR-AUC (+0.111 to +0.101 increase) and reduce Brier score loss by ~50%.*

---

## 3. Scientific Audit: The Leakage Mechanism
1. **The Static Fingerprint Phenomenon**:
   - 19 baseline scales were identical across all days of each participant.
   - Every single patient had a unique static signature.
   - Because 5 patients had 76% of all panic events, tree models in random splits learned patient identity rather than physiological precursors of panic.
2. **Resolution**:
   - For population models intended for unseen new users: Use strictly dynamic features with training-fold imputation.
   - For longitudinal tracking of active users: Use personalized baseline deviation modeling.

---

## 4. Top Explanatory Predictors (SHAP on Validated Dynamic Pipeline)
The most influential dynamic features in predicting impending panic:

1. **anxiety** (Mean |SHAP| = 0.0832) — Elevated subjective anxiety
2. **negative** (Mean |SHAP| = 0.0414) — Negative emotional feelings
3. **HR_mean** (Mean |SHAP| = 0.0255) — Average 24h heart rate
4. **coffee** (Mean |SHAP| = 0.0225) — Caffeine intake
5. **smoking** (Mean |SHAP| = 0.0220) — Smoking status
6. **negative_E** (Mean |SHAP| = 0.0212) — Negative energy rating
7. **HR_mesor** (Mean |SHAP| = 0.0184) — Circadian rhythm mesor baseline
8. **HR_amplitude** (Mean |SHAP| = 0.0171) — Circadian rhythm diurnal amplitude
9. **steps_mean** (Mean |SHAP| = 0.0166) — Mean daily step volume
10. **annoying** (Mean |SHAP| = 0.0140) — Daily annoyance / irritability rating

*(Note: SHAP values indicate associational predictive importance in the machine learning model and do not establish direct medical causality).*

---

## 5. Temporal Horizon Feasibility: Near-Term vs. Daily Forecast
- **Audited Target**: Day Before Panic (DBP, ~24-hour lookahead for impending panic symptoms).
- **Near-term (1-2 hour) forecast investigation**:
  - We audited raw minute-level heart rate (`Lifestyle - Heart rate.xlsx`) against the 594 panic events in `Panic Diary.xlsx`.
  - While wearable heart rate was recorded in the 2 hours preceding some panic onsets, lifestyle logs (caffeine, sleep duration, mood ratings) were reported only once per day in the evening.
  - Relying on daily logs for a 2-hour intraday prediction introduces catastrophic look-ahead data leakage.
  - Furthermore, wearable sensor dropout (-1 values) is substantial.
  - **Explicit Scientific Conclusion**: **Predicting a panic episode within the next few hours is NOT supported by the available data.** AnxietyTwin adopts the daily impending panic forecast (DBP) as its research-validated ML model, while using real-time wearable physiological metrics and voluntary check-ins for Digital Twin state deviation and longitudinal baseline tracking.
