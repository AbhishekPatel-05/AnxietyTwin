import {
  AuthResponse,
  UserProfile,
  PhysiologicalObservation,
  LifestyleObservation,
  AnxietyCheckin,
  TwinState,
  BaselineSummary,
  LongitudinalTrendPoint,
  SimulationInput,
  PredictionResult,
  ScenarioComparisonResult,
  PersonalizedPredictionResponse,
  PatientCardOut,
  PatientOverviewOut,
  TimelineEventOut,
  TwinInsightOut,
  ClinicianReviewNoteOut,
  ClinicianReviewNoteCreate,
  PatientAccessGrantOut,
  PdfExportOptions,
  InterventionsStatusResponse,
  InterventionSession,
  InterventionSessionCreate,
  DiscoveredPattern,
  PatternAnalysisResponse,
  PatternSummary,
  WellnessGoal,
  WellnessGoalCreate,
  GoalSuggestion,
  WeeklyCarePlanSummary,
  EmotionJournalEntry,
  EmotionJournalEntryCreate,
  JournalThemeSummaryResponse,
  DataQualityCenter,
  ClinicianFollowUpTask,
  ClinicianFollowUpTaskCreate,
  ClinicianTasksOverview,
  ScenarioReplayResponse,
  WeeklyReportOut,
  PrivacyDashboard,
  PrivacyAuditLog,
  PersonalizedInitializationResponse,
  ExplainableScenarioComparisonResponse,
  CounterfactualPerturbationRequest,
  CounterfactualPerturbationResponse,
  LongitudinalBaselineEvolutionOut,
  DigitalTwinMemoryOut,
  AIAssistantMessage,
  AIAssistantConfig,
} from '../types';

const API_BASE = (import.meta.env?.VITE_API_URL as string) || '/api';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('anxietytwin_token');
  }

  public setToken(token: string): void {
    localStorage.setItem('anxietytwin_token', token);
  }

  public clearToken(): void {
    localStorage.removeItem('anxietytwin_token');
    localStorage.removeItem('anxietytwin_user');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Clear token if expired or invalid
      this.clearToken();
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register') && window.location.pathname !== '/') {
        window.location.href = '/login';
      }
    }

    if (!response.ok) {
      let errorMsg = 'An error occurred';
      try {
        const errorData = await response.json();
        errorMsg = errorData.detail || errorData.message || response.statusText;
      } catch {
        errorMsg = response.statusText;
      }
      throw new Error(errorMsg);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // Auth
  async register(data: { email: string; password: string; full_name?: string }): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(res.access_token);
    localStorage.setItem('anxietytwin_user', JSON.stringify(res));
    return res;
  }

  async login(data: { email: string; password: string }): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(res.access_token);
    localStorage.setItem('anxietytwin_user', JSON.stringify(res));
    return res;
  }

  async getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('/auth/profile');
  }

  async updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    return this.request<UserProfile>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async completeOnboarding(data: any): Promise<UserProfile> {
    const res = await this.request<UserProfile>('/auth/onboarding', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const userStr = localStorage.getItem('anxietytwin_user');
    if (userStr) {
      const u = JSON.parse(userStr);
      u.onboarding_completed = true;
      localStorage.setItem('anxietytwin_user', JSON.stringify(u));
    }
    return res;
  }

  async deleteAccount(): Promise<void> {
    await this.request('/auth/me', { method: 'DELETE' });
    this.clearToken();
  }

  // Observations
  async addPhysiological(data: Partial<PhysiologicalObservation>): Promise<PhysiologicalObservation> {
    return this.request<PhysiologicalObservation>('/observations/physiological', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addLifestyle(data: Partial<LifestyleObservation>): Promise<LifestyleObservation> {
    return this.request<LifestyleObservation>('/observations/lifestyle', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getObservationHistory(limit = 50): Promise<{
    physiological: PhysiologicalObservation[];
    lifestyle: LifestyleObservation[];
    checkins: AnxietyCheckin[];
  }> {
    return this.request(`/observations/history?limit=${limit}`);
  }

  async updatePhysiological(id: number, data: Partial<PhysiologicalObservation>): Promise<PhysiologicalObservation> {
    return this.request<PhysiologicalObservation>(`/observations/physiological/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateLifestyle(id: number, data: Partial<LifestyleObservation>): Promise<LifestyleObservation> {
    return this.request<LifestyleObservation>(`/observations/lifestyle/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteObservation(type: 'physiological' | 'lifestyle' | 'checkin', id: number): Promise<void> {
    return this.request(`/observations/${type}/${id}`, { method: 'DELETE' });
  }

  // Check-ins
  async createCheckin(data: {
    subjective_anxiety_score: number;
    energy_level?: number;
    somatic_symptoms?: string[];
    triggers_noted?: string;
    notes?: string;
    sleep_hours?: number;
    caffeine_cups?: number;
    heart_rate_bpm?: number;
    steps_count?: number;
  }): Promise<{
    checkin: AnxietyCheckin;
    twin_state_updated: {
      state_label: string;
      composite_stress_index: number;
      baseline_deviation_score: number;
    };
    safety_guidance: any;
  }> {
    return this.request('/checkins', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCheckin(id: number, data: Partial<AnxietyCheckin>): Promise<any> {
    return this.request(`/checkins/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCheckin(id: number): Promise<void> {
    return this.request(`/checkins/${id}`, { method: 'DELETE' });
  }

  async getCheckins(limit = 50): Promise<AnxietyCheckin[]> {
    return this.request(`/checkins?limit=${limit}`);
  }

  // Digital Twin
  async getTwinState(): Promise<TwinState> {
    return this.request<TwinState>('/twin/state');
  }

  async getBaseline(): Promise<BaselineSummary> {
    return this.request<BaselineSummary>('/twin/baseline');
  }

  async getTrends(days = 30): Promise<{ points: LongitudinalTrendPoint[]; total_count: number }> {
    return this.request(`/twin/trends?days=${days}`);
  }

  async playSyntheticStream(participant_id = 'SYM2-1-285', days_to_stream = 7): Promise<any> {
    return this.request('/twin/synthetic-stream', {
      method: 'POST',
      body: JSON.stringify({ participant_id, days_to_stream }),
    });
  }

  // Simulation Lab
  async getSimulationProfiles(): Promise<{ profiles: any[] }> {
    return this.request('/simulation/profiles');
  }

  async runSimulation(inputs: SimulationInput, profile_id = 'DEMO-PATIENT-01'): Promise<any> {
    return this.request(`/simulation/run?profile_id=${profile_id}`, {
      method: 'POST',
      body: JSON.stringify(inputs),
    });
  }

  async compareScenarios(scenario_a: SimulationInput, scenario_b: SimulationInput, profile_id = 'DEMO-PATIENT-01'): Promise<ScenarioComparisonResult> {
    return this.request<ScenarioComparisonResult>('/simulation/compare', {
      method: 'POST',
      body: JSON.stringify({ scenario_a, scenario_b, baseline_profile_id: profile_id }),
    });
  }

  async saveScenario(name: string, description: string, inputs: SimulationInput, profile_id = 'DEMO-PATIENT-01'): Promise<any> {
    return this.request('/simulation/scenarios', {
      method: 'POST',
      body: JSON.stringify({ name, description, baseline_patient_id: profile_id, inputs }),
    });
  }

  async listSavedScenarios(): Promise<any[]> {
    return this.request('/simulation/scenarios');
  }

  async deleteScenario(scenarioId: number): Promise<void> {
    return this.request(`/simulation/scenarios/${scenarioId}`, { method: 'DELETE' });
  }

  // Adaptive Digital Twin & Longitudinal Evolution Engine
  async getAdaptiveBaselineInitialization(): Promise<PersonalizedInitializationResponse> {
    return this.request<PersonalizedInitializationResponse>('/simulation/adaptive/initialize');
  }

  async compareScenariosAdaptive(
    scenario_a: SimulationInput,
    scenario_b: SimulationInput,
    baseline_profile_id = 'DEMO-PATIENT-01'
  ): Promise<ExplainableScenarioComparisonResponse> {
    return this.request<ExplainableScenarioComparisonResponse>('/simulation/adaptive/compare', {
      method: 'POST',
      body: JSON.stringify({ scenario_a, scenario_b, baseline_profile_id }),
    });
  }

  async runCounterfactualPerturbation(
    req: CounterfactualPerturbationRequest
  ): Promise<CounterfactualPerturbationResponse> {
    return this.request<CounterfactualPerturbationResponse>('/simulation/adaptive/counterfactual', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async getBaselineEvolution(
    windowDays = 7,
    maxWindows = 4
  ): Promise<LongitudinalBaselineEvolutionOut> {
    return this.request<LongitudinalBaselineEvolutionOut>(
      `/twin/evolution?window_days=${windowDays}&max_windows=${maxWindows}`
    );
  }

  async getDigitalTwinMemories(): Promise<DigitalTwinMemoryOut[]> {
    return this.request<DigitalTwinMemoryOut[]>('/twin/memory');
  }

  async resetDigitalTwinMemory(): Promise<{
    status: string;
    message: string;
    authentic_records_preserved: boolean;
    detail: string;
  }> {
    return this.request('/twin/memory/reset', { method: 'POST' });
  }

  async snapshotDigitalTwinMemory(): Promise<DigitalTwinMemoryOut> {
    return this.request<DigitalTwinMemoryOut>('/twin/memory/snapshot', { method: 'POST' });
  }

  // ML Prediction
  async predictPanicRisk(data: any): Promise<PredictionResult> {
    return this.request<PredictionResult>('/prediction/predict', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPersonalizedPrediction(): Promise<PersonalizedPredictionResponse> {
    return this.request<PersonalizedPredictionResponse>('/prediction/personalized');
  }

  async getModelMetadata(): Promise<any> {
    return this.request('/prediction/metadata');
  }

  async getPredictionHistory(): Promise<any[]> {
    return this.request('/prediction/history');
  }

  // Health
  async checkHealth(): Promise<any> {
    return this.request('/health');
  }

  // ==========================================
  // PHASE 6.2 CLINICIAN WORKSPACE API
  // ==========================================

  async getClinicianPatients(): Promise<PatientCardOut[]> {
    return this.request<PatientCardOut[]>('/clinician/patients');
  }

  async getPatientOverview(patientId: number): Promise<PatientOverviewOut> {
    return this.request<PatientOverviewOut>(`/clinician/patients/${patientId}/overview`);
  }

  async getPatientTimeline(
    patientId: number,
    params?: {
      period_days?: number;
      start_date?: string;
      end_date?: string;
      event_types?: string;
      hide_simulated?: boolean;
    }
  ): Promise<TimelineEventOut[]> {
    const query = new URLSearchParams();
    if (params?.period_days) query.set('period_days', params.period_days.toString());
    if (params?.start_date) query.set('start_date', params.start_date);
    if (params?.end_date) query.set('end_date', params.end_date);
    if (params?.event_types) query.set('event_types', params.event_types);
    if (params?.hide_simulated !== undefined) query.set('hide_simulated', params.hide_simulated.toString());
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<TimelineEventOut[]>(`/clinician/patients/${patientId}/timeline${queryString}`);
  }

  async getClinicalInsights(
    patientId: number,
    params?: {
      period_days?: number;
      start_date?: string;
      end_date?: string;
    }
  ): Promise<TwinInsightOut[]> {
    const query = new URLSearchParams();
    if (params?.period_days) query.set('period_days', params.period_days.toString());
    if (params?.start_date) query.set('start_date', params.start_date);
    if (params?.end_date) query.set('end_date', params.end_date);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<TwinInsightOut[]>(`/clinician/patients/${patientId}/insights${queryString}`);
  }

  async getPatientNotes(patientId: number): Promise<ClinicianReviewNoteOut[]> {
    return this.request<ClinicianReviewNoteOut[]>(`/clinician/patients/${patientId}/notes`);
  }

  async createPatientNote(patientId: number, note: ClinicianReviewNoteCreate): Promise<ClinicianReviewNoteOut> {
    return this.request<ClinicianReviewNoteOut>(`/clinician/patients/${patientId}/notes`, {
      method: 'POST',
      body: JSON.stringify(note),
    });
  }

  async updatePatientNote(
    patientId: number,
    noteId: number,
    update: Partial<ClinicianReviewNoteCreate>
  ): Promise<ClinicianReviewNoteOut> {
    return this.request<ClinicianReviewNoteOut>(`/clinician/patients/${patientId}/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    });
  }

  async downloadPatientPdfSummary(patientId: number, options: PdfExportOptions): Promise<Blob> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE}/clinician/patients/${patientId}/pdf-summary`, {
      method: 'POST',
      headers,
      body: JSON.stringify(options),
    });
    if (!response.ok) {
      let errorMsg = 'Failed to generate PDF summary';
      try {
        const errorData = await response.json();
        errorMsg = errorData.detail || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }
    return response.blob();
  }

  async resetDemoPatient(): Promise<{ status: string; patient_id: number; message: string }> {
    return this.request<{ status: string; patient_id: number; message: string }>('/clinician/demo/reset', {
      method: 'POST',
    });
  }

  async listAccessGrants(): Promise<PatientAccessGrantOut[]> {
    return this.request<PatientAccessGrantOut[]>('/clinician/grants');
  }

  async createAccessGrant(data: { patient_email?: string; patient_id?: number; scope?: string; notes?: string }): Promise<PatientAccessGrantOut> {
    return this.request<PatientAccessGrantOut>('/clinician/grants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokeAccessGrant(grantId: number): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>(`/clinician/grants/${grantId}/revoke`, {
      method: 'POST',
    });
  }

  // ==========================================
  // EARLY-WARNING & INTERVENTIONS ENGINE API
  // ==========================================

  async getInterventionsStatus(windowHours: number = 72): Promise<InterventionsStatusResponse> {
    return this.request<InterventionsStatusResponse>(`/interventions/status?window_hours=${windowHours}`);
  }

  async getInterventionsHistory(params?: {
    period_days?: number;
    activity_type?: string;
    signal_type?: string;
    status?: string;
    source_type?: string;
    hide_simulated?: boolean;
    limit?: number;
  }): Promise<InterventionSession[]> {
    const query = new URLSearchParams();
    if (params?.period_days) query.set('period_days', params.period_days.toString());
    if (params?.activity_type && params.activity_type !== 'all') query.set('activity_type', params.activity_type);
    if (params?.signal_type && params.signal_type !== 'all') query.set('signal_type', params.signal_type);
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.source_type && params.source_type !== 'all') query.set('source_type', params.source_type);
    if (params?.hide_simulated !== undefined) query.set('hide_simulated', params.hide_simulated.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    const qStr = query.toString() ? `?${query.toString()}` : '';
    return this.request<InterventionSession[]>(`/interventions/history${qStr}`);
  }

  async recordIntervention(data: InterventionSessionCreate): Promise<InterventionSession> {
    return this.request<InterventionSession>('/interventions/record', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async evaluateSyntheticScenario(payload: { sample: any; baseline: any }): Promise<InterventionsStatusResponse> {
    return this.request<InterventionsStatusResponse>('/interventions/evaluate-scenario', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getPatientInterventions(
    patientId: number,
    params?: {
      period_days?: number;
      activity_type?: string;
      signal_type?: string;
      status?: string;
      source_type?: string;
      hide_simulated?: boolean;
    }
  ): Promise<{ status: InterventionsStatusResponse; history: InterventionSession[] }> {
    const query = new URLSearchParams();
    if (params?.period_days) query.set('period_days', params.period_days.toString());
    if (params?.activity_type && params.activity_type !== 'all') query.set('activity_type', params.activity_type);
    if (params?.signal_type && params.signal_type !== 'all') query.set('signal_type', params.signal_type);
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.source_type && params.source_type !== 'all') query.set('source_type', params.source_type);
    if (params?.hide_simulated !== undefined) query.set('hide_simulated', params.hide_simulated.toString());
    const qStr = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ status: InterventionsStatusResponse; history: InterventionSession[] }>(
      `/clinician/patients/${patientId}/interventions${qStr}`
    );
  }

  private async requestBlob(endpoint: string, options: RequestInit = {}): Promise<Blob> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }
    return response.blob();
  }

  // ==========================================
  // FEATURE 1: PATTERNS
  // ==========================================
  async getPatterns(status?: string): Promise<DiscoveredPattern[]> {
    const q = status ? `?status_filter=${status}` : '';
    return this.request<DiscoveredPattern[]>(`/patterns${q}`);
  }

  async discoverPatterns(): Promise<PatternAnalysisResponse> {
    return this.request<PatternAnalysisResponse>('/patterns/discover', { method: 'POST' });
  }

  async updatePatternFeedback(id: number, status: string): Promise<DiscoveredPattern> {
    return this.request<DiscoveredPattern>(`/patterns/${id}/feedback`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async getPatternSummary(): Promise<PatternSummary> {
    return this.request<PatternSummary>('/patterns/summary');
  }

  // ==========================================
  // FEATURE 2: WELLNESS GOALS & CARE PLAN
  // ==========================================
  async getGoals(status?: string): Promise<WellnessGoal[]> {
    const q = status ? `?status_filter=${status}` : '';
    return this.request<WellnessGoal[]>(`/goals${q}`);
  }

  async createGoal(data: WellnessGoalCreate): Promise<WellnessGoal> {
    return this.request<WellnessGoal>('/goals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateGoal(id: number, data: Partial<WellnessGoalCreate & { status: string }>): Promise<WellnessGoal> {
    return this.request<WellnessGoal>(`/goals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteGoal(id: number): Promise<void> {
    return this.request<void>(`/goals/${id}`, { method: 'DELETE' });
  }

  async getGoalSuggestions(): Promise<GoalSuggestion[]> {
    return this.request<GoalSuggestion[]>('/goals/suggestions');
  }

  async getWeeklyCarePlanSummary(): Promise<WeeklyCarePlanSummary> {
    return this.request<WeeklyCarePlanSummary>('/goals/weekly-summary');
  }

  // ==========================================
  // FEATURE 3: EMOTION JOURNAL
  // ==========================================
  async getJournalEntries(params?: {
    search?: string;
    mood_tag?: string;
    context_tag?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<EmotionJournalEntry[]> {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.mood_tag) q.set('mood_tag', params.mood_tag);
    if (params?.context_tag) q.set('context_tag', params.context_tag);
    if (params?.start_date) q.set('start_date', params.start_date);
    if (params?.end_date) q.set('end_date', params.end_date);
    const qStr = q.toString() ? `?${q.toString()}` : '';
    return this.request<EmotionJournalEntry[]>(`/journal${qStr}`);
  }

  async createJournalEntry(data: EmotionJournalEntryCreate): Promise<EmotionJournalEntry> {
    return this.request<EmotionJournalEntry>('/journal', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateJournalEntry(id: number, data: Partial<EmotionJournalEntryCreate>): Promise<EmotionJournalEntry> {
    return this.request<EmotionJournalEntry>(`/journal/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteJournalEntry(id: number): Promise<void> {
    return this.request<void>(`/journal/${id}`, { method: 'DELETE' });
  }

  async generateJournalThemeSummary(entryIds?: number[], userConsent: boolean = true): Promise<JournalThemeSummaryResponse> {
    return this.request<JournalThemeSummaryResponse>('/journal/theme-summary', {
      method: 'POST',
      body: JSON.stringify({ entry_ids: entryIds, user_consent: userConsent }),
    });
  }

  // ==========================================
  // FEATURE 4: DATA QUALITY CENTER
  // ==========================================
  async getDataQualitySummary(): Promise<DataQualityCenter> {
    return this.request<DataQualityCenter>('/data-quality/summary');
  }

  async getPatientDataQuality(patientId: number): Promise<DataQualityCenter> {
    return this.request<DataQualityCenter>(`/data-quality/patient/${patientId}`);
  }

  // ==========================================
  // FEATURE 5: CLINICIAN FOLLOW-UP TASKS
  // ==========================================
  async getPatientFollowUpTasks(patientId: number): Promise<ClinicianFollowUpTask[]> {
    return this.request<ClinicianFollowUpTask[]>(`/clinician/patients/${patientId}/tasks`);
  }

  async createFollowUpTask(data: ClinicianFollowUpTaskCreate): Promise<ClinicianFollowUpTask> {
    return this.request<ClinicianFollowUpTask>(`/clinician/patients/${data.patient_id}/tasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFollowUpTask(id: number, data: Partial<ClinicianFollowUpTaskCreate & { status: string }>): Promise<ClinicianFollowUpTask> {
    return this.request<ClinicianFollowUpTask>(`/clinician/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getClinicianTasksOverview(): Promise<ClinicianTasksOverview> {
    return this.request<ClinicianTasksOverview>('/clinician/tasks/overview');
  }

  async getPatientVisibleTasks(): Promise<ClinicianFollowUpTask[]> {
    return this.request<ClinicianFollowUpTask[]>('/clinician/patient-tasks');
  }

  async acknowledgePatientTask(id: number, notes?: string): Promise<ClinicianFollowUpTask> {
    return this.request<ClinicianFollowUpTask>(`/clinician/patient-tasks/${id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ patient_response_notes: notes }),
    });
  }

  // ==========================================
  // FEATURE 6: DETERMINISTIC REPLAY & COMPARISON PDF
  // ==========================================
  async replayScenario(data: {
    scenario_input: any;
    baseline_profile_id?: string;
    seed?: number;
    steps_count?: number;
  }): Promise<ScenarioReplayResponse> {
    return this.request<ScenarioReplayResponse>('/simulation/replay', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async exportScenarioComparisonPdf(data: {
    scenario_a: any;
    scenario_b: any;
    scenario_a_name?: string;
    scenario_b_name?: string;
    baseline_profile_id?: string;
  }): Promise<Blob> {
    return this.requestBlob('/simulation/comparison-report/pdf', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ==========================================
  // FEATURE 7: WEEKLY PERSONAL INSIGHTS REPORT
  // ==========================================
  async getWeeklyReport(params?: {
    start_date?: string;
    end_date?: string;
    include_journal_summary?: boolean;
    include_goals?: boolean;
    include_patterns?: boolean;
  }): Promise<WeeklyReportOut> {
    const q = new URLSearchParams();
    if (params?.start_date) q.set('start_date', params.start_date);
    if (params?.end_date) q.set('end_date', params.end_date);
    if (params?.include_journal_summary !== undefined) q.set('include_journal_summary', params.include_journal_summary.toString());
    if (params?.include_goals !== undefined) q.set('include_goals', params.include_goals.toString());
    if (params?.include_patterns !== undefined) q.set('include_patterns', params.include_patterns.toString());
    const qStr = q.toString() ? `?${q.toString()}` : '';
    return this.request<WeeklyReportOut>(`/reports/weekly${qStr}`);
  }

  async exportWeeklyReportPdf(data: {
    start_date?: string;
    end_date?: string;
    include_journal_summary?: boolean;
    include_goals?: boolean;
    include_patterns?: boolean;
  }): Promise<Blob> {
    return this.requestBlob('/reports/weekly/pdf', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ==========================================
  // FEATURE 8: PRIVACY & CONSENT CENTER
  // ==========================================
  async getPrivacyDashboard(): Promise<PrivacyDashboard> {
    return this.request<PrivacyDashboard>('/privacy/dashboard');
  }

  async getPrivacyGrants(): Promise<PatientAccessGrantOut[]> {
    return this.request<PatientAccessGrantOut[]>('/privacy/grants');
  }

  async grantClinicianAccess(data: {
    clinician_id?: number;
    clinician_email?: string;
    scope?: string;
    notes?: string;
  }): Promise<PatientAccessGrantOut> {
    return this.request<PatientAccessGrantOut>('/privacy/grants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokePrivacyGrant(grantId: number): Promise<{ message: string; grant_id: number; is_active: boolean }> {
    return this.request<{ message: string; grant_id: number; is_active: boolean }>(`/privacy/grants/${grantId}/revoke`, {
      method: 'POST',
    });
  }

  async getPrivacyAuditLog(limit: number = 50): Promise<PrivacyAuditLog[]> {
    return this.request<PrivacyAuditLog[]>(`/privacy/audit-log?limit=${limit}`);
  }

  async exportUserDataBundle(): Promise<Blob> {
    return this.requestBlob('/privacy/export', { method: 'GET' });
  }

  async deleteUserAccount(password: string, confirmationPhrase: string): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>('/privacy/delete-account', {
      method: 'POST',
      body: JSON.stringify({ password, confirmation_phrase: confirmationPhrase }),
    });
  }

  // ==========================================
  // AI CLINICAL ASSISTANT
  // ==========================================
  async chatWithAssistant(message: string, sessionId: string = 'default'): Promise<AIAssistantMessage> {
    return this.request<AIAssistantMessage>('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ message, session_id: sessionId }),
    });
  }

  async getAssistantHistory(sessionId: string = 'default'): Promise<{ session_id: string; messages: AIAssistantMessage[] }> {
    return this.request<{ session_id: string; messages: AIAssistantMessage[] }>(`/assistant/history?session_id=${sessionId}`);
  }

  async clearAssistantHistory(sessionId: string = 'default'): Promise<{ status: string; session_id: string; cleared: boolean }> {
    return this.request<{ status: string; session_id: string; cleared: boolean }>(`/assistant/history?session_id=${sessionId}`, {
      method: 'DELETE',
    });
  }

  async getAssistantConfig(): Promise<AIAssistantConfig> {
    return this.request<AIAssistantConfig>('/assistant/config');
  }
}

export const api = new ApiClient();
