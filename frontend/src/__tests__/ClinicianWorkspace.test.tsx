import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ClinicianWorkspacePage } from '../pages/ClinicianWorkspacePage';
import { api } from '../services/api';
import {
  PatientCardOut,
  PatientOverviewOut,
  TimelineEventOut,
  TwinInsightOut,
  ClinicianReviewNoteOut,
} from '../types';

// Mock API
vi.mock('../services/api', () => ({
  api: {
    getClinicianPatients: vi.fn(),
    getPatientOverview: vi.fn(),
    getPatientTimeline: vi.fn(),
    getClinicalInsights: vi.fn(),
    getPatientNotes: vi.fn(),
    createPatientNote: vi.fn(),
    downloadPatientPdfSummary: vi.fn(),
    resetDemoPatient: vi.fn(),
    getPatientInterventions: vi.fn(),
    getPatientFollowUpTasks: vi.fn().mockResolvedValue([]),
    createFollowUpTask: vi.fn(),
    updateFollowUpTask: vi.fn(),
  },
}));

const mockPatients: PatientCardOut[] = [
  {
    id: 101,
    display_name: 'Alex Rivera (Student Cohort)',
    email: 'alex.demo.patient@happiesthealth.org',
    age_range: '22-26',
    is_demo_patient: true,
    total_observations_count: 24,
    recent_checkin_date: 'Oct 10, 2026',
    recent_anxiety_score: 3,
    baseline_status: 'Empirical Baseline Active',
    data_completeness_percent: 86,
    last_reviewed_date: 'Oct 08, 2026',
  },
  {
    id: 102,
    display_name: 'Jordan Miller',
    email: 'jordan.miller@example.com',
    age_range: '30-34',
    is_demo_patient: false,
    total_observations_count: 8,
    recent_checkin_date: 'Oct 09, 2026',
    recent_anxiety_score: 6,
    baseline_status: 'Cold-Start Calibration',
    data_completeness_percent: 32,
    last_reviewed_date: null,
  },
];

const mockOverview: PatientOverviewOut = {
  patient_id: 101,
  display_name: 'Alex Rivera (Student Cohort)',
  email: 'alex.demo.patient@happiesthealth.org',
  age: 24,
  biological_sex: 'F',
  is_demo_patient: true,
  has_panic_history: true,
  trait_anxiety_score: 44.0,
  baseline_status: 'Empirical Baseline Active',
  total_observations: 24,
  distinct_days: 8,
  data_completeness_percent: 86,
  mean_resting_hr: 70.0,
  mean_hrv_ms: 48.0,
  mean_sleep_hours: 7.5,
  mean_caffeine_cups: 1.0,
  prediction_availability: 'available',
  latest_review_note: null,
};

const mockTimeline: TimelineEventOut[] = [
  {
    id: 'checkin_1',
    timestamp: '2026-10-10T14:00:00Z',
    event_type: 'checkin',
    source_type: 'user_entered',
    is_simulated: false,
    title: 'User Check-In (3/10)',
    summary: 'Distress Score: 3/10 • Fully rested; baseline equilibrium recovered.',
    values: { anxiety_score: 3, notes: 'Fully rested' },
    details: { raw_id: 1 },
  },
  {
    id: 'physio_1',
    timestamp: '2026-10-09T08:30:00Z',
    event_type: 'physiological',
    source_type: 'user_entered',
    is_simulated: false,
    title: 'Physiological Vitals',
    summary: 'HR: 71 BPM • HRV: 48 ms • Steps: 4800',
    values: { heart_rate_bpm: 71.0, hrv_ms: 48.0 },
    details: { raw_id: 2 },
  },
  {
    id: 'lifestyle_1',
    timestamp: '2026-10-08T09:00:00Z',
    event_type: 'lifestyle',
    source_type: 'user_entered',
    is_simulated: false,
    title: 'Daily Lifestyle Record',
    summary: 'Sleep: 4.2h • Caffeine: 4 cups',
    values: { sleep_hours: 4.2, caffeine_cups: 4.0 },
    details: { raw_id: 3 },
  },
];

const mockInsights: TwinInsightOut[] = [
  {
    id: 'insight_autonomic_hr',
    factor: 'Autonomic Heart Rate',
    category: 'autonomic',
    observation: 'Mean resting heart rate was 75.4 BPM (+5.4 BPM relative to personal baseline).',
    comparison_baseline: 'Individual baseline reference: 70.0 BPM',
    baseline_value: 70.0,
    current_value: 75.4,
    delta: 5.4,
    delta_unit: 'BPM',
    time_window: 'Last 14 days',
    source_provenance: 'user_entered',
    data_limitation: 'Non-continuous spot readings.',
    non_causal_interpretation:
      'Elevated heart rate reflects multi-factorial physical and emotional arousal; observational association does not establish causation.',
    direction: 'elevated',
    significance: 'moderate',
    supporting_record_ids: ['physio_1', 'physio_2'],
  },
  {
    id: 'insight_circadian_sleep',
    factor: 'Circadian Sleep Regularity',
    category: 'circadian',
    observation: 'Average sleep was 6.2 hours with 2 nights recording severe sleep debt (< 6.0h).',
    comparison_baseline: 'Individual baseline reference: 7.5 hours',
    baseline_value: 7.5,
    current_value: 6.2,
    delta: -1.3,
    delta_unit: 'hours',
    time_window: 'Last 14 days',
    source_provenance: 'user_entered',
    data_limitation: 'Self-reported sleep logs without polysomnography.',
    non_causal_interpretation:
      'Sleep restriction impairs emotional regulation; observational association does not establish causation.',
    direction: 'suppressed',
    significance: 'high',
    supporting_record_ids: ['lifestyle_1'],
  },
];

const mockNotes: ClinicianReviewNoteOut[] = [
  {
    id: 501,
    patient_id: 101,
    clinician_id: 100,
    clinician_name: 'Dr. Sarah Lin, MD',
    review_date: '2026-10-08T10:00:00Z',
    reporting_period_start: '2026-10-03',
    reporting_period_end: '2026-10-10',
    summary_observations:
      'Patient experienced acute sympathetic surge on Exam Day with HR 88 BPM and suppressed HRV 26 ms.',
    discussion_topics: '1. Circadian sleep hygiene during exam periods. 2. Limiting caffeine after 2:00 PM.',
    follow_up_plan: 'Review follow-up check-in trajectory in 14 days.',
    follow_up_date: '2026-10-22',
    follow_up_status: 'planned',
    created_at: '2026-10-08T10:00:00Z',
    updated_at: '2026-10-08T10:00:00Z',
  },
];

describe('Phase 6.2 — ClinicianWorkspacePage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem(
      'anxietytwin_user',
      JSON.stringify({
        id: 100,
        email: 'demo_clinician@happiesthealth.org',
        full_name: 'Dr. Sarah Lin, MD',
        role: 'clinician',
      })
    );
    localStorage.setItem('anxietytwin_token', 'mock_clinician_jwt_token');

    vi.mocked(api.getClinicianPatients).mockResolvedValue(mockPatients);
    vi.mocked(api.getPatientOverview).mockResolvedValue(mockOverview);
    vi.mocked(api.getPatientTimeline).mockResolvedValue(mockTimeline);
    vi.mocked(api.getClinicalInsights).mockResolvedValue(mockInsights);
    vi.mocked(api.getPatientNotes).mockResolvedValue(mockNotes);
    vi.mocked(api.getPatientInterventions).mockResolvedValue({
      status: {
        baseline_status: 'Empirical Baseline Active',
        is_cold_start: false,
        metrics: [
          {
            metric_key: 'heart_rate',
            metric_name: 'Resting Heart Rate',
            current_value: 82.0,
            baseline_value: 70.0,
            delta_value: 12.0,
            unit: 'BPM',
            trend: 'elevated',
            status: 'change_detected',
            observations_count: 8,
            provenance: 'measured',
          },
        ],
        signals: [
          {
            signal_id: 'sig_hr_1',
            signal_type: 'elevated_heart_rate',
            title: 'Elevated Resting Heart Rate',
            level: 'Change Detected',
            what_changed: 'Heart rate elevated +12 BPM above baseline',
            why_flagged: 'Exceeded +5 BPM elevation threshold',
            evidence_summary: 'Current: 82 BPM vs Baseline: 70 BPM',
            current_value: 82.0,
            baseline_value: 70.0,
            delta: 12.0,
            unit: 'BPM',
            timestamps: ['2026-10-10T14:00:00Z'],
            supporting_record_ids: ['physio_1'],
            data_quality: 'Device measurement',
            data_provenance: 'measured',
            suggested_activity: 'Guided Paced Breathing',
            suggested_intervention_type: 'breathing_478',
            limitations: 'Observational association only',
            is_rule_based: true,
          },
        ],
        recommendations: [],
        insufficient_data_reasons: [],
        disclaimer: 'Non-diagnostic.',
      },
      history: [
        {
          id: 1,
          user_id: 101,
          intervention_type: 'breathing_478',
          trigger_signal: 'elevated_heart_rate',
          status: 'completed',
          pre_distress_rating: 7,
          post_distress_rating: 4,
          rating_delta: -3,
          helpfulness: 'helpful',
          source_type: 'user_reported',
          started_at: '2026-10-10T14:10:00Z',
        },
      ],
    } as any);

    vi.mocked(api.getPatientFollowUpTasks).mockResolvedValue([]);
  });

  it('renders clinician workspace header, prototype disclaimer, and authorized patients registry', async () => {
    render(
      <BrowserRouter>
        <ClinicianWorkspacePage />
      </BrowserRouter>
    );

    expect(screen.getByText(/Patient Review & Clinical Insight Workspace/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Prototype/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Clinician Workspace Research Protocol/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('Alex Rivera (Student Cohort)').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Jordan Miller')).toBeInTheDocument();
    });

    expect(screen.getAllByText('alex.demo.patient@happiesthealth.org').length).toBeGreaterThanOrEqual(1);
  });

  it('filters authorized patients list when searching', async () => {
    render(
      <BrowserRouter>
        <ClinicianWorkspacePage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Alex Rivera (Student Cohort)').length).toBeGreaterThanOrEqual(1);
    });

    const searchInput = screen.getByPlaceholderText(/Filter by name or email/i);
    fireEvent.change(searchInput, { target: { value: 'Jordan' } });

    expect(screen.getByText('Jordan Miller')).toBeInTheDocument();
    expect(screen.getByText('jordan.miller@example.com')).toBeInTheDocument();
  });

  it('renders patient overview summary and baseline calibration metrics', async () => {
    render(
      <BrowserRouter>
        <ClinicianWorkspacePage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/86% Data Quality/i)).toBeInTheDocument();
    });

    expect(screen.getByText('70.0 bpm')).toBeInTheDocument();
    expect(screen.getByText('48.0 ms')).toBeInTheDocument();
    expect(screen.getByText(/8 distinct days/i)).toBeInTheDocument();
  });

  it('renders longitudinal patient timeline cards and provenance tags', async () => {
    render(
      <BrowserRouter>
        <ClinicianWorkspacePage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/User Check-In \(3\/10\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Physiological Vitals/i)).toBeInTheDocument();
      expect(screen.getByText(/Daily Lifestyle Record/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Fully rested; baseline equilibrium recovered/i)).toBeInTheDocument();
  });

  it('switches to Digital Twin Insights tab and displays non-causal disclosures', async () => {
    render(
      <BrowserRouter>
        <ClinicianWorkspacePage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Alex Rivera (Student Cohort)').length).toBeGreaterThanOrEqual(1);
    });

    const insightsTabBtn = screen.getByRole('button', { name: /Explainable Twin Insights/i });
    fireEvent.click(insightsTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Autonomic Heart Rate')).toBeInTheDocument();
      expect(screen.getByText('Circadian Sleep Regularity')).toBeInTheDocument();
    });

    // Check non-causal language is displayed
    expect(screen.getAllByText(/observational association does not establish causation/i).length).toBeGreaterThanOrEqual(1);

    // Check "View Supporting Records" button opens evidence modal
    const viewEvidenceBtns = screen.getAllByRole('button', { name: /View Supporting Records/i });
    expect(viewEvidenceBtns.length).toBeGreaterThan(0);
    fireEvent.click(viewEvidenceBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/Scientific Transparency Note:/i)).toBeInTheDocument();
      expect(screen.getByText('Record #physio_1')).toBeInTheDocument();
    });
  });

  it('switches to ML Prediction Review tab and renders honest horizon/disclaimers', async () => {
    render(
      <BrowserRouter>
        <ClinicianWorkspacePage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Alex Rivera (Student Cohort)').length).toBeGreaterThanOrEqual(1);
    });

    const predTabBtn = screen.getByRole('button', { name: /ML Model Review/i });
    fireEvent.click(predTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Production ML Target: Next-Day Diastolic Blood Pressure/i)).toBeInTheDocument();
      expect(screen.getByText(/Non-Diagnostic Disclaimer:/i)).toBeInTheDocument();
      expect(screen.getByText(/Longitudinal Cold-Start Integrity Requirements/i)).toBeInTheDocument();
    });
  });

  it('switches to Clinician Notes tab and submits a new clinical note', async () => {
    vi.mocked(api.createPatientNote).mockResolvedValue({
      id: 502,
      patient_id: 101,
      clinician_id: 100,
      clinician_name: 'Dr. Sarah Lin, MD',
      review_date: '2026-10-10T15:00:00Z',
      reporting_period_start: '2026-10-03',
      reporting_period_end: '2026-10-10',
      summary_observations: 'Patient coping well following midterm exams.',
      discussion_topics: 'Maintaining regular sleep routine.',
      follow_up_plan: 'Check in next month.',
      follow_up_date: '2026-11-10',
      follow_up_status: 'planned',
      created_at: '2026-10-10T15:00:00Z',
      updated_at: '2026-10-10T15:00:00Z',
    });

    render(
      <BrowserRouter>
        <ClinicianWorkspacePage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Alex Rivera (Student Cohort)').length).toBeGreaterThanOrEqual(1);
    });

    const notesTabBtn = screen.getByRole('button', { name: /Review Notes & Follow-up/i });
    fireEvent.click(notesTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Document Clinical Review Note/i)).toBeInTheDocument();
      expect(screen.getByText(/Patient experienced acute sympathetic surge on Exam Day/i)).toBeInTheDocument();
    });

    const summaryTextarea = screen.getByPlaceholderText(/Patient reports elevated anticipatory anxiety/i);
    fireEvent.change(summaryTextarea, {
      target: { value: 'Patient coping well following midterm exams.' },
    });

    const saveNoteBtn = screen.getByRole('button', { name: /Save Clinical Review Note/i });
    fireEvent.click(saveNoteBtn);

    await waitFor(() => {
      expect(api.createPatientNote).toHaveBeenCalledWith(
        101,
        expect.objectContaining({
          summary_observations: 'Patient coping well following midterm exams.',
        })
      );
    });
  });

  it('opens PDF Export Modal with selectable section checkboxes and triggers export', async () => {
    const dummyBlob = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
    vi.mocked(api.downloadPatientPdfSummary).mockResolvedValue(dummyBlob);

    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-pdf');
    window.URL.revokeObjectURL = vi.fn();

    render(
      <BrowserRouter>
        <ClinicianWorkspacePage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Alex Rivera (Student Cohort)').length).toBeGreaterThanOrEqual(1);
    });

    const exportBtn = screen.getByRole('button', { name: /Export Customizable Summary/i });
    await waitFor(() => {
      expect(exportBtn).not.toBeDisabled();
    });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(screen.getByText('Export Patient Summary PDF')).toBeInTheDocument();
    });

    // Verify section selection checkboxes exist
    expect(screen.getByText(/User Check-in History & Distress Ratings/i)).toBeInTheDocument();
    expect(screen.getByText(/Physiological Observations \(Resting HR & HRV\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Lifestyle Metrics \(Sleep & Caffeine Intake\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Explainable Digital Twin Insights & Evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/ML Model Prediction Boundaries/i)).toBeInTheDocument();
    expect(screen.getByText(/Clinician Review Notes & Follow-Up Plans/i)).toBeInTheDocument();
    expect(screen.getByText(/Include Simulated Prototype Streams/i)).toBeInTheDocument();

    const generatePdfBtn = screen.getByRole('button', { name: /Download Summary PDF/i });
    fireEvent.click(generatePdfBtn);

    await waitFor(() => {
      expect(api.downloadPatientPdfSummary).toHaveBeenCalledWith(
        101,
        expect.objectContaining({
          include_checkins: true,
          include_simulated_data: false,
        })
      );
    });

    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('handles 1-click synthetic demo cohort reset', async () => {
    vi.mocked(api.resetDemoPatient).mockResolvedValue({
      status: 'success',
      patient_id: 101,
      message: 'Reset complete',
    });

    const originalAlert = window.alert;
    window.alert = vi.fn();

    render(
      <BrowserRouter>
        <ClinicianWorkspacePage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Alex Rivera (Student Cohort)').length).toBeGreaterThanOrEqual(1);
    });

    const resetBtn = screen.getByRole('button', { name: /Reset Demo Cohort/i });
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(api.resetDemoPatient).toHaveBeenCalled();
    });

    window.alert = originalAlert;
  });

  it('switches to Early Warnings & Coping tab, displays baseline matrix, signals, and opens source inspector', async () => {
    render(
      <BrowserRouter>
        <ClinicianWorkspacePage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Alex Rivera (Student Cohort)').length).toBeGreaterThanOrEqual(1);
    });

    const interventionsTabBtn = screen.getByRole('button', { name: /Early Warnings & Coping/i });
    fireEvent.click(interventionsTabBtn);

    // Verify distinct ML boundary notice
    expect(screen.getByText(/Distinct from 24h ML Model \(DBP Target\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Personal Baseline Comparison Matrix/i)).toBeInTheDocument();
    expect(screen.getByText('Resting Heart Rate')).toBeInTheDocument();
    expect(screen.getByText('Elevated Resting Heart Rate')).toBeInTheDocument();
    expect(screen.getByText(/4-7-8 Breathing Pacer/i)).toBeInTheDocument();
    expect(screen.getByText('Δ -3')).toBeInTheDocument();

    // Inspect Source Observations drawer trigger
    const inspectBtn = screen.getByRole('button', { name: /Inspect Source Records/i });
    fireEvent.click(inspectBtn);

    expect(screen.getByText('Source Observation Inspection')).toBeInTheDocument();
    expect(screen.getByText('physio_1')).toBeInTheDocument();
  });
});
