import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PatternDiscoveryPage } from '../pages/PatternDiscoveryPage';
import { WellnessGoalsPage } from '../pages/WellnessGoalsPage';
import { JournalPage } from '../pages/JournalPage';
import { DataQualityPage } from '../pages/DataQualityPage';
import { WeeklyReportPage } from '../pages/WeeklyReportPage';
import { PrivacyConsentPage } from '../pages/PrivacyConsentPage';
import { api } from '../services/api';

// Mock the API client with exact method names from api.ts
vi.mock('../services/api', () => ({
  api: {
    // Feature 1
    getPatterns: vi.fn(),
    getPatternSummary: vi.fn(),
    discoverPatterns: vi.fn(),
    updatePatternFeedback: vi.fn(),
    // Feature 2
    getGoals: vi.fn(),
    getWeeklyCarePlanSummary: vi.fn(),
    getGoalSuggestions: vi.fn(),
    createGoal: vi.fn(),
    updateGoal: vi.fn(),
    deleteGoal: vi.fn(),
    // Feature 3
    getJournalEntries: vi.fn(),
    createJournalEntry: vi.fn(),
    updateJournalEntry: vi.fn(),
    deleteJournalEntry: vi.fn(),
    generateJournalThemeSummary: vi.fn(),
    // Feature 4
    getDataQualitySummary: vi.fn(),
    getPatientDataQuality: vi.fn(),
    // Feature 5
    getPatientFollowUpTasks: vi.fn(),
    createFollowUpTask: vi.fn(),
    updateFollowUpTask: vi.fn(),
    getClinicianTasksOverview: vi.fn(),
    getPatientVisibleTasks: vi.fn(),
    acknowledgePatientTask: vi.fn(),
    // Feature 6
    replayScenario: vi.fn(),
    exportScenarioComparisonPdf: vi.fn(),
    // Feature 7
    getWeeklyReport: vi.fn(),
    exportWeeklyReportPdf: vi.fn(),
    // Feature 8
    getPrivacyDashboard: vi.fn(),
    getPrivacyGrants: vi.fn(),
    grantClinicianAccess: vi.fn(),
    revokePrivacyGrant: vi.fn(),
    getPrivacyAuditLog: vi.fn(),
    exportUserDataBundle: vi.fn(),
    deleteUserAccount: vi.fn(),
  },
}));

describe('Advanced Feature 1: Personal Trigger & Pattern Discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getPatterns).mockResolvedValue([
      {
        id: 1,
        user_id: 1,
        pattern_type: 'context_trigger',
        title: 'Workload & Elevated Distress Association',
        description: 'Mean distress was 7.4/10 on days tagged with Workload compared to 3.8/10 on baseline days.',
        trigger_context: 'Workload',
        distress_correlation: 0.62,
        observation_count: 5,
        time_range: 'Oct 01 - Oct 10',
        confidence_level: 'robust',
        status: 'active',
        evidence_summary: {
          explanation: '5 check-ins tagged with Workload coincided with higher distress.',
        },
        created_at: '2026-10-10T00:00:00Z',
        updated_at: '2026-10-10T00:00:00Z',
        non_causal_disclaimer: 'Correlation does not imply causation.',
      },
    ]);
    vi.mocked(api.getPatternSummary).mockResolvedValue({
      total_checkins: 14,
      distinct_days_recorded: 10,
      top_context_factors: [{ factor: 'Workload', count: 5 }],
      calendar_heatmap: [],
      disclaimer: 'Exploratory correlation only.',
    });
  });

  it('renders pattern discovery page with non-causal disclaimer and correlation cards', async () => {
    render(
      <BrowserRouter>
        <PatternDiscoveryPage />
      </BrowserRouter>
    );

    // Verify non-causal disclosure banner
    expect(await screen.findByText(/Non-Causal Scientific Disclosure/i)).toBeInTheDocument();
    expect(screen.getByText(/Correlation does not imply causation/i)).toBeInTheDocument();

    // Verify pattern card
    const patternCards = await screen.findAllByText(/Workload & Elevated Distress Association/i);
    expect(patternCards.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/5 observation\(s\)/i)).toBeInTheDocument();
  });

  it('allows user to mark a discovered pattern as relevant', async () => {
    vi.mocked(api.updatePatternFeedback).mockResolvedValue({
      id: 1,
      user_id: 1,
      pattern_type: 'context_trigger',
      title: 'Workload & Elevated Distress Association',
      description: 'Mean distress was 7.4/10 on days tagged with Workload.',
      trigger_context: 'Workload',
      distress_correlation: 0.62,
      observation_count: 5,
      time_range: 'Oct 01 - Oct 10',
      confidence_level: 'robust',
      status: 'relevant',
      created_at: '2026-10-10T00:00:00Z',
      updated_at: '2026-10-10T00:00:00Z',
      non_causal_disclaimer: 'Correlation does not imply causation.',
    });

    render(
      <BrowserRouter>
        <PatternDiscoveryPage />
      </BrowserRouter>
    );

    const patternCards = await screen.findAllByText(/Workload & Elevated Distress Association/i);
    fireEvent.click(patternCards[0]);

    const relevantBtn = await screen.findByTitle('Mark as Relevant for my care');
    fireEvent.click(relevantBtn);

    await waitFor(() => {
      expect(api.updatePatternFeedback).toHaveBeenCalledWith(1, 'relevant');
    });
  });
});

describe('Advanced Feature 2: Personalized Wellness Goals & Care Plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getGoals).mockResolvedValue([
      {
        id: 10,
        user_id: 1,
        title: 'Daily 4-7-8 Evening Breathing',
        description: 'Complete one cycle of 4-7-8 breathing before bed.',
        category: 'breathing',
        target_frequency: 'daily',
        target_count: 7,
        current_week_progress: 5,
        current_week_target: 7,
        is_on_track: true,
        status: 'active',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-10T00:00:00Z',
      },
    ]);
    vi.mocked(api.getWeeklyCarePlanSummary).mockResolvedValue({
      week_start: '2026-10-05',
      week_end: '2026-10-11',
      planned_goals_count: 1,
      active_goals: [],
      total_completed_activities: 5,
      total_planned_activities: 7,
      completion_rate_pct: 71.4,
      user_helpfulness_summary: { helpful: 4, neutral: 1 },
      supportive_message: 'Consistent gentle practice builds parasympathetic resilience.',
      disclaimer: 'Voluntary wellness goals. Not a clinician-prescribed medical treatment plan.',
    });
    vi.mocked(api.getGoalSuggestions).mockResolvedValue([
      {
        title: 'Morning Grounding Routine',
        description: 'Practice 5-4-3-2-1 grounding after waking up.',
        category: 'grounding',
        target_frequency: 'weekdays',
        target_count: 5,
        rationale: 'Supports sensory anchoring during high workload weeks.',
      },
    ]);
  });

  it('renders active wellness goals with weekly progress bar and non-prescription disclaimer', async () => {
    render(
      <BrowserRouter>
        <WellnessGoalsPage />
      </BrowserRouter>
    );

    expect(await screen.findByText(/Daily 4-7-8 Evening Breathing/i)).toBeInTheDocument();
    expect(screen.getByText(/Self-Care Autonomy Notice/i)).toBeInTheDocument();
    expect(screen.getByText(/Morning Grounding Routine/i)).toBeInTheDocument();
    expect(screen.getByText(/Weekly Care Plan Progress/i)).toBeInTheDocument();
  });
});

describe('Advanced Feature 3: Emotion Journal & Context Capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getJournalEntries).mockResolvedValue([
      {
        id: 21,
        user_id: 1,
        title: 'Midterm Anxiety Reflection',
        content: 'Felt my heart racing before the presentation. Doing 4-7-8 breathing for 3 minutes brought my pulse down.',
        mood_tags: ['Overwhelmed', 'Restless'],
        distress_rating: 6.5,
        context_tags: ['Workload', 'Caffeine'],
        prompt_responses: {
          'What helped you cope?': '4-7-8 breathing exercise',
        },
        is_private: true,
        shared_with_clinician: false,
        created_at: '2026-10-09T18:00:00Z',
        updated_at: '2026-10-09T18:00:00Z',
      },
    ]);
  });

  it('renders journal entries with privacy badge and structured prompts', async () => {
    render(
      <BrowserRouter>
        <JournalPage />
      </BrowserRouter>
    );

    expect(await screen.findByText(/Midterm Anxiety Reflection/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Private to You/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Emotion Journal & Context Capture/i)).toBeInTheDocument();
  });

  it('requires explicit user consent before calling AI theme summary', async () => {
    vi.mocked(api.generateJournalThemeSummary).mockResolvedValue({
      themes: ['Academic deadlines', 'Evening autonomic arousal'],
      summary_text: 'Recurring reflections highlight workload as a trigger and breathing exercises as effective.',
      entry_count: 1,
      is_ai_generated: true,
      distinction_notice: 'This theme summary was synthesized by AI and is distinct from authentic journal entries.',
    });

    render(
      <BrowserRouter>
        <JournalPage />
      </BrowserRouter>
    );

    const openModalBtn = await screen.findByRole('button', { name: /AI Theme Summary/i });
    fireEvent.click(openModalBtn);

    const consentCheckbox = await screen.findByRole('checkbox');
    fireEvent.click(consentCheckbox);

    const generateBtn = screen.getByRole('button', { name: /Generate Theme Summary/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(api.generateJournalThemeSummary).toHaveBeenCalledWith(
        undefined,
        true
      );
    });
  });
});

describe('Advanced Feature 4: Digital Twin Confidence & Data Quality Center', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getDataQualitySummary).mockResolvedValue({
      coverage: {
        total_observations: 24,
        distinct_recording_days: 8,
        available_metrics: { heart_rate: true, hrv: true, sleep: true, distress: true },
        missing_metrics: ['continuous_eeg'],
        most_recent_timestamp: '2026-10-10T14:00:00Z',
        recency_status: 'fresh',
      },
      provenance: {
        measured_device_count: 12,
        user_reported_count: 8,
        simulated_synthetic_count: 4,
        derived_indices_count: 4,
        measured_pct: 42.9,
        user_reported_pct: 28.6,
        simulated_pct: 14.3,
        derived_pct: 14.3,
      },
      baseline_reliability: {
        is_calibrated: true,
        baseline_days_used: 8,
        minimum_days_required: 3,
        baseline_period: 'Oct 02 - Oct 10, 2026',
        is_outdated: false,
        unavailable_metrics: [],
        reliability_tier: 'high',
      },
      transparency_rules: [
        {
          indicator_name: 'Production XGBoost Model',
          rule_or_formula: 'Supervised Gradient Boosting over 14 engineered autonomic features',
          inputs_used: ['Resting HR', 'HRV RMSSD', 'Sleep Debt', 'Caffeine'],
          target_or_prediction_horizon: 'Next-Day Diastolic Blood Pressure (DBP > 85 mmHg)',
          known_limitations: 'Trained on synthetic cohort SYM2. Not validated for acute panic attacks.',
        },
      ],
      warnings: [],
      synthetic_data_isolated: true,
      disclaimer: 'Transparent data provenance center.',
    });
  });

  it('renders data quality coverage meters, provenance breakdown, and XGBoost disclosures', async () => {
    render(
      <BrowserRouter>
        <DataQualityPage />
      </BrowserRouter>
    );

    expect(await screen.findByText(/Digital Twin Confidence & Data Quality Center/i)).toBeInTheDocument();
    expect(screen.getByText(/Synthetic lab data quarantine is 100% active/i)).toBeInTheDocument();
    expect(screen.getByText(/Production XGBoost Model/i)).toBeInTheDocument();
    expect(screen.getByText(/Next-Day Diastolic Blood Pressure \(DBP > 85 mmHg\)/i)).toBeInTheDocument();
  });
});

describe('Advanced Feature 7: Weekly Personal Insights Report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.URL.createObjectURL = vi.fn().mockReturnValue('mock_url');
    window.URL.revokeObjectURL = vi.fn();
    vi.mocked(api.getWeeklyReport).mockResolvedValue({
      period_start: '2026-10-04',
      period_end: '2026-10-11',
      checkin_count: 7,
      avg_distress_rating: 4.2,
      distress_trend: 'improving',
      resting_hr_avg: 71.5,
      hrv_avg_ms: 47.8,
      sleep_avg_hours: 7.2,
      baseline_deviations: [
        {
          metric: 'Resting Heart Rate',
          weekly_average: 71.5,
          baseline: 70.0,
          delta: '+1.5 BPM',
          interpretation: 'Within normal baseline boundary',
        },
      ],
      recurring_patterns: [],
      coping_interventions_summary: {
        total_completed: 4,
        reported_helpful: 4,
        average_distress_reduction: 2.5,
        interventions_used: ['4-7-8 Breathing Pacer'],
      },
      wellness_goals_progress: [
        {
          title: 'Daily 4-7-8 Evening Breathing',
          category: 'breathing',
          progress: 5,
          target: 7,
          is_on_track: true,
        },
      ],
      private_reflections_included: false,
      reflections_summary: null,
      data_quality_notices: ['All 7 days have complete check-in records.'],
      disclaimer: 'Non-diagnostic weekly summary of recorded longitudinal observations.',
    });
  });

  it('renders weekly summary metrics and triggers PDF download', async () => {
    vi.mocked(api.exportWeeklyReportPdf).mockResolvedValue(new Blob(['mock_pdf']));

    render(
      <BrowserRouter>
        <WeeklyReportPage />
      </BrowserRouter>
    );

    expect(await screen.findByText(/Weekly Personal Insights Report/i)).toBeInTheDocument();
    expect(screen.getByText(/4.2 \/ 10/i)).toBeInTheDocument();
    expect(screen.getByText(/Daily 4-7-8 Evening Breathing/i)).toBeInTheDocument();

    const exportBtn = screen.getByRole('button', { name: /Download PDF Report/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(api.exportWeeklyReportPdf).toHaveBeenCalled();
    });
  });
});

describe('Advanced Feature 8: Privacy & Consent Center', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    window.URL.createObjectURL = vi.fn().mockReturnValue('mock_url');
    window.URL.revokeObjectURL = vi.fn();
    vi.mocked(api.getPrivacyDashboard).mockResolvedValue({
      user_email: 'patient@happiesthealth.org',
      stored_categories: [
        {
          category_name: 'Emotion Journal Entries',
          data_type: 'Free-text & tags',
          provenance: 'User-reported',
          accessible_by: 'Patient only (Private by default)',
          retention: 'User-directed (Permanent until deletion)',
        },
        {
          category_name: 'Physiological Vitals',
          data_type: 'HR & HRV',
          provenance: 'Device / user-entered',
          accessible_by: 'Patient & Authorized Clinicians',
          retention: 'Longitudinal baseline calculation',
        },
      ],
      role_access_matrix: [
        { role: 'Patient', access_level: 'Full Owner', scope: 'All personal records' },
        { role: 'Clinician', access_level: 'Consent-Restricted', scope: 'Explicitly granted access only' },
      ],
      active_grants_count: 1,
      revoked_grants_count: 0,
      recent_audit_count: 3,
      retention_policy_summary: 'You have full sovereignty over your data.',
    });
    vi.mocked(api.getPrivacyGrants).mockResolvedValue([
      {
        id: 1,
        patient_id: 1,
        clinician_id: 2,
        clinician_name: 'Dr. Sarah Lin, MD',
        scope: 'full_review',
        access_scope: 'longitudinal_observations, twin_insights',
        is_active: true,
        created_at: '2026-10-01T00:00:00Z',
        granted_at: '2026-10-01T00:00:00Z',
      },
    ]);
    vi.mocked(api.getPrivacyAuditLog).mockResolvedValue([
      {
        id: 1,
        user_id: 1,
        action: 'grant_access',
        performed_by_id: 1,
        details: { scope: 'full_review' },
        timestamp: '2026-10-01T00:00:00Z',
      },
    ]);
  });

  it('renders active grants and permits 1-click access revocation', async () => {
    vi.mocked(api.revokePrivacyGrant).mockResolvedValue({
      message: 'Access revoked',
      grant_id: 1,
      is_active: false,
    });

    render(
      <BrowserRouter>
        <PrivacyConsentPage />
      </BrowserRouter>
    );

    expect(await screen.findByText(/Dr. Sarah Lin, MD/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Grant/i)).toBeInTheDocument();

    const revokeBtn = screen.getByRole('button', { name: /Revoke Access/i });
    fireEvent.click(revokeBtn);

    await waitFor(() => {
      expect(api.revokePrivacyGrant).toHaveBeenCalledWith(1);
    });
  });

  it('triggers full JSON archive download', async () => {
    vi.mocked(api.exportUserDataBundle).mockResolvedValue(
      new Blob(['{"user":"test"}'], { type: 'application/json' })
    );

    render(
      <BrowserRouter>
        <PrivacyConsentPage />
      </BrowserRouter>
    );

    const exportBtn = await screen.findByRole('button', { name: /Export Complete Archive \(JSON\)/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(api.exportUserDataBundle).toHaveBeenCalled();
    });
  });
});
