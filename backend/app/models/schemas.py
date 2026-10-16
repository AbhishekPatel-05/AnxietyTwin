from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ==========================================
# AUTH & USER SCHEMAS
# ==========================================

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: Optional[str] = "patient"  # "patient", "clinician", "admin"


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Password with minimum 6 characters")
    role: Optional[str] = "patient"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    full_name: Optional[str] = None
    role: str = "patient"
    onboarding_completed: bool = False


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None


class UserOut(UserBase):
    id: int
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# USER PROFILE & ONBOARDING SCHEMAS
# ==========================================

class UserProfileBase(BaseModel):
    age: Optional[int] = Field(None, ge=18, le=120)
    biological_sex: Optional[str] = Field(None, description="'M', 'F', or 'other'")
    baseline_resting_hr: Optional[float] = Field(72.0, ge=40, le=140)
    baseline_sleep_hours: Optional[float] = Field(7.5, ge=2, le=16)
    baseline_caffeine_cups: Optional[float] = Field(1.0, ge=0, le=15)
    baseline_hrv_ms: Optional[float] = Field(45.0, ge=5, le=200)
    medical_history_notes: Optional[str] = None
    has_panic_history: Optional[bool] = False
    trait_anxiety_score: Optional[float] = Field(None, ge=0, le=60)


class UserProfileCreate(UserProfileBase):
    consents: Optional[List[str]] = Field(default=["health_data_processing", "simulation_research"])


class UserProfileUpdate(UserProfileBase):
    onboarding_completed: Optional[bool] = None


class UserProfileOut(UserProfileBase):
    id: int
    user_id: int
    onboarding_completed: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# CONSENT SCHEMAS
# ==========================================

class ConsentCreate(BaseModel):
    consent_type: str
    consented: bool = True


class ConsentOut(BaseModel):
    id: int
    consent_type: str
    consented: bool
    consented_at: datetime
    withdrawal_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# OBSERVATION SCHEMAS
# ==========================================

class PhysiologicalObservationCreate(BaseModel):
    heart_rate_bpm: float = Field(..., ge=30, le=240, description="Heart rate in BPM")
    heart_rate_variability_ms: Optional[float] = Field(None, ge=1, le=300, description="HRV (RMSSD) in ms")
    resting_heart_rate: Optional[float] = Field(None, ge=30, le=150)
    steps_count: Optional[int] = Field(None, ge=0, le=100000)
    source_type: Optional[str] = Field("user_entered", description="'user_entered', 'synthetic', or 'device_measurement'")
    timestamp: Optional[datetime] = None


class PhysiologicalObservationOut(PhysiologicalObservationCreate):
    id: int
    user_id: int
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class PhysiologicalObservationUpdate(BaseModel):
    heart_rate_bpm: Optional[float] = Field(None, ge=30, le=240, description="Heart rate in BPM")
    heart_rate_variability_ms: Optional[float] = Field(None, ge=1, le=300, description="HRV (RMSSD) in ms")
    resting_heart_rate: Optional[float] = Field(None, ge=30, le=150)
    steps_count: Optional[int] = Field(None, ge=0, le=100000)


class LifestyleObservationCreate(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Date string YYYY-MM-DD")
    sleep_hours: float = Field(..., ge=0, le=24)
    sleep_quality_score: Optional[int] = Field(3, ge=1, le=5)
    caffeine_cups: Optional[float] = Field(0.0, ge=0, le=30)
    alcohol_units: Optional[float] = Field(0.0, ge=0, le=50)
    exercise_minutes: Optional[float] = Field(0.0, ge=0, le=1440)
    smoking_count: Optional[int] = Field(0, ge=0, le=100)
    source_type: Optional[str] = "user_entered"


class LifestyleObservationOut(LifestyleObservationCreate):
    id: int
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LifestyleObservationUpdate(BaseModel):
    date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Date string YYYY-MM-DD")
    sleep_hours: Optional[float] = Field(None, ge=0, le=24)
    sleep_quality_score: Optional[int] = Field(None, ge=1, le=5)
    caffeine_cups: Optional[float] = Field(None, ge=0, le=30)
    alcohol_units: Optional[float] = Field(None, ge=0, le=50)
    exercise_minutes: Optional[float] = Field(None, ge=0, le=1440)
    smoking_count: Optional[int] = Field(None, ge=0, le=100)


# ==========================================
# ANXIETY CHECK-IN SCHEMAS
# ==========================================

class AnxietyCheckinCreate(BaseModel):
    subjective_anxiety_score: int = Field(..., ge=0, le=10, description="Self-reported 0-10 rating")
    energy_level: Optional[int] = Field(3, ge=1, le=5)
    somatic_symptoms: Optional[List[str]] = Field(default=[], description="List of somatic feelings, e.g. ['tightness', 'trembling']")
    triggers_noted: Optional[str] = None
    context_tags: Optional[List[str]] = Field(default=None, description="Contextual tags, e.g. ['Workload', 'Caffeine']")
    notes: Optional[str] = None
    source_type: Optional[str] = "user_entered"
    timestamp: Optional[datetime] = None
    # Optional unified daily observation fields
    sleep_hours: Optional[float] = Field(None, ge=0, le=24, description="Sleep duration in hours")
    steps_count: Optional[int] = Field(None, ge=0, le=100000, description="Step count or daily activity")
    caffeine_cups: Optional[float] = Field(None, ge=0, le=30, description="Caffeine cups")
    heart_rate_bpm: Optional[float] = Field(None, ge=30, le=240, description="Resting heart rate in BPM")
    heart_rate_variability_ms: Optional[float] = Field(None, ge=1, le=300, description="HRV (RMSSD) in ms")


class AnxietyCheckinUpdate(BaseModel):
    subjective_anxiety_score: Optional[int] = Field(None, ge=0, le=10)
    energy_level: Optional[int] = Field(None, ge=1, le=5)
    somatic_symptoms: Optional[List[str]] = None
    triggers_noted: Optional[str] = None
    context_tags: Optional[List[str]] = None
    notes: Optional[str] = None
    sleep_hours: Optional[float] = Field(None, ge=0, le=24)
    steps_count: Optional[int] = Field(None, ge=0, le=100000)
    caffeine_cups: Optional[float] = Field(None, ge=0, le=30)
    heart_rate_bpm: Optional[float] = Field(None, ge=30, le=240)


class AnxietyCheckinOut(BaseModel):
    id: int
    user_id: int
    timestamp: datetime
    source_type: str
    subjective_anxiety_score: int
    energy_level: Optional[int] = None
    somatic_symptoms: Optional[str] = None
    triggers_noted: Optional[str] = None
    context_tags: Optional[List[str]] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# DIGITAL TWIN STATE & SNAPSHOT SCHEMAS
# ==========================================

class TwinStateSnapshotOut(BaseModel):
    id: int
    user_id: int
    timestamp: datetime
    source: str
    composite_stress_index: float
    physiological_arousal_score: float
    circadian_disruption_index: float
    baseline_deviation_score: float
    state_label: str
    state_details_json: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BaselineSummaryOut(BaseModel):
    has_sufficient_data: bool
    is_cold_start: bool = True
    required_observations_count: int = 5
    personalized_model_min_days: int = 7
    total_observations_count: int
    unique_days_count: int = 0
    date_span_days: int = 0
    history_progress_percent: float = 0.0
    status_message: str = "Cold-start calibration active"
    reference_prior_note: Optional[str] = None
    missing_indicators: List[str] = []
    mean_resting_hr: Optional[float] = None
    mean_hrv_ms: Optional[float] = None
    mean_sleep_hours: Optional[float] = None
    mean_caffeine_cups: Optional[float] = None
    mean_anxiety_score: Optional[float] = None
    std_resting_hr: Optional[float] = 8.0
    std_hrv_ms: Optional[float] = 12.0
    std_sleep_hours: Optional[float] = 1.2
    last_updated: Optional[datetime] = None
    descriptive_baseline_ready: bool = False
    personalized_prediction_ready: bool = False
    personalized_prediction_requirement: str = (
        "Requires at least 7 distinct days of prior historical observations strictly preceding prediction date."
    )


class LongitudinalTrendPoint(BaseModel):
    date: str
    timestamp: str
    heart_rate: Optional[float] = None
    hrv_ms: Optional[float] = None
    sleep_hours: Optional[float] = None
    caffeine_cups: Optional[float] = None
    anxiety_score: Optional[int] = None
    composite_stress: Optional[float] = None
    source_type: str = "user_entered"


class LongitudinalTrendOut(BaseModel):
    points: List[LongitudinalTrendPoint]
    total_count: int


# ==========================================
# SIMULATION LAB SCHEMAS
# ==========================================

class SimulationScenarioInput(BaseModel):
    sleep_hours: float = Field(7.0, ge=1, le=16)
    caffeine_cups: float = Field(1.0, ge=0, le=15)
    physical_activity_mins: float = Field(30.0, ge=0, le=300)
    heart_rate_bpm: float = Field(75.0, ge=40, le=180)
    hrv_ms: float = Field(45.0, ge=5, le=150)
    self_reported_anxiety: int = Field(3, ge=0, le=10)
    recent_stress_exposure: int = Field(2, ge=0, le=5)  # 0: none, 5: severe


class SimulationScenarioCreate(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    baseline_patient_id: Optional[str] = "DEMO-PATIENT-01"
    inputs: SimulationScenarioInput
    seed: Optional[int] = 42
    scenario_type: Optional[str] = "custom"
    version: Optional[str] = "1.0"
    tags: Optional[List[str]] = None


class SimulationScenarioOut(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str] = None
    baseline_patient_id: str
    modified_inputs: Dict[str, Any]
    resulting_state: Dict[str, Any]
    seed: Optional[int] = 42
    scenario_type: Optional[str] = "custom"
    version: Optional[str] = "1.0"
    tags: Optional[List[str]] = None
    created_at: datetime


class ScenarioComparisonRequest(BaseModel):
    scenario_a: SimulationScenarioInput
    scenario_b: SimulationScenarioInput
    baseline_profile_id: Optional[str] = "DEMO-PATIENT-01"


class ScenarioComparisonResponse(BaseModel):
    scenario_a_result: Dict[str, Any]
    scenario_b_result: Dict[str, Any]
    differential_analysis: Dict[str, Any]
    scenario_a_prediction: Optional[Dict[str, Any]] = None
    scenario_b_prediction: Optional[Dict[str, Any]] = None
    delta_predicted_probability: Optional[float] = None
    non_causal_disclaimer: str = (
        "Model sensitivity to hypothetical inputs reflects associational machine learning patterns and does not establish clinical causation. Changing lifestyle variables does not guarantee prevention or cause of panic attacks."
    )


# ==========================================
# PREDICTION & ML SCHEMAS
# ==========================================

class PredictionRequest(BaseModel):
    heart_rate_mean: float = Field(75.0, ge=40, le=160)
    heart_rate_max: float = Field(105.0, ge=50, le=220)
    heart_rate_var: float = Field(110.0, ge=5, le=600)
    steps_mean: float = Field(50.0, ge=0, le=300)
    sleep_duration: float = Field(7.0, ge=1, le=16)
    sleep_onset_hour: float = Field(-1.0, ge=-24, le=24)
    sleep_out_hour: float = Field(7.0, ge=-24, le=24)
    caffeine_intake: float = Field(1.0, ge=0, le=15)
    alcohol_intake: float = Field(0.0, ge=0, le=20)
    daily_anxiety_rating: float = Field(3.0, ge=0, le=10)
    annoyance_rating: float = Field(2.0, ge=0, le=10)
    trait_anxiety_stai: Optional[float] = Field(42.0, ge=20, le=80)
    childhood_trauma_ctq: Optional[float] = Field(12.0, ge=5, le=25)
    model_choice: Optional[str] = "RandomForest"  # "RandomForest", "XGBoost", "LogisticRegression"


class PredictionResponse(BaseModel):
    model_name: str
    model_version: str
    prediction_horizon: str
    predicted_probability: float
    uncertainty_interval: List[float]  # [lower, upper]
    risk_band: str  # LOW, MODERATE, ELEVATED
    calibration_reliability_note: str
    top_contributing_factors: List[Dict[str, Any]]
    research_disclaimer: str
    timestamp: datetime


class PersonalizedPredictionResponse(BaseModel):
    status: str  # "ready" or "unavailable"
    unique_history_days: int
    required_days: int = 7
    prediction: Optional[PredictionResponse] = None
    message: str
    limitation: Optional[str] = None
    data_requirements_note: str = (
        "Personalized longitudinal modeling requires at least 7 distinct past days of observations strictly prior to prediction date to prevent future data leakage."
    )


# ==========================================
# SYNTHETIC PLAYBACK SCHEMAS
# ==========================================

class SyntheticPlaybackRequest(BaseModel):
    participant_id: Optional[str] = "SYM2-1-285"
    days_to_stream: int = Field(7, ge=1, le=30)


# ==========================================
# SYSTEM HEALTH
# ==========================================

class HealthComponentStatus(BaseModel):
    database: str
    ml_inference: str
    twin_engine: str


class HealthResponse(BaseModel):
    status: str
    version: str
    database: str
    ml_models_loaded: bool
    components: Optional[HealthComponentStatus] = None
    timestamp: datetime


# ==========================================
# PHASE 6.2 — CLINICIAN WORKSPACE SCHEMAS
# ==========================================

class PatientAccessGrantCreate(BaseModel):
    patient_email: Optional[EmailStr] = None
    patient_id: Optional[int] = None
    clinician_id: Optional[int] = None
    clinician_email: Optional[EmailStr] = None
    scope: str = "full_review"
    notes: Optional[str] = None


class PatientAccessGrantOut(BaseModel):
    id: int
    patient_id: int
    clinician_id: int
    patient_email: Optional[str] = None
    patient_name: Optional[str] = None
    scope: str
    is_active: bool
    created_at: datetime
    revoked_at: Optional[datetime] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ClinicianReviewNoteCreate(BaseModel):
    reporting_period_start: Optional[str] = None
    reporting_period_end: Optional[str] = None
    summary_observations: str = Field(..., min_length=3)
    discussion_topics: Optional[str] = None
    follow_up_plan: Optional[str] = None
    follow_up_date: Optional[str] = None
    follow_up_status: str = "planned"  # "planned", "completed", "none"


class ClinicianReviewNoteUpdate(BaseModel):
    summary_observations: Optional[str] = None
    discussion_topics: Optional[str] = None
    follow_up_plan: Optional[str] = None
    follow_up_date: Optional[str] = None
    follow_up_status: Optional[str] = None


class ClinicianReviewNoteOut(BaseModel):
    id: int
    patient_id: int
    clinician_id: int
    clinician_name: Optional[str] = None
    review_date: datetime
    reporting_period_start: Optional[str] = None
    reporting_period_end: Optional[str] = None
    summary_observations: str
    discussion_topics: Optional[str] = None
    follow_up_plan: Optional[str] = None
    follow_up_date: Optional[str] = None
    follow_up_status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TimelineEventOut(BaseModel):
    id: str
    timestamp: datetime
    event_type: str  # "checkin", "physiological", "lifestyle", "twin_state", "prediction", "coping_feedback", "simulation"
    source_type: str  # "user_entered", "historical_research", "calculated", "simulated"
    is_simulated: bool
    title: str
    summary: str
    values: Dict[str, Any]
    details: Optional[Dict[str, Any]] = None


class TwinInsightOut(BaseModel):
    id: str
    factor: str
    category: str  # "autonomic", "circadian", "psychological", "composite"
    observation: str
    comparison_baseline: str
    baseline_value: Optional[float] = None
    current_value: Optional[float] = None
    delta: Optional[float] = None
    delta_unit: str
    time_window: str
    source_provenance: str
    data_limitation: str
    non_causal_interpretation: str
    direction: str  # "elevated", "suppressed", "stable", "variable"
    significance: str  # "high", "moderate", "low"
    supporting_record_ids: List[str]


class PatientCardOut(BaseModel):
    id: int
    display_name: str
    email: str
    age_range: Optional[str] = None
    is_demo_patient: bool = False
    total_observations_count: int
    recent_checkin_date: Optional[str] = None
    recent_anxiety_score: Optional[int] = None
    baseline_status: str  # "Empirical Baseline Active", "Cold-Start Calibration"
    data_completeness_percent: int
    last_reviewed_date: Optional[str] = None


class PatientOverviewOut(BaseModel):
    patient_id: int
    display_name: str
    email: str
    age: Optional[int] = None
    biological_sex: Optional[str] = None
    is_demo_patient: bool = False
    trait_anxiety_score: Optional[float] = None
    has_panic_history: bool = False
    baseline_status: str
    mean_resting_hr: float
    mean_hrv_ms: float
    mean_sleep_hours: float
    mean_caffeine_cups: float
    total_observations: int
    distinct_days: int
    data_completeness_percent: int
    latest_twin_state: Optional[Dict[str, Any]] = None
    prediction_availability: str  # "available", "unavailable_cold_start"
    prediction_cold_start_message: Optional[str] = None
    latest_review_note: Optional[ClinicianReviewNoteOut] = None


class PdfExportOptions(BaseModel):
    include_checkins: bool = True
    include_physiology: bool = True
    include_lifestyle: bool = True
    include_twin_insights: bool = True
    include_prediction: bool = True
    include_clinician_notes: bool = True
    include_interventions: bool = True
    include_simulated: bool = False
    reporting_days: int = 14


# ==========================================
# EARLY-WARNING & INTERVENTION ENGINE SCHEMAS
# ==========================================

class BaselineComparisonMetric(BaseModel):
    metric_key: str
    metric_name: str
    current_value: Optional[float] = None
    baseline_value: Optional[float] = None
    delta_value: Optional[float] = None
    unit: str
    trend: str  # "elevated", "reduced", "stable", "disrupted", "unknown"
    status: str  # "within_range", "change_detected", "insufficient_data"
    observations_count: int = 0
    provenance: str = "measured"
    latest_timestamp: Optional[str] = None


class EarlyWarningSignal(BaseModel):
    signal_id: str
    signal_type: str
    title: str
    level: str  # "Within Personal Range", "Change Detected", "Insufficient Data"
    what_changed: str
    why_flagged: str
    evidence_summary: str
    current_value: Optional[float] = None
    baseline_value: Optional[float] = None
    delta: Optional[float] = None
    unit: str = ""
    timestamps: List[str] = []
    supporting_record_ids: List[str] = []
    data_quality: str
    data_provenance: str = "user_reported"
    suggested_activity: str
    suggested_intervention_type: str
    limitations: str
    is_rule_based: bool = True


class InterventionRecommendation(BaseModel):
    id: str
    intervention_type: str  # "breathing_478", "grounding_54321", "sleep_hygiene", "checkin_prompt", "routine_monitoring"
    title: str
    description: str
    rational_summary: str
    priority: str  # "high", "moderate", "low", "informational"
    estimated_duration_min: int
    trigger_signal_id: Optional[str] = None
    is_medical: bool = False
    disclaimer: str = "Experimental wellness support. Not a prescription, psychiatric treatment, or medical device."


class InterventionSessionCreate(BaseModel):
    intervention_type: str
    trigger_signal: Optional[str] = "user_initiated"
    status: str = "completed"
    pre_distress_rating: Optional[float] = Field(None, ge=0, le=10)
    post_distress_rating: Optional[float] = Field(None, ge=0, le=10)
    helpfulness: Optional[str] = None  # "helpful", "somewhat_helpful", "not_helpful", "prefer_not_to_say"
    user_notes: Optional[str] = None
    source_type: Optional[str] = "user_entered"  # "user_entered", "synthetic", "simulated"
    context_snapshot: Optional[Dict[str, Any]] = None


class InterventionSessionOut(BaseModel):
    id: int
    user_id: int
    intervention_type: str
    trigger_signal: Optional[str] = None
    status: str
    pre_distress_rating: Optional[float] = None
    post_distress_rating: Optional[float] = None
    rating_delta: Optional[float] = None
    helpfulness: Optional[str] = None
    user_notes: Optional[str] = None
    source_type: str = "user_entered"
    context_snapshot: Optional[Dict[str, Any]] = None
    started_at: datetime
    completed_at: Optional[datetime] = None


class InterventionsStatusOut(BaseModel):
    baseline_status: str
    is_cold_start: bool
    metrics: List[BaselineComparisonMetric]
    signals: List[EarlyWarningSignal]
    recommendations: List[InterventionRecommendation]
    insufficient_data_reasons: List[str] = []
    disclaimer: str = (
        "Experimental wellness indicators based on empirical rules. Observational association does not establish clinical causation. "
        "Not intended to diagnose any medical condition or predict acute panic attacks."
    )


# ==========================================
# FEATURE 1: PERSONAL TRIGGER & PATTERN DISCOVERY
# ==========================================

class DiscoveredPatternOut(BaseModel):
    id: int
    user_id: int
    pattern_type: str  # context_trigger, sleep_distress, vitals_shift, coping_efficacy
    title: str
    description: str
    trigger_context: Optional[str] = None
    distress_correlation: Optional[float] = None
    observation_count: int
    time_range: Optional[str] = None
    confidence_level: str  # preliminary, moderate, robust
    status: str  # active, dismissed, relevant, irrelevant
    evidence_summary: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    non_causal_disclaimer: str = "Statistical correlation observed across historical records. Does not infer causation or claim an event causes anxiety."

    model_config = ConfigDict(from_attributes=True)


class PatternFeedbackUpdate(BaseModel):
    status: str = Field(..., description="relevant, irrelevant, dismissed, or active")


class PatternAnalysisResponse(BaseModel):
    patterns: List[DiscoveredPatternOut]
    analyzed_checkin_count: int
    analyzed_observation_days: int
    insufficient_data: bool = False
    disclaimer: str = "Exploratory pattern discovery. Correlation does not imply causation."


# ==========================================
# FEATURE 2: PERSONALIZED WELLNESS GOALS & CARE PLAN
# ==========================================

class WellnessGoalCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    category: str = Field(..., description="checkin, sleep_routine, breathing, grounding, journaling, physical_activity")
    target_frequency: str = Field("daily", description="daily, weekdays, weekly, 3_times_week")
    target_count: int = Field(5, ge=1, le=50)
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class WellnessGoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    target_frequency: Optional[str] = None
    target_count: Optional[int] = Field(None, ge=1, le=50)
    status: Optional[str] = Field(None, description="active, paused, completed, archived")
    end_date: Optional[str] = None


class WellnessGoalOut(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str] = None
    category: str
    target_frequency: str
    target_count: int
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: str
    current_week_progress: int = 0
    current_week_target: int = 0
    is_on_track: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GoalSuggestionOut(BaseModel):
    title: str
    description: str
    category: str
    target_frequency: str
    target_count: int
    rationale: str


class WeeklyCarePlanSummaryOut(BaseModel):
    week_start: str
    week_end: str
    planned_goals_count: int
    active_goals: List[WellnessGoalOut]
    total_completed_activities: int
    total_planned_activities: int
    completion_rate_pct: float
    user_helpfulness_summary: Dict[str, int]
    supportive_message: str
    disclaimer: str = "Voluntary wellness goals. Not a clinician-prescribed medical treatment plan."


# ==========================================
# FEATURE 3: EMOTION JOURNAL & CONTEXT CAPTURE
# ==========================================

class EmotionJournalEntryCreate(BaseModel):
    title: Optional[str] = None
    content: str = Field(..., min_length=1, description="Personal reflective thoughts")
    mood_tags: Optional[List[str]] = Field(default=[], description="e.g. ['Overwhelmed', 'Restless']")
    distress_rating: Optional[float] = Field(None, ge=0, le=10)
    context_tags: Optional[List[str]] = Field(default=[], description="e.g. ['Workload', 'Sleep disruption']")
    prompt_responses: Optional[Dict[str, str]] = Field(default=None, description="Responses to structured prompts")
    is_private: bool = Field(True, description="Strictly private to the user by default")
    shared_with_clinician: bool = Field(False, description="Explicit user consent required to share")
    linked_checkin_id: Optional[int] = None


class EmotionJournalEntryUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    mood_tags: Optional[List[str]] = None
    distress_rating: Optional[float] = Field(None, ge=0, le=10)
    context_tags: Optional[List[str]] = None
    prompt_responses: Optional[Dict[str, str]] = None
    is_private: Optional[bool] = None
    shared_with_clinician: Optional[bool] = None


class EmotionJournalEntryOut(BaseModel):
    id: int
    user_id: int
    title: Optional[str] = None
    content: str
    mood_tags: List[str] = []
    distress_rating: Optional[float] = None
    context_tags: List[str] = []
    prompt_responses: Optional[Dict[str, str]] = None
    is_private: bool
    shared_with_clinician: bool
    linked_checkin_id: Optional[int] = None
    ai_summary: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class JournalThemeSummaryRequest(BaseModel):
    entry_ids: Optional[List[int]] = None
    user_consent: bool = Field(..., description="Explicit user consent required for AI theme summarization")


class JournalThemeSummaryResponse(BaseModel):
    themes: List[str]
    summary_text: str
    entry_count: int
    is_ai_generated: bool = True
    distinction_notice: str = "This theme summary was synthesized by AI and is distinct from your authentic personal journal entries."


# ==========================================
# FEATURE 4: DIGITAL TWIN CONFIDENCE & DATA QUALITY CENTER
# ==========================================

class ObservationCoverage(BaseModel):
    total_observations: int
    distinct_recording_days: int
    available_metrics: Dict[str, bool]
    missing_metrics: List[str]
    most_recent_timestamp: Optional[str] = None
    recency_status: str  # fresh, stale, insufficient


class DataProvenanceBreakdown(BaseModel):
    measured_device_count: int
    user_reported_count: int
    simulated_synthetic_count: int
    derived_indices_count: int
    measured_pct: float
    user_reported_pct: float
    simulated_pct: float
    derived_pct: float


class BaselineReliability(BaseModel):
    is_calibrated: bool
    baseline_days_used: int
    minimum_days_required: int = 3
    baseline_period: Optional[str] = None
    is_outdated: bool = False
    unavailable_metrics: List[str] = []
    reliability_tier: str  # high, moderate, preliminary, uncalibrated


class InsightTransparencyRule(BaseModel):
    indicator_name: str
    rule_or_formula: str
    inputs_used: List[str]
    target_or_prediction_horizon: str
    known_limitations: str


class DataQualityWarning(BaseModel):
    code: str
    severity: str  # info, warning, caution
    title: str
    message: str
    suggested_action: str


class DataQualityCenterOut(BaseModel):
    coverage: ObservationCoverage
    provenance: DataProvenanceBreakdown
    baseline_reliability: BaselineReliability
    transparency_rules: List[InsightTransparencyRule]
    warnings: List[DataQualityWarning]
    synthetic_data_isolated: bool = True
    disclaimer: str = (
        "Data quality metrics evaluate observation completeness and recency only. "
        "Data completeness does not equal clinical confidence or establish medical validity."
    )


# ==========================================
# FEATURE 5: CLINICIAN FOLLOW-UP & CARE COORDINATION
# ==========================================

class ClinicianFollowUpTaskCreate(BaseModel):
    patient_id: int
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    patient_visible_notes: Optional[str] = None
    due_date: Optional[str] = None  # YYYY-MM-DD
    priority: str = Field("medium", description="low, medium, high, urgent")
    is_patient_visible: bool = True


class ClinicianFollowUpTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    patient_visible_notes: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = Field(None, description="pending, in_progress, completed, cancelled")
    is_patient_visible: Optional[bool] = None


class PatientTaskAcknowledge(BaseModel):
    patient_response_notes: Optional[str] = None


class ClinicianFollowUpTaskOut(BaseModel):
    id: int
    patient_id: int
    patient_name: Optional[str] = None
    clinician_id: int
    clinician_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    patient_visible_notes: Optional[str] = None
    due_date: Optional[str] = None
    priority: str
    status: str
    is_patient_visible: bool
    patient_acknowledged: bool
    patient_response_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ClinicianTasksOverviewOut(BaseModel):
    total_active: int
    upcoming_tasks: List[ClinicianFollowUpTaskOut]
    overdue_tasks: List[ClinicianFollowUpTaskOut]
    completed_tasks: List[ClinicianFollowUpTaskOut]


# ==========================================
# FEATURE 6: SCENARIO REPLAY & COMPARISON
# ==========================================

class ScenarioReplayRequest(BaseModel):
    scenario_input: SimulationScenarioInput
    baseline_profile_id: Optional[str] = "DEMO-PATIENT-01"
    seed: int = Field(42, description="Reproducible pseudo-random seed for deterministic trajectory")
    steps_count: int = Field(24, ge=4, le=72, description="Number of simulation timeline steps")


class ScenarioReplayStep(BaseModel):
    step_index: int
    hour_offset: int
    heart_rate_bpm: float
    hrv_ms: float
    composite_stress_index: float
    physiological_arousal_score: float
    circadian_disruption_index: float
    state_label: str


class ScenarioReplayResponse(BaseModel):
    scenario_name: str
    seed: int
    baseline_profile: str
    steps: List[ScenarioReplayStep]
    synthetic_notice: str = "SYNTHETIC DETERMINISTIC REPLAY — NOT GENUINE PHYSIOLOGICAL DATA"
    reproducibility_hash: str


class ScenarioComparisonPdfRequest(BaseModel):
    scenario_a: SimulationScenarioInput
    scenario_b: SimulationScenarioInput
    scenario_a_name: str = "Baseline Scenario"
    scenario_b_name: str = "Counterfactual Scenario"
    baseline_profile_id: str = "DEMO-PATIENT-01"


# ==========================================
# FEATURE 7: WEEKLY PERSONAL INSIGHTS REPORT
# ==========================================

class WeeklyReportRequest(BaseModel):
    start_date: Optional[str] = None  # YYYY-MM-DD
    end_date: Optional[str] = None    # YYYY-MM-DD
    include_journal_summary: bool = False  # False by default for privacy
    include_goals: bool = True
    include_patterns: bool = True


class WeeklyReportOut(BaseModel):
    period_start: str
    period_end: str
    checkin_count: int
    avg_distress_rating: Optional[float] = None
    distress_trend: str  # stable, increasing, decreasing, insufficient_data
    resting_hr_avg: Optional[float] = None
    hrv_avg_ms: Optional[float] = None
    sleep_avg_hours: Optional[float] = None
    baseline_deviations: List[Dict[str, Any]]
    recurring_patterns: List[Dict[str, Any]]
    coping_interventions_summary: Dict[str, Any]
    wellness_goals_progress: List[Dict[str, Any]]
    private_reflections_included: bool
    reflections_summary: Optional[str] = None
    data_quality_notices: List[str]
    disclaimer: str = (
        "This weekly summary is generated for personal reflection and self-understanding. "
        "Changes do not establish clinical recovery, deterioration, or medical efficacy."
    )


# ==========================================
# FEATURE 8: PRIVACY & CONSENT CENTER
# ==========================================

class PrivacyDashboardOut(BaseModel):
    user_email: str
    stored_categories: List[Dict[str, Any]]
    role_access_matrix: List[Dict[str, Any]]
    active_grants_count: int
    revoked_grants_count: int
    recent_audit_count: int
    retention_policy_summary: str


class PrivacyAuditLogOut(BaseModel):
    id: int
    user_id: int
    action: str
    performed_by_id: int
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class AccountDeletionRequest(BaseModel):
    password: str = Field(..., description="Account password required for re-authentication")
    confirmation_phrase: str = Field(..., description="Must match 'DELETE MY ACCOUNT'")


class AccountDeletionResponse(BaseModel):
    status: str
    message: str
    deleted_account_email: str
    deleted_at: datetime


# ==========================================
# FEATURE: ADAPTIVE DIGITAL TWIN & LONGITUDINAL EVOLUTION
# ==========================================

class PersonalizedMetricSummary(BaseModel):
    metric_key: str
    display_name: str
    current_value: Optional[float] = None
    baseline_value: Optional[float] = None
    unit: str
    observation_count: int
    observation_period: str
    most_recent_timestamp: Optional[str] = None
    provenance: str  # "device_measured", "user_reported", "derived", "reference_demo"
    sufficient_data: bool
    status_note: str


class PersonalizedInitializationResponse(BaseModel):
    user_id: Optional[int] = None
    is_personalized: bool
    data_mode: str  # "personalized" or "generic_demo"
    profile_id: str  # "USER-AUTHENTIC" or "DEMO-PATIENT-01"
    profile_name: str
    baseline_summary: BaselineSummaryOut
    metrics: List[PersonalizedMetricSummary]
    sufficient_data: bool
    disclaimer: str


class ScenarioDifferenceItem(BaseModel):
    parameter: str
    display_name: str
    baseline_val: Any
    alternative_val: Any
    unit: str
    delta_display: str
    has_modeled_effect: bool
    effect_explanation: str


class ExplainableScenarioComparisonResponse(BaseModel):
    scenario_a_result: Dict[str, Any]
    scenario_b_result: Dict[str, Any]
    differential_analysis: Dict[str, Any]
    scenario_a_prediction: Optional[Dict[str, Any]] = None
    scenario_b_prediction: Optional[Dict[str, Any]] = None
    delta_predicted_probability: Optional[float] = None
    inputs_changed: List[ScenarioDifferenceItem]
    outputs_changed: List[Dict[str, Any]]
    unmodeled_inputs: List[str]
    calculation_explanations: List[str]
    scientific_limitations: List[str]
    reproducibility_hash: str
    engine_version: str = "2.0-adaptive"
    non_causal_disclaimer: str = (
        "Model sensitivity to hypothetical counterfactual inputs reflects statistical patterns in the research cohort. "
        "It does NOT establish clinical causation. Changing lifestyle variables does not guarantee prevention or cause of panic attacks."
    )


class CounterfactualPerturbationRequest(BaseModel):
    parameter_to_vary: Literal[
        "sleep_hours",
        "caffeine_cups",
        "heart_rate_bpm",
        "hrv_ms",
        "self_reported_anxiety",
        "physical_activity_mins",
        "recent_stress_exposure",
    ]
    perturbed_value: float
    base_scenario: SimulationScenarioInput
    baseline_profile_id: Optional[str] = "DEMO-PATIENT-01"
    seed: Optional[int] = 42


class CounterfactualPerturbationResponse(BaseModel):
    parameter_varied: str
    original_input: float
    alternative_input: float
    input_delta: float
    base_state: Dict[str, Any]
    counterfactual_state: Dict[str, Any]
    metric_deltas: Dict[str, float]
    simulation_rule_explanation: str
    formula_attribution: str
    unmodeled_effect_note: Optional[str] = None
    provenance_notice: str = "SYNTHETIC COUNTERFACTUAL EXPERIMENT — DETERMINISTIC DERIVATION"


class BaselineEvolutionWindow(BaseModel):
    window_label: str
    start_date: str
    end_date: str
    observation_count: int
    unique_days: int
    mean_resting_hr: Optional[float] = None
    mean_hrv_ms: Optional[float] = None
    mean_sleep_hours: Optional[float] = None
    mean_caffeine_cups: Optional[float] = None
    mean_anxiety_score: Optional[float] = None
    composite_stress_index: Optional[float] = None
    delta_vs_prior: Optional[Dict[str, Optional[float]]] = None
    provenance: str = "authentic_patient_record"
    sufficient_data: bool
    data_quality_notes: List[str]


class LongitudinalBaselineEvolutionOut(BaseModel):
    user_id: int
    current_baseline_version: str
    calculation_timestamp: str
    windows: List[BaselineEvolutionWindow]
    change_explanations: List[str]
    has_sufficient_longitudinal_data: bool
    isolation_notice: str = "HISTORICAL BASELINE OBSERVATIONS — EXCLUDES ALL SYNTHETIC SIMULATION SCENARIOS"


class DigitalTwinMemoryOut(BaseModel):
    id: int
    user_id: int
    baseline_version: str
    calculation_timestamp: datetime
    calculation_version: str
    observation_count: int
    metrics_included: Dict[str, Any]
    source_record_references: List[Any]
    is_active: bool
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

