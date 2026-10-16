export interface User {
  id: number;
  email: string;
  full_name?: string;
  role?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: number;
  user_id: number;
  age?: number;
  biological_sex?: string;
  baseline_resting_hr: number;
  baseline_sleep_hours: number;
  baseline_caffeine_cups: number;
  baseline_hrv_ms: number;
  medical_history_notes?: string;
  has_panic_history: boolean;
  trait_anxiety_score?: number;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  email: string;
  full_name?: string;
  role?: string;
  onboarding_completed: boolean;
}

export interface PhysiologicalObservation {
  id: number;
  user_id: number;
  timestamp: string;
  source_type: 'user_entered' | 'synthetic' | 'device_measurement';
  heart_rate_bpm: number;
  heart_rate_variability_ms?: number;
  resting_heart_rate?: number;
  steps_count?: number;
}

export interface LifestyleObservation {
  id: number;
  user_id: number;
  date: string;
  source_type: string;
  sleep_hours: number;
  sleep_quality_score?: number;
  caffeine_cups: number;
  alcohol_units: number;
  exercise_minutes: number;
  smoking_count?: number;
}

export interface AnxietyCheckin {
  id: number;
  user_id: number;
  timestamp: string;
  source_type: string;
  subjective_anxiety_score: number;
  energy_level?: number;
  somatic_symptoms?: string[];
  triggers_noted?: string;
  notes?: string;
  sleep_hours?: number;
  caffeine_cups?: number;
  heart_rate_bpm?: number;
  steps_count?: number;
}

export interface TwinState {
  id: number;
  timestamp: string;
  source: string;
  composite_stress_index: number;
  physiological_arousal_score: number;
  circadian_disruption_index: number;
  baseline_deviation_score: number;
  state_label: 'STABLE_BASELINE' | 'MILD_STRAIN' | 'ELEVATED_AROUSAL' | 'HIGH_VULNERABILITY' | 'RECOVERY';
  details: {
    heart_rate_bpm?: number | null;
    hrv_ms?: number | null;
    sleep_hours?: number | null;
    caffeine_cups?: number | null;
    anxiety_score?: number | null;
    is_heart_rate_measured?: boolean;
    is_hrv_measured?: boolean;
    symptoms_reported?: string[];
    measured_inputs?: {
      heart_rate: boolean;
      hrv: boolean;
      sleep: boolean;
      caffeine: boolean;
      anxiety: boolean;
    };
    baseline_reference?: {
      mean_hr: number;
      mean_hrv: number;
      mean_sleep: number;
      mean_caffeine: number;
      mean_anxiety: number;
    };
    disclaimer?: string;
  };
}

export interface BaselineSummary {
  has_sufficient_data: boolean;
  is_cold_start?: boolean;
  required_observations_count?: number;
  personalized_model_min_days?: number;
  total_observations_count: number;
  observations_count?: number;
  unique_days_count?: number;
  date_span_days?: number;
  history_progress_percent?: number;
  status_message?: string;
  reference_prior_note?: string;
  missing_indicators?: string[];
  mean_resting_hr?: number | null;
  mean_hrv_ms?: number | null;
  mean_sleep_hours?: number | null;
  mean_caffeine_cups?: number | null;
  mean_anxiety_score?: number | null;
  std_resting_hr?: number;
  std_hrv_ms?: number;
  std_sleep_hours?: number;
  last_updated?: string;
  descriptive_baseline_ready?: boolean;
  personalized_prediction_ready?: boolean;
  personalized_prediction_requirement?: string;
}

export interface LongitudinalTrendPoint {
  date: string;
  timestamp: string;
  heart_rate?: number | null;
  hrv_ms?: number | null;
  sleep_hours?: number | null;
  caffeine_cups?: number | null;
  anxiety_score?: number | null;
  composite_stress?: number | null;
  source_type: string;
}

export interface SimulationInput {
  sleep_hours: number;
  caffeine_cups: number;
  physical_activity_mins: number;
  heart_rate_bpm: number;
  hrv_ms: number;
  self_reported_anxiety: number;
  recent_stress_exposure: number;
}

export interface PredictionResult {
  model_name: string;
  model_version: string;
  prediction_horizon: string;
  predicted_probability: number;
  uncertainty_interval: [number, number];
  risk_band: 'LOW' | 'MODERATE' | 'ELEVATED';
  calibration_reliability_note: string;
  top_contributing_factors: Array<{
    factor: string;
    current_value: number;
    population_mean?: number;
    cohort_median?: number;
    impact: string;
  }>;
  research_disclaimer: string;
  timestamp: string;
}

export interface ScenarioComparisonResult {
  scenario_a_result: any;
  scenario_b_result: any;
  differential_analysis: {
    delta_composite_stress: number;
    delta_physiological_arousal: number;
    delta_circadian_disruption: number;
    primary_divergence_driver: string;
    synthetic_label: string;
  };
  scenario_a_prediction?: PredictionResult;
  scenario_b_prediction?: PredictionResult;
  delta_predicted_probability?: number;
  non_causal_disclaimer?: string;
}

export interface PersonalizedPredictionResponse {
  status: 'ready' | 'unavailable';
  unique_history_days: number;
  required_days: number;
  prediction?: PredictionResult | null;
  message: string;
  limitation?: string | null;
  data_requirements_note?: string;
}

// ==========================================
// PHASE 6.2 CLINICIAN WORKSPACE TYPES
// ==========================================

export interface PatientCardOut {
  id: number;
  display_name: string;
  email: string;
  age_range?: string | null;
  is_demo_patient: boolean;
  total_observations_count: number;
  recent_checkin_date?: string | null;
  recent_anxiety_score?: number | null;
  baseline_status: string;
  data_completeness_percent: number;
  last_reviewed_date?: string | null;
}

export interface PatientOverviewOut {
  patient_id: number;
  display_name: string;
  email: string;
  age?: number | null;
  biological_sex?: string | null;
  is_demo_patient: boolean;
  trait_anxiety_score?: number | null;
  has_panic_history: boolean;
  baseline_status: string;
  mean_resting_hr: number;
  mean_hrv_ms: number;
  mean_sleep_hours: number;
  mean_caffeine_cups: number;
  total_observations: number;
  distinct_days: number;
  data_completeness_percent: number;
  latest_twin_state?: any | null;
  prediction_availability: 'available' | 'unavailable_cold_start';
  prediction_cold_start_message?: string | null;
  latest_review_note?: ClinicianReviewNoteOut | null;
}

export interface TimelineEventOut {
  id: string;
  timestamp: string;
  event_type: 'checkin' | 'physiological' | 'lifestyle' | 'twin_state' | 'prediction' | 'coping_feedback' | 'simulation';
  source_type: 'user_entered' | 'historical_research' | 'calculated' | 'simulated';
  is_simulated: boolean;
  title: string;
  summary: string;
  values: Record<string, any>;
  details?: Record<string, any> | null;
}

export interface TwinInsightOut {
  id: string;
  factor: string;
  category: 'autonomic' | 'circadian' | 'psychological' | 'composite';
  observation: string;
  comparison_baseline: string;
  baseline_value?: number | null;
  current_value?: number | null;
  delta?: number | null;
  delta_unit: string;
  time_window: string;
  source_provenance: string;
  data_limitation: string;
  non_causal_interpretation: string;
  direction: 'elevated' | 'suppressed' | 'stable' | 'variable';
  significance: 'high' | 'moderate' | 'low';
  supporting_record_ids: string[];
}

export interface ClinicianReviewNoteOut {
  id: number;
  patient_id: number;
  clinician_id: number;
  clinician_name?: string | null;
  review_date: string;
  reporting_period_start?: string | null;
  reporting_period_end?: string | null;
  summary_observations: string;
  discussion_topics?: string | null;
  follow_up_plan?: string | null;
  follow_up_date?: string | null;
  follow_up_status: string;
  created_at: string;
  updated_at: string;
}

export interface ClinicianReviewNoteCreate {
  reporting_period_start?: string;
  reporting_period_end?: string;
  summary_observations: string;
  discussion_topics?: string;
  follow_up_plan?: string;
  follow_up_date?: string;
  follow_up_status?: string;
}

export interface PatientAccessGrantOut {
  id: number;
  patient_id: number;
  clinician_id: number;
  clinician_name?: string | null;
  patient_email?: string | null;
  patient_name?: string | null;
  scope: string;
  access_scope?: string;
  is_active: boolean;
  created_at: string;
  granted_at?: string;
  revoked_at?: string | null;
  notes?: string | null;
}

export interface PdfExportOptions {
  include_checkins: boolean;
  include_physiology: boolean;
  include_lifestyle: boolean;
  include_digital_twin_insights: boolean;
  include_ml_predictions: boolean;
  include_clinician_notes: boolean;
  include_interventions?: boolean;
  include_simulated_data: boolean;
  reporting_period_start?: string | null;
  reporting_period_end?: string | null;
}

// ==========================================
// EARLY-WARNING & INTERVENTION ENGINE TYPES
// ==========================================

export interface BaselineComparisonMetric {
  metric_key: string;
  metric_name: string;
  current_value?: number | null;
  baseline_value?: number | null;
  delta_value?: number | null;
  unit: string;
  trend: 'elevated' | 'reduced' | 'stable' | 'disrupted' | 'unknown';
  status: 'within_range' | 'change_detected' | 'insufficient_data';
  observations_count: number;
  provenance: string;
  latest_timestamp?: string | null;
}

export interface EarlyWarningSignal {
  signal_id: string;
  signal_type: string;
  title: string;
  level: 'Within Personal Range' | 'Change Detected' | 'Insufficient Data';
  what_changed: string;
  why_flagged: string;
  evidence_summary: string;
  current_value?: number | null;
  baseline_value?: number | null;
  delta?: number | null;
  unit: string;
  timestamps: string[];
  supporting_record_ids: string[];
  data_quality: string;
  data_provenance: string;
  suggested_activity: string;
  suggested_intervention_type: string;
  limitations: string;
  is_rule_based: boolean;
}

export interface InterventionRecommendation {
  id: string;
  intervention_type: 'breathing_478' | 'grounding_54321' | 'sleep_hygiene' | 'checkin_prompt' | 'routine_monitoring';
  title: string;
  description: string;
  rational_summary: string;
  priority: 'high' | 'moderate' | 'low' | 'informational';
  estimated_duration_min: number;
  trigger_signal_id?: string | null;
  is_medical: boolean;
  disclaimer: string;
}

export interface InterventionSession {
  id: number;
  user_id: number;
  intervention_type: string;
  trigger_signal?: string | null;
  status: string;
  pre_distress_rating?: number | null;
  post_distress_rating?: number | null;
  rating_delta?: number | null;
  helpfulness?: 'helpful' | 'somewhat_helpful' | 'not_helpful' | 'prefer_not_to_say' | null;
  user_notes?: string | null;
  source_type: string;
  context_snapshot?: Record<string, any> | null;
  started_at: string;
  completed_at?: string | null;
}

export interface InterventionSessionCreate {
  intervention_type: string;
  trigger_signal?: string;
  status?: string;
  pre_distress_rating?: number;
  post_distress_rating?: number;
  helpfulness?: string;
  user_notes?: string;
  source_type?: string;
  context_snapshot?: Record<string, any>;
}

export interface InterventionsStatusResponse {
  baseline_status: string;
  is_cold_start: boolean;
  metrics: BaselineComparisonMetric[];
  signals: EarlyWarningSignal[];
  recommendations: InterventionRecommendation[];
  insufficient_data_reasons: string[];
  disclaimer: string;
}

// =========================================================================
// FEATURE 1: PERSONAL TRIGGER & PATTERN DISCOVERY TYPES
// =========================================================================

export interface DiscoveredPattern {
  id: number;
  user_id: number;
  pattern_type: 'context_trigger' | 'sleep_distress' | 'vitals_shift' | 'coping_efficacy';
  title: string;
  description: string;
  trigger_context?: string | null;
  distress_correlation?: number | null;
  observation_count: number;
  time_range?: string | null;
  confidence_level: 'preliminary' | 'moderate' | 'robust';
  status: 'active' | 'dismissed' | 'relevant' | 'irrelevant';
  evidence_summary?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  non_causal_disclaimer: string;

  // Compatibility fields
  user_status?: string;
  confidence_score?: number;
  time_range_start?: string;
  time_range_end?: string;
  evidence_explanation?: string;
  factors_json?: Record<string, any>;
}

export interface PatternAnalysisResponse {
  patterns: DiscoveredPattern[];
  analyzed_checkin_count: number;
  analyzed_observation_days: number;
  insufficient_data: boolean;
  disclaimer: string;
}

export interface PatternSummary {
  total_checkins: number;
  distinct_days_recorded: number;
  top_context_factors: Array<{ factor: string; count: number }>;
  calendar_heatmap: Array<{ date: string; count: number }>;
  disclaimer: string;
}

// =========================================================================
// FEATURE 2: PERSONALIZED WELLNESS GOALS & CARE PLAN TYPES
// =========================================================================

export interface WellnessGoal {
  id: number;
  user_id: number;
  title: string;
  description?: string | null;
  category: 'checkin' | 'sleep_routine' | 'breathing' | 'grounding' | 'journaling' | 'physical_activity';
  target_frequency: string;
  target_count: number;
  start_date?: string | null;
  end_date?: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  current_week_progress: number;
  current_week_target: number;
  is_on_track: boolean;
  created_at: string;
  updated_at: string;
}

export interface WellnessGoalCreate {
  title: string;
  description?: string;
  category: string;
  target_frequency: string;
  target_count: number;
  start_date?: string;
  end_date?: string;
}

export interface GoalSuggestion {
  title: string;
  description: string;
  category: string;
  target_frequency: string;
  target_count: number;
  rationale: string;
}

export interface WeeklyCarePlanSummary {
  week_start: string;
  week_end: string;
  planned_goals_count: number;
  active_goals: WellnessGoal[];
  total_completed_activities: number;
  total_planned_activities: number;
  completion_rate_pct: number;
  user_helpfulness_summary: Record<string, number>;
  supportive_message: string;
  disclaimer: string;
}

// =========================================================================
// FEATURE 3: EMOTION JOURNAL & CONTEXT CAPTURE TYPES
// =========================================================================

export interface EmotionJournalEntry {
  id: number;
  user_id: number;
  title?: string | null;
  content: string;
  mood_tags: string[];
  distress_rating?: number | null;
  context_tags: string[];
  prompt_responses?: Record<string, string> | null;
  is_private: boolean;
  shared_with_clinician: boolean;
  linked_checkin_id?: number | null;
  ai_summary?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmotionJournalEntryCreate {
  title?: string;
  content: string;
  mood_tags?: string[];
  distress_rating?: number;
  context_tags?: string[];
  prompt_responses?: Record<string, string>;
  is_private?: boolean;
  shared_with_clinician?: boolean;
  linked_checkin_id?: number;
}

export interface JournalThemeSummaryResponse {
  themes: string[];
  summary_text: string;
  entry_count: number;
  is_ai_generated: boolean;
  distinction_notice: string;
}

// =========================================================================
// FEATURE 4: DIGITAL TWIN CONFIDENCE & DATA QUALITY CENTER TYPES
// =========================================================================

export interface ObservationCoverage {
  total_observations: number;
  distinct_recording_days: number;
  available_metrics: Record<string, boolean>;
  missing_metrics: string[];
  most_recent_timestamp?: string | null;
  recency_status: 'fresh' | 'stale' | 'insufficient';
}

export interface DataProvenanceBreakdown {
  measured_device_count: number;
  user_reported_count: number;
  simulated_synthetic_count: number;
  derived_indices_count: number;
  measured_pct: number;
  user_reported_pct: number;
  simulated_pct: number;
  derived_pct: number;
}

export interface BaselineReliability {
  is_calibrated: boolean;
  baseline_days_used: number;
  minimum_days_required: number;
  baseline_period?: string | null;
  is_outdated: boolean;
  unavailable_metrics: string[];
  reliability_tier: 'high' | 'moderate' | 'preliminary' | 'uncalibrated';
}

export interface InsightTransparencyRule {
  indicator_name: string;
  rule_or_formula: string;
  inputs_used: string[];
  target_or_prediction_horizon: string;
  known_limitations: string;
}

export interface DataQualityWarning {
  code: string;
  severity: 'info' | 'warning' | 'caution';
  title: string;
  message: string;
  suggested_action: string;
}

export interface DataQualityCenter {
  coverage: ObservationCoverage;
  provenance: DataProvenanceBreakdown;
  baseline_reliability: BaselineReliability;
  transparency_rules: InsightTransparencyRule[];
  warnings: DataQualityWarning[];
  synthetic_data_isolated: boolean;
  disclaimer: string;
}

// =========================================================================
// FEATURE 5: CLINICIAN FOLLOW-UP & CARE COORDINATION TYPES
// =========================================================================

export interface ClinicianFollowUpTask {
  id: number;
  patient_id: number;
  patient_name?: string | null;
  clinician_id: number;
  clinician_name?: string | null;
  title: string;
  description?: string | null;
  patient_visible_notes?: string | null;
  due_date?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  is_patient_visible: boolean;
  patient_acknowledged: boolean;
  patient_response_notes?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface ClinicianFollowUpTaskCreate {
  patient_id: number;
  title: string;
  description?: string;
  patient_visible_notes?: string;
  due_date?: string;
  priority?: string;
  is_patient_visible?: boolean;
}

export interface ClinicianTasksOverview {
  total_active: number;
  upcoming_tasks: ClinicianFollowUpTask[];
  overdue_tasks: ClinicianFollowUpTask[];
  completed_tasks: ClinicianFollowUpTask[];
}

// =========================================================================
// FEATURE 6: SCENARIO REPLAY & COMPARISON TYPES
// =========================================================================

export interface ScenarioReplayStep {
  step_index: number;
  hour_offset: number;
  heart_rate_bpm: number;
  hrv_ms: number;
  composite_stress_index: number;
  physiological_arousal_score: number;
  circadian_disruption_index: number;
  state_label: string;
}

export interface ScenarioReplayResponse {
  scenario_name: string;
  seed: number;
  baseline_profile: string;
  steps: ScenarioReplayStep[];
  synthetic_notice: string;
  reproducibility_hash: string;
}

// =========================================================================
// FEATURE 7: WEEKLY PERSONAL INSIGHTS REPORT TYPES
// =========================================================================

export interface WeeklyReportOut {
  period_start: string;
  period_end: string;
  checkin_count: number;
  avg_distress_rating?: number | null;
  distress_trend: string;
  resting_hr_avg?: number | null;
  hrv_avg_ms?: number | null;
  sleep_avg_hours?: number | null;
  baseline_deviations: Array<{
    metric: string;
    weekly_average: number;
    baseline: number;
    delta: string;
    interpretation: string;
  }>;
  recurring_patterns: Array<{
    title: string;
    confidence: string;
    observation_count: number;
    description: string;
  }>;
  coping_interventions_summary: {
    total_completed: number;
    reported_helpful: number;
    average_distress_reduction: number;
    interventions_used: string[];
  };
  wellness_goals_progress: Array<{
    title: string;
    category: string;
    progress: number;
    target: number;
    is_on_track: boolean;
  }>;
  private_reflections_included: boolean;
  reflections_summary?: string | null;
  data_quality_notices: string[];
  disclaimer: string;
}

// =========================================================================
// FEATURE 8: PRIVACY & CONSENT CENTER TYPES
// =========================================================================

export interface PrivacyDashboard {
  user_email: string;
  stored_categories: Array<{
    category_name: string;
    data_type: string;
    provenance: string;
    accessible_by: string;
    retention: string;
  }>;
  role_access_matrix: Array<{
    role: string;
    access_level: string;
    scope: string;
  }>;
  active_grants_count: number;
  revoked_grants_count: number;
  recent_audit_count: number;
  retention_policy_summary: string;
}

export interface PrivacyAuditLog {
  id: number;
  user_id: number;
  action: string;
  performed_by_id: number;
  details?: Record<string, any> | null;
  timestamp: string;
}

export interface PatientAccessGrantOut {
  id: number;
  patient_id: number;
  clinician_id: number;
  patient_email?: string | null;
  patient_name?: string | null;
  clinician_name?: string | null;
  scope: string;
  access_scope?: string;
  is_active: boolean;
  created_at: string;
  granted_at?: string;
  revoked_at?: string | null;
  notes?: string | null;
}

// =========================================================================
// FEATURE: ADAPTIVE DIGITAL TWIN & LONGITUDINAL EVOLUTION TYPES
// =========================================================================

export interface PersonalizedMetricSummary {
  metric_key: string;
  display_name: string;
  current_value: number | null;
  baseline_value: number | null;
  unit: string;
  observation_count: number;
  observation_period: string;
  most_recent_timestamp: string | null;
  provenance: 'device_measured' | 'user_reported' | 'derived' | 'reference_demo';
  sufficient_data: boolean;
  status_note: string;
}

export interface PersonalizedInitializationResponse {
  user_id: number | null;
  is_personalized: boolean;
  data_mode: 'personalized' | 'generic_demo';
  profile_id: string;
  profile_name: string;
  baseline_summary: BaselineSummary;
  metrics: PersonalizedMetricSummary[];
  sufficient_data: boolean;
  disclaimer: string;
}

export interface ScenarioDifferenceItem {
  parameter: string;
  display_name: string;
  baseline_val: any;
  alternative_val: any;
  unit: string;
  delta_display: string;
  has_modeled_effect: boolean;
  effect_explanation: string;
}

export interface ExplainableScenarioComparisonResponse {
  scenario_a_result: Record<string, any>;
  scenario_b_result: Record<string, any>;
  differential_analysis: Record<string, any>;
  scenario_a_prediction?: Record<string, any> | null;
  scenario_b_prediction?: Record<string, any> | null;
  delta_predicted_probability?: number | null;
  inputs_changed: ScenarioDifferenceItem[];
  outputs_changed: Array<{
    metric: string;
    display_name: string;
    baseline_value: any;
    alternative_value: any;
    delta: number;
    unit: string;
    interpretation: string;
  }>;
  unmodeled_inputs: string[];
  calculation_explanations: string[];
  scientific_limitations: string[];
  reproducibility_hash: string;
  engine_version: string;
  non_causal_disclaimer: string;
}

export interface CounterfactualPerturbationRequest {
  parameter_to_vary: string;
  perturbed_value: number;
  base_scenario: SimulationInput;
  baseline_profile_id?: string;
  seed?: number;
}

export interface CounterfactualPerturbationResponse {
  parameter_varied: string;
  original_input: number;
  alternative_input: number;
  input_delta: number;
  base_state: Record<string, any>;
  counterfactual_state: Record<string, any>;
  metric_deltas: {
    delta_composite_stress: number;
    delta_physiological_arousal: number;
    delta_circadian_disruption: number;
    delta_baseline_deviation: number;
  };
  simulation_rule_explanation: string;
  formula_attribution: string;
  unmodeled_effect_note?: string | null;
  provenance_notice: string;
}

export interface BaselineEvolutionWindow {
  window_label: string;
  start_date: string;
  end_date: string;
  observation_count: number;
  unique_days: number;
  mean_resting_hr: number | null;
  mean_hrv_ms: number | null;
  mean_sleep_hours: number | null;
  mean_caffeine_cups: number | null;
  mean_anxiety_score: number | null;
  composite_stress_index: number | null;
  delta_vs_prior?: Record<string, number | null> | null;
  provenance: string;
  sufficient_data: boolean;
  data_quality_notes: string[];
}

export interface LongitudinalBaselineEvolutionOut {
  user_id: number;
  current_baseline_version: string;
  calculation_timestamp: string;
  windows: BaselineEvolutionWindow[];
  change_explanations: string[];
  has_sufficient_longitudinal_data: boolean;
  isolation_notice: string;
}

export interface DigitalTwinMemoryOut {
  id: number;
  user_id: number;
  baseline_version: string;
  calculation_timestamp: string;
  calculation_version: string;
  observation_count: number;
  metrics_included: Record<string, any>;
  source_record_references: any[];
  is_active: boolean;
  notes?: string | null;
  created_at: string;
}

// =========================================================================
// AI CLINICAL ASSISTANT TYPES
// =========================================================================

export interface AIAssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  provenance?: string[];
  citations?: string[];
  tool_calls?: Array<{ tool: string; result: any }>;
  provider?: string;
  model?: string;
}

export interface AIAssistantConfig {
  active_provider: string;
  model: string;
  is_live_hosted: boolean;
  supported_providers: string[];
  available_tools: string[];
  safety_guardrail_active: boolean;
}

