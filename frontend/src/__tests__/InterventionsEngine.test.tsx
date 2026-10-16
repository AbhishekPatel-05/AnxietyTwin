import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { InterventionsPage } from '../pages/InterventionsPage';
import { InteractiveInterventionModal } from '../components/InteractiveInterventionModal';
import { api } from '../services/api';
import { InterventionsStatusResponse, InterventionSession } from '../types';

// Mock API
vi.mock('../services/api', () => ({
  api: {
    getInterventionsStatus: vi.fn(),
    getInterventionsHistory: vi.fn(),
    recordIntervention: vi.fn(),
  },
}));

const mockStatus: InterventionsStatusResponse = {
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
      provenance: 'user_entered',
    },
    {
      metric_key: 'hrv',
      metric_name: 'Parasympathetic Tone (HRV rMSSD)',
      current_value: 32.0,
      baseline_value: 48.0,
      delta_value: -16.0,
      unit: 'ms',
      trend: 'reduced',
      status: 'change_detected',
      observations_count: 8,
      provenance: 'user_entered',
    },
    {
      metric_key: 'sleep_duration',
      metric_name: 'Sleep Duration',
      current_value: 5.0,
      baseline_value: 7.5,
      delta_value: -2.5,
      unit: 'hours',
      trend: 'disrupted',
      status: 'change_detected',
      observations_count: 7,
      provenance: 'user_entered',
    },
    {
      metric_key: 'subjective_distress',
      metric_name: 'Subjective Distress Rating',
      current_value: 7.0,
      baseline_value: 2.5,
      delta_value: 4.5,
      unit: 'rating (0-10)',
      trend: 'elevated',
      status: 'change_detected',
      observations_count: 8,
      provenance: 'user_entered',
    },
  ],
  signals: [
    {
      signal_id: 'sig_composite_strain',
      signal_type: 'composite_autonomic_strain',
      title: 'Composite Autonomic & Subjective Strain',
      level: 'Change Detected',
      what_changed: 'Concurrent autonomic arousal and elevated subjective distress detected in recent records.',
      why_flagged: 'Both physiological markers (HR/HRV) and self-reported distress exceeded individual baseline thresholds.',
      evidence_summary: 'HR: 82.0 BPM (+12.0), HRV: 32.0 ms (-16.0), Distress: 7.0/10 (+4.5).',
      current_value: 7.0,
      baseline_value: 2.5,
      delta: 4.5,
      unit: 'composite',
      timestamps: ['2026-10-10T14:00:00Z'],
      supporting_record_ids: ['physio_101', 'checkin_101'],
      data_quality: 'Multi-modal cross-validated observations.',
      data_provenance: 'multi_modal',
      suggested_activity: 'Start 5-4-3-2-1 Sensory Grounding followed by 4-7-8 Breathing Pacer.',
      suggested_intervention_type: 'grounding_54321',
      limitations: 'Observational association does not establish causation. This multi-metric indicator does NOT constitute medical validation or predict panic attacks.',
      is_rule_based: true,
    },
  ],
  recommendations: [
    {
      id: 'rec_grounding_composite',
      intervention_type: 'grounding_54321',
      title: '5-4-3-2-1 Sensory Grounding',
      description: 'Interactive somatic grounding exercise engaging the 5 senses to disrupt sensory overwhelm.',
      rational_summary: 'Recommended due to concurrent autonomic arousal and elevated distress.',
      priority: 'high',
      estimated_duration_min: 4,
      trigger_signal_id: 'sig_composite_strain',
      is_medical: false,
      disclaimer: 'Experimental wellness support. Not medical treatment.',
    },
  ],
  insufficient_data_reasons: [],
  disclaimer: 'Observational association does not establish clinical causation.',
};

const mockHistory: InterventionSession[] = [
  {
    id: 1,
    user_id: 101,
    intervention_type: 'breathing_478',
    trigger_signal: 'composite_autonomic_strain',
    status: 'completed',
    pre_distress_rating: 8.0,
    post_distress_rating: 5.0,
    rating_delta: -3.0,
    helpfulness: 'helpful',
    user_notes: 'Felt much calmer after 4 breath cycles.',
    source_type: 'user_entered',
    started_at: '2026-10-10T12:00:00Z',
    completed_at: '2026-10-10T12:05:00Z',
  },
];

describe('InterventionsPage and Early-Warning Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getInterventionsStatus as any).mockResolvedValue(mockStatus);
    (api.getInterventionsHistory as any).mockResolvedValue(mockHistory);
    (api.recordIntervention as any).mockResolvedValue({
      id: 2,
      user_id: 101,
      intervention_type: 'breathing_478',
      status: 'completed',
      pre_distress_rating: 7.0,
      post_distress_rating: 4.0,
      rating_delta: -3.0,
      helpfulness: 'helpful',
      source_type: 'user_entered',
      started_at: '2026-10-10T15:00:00Z',
    });
  });

  it('renders page header, status badge, and non-causal disclaimer', async () => {
    render(
      <BrowserRouter>
        <InterventionsPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/Early-Warning & Personalized Interventions/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Empirical Baseline Active')).toBeInTheDocument();
    });
    expect(screen.getByText(/Scientific Protocol & Non-Diagnostic Disclosure/i)).toBeInTheDocument();
  });

  it('renders baseline comparison matrix and detected signal cards', async () => {
    render(
      <BrowserRouter>
        <InterventionsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Resting Heart Rate')).toBeInTheDocument();
      expect(screen.getByText('82 BPM')).toBeInTheDocument();
      expect(screen.getByText('Composite Autonomic & Subjective Strain')).toBeInTheDocument();
    });
  });

  it('toggles evidence inspection drawer for a detected signal', async () => {
    render(
      <BrowserRouter>
        <InterventionsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /View Evidence/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /View Evidence/i }));

    expect(screen.getByText(/Why it was flagged:/i)).toBeInTheDocument();
    expect(screen.getByText('physio_101')).toBeInTheDocument();
    expect(screen.getByText('checkin_101')).toBeInTheDocument();
  });

  it('switches to recommendations tab and renders activity details', async () => {
    render(
      <BrowserRouter>
        <InterventionsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Supportive Recommendations/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Supportive Recommendations/i }));

    expect(screen.getByText('5-4-3-2-1 Sensory Grounding')).toBeInTheDocument();
    expect(screen.getByText(/high Priority/i)).toBeInTheDocument();
  });

  it('switches to history tab and displays past sessions with rating delta', async () => {
    render(
      <BrowserRouter>
        <InterventionsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Intervention Feedback History/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Intervention Feedback History/i }));

    expect(screen.getByText('4-7-8 Breathing Pacer')).toBeInTheDocument();
    expect(screen.getByText(/Felt much calmer after 4 breath cycles/i)).toBeInTheDocument();
    expect(screen.getByText('Δ -3')).toBeInTheDocument();
    expect(screen.getByText('HELPFUL')).toBeInTheDocument();
  });

  it('handles dismissing an intervention recommendation', async () => {
    (api.recordIntervention as any).mockResolvedValueOnce({
      id: 99,
      intervention_type: 'grounding_54321',
      status: 'dismissed',
    });

    render(
      <BrowserRouter>
        <InterventionsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Supportive Recommendations/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Supportive Recommendations/i }));

    const dismissBtns = screen.getAllByRole('button', { name: /Dismiss/i });
    expect(dismissBtns.length).toBeGreaterThan(0);
    fireEvent.click(dismissBtns[0]);

    await waitFor(() => {
      expect(api.recordIntervention).toHaveBeenCalledWith(
        expect.objectContaining({
          intervention_type: 'grounding_54321',
          status: 'dismissed',
        })
      );
    });
  });

  it('displays contradictory signals and suggests check-in prompt', async () => {
    (api.getInterventionsStatus as any).mockResolvedValueOnce({
      ...mockStatus,
      signals: [
        {
          signal_id: 'sig_conflicting',
          signal_type: 'conflicting_observations',
          title: 'Divergent Physiological & Subjective Signals',
          level: 'Change Detected',
          what_changed: 'Elevated physiological arousal (HR: 88 BPM) with low subjective distress (2/10).',
          why_flagged: 'Autonomic indicators diverge from subjective report. Investigation warranted.',
          evidence_summary: 'HR delta: +18 BPM vs Subjective score: 2/10',
          current_value: 2.0,
          baseline_value: 2.5,
          delta: -0.5,
          unit: 'rating',
          timestamps: ['2026-10-10T14:00:00Z'],
          supporting_record_ids: ['physio_202', 'checkin_202'],
          data_quality: 'Divergent multi-modal cross-check',
          data_provenance: 'measured',
          suggested_activity: 'Complete a brief contextual check-in to identify physical factors.',
          suggested_intervention_type: 'checkin_prompt',
          limitations: 'Non-diagnostic; observational correlation only.',
          is_rule_based: true,
        },
      ],
      recommendations: [
        {
          id: 'rec_checkin_conflicting',
          intervention_type: 'checkin_prompt',
          title: 'Contextual Check-In Prompt',
          description: 'Reflect on physical factors such as recent exertion, caffeine, or ambient temperature.',
          rational_summary: 'Physiological arousal diverged from subjective tension.',
          priority: 'moderate',
          estimated_duration_min: 2,
          trigger_signal_id: 'sig_conflicting',
          is_medical: false,
          disclaimer: 'Non-diagnostic check-in.',
        },
      ],
    });

    render(
      <BrowserRouter>
        <InterventionsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Divergent Physiological & Subjective Signals')).toBeInTheDocument();
    });

    expect(screen.getByText(/Elevated physiological arousal/i)).toBeInTheDocument();
    expect(screen.getByText(/MEASURED/i)).toBeInTheDocument();

    // Check recommendation
    fireEvent.click(screen.getByRole('button', { name: /Supportive Recommendations/i }));
    expect(screen.getByText('Contextual Check-In Prompt')).toBeInTheDocument();
  });
});

describe('InteractiveInterventionModal Component', () => {
  it('handles pre-rating, active exercise, post-rating, and submits feedback', async () => {
    const onCompletedMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <InteractiveInterventionModal
        isOpen={true}
        onClose={onCloseMock}
        initialActivity="breathing_478"
        triggerSignal="test_signal"
        onCompleted={onCompletedMock}
      />
    );

    expect(screen.getByText(/Personalized Supportive Wellness Exercise/i)).toBeInTheDocument();
    expect(screen.getByText(/How tense or distressed do you feel right now\?/i)).toBeInTheDocument();

    // Begin exercise
    fireEvent.click(screen.getByRole('button', { name: /Begin Exercise/i }));

    // Active breathing ring and controls
    expect(screen.getByText(/Inhale Deeply/i)).toBeInTheDocument();
    expect(screen.getByText(/Finished • Record Post-Exercise Feedback/i)).toBeInTheDocument();

    // Finish exercise
    fireEvent.click(screen.getByRole('button', { name: /Finished • Record Post-Exercise Feedback/i }));

    // Post feedback screen
    expect(screen.getByText(/How do you feel after completing the exercise\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Did this activity feel helpful\?/i)).toBeInTheDocument();

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Save Activity & Record Feedback/i }));

    await waitFor(() => {
      expect(api.recordIntervention).toHaveBeenCalledWith(
        expect.objectContaining({
          intervention_type: 'breathing_478',
          status: 'completed',
          helpfulness: 'helpful',
        })
      );
    });
  });
});
