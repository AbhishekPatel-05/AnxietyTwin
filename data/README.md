# AnxietyTwin Dataset Documentation

## Overview
This directory contains the prospective digital phenotyping dataset originally presented in:

> **Jang, S., Sun, T.H., Shin, S. et al.**  
> *A digital phenotyping dataset for impending panic symptoms: a prospective longitudinal study.*  
> **Scientific Data (Nature)** 11, 1264 (2024).  
> DOI: [10.1038/s41597-024-04147-6](https://doi.org/10.1038/s41597-024-04147-6)  
> Repository & Code: [DigitalHealthcareLab/24PanicPrediction](https://github.com/DigitalHealthcareLab/24PanicPrediction)  
> License: **Creative Commons Attribution 4.0 International (CC BY 4.0)**

---

## Directory Structure

```
data/
├── raw/                      # 46 raw Excel files (.xlsx)
│   ├── 1 Screening for depression.xlsx ... 32 Depression.xlsx
│   ├── Basic research participation information.xlsx
│   ├── Dailylog-Message sending history.xlsx
│   ├── Diary.xlsx & Emotion Diary.xlsx
│   ├── Lifestyle - Caffeine.xlsx
│   ├── Lifestyle - Drinking.xlsx
│   ├── Lifestyle - Heart rate.xlsx
│   ├── Lifestyle - Sleep.xlsx
│   ├── Lifestyle - Step count.xlsx
│   ├── Panic Diary.xlsx
│   └── Project Information.xlsx
└── processed/                # 21 processed data tables (.feather)
    ├── merged_df.feather     # Primary multimodal analytical matrix (3,969 days, 71 features)
    ├── panic.feather         # DBP label events table
    ├── HR_date.feather       # Daily aggregated heart rate parameters
    ├── sleep.feather         # Sleep duration and timing
    ├── foot_date.feather     # Daily step counts
    ├── coffee_date.feather   # Daily caffeine intake
    ├── demographic_data.feather # Baseline clinical/socio-demographics
    └── questionnaire_*.feather
```

---

## Primary Modeling Matrix: `merged_df.feather`
- **Total Rows**: 3,969 daily participant records
- **Total Patients**: 43 adult outpatients with mood and anxiety disorders
- **Target Variable**: `panic` (1.0 = Day Before Panic [DBP], 0.0 = Stable Day [SD])
- **Prevalence**: 254 positive events (6.40%), 3,715 stable days (93.60%)
- **Missing Data**: 0 missing values (fully imputed/normalized in processed matrix)

## Data Protection Notice
Participant-level health records are de-identified under IRB approvals (Chungnam National University Sejong Hospital 2020-12-016-007; Korea University Anam Hospital 2022AN0493). In accordance with clinical safety principles, participant-level records are never exposed in application logs.
