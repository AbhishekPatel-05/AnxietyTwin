# AnxietyTwin — AI-Powered Personalized Anxiety Monitoring and Digital Twin Platform

[![Python 3.13](https://img.shields.io/badge/Python-3.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-teal.svg)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![TypeScript 6](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind-4.3-38B2AC.svg)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/Software_License-MIT-yellow.svg)](LICENSE)
[![Dataset License: CC BY 4.0](https://img.shields.io/badge/Dataset_License-CC%20BY%204.0-green.svg)](https://creativecommons.org/licenses/by/4.0/)

> **Investigational Healthcare Prototype Notice:** AnxietyTwin is a research prototype and supportive digital wellness platform. It does **not** provide medical diagnoses, treatment recommendations, clinical decisions, or guarantees of panic attack prevention. If you or someone you know is experiencing acute distress, call or text the Suicide & Crisis Lifeline at **988** (US/Canada), call **111** (UK), or visit [findahelpline.com](https://findahelpline.com) for 24/7 free, confidential crisis support.

---

## Table of Contents
- [1. Submission Information & Metadata](#1-submission-information--metadata)
  - [1.1 Public GitHub Repository](#11-public-github-repository)
  - [1.2 Team Details](#12-team-details)
  - [1.3 College / Incubator Information](#13-college--incubator-information)
  - [1.4 Project Title & Overview](#14-project-title--overview)
- [2. Problem Statement & Motivation](#2-problem-statement--motivation)
- [3. Healthcare Use Case & Clinical Context](#3-healthcare-use-case--clinical-context)
- [4. System Architecture & Technical Stack](#4-system-architecture--technical-stack)
  - [4.1 System Architecture Diagram](#41-system-architecture-diagram)
  - [4.2 Comprehensive Technical Stack](#42-comprehensive-technical-stack)
  - [4.3 Architecture Document (PDF)](#43-architecture-document-pdf)
- [5. AI/ML Subsystem & Methodological Rigor](#5-aiml-subsystem--methodological-rigor)
  - [5.1 Research Dataset & Prospective Cohort](#51-research-dataset--prospective-cohort)
  - [5.2 The Leakage Discovery: Why Population Models Fail](#52-the-leakage-discovery-why-population-models-fail)
  - [5.3 Predictive ML Pipeline & Experimental Benchmarks](#53-predictive-ml-pipeline--experimental-benchmarks)
  - [5.4 Digital Twin Simulation Engine vs. Predictive ML](#54-digital-twin-simulation-engine-vs-predictive-ml)
  - [5.5 Conversational Clinical AI Copilot & Grounded RAG](#55-conversational-clinical-ai-copilot--grounded-rag)
- [6. Implemented Features & Application Workspaces](#6-implemented-features--application-workspaces)
- [7. Project Presentation (PDF)](#7-project-presentation-pdf)
- [8. Demonstration Video](#8-demonstration-video)
- [9. Repository Structure](#9-repository-structure)
- [10. Installation & Setup Guide](#10-installation--setup-guide)
  - [10.1 Prerequisites](#101-prerequisites)
  - [10.2 Option A: Docker Compose Deployment (Recommended)](#102-option-a-docker-compose-deployment-recommended)
  - [10.3 Option B: Local Native Setup (Development)](#103-option-b-local-native-setup-development)
- [11. Environment Variables Configuration](#11-environment-variables-configuration)
- [12. Automated Testing & Verification Suite](#12-automated-testing--verification-suite)
- [13. Visual Assets & Recommended Evaluation Walkthrough](#13-visual-assets--recommended-evaluation-walkthrough)
- [14. Limitations, Safety & Responsible AI Governance](#14-limitations-safety--responsible-ai-governance)
- [15. Open-Source License & Third-Party Attributions](#15-open-source-license--third-party-attributions)
- [16. Contact & Project Maintenance](#16-contact--project-maintenance)

---

## 1. Submission Information & Metadata

### 1.1 Public GitHub Repository
- **Repository URL:** [https://github.com/AbhishekPatel-05/AnxietyTwin](https://github.com/AbhishekPatel-05/AnxietyTwin)
- **Repository Visibility:** Public
- **Git Branch:** `main`

> *Evaluator Note:* This repository has been structured, sanitized, and initialized with zero tracked local secrets, machine-specific paths, or build caches. See [Installation & Setup](#10-installation--setup-guide) to run the full stack locally or via Docker.

### 1.2 Team Details
- **Submission Type:** Individual
- **Team Name:** Team Nexus
- **Team Members & Roles:**
  - **Abhishek Patel** — Lead Full-Stack & ML Systems Engineer

### 1.3 College / Incubator Information
- **Institution / University:** UNIVERSITY OF CALCUTTA
- **Department:** INFORMATION TECHNOLOGY
- **Incubator / Innovation Hub:** Independent Submission
- **Competition Track:** Happiest Health Digital Twin Challenge 2026

### 1.4 Project Title & Overview
**AnxietyTwin — AI-Powered Personalized Anxiety Monitoring and Digital Twin Platform**

AnxietyTwin is an end-to-end healthcare **Digital Twin** platform for continuous, personalized anxiety support and prospective vulnerability modeling. Rooted in clinical digital phenotyping research ([Jang et al., *Scientific Data / Nature*, 2024](https://doi.org/10.1038/s41597-024-04147-6)), AnxietyTwin replaces static, one-size-fits-all prediction dashboards with a **persistent, evolving virtual patient state**. 

By tracking empirical individual baselines across autonomic arousal (wearable resting heart rate), circadian regularity (sleep timing and duration), and subjective check-ins, the platform detects longitudinal state deviations, models impending 24-hour panic vulnerability, enables counterfactual "what-if" physiological scenario explorations, and provides safe conversational clinical decision support with automated crisis guardrails.

---

## 2. Problem Statement & Motivation

Anxiety and panic disorders affect over 300 million individuals globally, representing one of the leading causes of psychological distress, impaired occupational functioning, and acute emergency room visits. Despite widespread smartphone and wearable ownership, digital mental health support remains fundamentally fractured:

1. **Fragmented & Passive Consumer Apps:** Most commercial wellness apps rely on sporadic, retrospective questionnaire logging (e.g., weekly GAD-7) or generic breathing exercises that lack real-time physiological grounding.
2. **Uncalibrated Population Averages:** Commercial fitness trackers compute arbitrary "stress scores" using generic population heuristics. Because an athlete's resting heart rate of 52 bpm is clinically distinct from a sedentary individual's 78 bpm, population-level averages fail to recognize personal physiological strain.
3. **Black-Box, Alarmist Prediction:** Emerging predictive health apps often present catastrophic alerts ("High risk of panic attack right now!"), inducing anticipatory hypervigilance and exacerbating sympathetic nervous system arousal.
4. **The Research Methodology Gap (Data Leakage):** Published digital phenotyping studies frequently report inflated predictive accuracy (e.g., ROC-AUC > 0.90) by performing random row-level train/test splits. Our empirical audit of the landmark 2024 Nature dataset demonstrated that random splits allow models to **fingerprint static individual traits** (demographics and clinical questionnaires) rather than learning generalized physiological precursors of acute episodes. When evaluated on unseen participants, generic population models collapse to near-chance performance (ROC-AUC ~ 0.58).

**The Solution:** AnxietyTwin addresses these limitations by creating a personalized **Digital Twin**. Instead of forcing patients into generic predictive buckets, the system establishes a personalized rolling baseline for each user, measures multimodal physiological strain deviations, simulates counterfactual interventions, and facilitates consent-governed clinician collaboration.

---

## 3. Healthcare Use Case & Clinical Context

AnxietyTwin is engineered for supportive outpatient monitoring, personal autonomic awareness, and structured clinical collaboration:

| Use Case Module | Clinical Purpose & Intended Workflow | Responsible Health Framing |
| :--- | :--- | :--- |
| **Personal Observations & Check-Ins** | Quick 30-second daily logs capturing subjective distress (0–10), somatic sensations, context tags (work, social, caffeine), and physiological priors. | Non-punitive, longitudinal logging; emphasizes self-compassion and somatic awareness. |
| **Empirical Baseline Tracking** | Continuous rolling computation of individual means and standard deviations for resting HR, HRV (rMSSD), sleep duration, and activity. | Avoids arbitrary population norms; tracks shifts relative to *your* unique personal physiology. |
| **Hypothetical Digital Twin Lab** | Interactive "What-If" simulation laboratory allowing users to perturb single variables (e.g., 2h sleep deficit, 300mg caffeine) to observe projected autonomic strain. | Strictly simulated; educational counterfactuals clearly quarantined from authentic patient records. |
| **Early-Warning Engine** | Rule-based detection of autonomic strain divergence, sleep fragmentation, and consecutive acute check-ins. | Provides supportive, non-alarmist coping recommendations; never claims an event causes panic. |
| **Self-Care & Wellness Goals** | Voluntary habit tracker for evidence-based grounding practices (4-7-8 breathing, progressive muscle relaxation, sleep consistency). | Non-gamified, supportive progress tracking without punitive streak breaks. |
| **Conversational Clinical Copilot** | Context-aware AI assistant integrated into a slide-over drawer, executing session-bound tools to explain baselines and retrieve clinical coping literature. | Intercepts crisis signals immediately with 988 resources; labels all data provenance (`[Authenticated Telemetry]`, `[Platform Spec]`). |
| **Consent-Based Clinician Workspace** | Dedicated portal for authorized psychiatric clinicians to review longitudinal patient trends, assign care coordination tasks, and export comprehensive ReportLab PDFs. | Strict patient sovereignty: 1-click patient grant revocation instantly severs clinician access. |

---

## 4. System Architecture & Technical Stack

### 4.1 System Architecture Diagram

```mermaid
flowchart TB
    subgraph Client["1. Client & Presentation Tier (React 19 + TypeScript + Vite)"]
        Dashboard["Personal Dashboard\n(/dashboard, /twin)"]
        Simulator["Digital Twin Simulator\n(/simulation Lab)"]
        ClinicianUI["Clinician Workspace\n(/clinician Portal)"]
        SelfCare["Self-Care & Privacy Hub\n(/patterns, /goals, /journal)"]
        AssistantUI["Clinical AI Assistant\n(<AIAssistantDrawer />)"]
    end

    subgraph Gateway["2. API Gateway & Security Tier (FastAPI 0.115 + Pydantic v2)"]
        AuthMiddleware["OAuth2 & JWT Auth\nRole-Based Access Control"]
        RouterHub["16 REST Endpoint Routers\n(/api/twin, /api/simulation, etc.)"]
        PrivacyGuard["Consent Grant & Access\nRevocation Guard"]
    end

    subgraph Domain["3. Domain Logic & Digital Twin Engines (Python 3.13)"]
        TwinEngine["DigitalTwinEngine\nEmpirical Baselines & CSI State"]
        EvolutionSvc["EvolutionService\nLongitudinal Drift & Memory Reset"]
        InterventionEng["InterventionEngine\nEarly-Warning Rules & Provenance"]
        ReportLabSvc["Clinical & PDF Service\nDeterministic ReportLab Engine"]
    end

    subgraph ML_Subsystem["4. Machine Learning Subsystem (ml/src)"]
        ProdPipeline["Production Pipeline\nImputer + Scaler + RandomForest"]
        DynamicFeats["35 Strict Dynamic Features\nZero Static Trait Leakage"]
        TargetEngine["24-Hour DBP Target Engine\nDay-of-Panic (DP) Excluded"]
    end

    subgraph AI_RAG["5. Conversational AI & Safety Tier"]
        LLMProvider["Multi-Provider LLM Abstraction\nGemini | OpenAI | Claude | Ollama"]
        GroundedEngine["Grounded Clinical Fallback\nDeterministic Offline RAG (8 Articles)"]
        CrisisGuard["988 Crisis Guardrail\nRegex Interceptor & Safety Hotline"]
    end

    subgraph Persistence["6. Persistence & Storage Layer (PostgreSQL 16 / SQLite)"]
        SQLAlchemy["SQLAlchemy 2.0 ORM\nAutomated Idempotent Migrations"]
        DB[(Multi-Tenant Database\nUsers, Checkins, Observations,\nGrants, Journal, Audit Logs)]
        QuarantinePredicate["Data Provenance Predicate\nMEASURED / REPORTED vs SYNTHETIC"]
    end

    %% Flow Connections
    Client <-->|Secure HTTPS / REST| Gateway
    Gateway --> Domain
    Domain --> ML_Subsystem
    Domain --> AI_RAG
    Domain --> Persistence
    ML_Subsystem -.->|Inference Calibration| Domain
    AI_RAG -.->|Session-Bound Tool Calls| Gateway
    Persistence -.-> QuarantinePredicate
```

### 4.2 Comprehensive Technical Stack

| Layer | Technologies & Libraries | Verified Implementation Details |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 19.2**, **TypeScript 6.0**, **Vite 8.3** | High-performance Single Page Application with strict TypeScript definitions and code-splitting. |
| **Styling & Icons** | **Tailwind CSS 4.3**, **Lucide React 1.54** | Modern responsive healthcare design system with clean visual contrast and accessible semantics. |
| **Data Visualization** | **Recharts 3.10** | Dynamic physiological time-series charts, composite stress gauges, and baseline deviation bands. |
| **Backend Framework** | **FastAPI 0.115**, **Python 3.13**, **Uvicorn** | Async REST API with automatic OpenAPI documentation (`/docs`) and Pydantic v2 request/response schemas. |
| **Database & ORM** | **PostgreSQL 16** (Prod) / **SQLite** (Dev/Test), **SQLAlchemy 2.0** | Relational multi-tenant architecture with idempotent runtime schema migrations (`_run_schema_migrations`). |
| **Authentication** | **OAuth2**, **JWT (JSON Web Tokens)**, **Passlib (bcrypt)** | Role-Based Access Control (`patient` vs `clinician`) with stateless token validation. |
| **Predictive Machine Learning** | **Scikit-learn 1.6**, **XGBoost 2.1**, **Joblib** | Serialized production pipeline (`production_model.joblib`) with training-fold `SimpleImputer` and `StandardScaler`. |
| **Digital Twin Simulation** | **Python 3.13**, **Custom TS Simulation Engine** | Mathematical $z$-score deviation synthesis and counterfactual perturbation modeling with bit-for-bit replay. |
| **AI Assistant & RAG** | **Google Gemini**, **OpenAI**, **Anthropic**, **Ollama**, **Internal RAG** | Pluggable multi-provider LLM interface with deterministic zero-dependency grounded fallback and 8 clinical knowledge articles. |
| **Reporting & Export** | **ReportLab 4.4** | Server-side cryptographic hash-verified PDF export for clinical reviews and weekly summaries. |
| **Testing Suites** | **Pytest 8.3**, **Vitest 5.0**, **Testing Library** | 82 backend pytest tests and 79 frontend Vitest tests (161 automated test cases passing). |
| **Containerization** | **Docker**, **Docker Compose**, **Nginx** | Production multi-container composition orchestrating database, backend, and static frontend proxy. |

### 4.3 Architecture Document (PDF)
A formal, publication-grade architectural blueprint diagram has been rendered and preserved directly in the repository:
- **Architecture Diagram File:** [`docs/AnxietyTwin_Architecture_Diagram.pdf`](docs/AnxietyTwin_Architecture_Diagram.pdf)
- **Format:** Vector PDF (300 DPI, multi-tier layout detailing Presentation, Gateway, Domain, ML, RAG, and Persistence boundaries).

---

## 5. AI/ML Subsystem & Methodological Rigor

### 5.1 Research Dataset & Prospective Cohort
AnxietyTwin is developed and validated against the prospective clinical digital phenotyping dataset published by Jang et al. in *Nature Scientific Data* (2024) ([DOI: 10.1038/s41597-024-04147-6](https://doi.org/10.1038/s41597-024-04147-6)):
- **Clinical Centers:** Department of Psychiatry, Korea University Anam Hospital & Chungnam National University Sejong Hospital.
- **Cohort Size:** 43 adult outpatients (18 male, 25 female, mean age 36.0 ± 11.3 years) diagnosed with mood and anxiety disorders monitored prospectively for up to 2 years.
- **Multimodal Data Stream:** Continuous wearable photoplethysmography (HR, step count, sleep architecture), daily smartphone behavioral logs, clinical diagnostic inventories (PANAS, STAI, ASI), and acute event diaries.
- **Analytical Matrix:** 3,969 daily participant records in `data/processed/merged_df.feather` with 70 feature dimensions.
- **Target Label Semantics:** **Day Before Panic (DBP, `panic == 1`)** — predicting impending vulnerability across a ~24-hour horizon ($t+1$) vs. Stable Days (SD, `panic == 0`, 3,715 days).
- **Day of Panic (DP) Exclusion:** Days on which acute panic episodes occurred (`panic == 2` in raw records) are **strictly excluded** from the modeling matrix. This prevents post-episode tachycardia and severe distress from distorting vulnerability models.
- **Severe Class Imbalance:** 254 positive DBP events (6.40% positive prevalence; 14.63 negative observations per 1 positive event).

### 5.2 The Leakage Discovery: Why Population Models Fail
In the original 2024 publication, the authors reported a high XGBoost ROC-AUC of 0.905. During our engineering audit, we successfully replicated this result using **Random 5-Fold Cross-Validation** (Random Forest ROC-AUC = 0.9054, XGBoost = 0.9037).

However, our rigorous methodological analysis revealed that **random cross-validation causes catastrophic cross-participant data leakage**:
1. Random row-level splitting scatters different days from the *same patient* across both training and test folds.
2. Because static demographic traits and baseline questionnaire scores (e.g., trait anxiety, childhood trauma) do not vary day-to-day, machine learning estimators **memorize participant identities (fingerprinting)** rather than learning physiological precursors of panic.
3. When we evaluated the identical pipeline under **Participant-Aware GroupKFold Cross-Validation** (where all days of a patient are strictly quarantined to a single fold), model performance on unseen participants collapsed:
   - Random Forest on 66 features: ROC-AUC dropped from **0.9054 → 0.5824 ± 0.1512** (PR-AUC = 0.0936).
   - XGBoost on 66 features: ROC-AUC dropped from **0.9037 → 0.5602 ± 0.1581** (PR-AUC = 0.0932).

**The Architectural Pivot:** This empirical finding proved that generic population models cannot reliably predict impending panic in new individuals. To solve this, AnxietyTwin built:
- A **35-Feature Strict Dynamic Modality** that eliminates static demographic and questionnaire fingerprinting.
- An **Individual Digital Twin Engine** that personalizes predictions using the patient's own longitudinal baseline deviations.

### 5.3 Predictive ML Pipeline & Experimental Benchmarks

All models were evaluated under strict, reproducible cross-validation protocols in `ml/scripts/train_pipeline.py`. Serialized predictions are stored in `ml/reports/`:

| Cross-Validation Protocol | Feature Set | Model Architecture | ROC-AUC | PR-AUC | Brier Score | Clinical Interpretation |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **Random 5-Fold CV** *(Paper Replication)* | 66 Features (incl. static traits) | Random Forest | 0.9054 ± 0.0131 | 0.5930 | 0.0721 | Replicates published paper; inflated by participant trait leakage. |
| **Random 5-Fold CV** *(Paper Replication)* | 66 Features (incl. static traits) | XGBoost Classifier | 0.9037 ± 0.0127 | 0.5894 | 0.0721 | Benchmark comparison replicating published 0.905 XGBoost score. |
| **GroupKFold (Unseen Patients)** | 66 Features (with leakage) | Random Forest | 0.5824 ± 0.1512 | 0.0936 | 0.0837 | Demonstrates collapse of population models on new patients. |
| **GroupKFold (Unseen Patients)** | **35 Strict Dynamic Features** | **Random Forest (Production)** | **0.7284 ± 0.1024** | **0.1827** | **0.0932** | **Honest generalized baseline on dynamic wearable & daily logs.** |
| **GroupKFold (Unseen Patients)** | 35 Strict Dynamic Features | Logistic Regression (L2) | 0.7203 ± 0.1005 | 0.1770 | 0.1614 | Highly interpretable generalized linear dynamic benchmark. |
| **Longitudinal Personalization** | **35 Dynamic + Individual Deltas** | **Random Forest (Personalized)** | **0.8504** | **0.4574** | **0.0477** | **Strict causal temporal split ($\ge 30$d history); models baseline shift.** |
| **Longitudinal Personalization** | 35 Dynamic + Individual Deltas | XGBoost (Personalized) | 0.8436 | 0.4881 | 0.0396 | Demonstrates strong predictive gain from individual Digital Twin tracking. |

### 5.4 Digital Twin Simulation Engine vs. Predictive ML
AnxietyTwin maintains a strict architectural boundary between **predictive scoring** and **digital twin simulation**:

```
+-------------------------------------------------------------------------------------------------+
|                                    DIGITAL TWIN ARCHITECTURE                                    |
+---------------------------------------------------------------+---------------------------------+
|                  Predictive ML Subsystem                      |    Adaptive Digital Twin Engine |
+---------------------------------------------------------------+---------------------------------+
| • Goal: Next-day statistical vulnerability scoring (~24h).    | • Goal: Real-time state drift & |
| • Mechanism: RandomForest on 35 dynamic metrics.              |   counterfactual simulation.    |
| • Calibration: Probability output with explicit bounds.       | • Mechanism: Autonomic z-scores |
| • Horizon: Evaluated strictly at Day Before Panic (DBP).      |   against rolling empirical     |
| • Scope: Population baseline & longitudinal deviation model.  |   individual mean & variance.   |
| • Non-Imminent: NEVER predicts next-hour panic attacks.       | • Composite Stress Index (CSI). |
|                                                               | • Bit-for-bit replay & PDF.     |
+---------------------------------------------------------------+---------------------------------+
```

- **Composite Stress Index (CSI):** A deterministic, explainable composite formula synthesizing:
  $$\text{CSI} = 0.40 \times \text{Autonomic Strain } (z_{\text{HR}}) + 0.30 \times \text{Circadian Disruption } (\Delta_{\text{Sleep}}) + 0.30 \times \text{Subjective Distress } (\text{Check-in})$$
- **Data Provenance Isolation:** Observations are tagged as `MEASURED`, `REPORTED`, or `SYNTHETIC`. Database constraints ensure that simulated scenarios in the Digital Twin Lab can **never** contaminate genuine patient baselines or retrain production ML models.

### 5.5 Conversational Clinical AI Copilot & Grounded RAG
The platform incorporates a conversational clinical AI assistant (`<AIAssistantDrawer />`) powered by an extensible provider interface (`backend/app/services/assistant_service.py`):
1. **Multi-Provider LLM Support:** Seamlessly connects to Google Gemini API (`gemini-1.5-pro`), OpenAI (`gpt-4o-mini`), Anthropic Claude (`claude-3-5-sonnet`), or local air-gapped Ollama (`llama3:8b`).
2. **Deterministic Grounded Clinical Fallback:** If API keys are omitted, the assistant automatically and safely defaults to a zero-dependency, local RAG engine.
3. **Clinical Knowledge Base:** Pre-loaded with 8 peer-reviewed clinical summaries covering autonomic regulation, heart rate variability, diaphragmatic breathing physiology, cognitive restructuring, and sleep hygiene.
4. **Session-Bound Tool Execution:** Authenticated backend tools retrieve personal baseline averages, CSI scores, and goal summaries. Tool executions derive patient identity strictly from verified JWT session tokens.
5. **988 Crisis Guardrail:** Immediate regex-based interception of self-harm, suicidal ideation, or extreme acute distress keywords, directly returning emergency hotlines and crisis text lines before model invocation.

---

## 6. Implemented Features & Application Workspaces

AnxietyTwin provides 17 fully functional workspaces and components:

1. **Public Landing Page (`/`):** Clinical background, 2024 Nature study summary, leakage audit highlights, and dual-mode entry.
2. **Registration & Auth (`/register`, `/login`):** Secure password hashing (bcrypt), JWT issuance, and patient vs. clinician role routing.
3. **Onboarding & Baseline Intake (`/onboarding`):** Captures physiological priors, trait anxiety benchmarks, and explicit health/research consent.
4. **Personal Mode Dashboard (`/dashboard`):** Real-time Digital Twin state badge, composite stress gauge, longitudinal charts, quick observation modal, and pending clinician tasks banner.
5. **My Digital Twin (`/twin`):** Comprehensive breakdown of personal baseline averages, current autonomic deltas, and state synthesis math.
6. **Observation History (`/history`):** Chronological audit trail of physiological telemetry and lifestyle logs with provenance tags (`MEASURED`, `REPORTED`, `SYNTHETIC`) and deletion controls.
7. **Anxiety Check-In (`/checkin`):** 0–10 subjective distress slider, somatic symptom selectors, trigger tags, safety lifelines, and integrated 4-7-8 breathing pacer.
8. **Interactive Breathing Pacer (`<BreathingPacer />`):** Visual somatic grounding tool with adjustable 4-7-8 and box-breathing cadences.
9. **Personal Trigger & Pattern Discovery (`/patterns`):** Mathematical correlation discovery across longitudinal records (sleep, caffeine, workload) with non-causal disclosures and relevance feedback.
10. **Personalized Wellness Goals (`/goals`):** Self-care habit tracker for check-ins, sleep consistency, and breathing sessions with supportive, non-punitive progress meters.
11. **Emotion Journal & Qualitative Context (`/journal`):** Private reflection space with structured prompts, mood tags, strict clinician privacy isolation, and consent-gated AI theme synthesis.
12. **Digital Twin Data Quality Center (`/data-quality`):** Complete evidence accounting with observation coverage meters, calibration reliability tiering, and 24h DBP horizon disclosures.
13. **Patient Review & Clinician Workspace (`/clinician`):** Authorized clinician portal featuring patient registries, longitudinal timelines, explainable twin insights, review notes, and care coordination follow-up tasks.
14. **Adaptive Digital Twin Simulation Lab (`/simulation`):** Interactive what-if scenario builder initialized from authentic telemetry or synthetic demo presets (`DEMO-PATIENT-01`), 1-variable counterfactual perturbations, differential formula explainer, and non-destructive memory reset.
15. **Weekly Personal Insights Report (`/weekly-report`):** Multi-dimensional summary of check-ins, distress trends, baseline deviations, and wellness goal achievements with downloadable ReportLab PDF export.
16. **Privacy, Consent & Data Governance Center (`/privacy`):** Granular clinician access grant management with 1-click revocation, full JSON personal archive export, and verified account deletion.
17. **Conversational Clinical AI Assistant (`<AIAssistantDrawer />`):** Context-aware, explainable conversational clinical copilot with tool execution, clinical RAG, and immediate 988 crisis interception.

---

## 7. Project Presentation (PDF)

A comprehensive 19-slide presentation detailing the project's clinical motivation, methodology, architecture, and verification results has been compiled and saved:
- **Presentation File:** [`docs/repaired_AnxietyTwin_Project_Presentation (2).pdf`](<docs/repaired_AnxietyTwin_Project_Presentation (2).pdf>)
- **Format:** Presentation PDF (19 structured slides detailing the problem, prospective cohort, data leakage resolution, decoupled architecture, digital twin engine, clinical workflows, and verification).

---

## 8. Demonstration Video

A comprehensive demonstration video presents the end-to-end platform architecture, machine learning findings, digital twin simulation, and clinical workflows.

- **Demonstration Video URL:** [https://youtu.be/NQzYV4Sl_rw](https://youtu.be/NQzYV4Sl_rw)
- **Video Status:** Verified & Published

### Suggested 15-Minute Demonstration Walkthrough Script
1. **Introduction & Scientific Background (0:00–2:30):** The clinical burden of anxiety, limitations of generic wellness apps, the 2024 Nature dataset, and the discovery of cross-participant trait leakage.
2. **Patient Dashboard & Check-In Workflow (2:30–5:00):** Submitting a daily check-in, using the interactive 4-7-8 breathing pacer, and observing dynamic Composite Stress Index (CSI) updates.
3. **Adaptive Digital Twin & Simulation Lab (5:00–8:00):** Launching `/simulation`, executing counterfactual single-variable perturbations (sleep deficit, caffeine), comparing scenarios, and demonstrating deterministic replay.
4. **Conversational AI Assistant (8:00–10:30):** Opening `<AIAssistantDrawer />`, demonstrating session-bound baseline tool calls, clinical RAG explanations, and triggering the 988 crisis guardrail.
5. **Clinician Collaboration & Care Coordination (10:30–12:30):** Logging in as a clinician, reviewing consented patient telemetry, creating follow-up tasks, and generating the ReportLab clinical summary PDF.
6. **Privacy Sovereignty, Testing Rigor & Conclusion (12:30–15:00):** 1-click clinician grant revocation, JSON data export, reviewing the 161 automated test results, and final competition closing.

---

## 9. Repository Structure

```
Anxiety/
├── .env.example                               # Safe environment configuration template
├── .gitignore                                 # Git ignore rules (protects env, caches, dist, logs)
├── docker-compose.yml                         # Container orchestration (Frontend + Backend + DB)
├── LICENSE                                    # Open-source MIT software license
├── README.md                                  # Complete GitHub submission & technical documentation
│
├── Research Paper/
│   └── s41597-024-04147-6.pdf                 # Foundational Nature Scientific Data (2024) publication
│
├── backend/
│   ├── Dockerfile                             # Container definition for FastAPI backend
│   ├── requirements.txt                       # Backend Python dependencies (FastAPI, scikit-learn, etc.)
│   └── app/
│       ├── main.py                            # FastAPI application entry point & DB bootstrap
│       ├── api/                               # 16 REST API routers (twin, simulation, clinician, etc.)
│       ├── core/                              # Security, JWT, config, database engine
│       ├── models/                            # SQLAlchemy models & Pydantic validation schemas
│       └── services/                          # TwinEngine, MLService, AssistantService, ReportLab
│
├── data/
│   ├── README.md                              # Dataset provenance, schema dictionary, ethics
│   ├── processed/                             # 21 processed study Feather datasets (.feather)
│   └── raw/                                   # 46 original study Excel clinical files (.xlsx)
│
├── docs/
│   ├── AnxietyTwin_Architecture_Diagram.pdf   # Publication-Grade Architecture Diagram (PDF)
│   └── repaired_AnxietyTwin_Project_Presentation (2).pdf # Complete 19-Slide Presentation (PDF)
│
├── frontend/
│   ├── Dockerfile                             # Multi-stage production container build (Vite + Nginx)
│   ├── nginx.conf                             # Nginx reverse proxy & SPA routing configuration
│   ├── package.json                           # Frontend Node dependencies (React 19, Tailwind 4)
│   ├── package-lock.json                      # Locked dependency tree
│   ├── tsconfig*.json                         # TypeScript compiler configurations
│   ├── vite.config.ts                         # Vite build configuration
│   ├── public/                                # Public web assets & SVGs
│   └── src/
│       ├── App.tsx                            # React router configuration
│       ├── main.tsx                           # React DOM mount point
│       ├── components/                        # UI components (Pacer, CrisisBanner, AssistantDrawer)
│       ├── pages/                             # 16 full application pages
│       ├── services/                          # Type-safe API client & PRNG simulation engine
│       ├── types/                             # TypeScript interfaces & domain types
│       └── __tests__/                         # 8 automated Vitest suites (79 tests)
│
├── ml/
│   ├── README.md                              # ML methodology, leakage analysis & reproduction
│   ├── models/                                # Serialized production artifacts & feature metadata
│   ├── reports/                               # Full cross-validation results, audit JSON, SHAP rankings
│   ├── scripts/                               # train_pipeline.py, evaluate_models.py, inspect_dataset.py
│   └── src/                                   # Modular pipeline code (loading, preprocessing, training)
│
├── scripts/
│   ├── verify_final_audit.py                  # End-to-end integration & 8-feature reliability audit
│   ├── verify_demo_journey.py                 # Full interactive demo journey verification
│   ├── verify_interventions_engine_journey.py # Early-warning intervention journey verification
│   ├── verify_phase_6_1_journey.py            # Live scenario engine verification script
│   └── verify_phase_6_2_journey.py            # Clinician workspace decision-support journey script
│
└── tests/                                     # 10 automated pytest suites (82 tests)
    ├── test_backend.py                        # Auth, checkins, CRUD lifecycle, multi-tenant security
    ├── test_twin_engine.py                    # Digital twin engine math, z-scores, baselines
    ├── test_ml_pipeline.py                    # Feature ordering, serialization validity, leakage guards
    ├── test_early_warning_engine.py           # Early warning rules, feedback loop, provenance
    ├── test_ai_assistant.py                   # Conversational assistant & 988 crisis safety guardrail
    ├── test_adaptive_twin_evolution.py        # Counterfactual and longitudinal evolution tests
    ├── test_adaptive_twin_verification.py     # Deterministic replay & provenance quarantine tests
    ├── test_advanced_features.py              # Pattern discovery, goals, journal, and privacy export
    ├── test_phase4_reliability.py             # Multi-tenant data isolation & cold-start tests
    └── test_phase6_2_clinical.py              # Clinician workspace, consent grants, PDF tests
```

---

## 10. Installation & Setup Guide

### 10.1 Prerequisites
- **Python:** 3.11 or 3.13 (Python 3.13.5 verified)
- **Node.js:** v18.0.0 or higher & `npm`
- **Database:** PostgreSQL 14+ (or Docker Compose)
- **Git:** Git 2.30+

---

### 10.2 Option A: Docker Compose Deployment (Recommended)
The fastest and most reproducible way to run the entire verified stack (PostgreSQL + FastAPI Backend + React Frontend):

```bash
# 1. Clone repository and navigate to directory
git clone https://github.com/AbhishekPatel-05/AnxietyTwin.git
cd AnxietyTwin

# 2. Create local environment configuration
cp .env.example .env

# 3. Launch all containerized services
docker-compose up --build
```

**Accessing Services:**
- **Frontend Web Application:** [http://localhost:80](http://localhost:80) (or [http://localhost:3000](http://localhost:3000))
- **FastAPI Backend REST API:** [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Health Check:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

### 10.3 Option B: Local Native Setup (Development)

#### Step 1: Environment Setup
```bash
# Copy safe configuration template
cp .env.example .env
```

#### Step 2: Database Initialization (PostgreSQL)
Ensure PostgreSQL is active on port 5432:
```sql
CREATE DATABASE anxietytwin;
```
*(Note: If PostgreSQL is unavailable, SQLite is automatically supported for local testing by configuring `DATABASE_URL=sqlite:///./anxietytwin.db` in `.env`).*

#### Step 3: Backend Setup (FastAPI)
```bash
# Create and activate Python virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install backend dependencies
pip install -r backend/requirements.txt

# Run ML pipeline reproduction (artifacts are already pre-trained and serialized)
python ml/scripts/train_pipeline.py

# Launch the FastAPI backend server
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Step 4: Frontend Setup (React 19 + Vite)
In a separate terminal:
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```
Open your browser to: **[http://localhost:5173](http://localhost:5173)**.

---

## 11. Environment Variables Configuration

AnxietyTwin uses standard, transparent environment variables configured in `.env`. An explicit `.env.example` file is included with safe defaults:

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `SECRET_KEY` | `replace_with_a_secure_random_string...` | Cryptographic secret used for signing JWT authentication tokens. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` (24 hours) | Expiration window for patient and clinician session tokens. |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/anxietytwin` | PostgreSQL connection string (supports SQLite for local testing). |
| `ML_MODELS_DIR` | `./ml/models` | Path to serialized production scikit-learn artifacts. |
| `PORT` | `8000` | Port for the FastAPI backend server. |
| `FRONTEND_PORT` | `5173` | Port for the Vite frontend development server. |
| `AI_ASSISTANT_PROVIDER` | `grounded_clinical` | Active AI provider (`grounded_clinical` \| `gemini` \| `openai` \| `anthropic` \| `ollama`). |
| `GEMINI_API_KEY` | *(Optional)* | Google Gemini API key if using cloud LLM capabilities. |
| `GEMINI_MODEL` | `gemini-1.5-pro` | Gemini model variant. |
| `OPENAI_API_KEY` | *(Optional)* | OpenAI API key if using GPT-4o-mini. |
| `ANTHROPIC_API_KEY` | *(Optional)* | Anthropic API key if using Claude 3.5 Sonnet. |
| `OLLAMA_BASE_URL` | `http://localhost:11434` *(Optional)* | Local Ollama endpoint for private air-gapped deployments. |

> **Privacy Guarantee:** Zero API keys or secrets are required to run the platform. When `AI_ASSISTANT_PROVIDER=grounded_clinical` is set, the system runs completely offline using internal deterministic clinical RAG.

---

## 12. Automated Testing & Verification Suite

AnxietyTwin includes an extensive regression test suite containing **161 automated test cases** that execute cleanly across backend and frontend environments:

### 12.1 Backend Tests (Pytest — 82 Tests)
Verifies database migrations, authentication, multi-tenant boundaries, Digital Twin mathematical synthesis, machine learning serialization, ReportLab PDF rendering, and AI crisis guardrails:
```bash
# From repository root:
$env:PYTHONPATH="." # Windows PowerShell
pytest tests/ -v
```
**Test Results:** `82 passed, 0 failed in ~55s`

### 12.2 Frontend Component & Lifecycle Tests (Vitest — 79 Tests)
Verifies component mounting, 4-7-8 pacer timers, scenario simulation state updates, drawer lifecycle, and crisis banner rendering:
```bash
cd frontend
npm test
```
**Test Results:** `79 passed, 0 failed in ~60s`

### 12.3 Production Frontend Compilation Check
```bash
cd frontend
npm run build
```
**Result:** `built in ~14s` (`dist/index.html`, minified CSS and JavaScript chunks generated without errors).

### 12.4 End-to-End Clinical Journey & Feature Audit
Validates all 8 newly expanded platform features (pattern discovery, wellness care plan, private journal, data quality center, follow-up care coordination, deterministic simulation replay, date-filtered weekly reports, and verified account deletion):
```bash
python scripts/verify_final_audit.py
```
**Result:** `ALL 8 FEATURES SUCCESSFULLY AUDITED AND VERIFIED END-TO-END!`

---

## 13. Visual Assets & Recommended Evaluation Walkthrough

### 13.1 Platform Visual Identity
The repository includes authentic visual assets in `frontend/src/assets/`:
- **Hero Image:** [`frontend/src/assets/hero.png`](frontend/src/assets/hero.png) (Demonstrating the persistent virtual patient state and composite stress interface).

### 13.2 Recommended Evaluation Journey (Step-by-Step for Judges)
When evaluating the running application, we recommend following this 5-step clinical journey:

1. **Step 1: Explore Public Landing & Scientific Audit (`/`)**
   - Review the Nature (2024) research cohort breakdown and data leakage audit findings.
2. **Step 2: Authenticate & Experience Patient Dashboard (`/login` → `/dashboard`)**
   - Log in using patient credentials or register a new profile.
   - Inspect the **Digital Twin State Card** and **Composite Stress Index (CSI)** gauge.
   - Click **Quick Check-In** (`/checkin`) to rate current distress and engage the **4-7-8 Breathing Pacer**.
3. **Step 3: Test Counterfactual Simulations in Digital Twin Lab (`/simulation`)**
   - Load the `DEMO-PATIENT-01` baseline preset.
   - Adjust sleep deficit (+2.5h) and caffeine (+300mg) sliders to observe live projected CSI changes.
   - Click **Why Did the Digital Twin Change?** to inspect the explainable mathematical differential.
   - Export a **Bit-for-Bit Scenario Comparison PDF**.
4. **Step 4: Engage the Conversational Clinical Copilot (`<AIAssistantDrawer />`)**
   - Click the AI Assistant icon in the navigation bar.
   - Ask: *"Explain how my autonomic baseline is calculated"* to verify session-bound tool execution.
   - Ask: *"What breathing technique helps acute panic?"* to verify Grounded Clinical RAG retrieval.
   - Type an acute phrase (e.g., *"I want to hurt myself"*) to verify immediate **988 Crisis Guardrail interception**.
5. **Step 5: Verify Clinician Workspace & Care Coordination (`/clinician`)**
   - Switch to clinician mode to view authorized patient summaries.
   - Review the longitudinal timeline, write a clinical review note, and assign a care coordination task.
   - Download the comprehensive clinical summary PDF.
   - Navigate to `/privacy` as the patient and click **Revoke Access** to witness immediate real-time authorization severing.

---

## 14. Limitations, Safety & Responsible AI Governance

### 14.1 Explicit Limitations & Prediction Horizon
- **Not a Medical Device:** AnxietyTwin is an investigational software prototype. It has not been cleared or approved by the US FDA, CE mark authorities, or any international medical regulatory agency.
- **24-Hour Horizon (Day Before Panic / DBP):** The predictive machine learning model estimates impending panic vulnerability on a next-day basis ($t+1$). It is **not** capable of predicting imminent, minute-by-minute panic attacks.
- **Population Constraints:** The underlying dataset comprises 43 adult psychiatric outpatients in South Korea. Generalization to pediatric, non-clinical, or culturally diverse populations has not been established.
- **Observational Non-Causality:** All discovered patterns (e.g., "Workload correlated with higher distress") are observational statistical associations. AnxietyTwin explicitly communicates to users that correlation does not establish causation.

### 14.2 Mental Health Safety & Crisis Protocols
- **Crisis Lifelines:** Prominently featured across the global navigation, crisis banners, check-in drawers, and AI assistant responses.
  - **United States & Canada:** Dial or text **988** ([988lifeline.org](https://988lifeline.org))
  - **Crisis Text Line:** Text `HOME` to **741741**
  - **United Kingdom:** Dial **111** ([nhs.uk](https://www.nhs.uk/service-search/mental-health/find-an-urgent-mental-health-helpline))
  - **International:** [findahelpline.com](https://findahelpline.com)
- **Calm, Non-Alarmist UI:** The user interface avoids emergency siren colors (flashing red sirens) or alarmist alerts. Autonomic shifts are framed as natural physiological adaptations.
- **Privacy by Default:** Personal emotion journal reflections are encrypted and strictly private to the user. Clinicians can never inspect journal entries unless affirmative, explicit consent is granted.
- **Full Data Sovereignty (GDPR):** Complete JSON archive data export and permanent account erasure with verified deletion under GDPR Right to Portability and Right to be Forgotten.

---

## 15. Open-Source License & Third-Party Attributions

### 15.1 Software License
AnxietyTwin is open-sourced under the **MIT License**. See the complete [`LICENSE`](LICENSE) file for legal terms.

```text
MIT License
Copyright (c) 2026 AnxietyTwin Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

### 15.2 Dataset License & Citation
The research dataset in `data/` originates from the open-access publication by Jang et al. (2024) and is distributed under the **Creative Commons Attribution 4.0 International (CC BY 4.0)** license:

> Jang, S., Sun, T.H., Shin, S. et al. *A digital phenotyping dataset for impending panic symptoms: a prospective longitudinal study.* Sci Data 11, 1264 (2024). DOI: [10.1038/s41597-024-04147-6](https://doi.org/10.1038/s41597-024-04147-6).

---

## 16. Contact & Project Maintenance

For technical questions, competition evaluation inquiries, or academic research discussions:
- **Project Lead:** Abhishek Patel — University of Calcutta
- **GitHub Repository Issues:** [https://github.com/AbhishekPatel-05/AnxietyTwin/issues](https://github.com/AbhishekPatel-05/AnxietyTwin/issues)
