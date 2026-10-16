import json
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Enum as SQLEnum,
)
from sqlalchemy.orm import relationship
from backend.app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(30), default="patient")  # "patient", "clinician", "admin"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    consents = relationship("Consent", back_populates="user", cascade="all, delete-orphan")
    physiological_observations = relationship("PhysiologicalObservation", back_populates="user", cascade="all, delete-orphan")
    lifestyle_observations = relationship("LifestyleObservation", back_populates="user", cascade="all, delete-orphan")
    anxiety_checkins = relationship("AnxietyCheckin", back_populates="user", cascade="all, delete-orphan")
    state_snapshots = relationship("TwinStateSnapshot", back_populates="user", cascade="all, delete-orphan")
    simulation_scenarios = relationship("SimulationScenario", back_populates="user", cascade="all, delete-orphan")
    predictions = relationship("PredictionRecord", back_populates="user", cascade="all, delete-orphan")
    granted_accesses = relationship(
        "PatientAccessGrant",
        foreign_keys="PatientAccessGrant.patient_id",
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    clinician_grants = relationship(
        "PatientAccessGrant",
        foreign_keys="PatientAccessGrant.clinician_id",
        back_populates="clinician",
        cascade="all, delete-orphan",
    )
    clinical_notes = relationship(
        "ClinicianReviewNote",
        foreign_keys="ClinicianReviewNote.patient_id",
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    authored_notes = relationship(
        "ClinicianReviewNote",
        foreign_keys="ClinicianReviewNote.clinician_id",
        back_populates="clinician",
        cascade="all, delete-orphan",
    )
    interventions = relationship(
        "InterventionSession",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    discovered_patterns = relationship("DiscoveredPattern", back_populates="user", cascade="all, delete-orphan")
    wellness_goals = relationship("WellnessGoal", back_populates="user", cascade="all, delete-orphan")
    journal_entries = relationship("EmotionJournalEntry", back_populates="user", cascade="all, delete-orphan")
    received_follow_up_tasks = relationship(
        "ClinicianFollowUpTask",
        foreign_keys="ClinicianFollowUpTask.patient_id",
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    assigned_follow_up_tasks = relationship(
        "ClinicianFollowUpTask",
        foreign_keys="ClinicianFollowUpTask.clinician_id",
        back_populates="clinician",
        cascade="all, delete-orphan",
    )
    privacy_audit_logs = relationship(
        "PrivacyAuditLog",
        foreign_keys="PrivacyAuditLog.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    digital_twin_memories = relationship(
        "DigitalTwinMemory",
        foreign_keys="DigitalTwinMemory.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    age = Column(Integer, nullable=True)
    biological_sex = Column(String(10), nullable=True)  # "M", "F", "other"
    baseline_resting_hr = Column(Float, default=72.0)
    baseline_sleep_hours = Column(Float, default=7.5)
    baseline_caffeine_cups = Column(Float, default=1.0)
    baseline_hrv_ms = Column(Float, default=45.0)
    medical_history_notes = Column(Text, nullable=True)
    has_panic_history = Column(Boolean, default=False)
    trait_anxiety_score = Column(Float, nullable=True)  # e.g., GAD-7 or STAI-X2
    onboarding_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="profile")


class Consent(Base):
    __tablename__ = "consents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    consent_type = Column(String(50), nullable=False)  # health_data_processing, simulation_research, predictive_analytics
    consented = Column(Boolean, default=True)
    consented_at = Column(DateTime, default=utc_now)
    withdrawal_date = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="consents")


class PhysiologicalObservation(Base):
    __tablename__ = "physiological_observations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=utc_now, index=True)
    source_type = Column(String(30), default="user_entered")  # user_entered, synthetic, device_measurement
    heart_rate_bpm = Column(Float, nullable=True)
    heart_rate_variability_ms = Column(Float, nullable=True)
    resting_heart_rate = Column(Float, nullable=True)
    steps_count = Column(Integer, nullable=True)

    user = relationship("User", back_populates="physiological_observations")


class LifestyleObservation(Base):
    __tablename__ = "lifestyle_observations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(String(20), index=True, nullable=False)  # YYYY-MM-DD
    source_type = Column(String(30), default="user_entered")  # user_entered, synthetic
    sleep_hours = Column(Float, nullable=False)
    sleep_quality_score = Column(Integer, nullable=True)  # 1 to 5
    caffeine_cups = Column(Float, default=0.0)
    alcohol_units = Column(Float, default=0.0)
    exercise_minutes = Column(Float, default=0.0)
    smoking_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="lifestyle_observations")


class AnxietyCheckin(Base):
    __tablename__ = "anxiety_checkins"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=utc_now, index=True)
    source_type = Column(String(30), default="user_entered")
    subjective_anxiety_score = Column(Integer, nullable=False)  # 0 to 10
    energy_level = Column(Integer, nullable=True)  # 1 to 5
    somatic_symptoms = Column(Text, nullable=True)  # JSON list string: ["tightness", "palpitations"]
    triggers_noted = Column(String(255), nullable=True)
    context_tags_json = Column(Text, nullable=True)  # JSON list string: ["workload", "caffeine"]
    notes = Column(Text, nullable=True)

    user = relationship("User", back_populates="anxiety_checkins")

    @property
    def context_tags(self):
        if self.context_tags_json:
            try:
                return json.loads(self.context_tags_json)
            except Exception:
                return []
        return []


class TwinStateSnapshot(Base):
    __tablename__ = "twin_state_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=utc_now, index=True)
    source = Column(String(30), default="personal_mode")  # personal_mode, simulation_lab
    composite_stress_index = Column(Float, nullable=False)  # 0 to 100
    physiological_arousal_score = Column(Float, nullable=False)  # 0 to 100
    circadian_disruption_index = Column(Float, nullable=False)  # 0 to 100
    baseline_deviation_score = Column(Float, nullable=False)  # -100 to +100
    state_label = Column(String(50), nullable=False)  # STABLE_BASELINE, MILD_STRAIN, ELEVATED_AROUSAL, HIGH_VULNERABILITY, RECOVERY
    state_details_json = Column(Text, nullable=True)  # JSON serialized dictionary

    user = relationship("User", back_populates="state_snapshots")


class SimulationScenario(Base):
    __tablename__ = "simulation_scenarios"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    baseline_patient_id = Column(String(50), default="DEMO-PATIENT-01")
    modified_inputs_json = Column(Text, nullable=False)  # JSON dictionary of scenario parameters
    resulting_state_json = Column(Text, nullable=False)  # JSON resulting twin state
    seed = Column(Integer, default=42)
    scenario_type = Column(String(50), default="custom")  # baseline, stress_surge, recovery, custom
    version = Column(String(20), default="1.0")
    tags_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="simulation_scenarios")


class PredictionRecord(Base):
    __tablename__ = "prediction_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    model_name = Column(String(50), default="AnxietyTwin-XGBoost-DBP")
    model_version = Column(String(20), default="1.0.0")
    prediction_timestamp = Column(DateTime, default=utc_now)
    predicted_probability = Column(Float, nullable=False)
    prediction_horizon = Column(String(255), default="24_hour_impending")
    uncertainty_interval_lower = Column(Float, nullable=False)
    uncertainty_interval_upper = Column(Float, nullable=False)
    risk_band = Column(String(20), nullable=False)  # LOW, MODERATE, ELEVATED
    contributing_factors_json = Column(Text, nullable=True)
    disclaimer_acknowledged = Column(Boolean, default=True)

    user = relationship("User", back_populates="predictions")


class PatientAccessGrant(Base):
    __tablename__ = "patient_access_grants"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    clinician_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    scope = Column(String(100), default="full_review")  # full_review, summary_only
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    revoked_at = Column(DateTime, nullable=True)
    notes = Column(String(255), nullable=True)

    patient = relationship("User", foreign_keys=[patient_id], back_populates="granted_accesses")
    clinician = relationship("User", foreign_keys=[clinician_id], back_populates="clinician_grants")


class ClinicianReviewNote(Base):
    __tablename__ = "clinician_review_notes"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    clinician_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    review_date = Column(DateTime, default=utc_now)
    reporting_period_start = Column(String(30), nullable=True)
    reporting_period_end = Column(String(30), nullable=True)
    summary_observations = Column(Text, nullable=False)
    discussion_topics = Column(Text, nullable=True)
    follow_up_plan = Column(Text, nullable=True)
    follow_up_date = Column(String(30), nullable=True)
    follow_up_status = Column(String(30), default="planned")  # planned, completed, none
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    patient = relationship("User", foreign_keys=[patient_id], back_populates="clinical_notes")
    clinician = relationship("User", foreign_keys=[clinician_id], back_populates="authored_notes")


class InterventionSession(Base):
    __tablename__ = "intervention_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    intervention_type = Column(String(50), nullable=False)  # breathing_478, grounding_54321, sleep_hygiene, checkin_prompt, routine_monitoring
    trigger_signal = Column(String(100), nullable=True)  # elevated_distress, reduced_hrv, disrupted_sleep, composite_autonomic_strain, user_initiated
    status = Column(String(30), default="completed")  # completed, dismissed, in_progress
    pre_distress_rating = Column(Float, nullable=True)  # 0 to 10
    post_distress_rating = Column(Float, nullable=True)  # 0 to 10
    rating_delta = Column(Float, nullable=True)  # post - pre (e.g. -2.0)
    helpfulness = Column(String(30), nullable=True)  # helpful, somewhat_helpful, not_helpful, prefer_not_to_say
    user_notes = Column(Text, nullable=True)
    source_type = Column(String(30), default="user_entered")  # user_entered, synthetic, simulated
    context_snapshot_json = Column(Text, nullable=True)  # JSON snapshot of metrics at time of session
    started_at = Column(DateTime, default=utc_now)
    completed_at = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="interventions")


class DiscoveredPattern(Base):
    __tablename__ = "discovered_patterns"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    pattern_type = Column(String(50), nullable=False)  # context_trigger, sleep_distress, vitals_shift, coping_efficacy
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    trigger_context = Column(String(100), nullable=True)  # e.g., "Workload", "Sleep Disruption", "Caffeine Surge"
    distress_correlation = Column(Float, nullable=True)  # mean delta or correlation score
    observation_count = Column(Integer, default=0)
    time_range = Column(String(100), nullable=True)  # e.g., "Last 14 days"
    confidence_level = Column(String(30), default="preliminary")  # preliminary, moderate, robust
    status = Column(String(30), default="active")  # active, dismissed, relevant, irrelevant
    evidence_summary_json = Column(Text, nullable=True)  # JSON breakdown of supporting records
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="discovered_patterns")

    @property
    def evidence_summary(self):
        if self.evidence_summary_json:
            try:
                return json.loads(self.evidence_summary_json)
            except Exception:
                return {}
        return {}


class WellnessGoal(Base):
    __tablename__ = "wellness_goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False)  # checkin, sleep_routine, breathing, grounding, journaling, physical_activity
    target_frequency = Column(String(50), default="daily")  # daily, weekdays, weekly, 3_times_week
    target_count = Column(Integer, default=5)  # e.g. 5 times per week
    start_date = Column(String(30), nullable=True)  # YYYY-MM-DD
    end_date = Column(String(30), nullable=True)  # YYYY-MM-DD
    status = Column(String(30), default="active")  # active, paused, completed, archived
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="wellness_goals")


class EmotionJournalEntry(Base):
    __tablename__ = "emotion_journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=True)
    content = Column(Text, nullable=False)
    mood_tags_json = Column(Text, nullable=True)  # JSON list string: ["Overwhelmed", "Restless"]
    distress_rating = Column(Float, nullable=True)  # 0 to 10
    context_tags_json = Column(Text, nullable=True)  # JSON list string: ["Workload", "Sleep"]
    prompt_responses_json = Column(Text, nullable=True)  # JSON dictionary of structured reflection prompts
    is_private = Column(Boolean, default=True)  # Private by default; never accessible to clinicians unless explicitly shared
    shared_with_clinician = Column(Boolean, default=False)
    linked_checkin_id = Column(Integer, ForeignKey("anxiety_checkins.id", ondelete="SET NULL"), nullable=True)
    ai_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="journal_entries")

    @property
    def mood_tags(self):
        if self.mood_tags_json:
            try:
                return json.loads(self.mood_tags_json)
            except Exception:
                return []
        return []

    @property
    def context_tags(self):
        if self.context_tags_json:
            try:
                return json.loads(self.context_tags_json)
            except Exception:
                return []
        return []

    @property
    def prompt_responses(self):
        if self.prompt_responses_json:
            try:
                return json.loads(self.prompt_responses_json)
            except Exception:
                return {}
        return {}


class ClinicianFollowUpTask(Base):
    __tablename__ = "clinician_follow_up_tasks"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    clinician_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    patient_visible_notes = Column(Text, nullable=True)
    due_date = Column(String(30), nullable=True)  # YYYY-MM-DD
    priority = Column(String(20), default="medium")  # low, medium, high, urgent
    status = Column(String(30), default="pending")  # pending, in_progress, completed, cancelled
    is_patient_visible = Column(Boolean, default=True)
    patient_acknowledged = Column(Boolean, default=False)
    patient_response_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    completed_at = Column(DateTime, nullable=True)

    patient = relationship("User", foreign_keys=[patient_id], back_populates="received_follow_up_tasks")
    clinician = relationship("User", foreign_keys=[clinician_id], back_populates="assigned_follow_up_tasks")


class PrivacyAuditLog(Base):
    __tablename__ = "privacy_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(100), nullable=False)  # grant_created, grant_revoked, data_exported, journal_shared, account_deleted
    performed_by_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    details_json = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utc_now)

    user = relationship("User", foreign_keys=[user_id], back_populates="privacy_audit_logs")

    @property
    def details(self):
        if self.details_json:
            try:
                return json.loads(self.details_json)
            except Exception:
                return {}
        return {}


class DigitalTwinMemory(Base):
    __tablename__ = "digital_twin_memories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    baseline_version = Column(String(50), nullable=False)
    reference_period_start = Column(DateTime, nullable=True)
    reference_period_end = Column(DateTime, nullable=True)
    calculation_timestamp = Column(DateTime, default=utc_now)
    calculation_version = Column(String(20), default="2.0-adaptive")
    observation_count = Column(Integer, default=0)
    metrics_included_json = Column(Text, nullable=False)  # JSON dictionary of metrics and baseline values
    source_record_references_json = Column(Text, nullable=True)  # JSON summary of source observation IDs / date ranges
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    user = relationship("User", foreign_keys=[user_id], back_populates="digital_twin_memories")

    @property
    def metrics_included(self):
        if self.metrics_included_json:
            try:
                return json.loads(self.metrics_included_json)
            except Exception:
                return {}
        return {}

    @property
    def source_record_references(self):
        if self.source_record_references_json:
            try:
                return json.loads(self.source_record_references_json)
            except Exception:
                return []
        return []
