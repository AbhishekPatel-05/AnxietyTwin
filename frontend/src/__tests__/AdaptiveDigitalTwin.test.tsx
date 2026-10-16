import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SimulationLabPage } from '../pages/SimulationLabPage';
import { api } from '../services/api';

// Mock API methods
vi.mock('../services/api', () => ({
  api: {
    getSimulationProfiles: vi.fn().mockResolvedValue({
      profiles: [
        {
          id: 'DEMO-PATIENT-01',
          name: 'Alex - Standard Healthy Baseline',
          description: 'Standard baseline archetype',
          mean_resting_hr: 70.0,
          std_resting_hr: 7.0,
          mean_hrv_ms: 48.0,
          std_hrv_ms: 11.0,
          mean_sleep_hours: 7.5,
          mean_caffeine_cups: 1.0,
          mean_anxiety_score: 2.0,
        },
      ],
    }),
    getAdaptiveBaselineInitialization: vi.fn().mockResolvedValue({
      user_id: 1,
      is_personalized: true,
      data_mode: 'personalized',
      profile_id: 'USER-1',
      profile_name: 'Personal Empirical Baseline (Tester)',
      baseline_summary: {
        has_sufficient_data: true,
        is_cold_start: false,
        required_observations_count: 5,
        personalized_model_min_days: 7,
        total_observations_count: 12,
        unique_days_count: 5,
        date_span_days: 5,
        history_progress_percent: 100.0,
        status_message: 'Empirical baseline ready',
        missing_indicators: [],
        mean_resting_hr: 68.0,
        mean_hrv_ms: 50.0,
        mean_sleep_hours: 7.6,
        mean_caffeine_cups: 1.0,
        mean_anxiety_score: 2.2,
      },
      metrics: [
        {
          metric_key: 'resting_heart_rate',
          display_name: 'Resting Heart Rate',
          current_value: 68.0,
          baseline_value: 68.0,
          unit: 'BPM',
          observation_count: 6,
          observation_period: '5 days',
          most_recent_timestamp: '2026-10-10T12:00:00Z',
          provenance: 'device_measured',
          sufficient_data: true,
          status_note: 'Empirical baseline',
        },
        {
          metric_key: 'hrv_rmssd',
          display_name: 'HRV (rMSSD)',
          current_value: 50.0,
          baseline_value: 50.0,
          unit: 'ms',
          observation_count: 6,
          observation_period: '5 days',
          most_recent_timestamp: '2026-10-10T12:00:00Z',
          provenance: 'device_measured',
          sufficient_data: true,
          status_note: 'Empirical baseline',
        },
      ],
      sufficient_data: true,
      disclaimer: 'Personalized Digital Twin initialized from authentic records.',
    }),
    runSimulation: vi.fn().mockResolvedValue({
      status: 'success',
      twin_state: {
        composite_stress_index: 28.5,
        physiological_arousal_score: 32.0,
        circadian_disruption_index: 10.0,
        baseline_deviation_score: 0.5,
        state_label: 'STABLE_BASELINE',
      },
      research_prediction: {
        predicted_probability: 0.12,
        risk_band: 'LOW',
      },
    }),
    compareScenariosAdaptive: vi.fn().mockResolvedValue({
      scenario_a_result: {
        composite_stress_index: 28.5,
        physiological_arousal_score: 32.0,
        circadian_disruption_index: 10.0,
        baseline_deviation_score: 0.5,
        state_label: 'STABLE_BASELINE',
      },
      scenario_b_result: {
        composite_stress_index: 68.0,
        physiological_arousal_score: 65.0,
        circadian_disruption_index: 45.0,
        baseline_deviation_score: 35.0,
        state_label: 'HIGH_VULNERABILITY',
      },
      differential_analysis: {
        delta_composite_stress: 39.5,
        delta_physiological_arousal: 33.0,
        delta_circadian_disruption: 35.0,
        primary_divergence_driver: 'Circadian & Sleep Debt',
      },
      inputs_changed: [
        {
          parameter: 'sleep_hours',
          display_name: 'Sleep Duration',
          baseline_val: 7.5,
          alternative_val: 4.5,
          unit: 'hours',
          delta_display: '-3.0 hours',
          has_modeled_effect: true,
          effect_explanation: 'Circadian Disruption penalty formula: deficit * 20.0',
        },
        {
          parameter: 'physical_activity_mins',
          display_name: 'Physical Activity',
          baseline_val: 35.0,
          alternative_val: 15.0,
          unit: 'minutes',
          delta_display: '-20.0 minutes',
          has_modeled_effect: false,
          effect_explanation: 'No modeled effect on DigitalTwinEngine state equations.',
        },
      ],
      outputs_changed: [
        {
          metric: 'composite_stress_index',
          display_name: 'Composite Stress Index (CSI)',
          baseline_value: 28.5,
          alternative_value: 68.0,
          delta: 39.5,
          unit: 'points (0-100)',
          interpretation: 'Composite Stress Index synthesized as 35% arousal + 25% circadian + 40% strain.',
        },
      ],
      unmodeled_inputs: [
        'Physical Activity changed by -20.0 minutes, but this parameter has NO modeled effect on the DigitalTwinEngine state formula.',
      ],
      calculation_explanations: [
        'Sleep Duration shifted (7.5 -> 4.5 hours): Governed by Circadian Disruption rule',
      ],
      scientific_limitations: [
        'Simulations are deterministic mathematical calculations, not individual clinical forecasts.',
      ],
      reproducibility_hash: 'a1b2c3d4e5f67890',
      engine_version: '2.0-adaptive',
      non_causal_disclaimer: 'Model sensitivity reflects statistical patterns and does not establish causality.',
    }),
    runCounterfactualPerturbation: vi.fn().mockResolvedValue({
      parameter_varied: 'sleep_hours',
      original_input: 7.5,
      alternative_input: 4.5,
      input_delta: -3.0,
      base_state: { composite_stress_index: 28.5 },
      counterfactual_state: { composite_stress_index: 43.5 },
      metric_deltas: {
        delta_composite_stress: 15.0,
        delta_physiological_arousal: 0.0,
        delta_circadian_disruption: 60.0,
        delta_baseline_deviation: 15.0,
      },
      simulation_rule_explanation: 'Sleep modified from 7.5h to 4.5h. Sleep deficit penalty formula: max(0, 7.5 - 4.5) * 20.0.',
      formula_attribution: 'Circadian disruption changed by +60.0 pts (25% CSI weight -> +15.0 CSI shift).',
      unmodeled_effect_note: null,
      provenance_notice: 'SYNTHETIC COUNTERFACTUAL EXPERIMENT — DETERMINISTIC DERIVATION',
    }),
    getBaselineEvolution: vi.fn().mockResolvedValue({
      user_id: 1,
      current_baseline_version: 'v2.0-202641',
      calculation_timestamp: '2026-10-11T10:00:00Z',
      windows: [
        {
          window_label: 'Current Window (Oct 04 to Oct 11)',
          start_date: '2026-10-04',
          end_date: '2026-10-11',
          observation_count: 8,
          unique_days: 4,
          mean_resting_hr: 68.0,
          mean_hrv_ms: 50.0,
          mean_sleep_hours: 7.5,
          mean_caffeine_cups: 1.0,
          mean_anxiety_score: 2.0,
          composite_stress_index: 26.0,
          delta_vs_prior: { delta_resting_hr: -2.0 },
          provenance: 'authentic_patient_record',
          sufficient_data: true,
          data_quality_notes: ['Sensor coverage verified.'],
        },
      ],
      change_explanations: [
        'Resting HR shifted by -2.0 BPM across consecutive observation windows based on 8 authentic readings.',
        'Evolution reflects authentic observations and does not alter production ML model weights.',
      ],
      has_sufficient_longitudinal_data: true,
      isolation_notice: 'HISTORICAL BASELINE OBSERVATIONS — EXCLUDES ALL SYNTHETIC SIMULATION SCENARIOS',
    }),
    getDigitalTwinMemories: vi.fn().mockResolvedValue([
      {
        id: 1,
        user_id: 1,
        baseline_version: 'v2.0-202640',
        calculation_timestamp: '2026-10-04T12:00:00Z',
        calculation_version: '2.0-adaptive',
        observation_count: 10,
        metrics_included: { mean_resting_hr: 70.0 },
        source_record_references: [],
        is_active: true,
        notes: 'Empirical multi-modal longitudinal baseline calculated from genuine user telemetry.',
        created_at: '2026-10-04T12:00:00Z',
      },
    ]),
    resetDigitalTwinMemory: vi.fn().mockResolvedValue({
      status: 'success',
      message: 'Successfully reset 1 derived Digital Twin memory snapshots.',
      authentic_records_preserved: true,
      detail: 'Derived baselines reset. Authentic medical observations remain intact.',
    }),
    snapshotDigitalTwinMemory: vi.fn().mockResolvedValue({
      id: 2,
      user_id: 1,
      baseline_version: 'v2.0-202641',
      calculation_timestamp: '2026-10-11T10:00:00Z',
      calculation_version: '2.0-adaptive',
      observation_count: 12,
      metrics_included: { mean_resting_hr: 68.0 },
      source_record_references: [],
      is_active: true,
      notes: 'Active baseline snapshot.',
      created_at: '2026-10-11T10:00:00Z',
    }),
    replayScenario: vi.fn().mockResolvedValue({
      scenario_name: 'Deterministic Counterfactual Replay',
      seed: 42,
      baseline_profile: 'Alex - Standard Healthy Baseline',
      steps: [
        {
          step_index: 0,
          hour_offset: 0,
          heart_rate_bpm: 66.0,
          hrv_ms: 48.0,
          composite_stress_index: 25.0,
          physiological_arousal_score: 28.0,
          circadian_disruption_index: 10.0,
          state_label: 'STABLE_BASELINE',
        },
      ],
      synthetic_notice: 'SYNTHETIC DETERMINISTIC REPLAY',
      reproducibility_hash: 'feedfacecafe1234',
    }),
  },
}));

describe('Adaptive Digital Twin & Longitudinal Evolution Engine (Frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders quarantine banner and personalized initialization badge', async () => {
    render(
      <BrowserRouter>
        <SimulationLabPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/SIMULATED SCENARIO — NOT A REAL-WORLD FORECAST/i)
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/Personalized Baseline/i)).toBeInTheDocument();
    expect(screen.getByText(/Digital Twin Baseline Initialization/i)).toBeInTheDocument();
  });

  it('allows applying scenario presets and updates input parameters', async () => {
    render(
      <BrowserRouter>
        <SimulationLabPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Hypothetical Scenario Inputs/i)).toBeInTheDocument();
    });

    // Click 'Stress Surge' preset
    const stressBtn = screen.getByRole('button', { name: /Stress Surge/i });
    fireEvent.click(stressBtn);

    // Verify simulation was called
    await waitFor(() => {
      expect(api.runSimulation).toHaveBeenCalled();
    });

    // Click 'Restorative' preset
    const restorativeBtn = screen.getByRole('button', { name: /Restorative/i });
    fireEvent.click(restorativeBtn);

    await waitFor(() => {
      expect(api.runSimulation).toHaveBeenCalled();
    });
  });

  it('navigates to Comparison tab and displays side-by-side scenarios and deltas', async () => {
    render(
      <BrowserRouter>
        <SimulationLabPage />
      </BrowserRouter>
    );

    const compareTab = screen.getByRole('button', { name: /Comparison/i });
    fireEvent.click(compareTab);

    await waitFor(() => {
      expect(api.compareScenariosAdaptive).toHaveBeenCalled();
      expect(screen.getByText(/Side-by-Side Scenario Trajectory Comparison/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Scenario A \(Current Configuration\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Scenario B \(Alternative Scenario\)/i)).toBeInTheDocument();
  });

  it('navigates to Explain & Counterfactuals tab and displays "Why Did the Digital Twin Change?" panel', async () => {
    render(
      <BrowserRouter>
        <SimulationLabPage />
      </BrowserRouter>
    );

    const explainTab = screen.getByRole('button', { name: /Explain & Counterfactuals/i });
    fireEvent.click(explainTab);

    await waitFor(() => {
      expect(screen.getByText(/Why Did the Digital Twin Change\?/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Controlled Counterfactual Explorer/i)).toBeInTheDocument();
    expect(screen.getByText(/Inputs With No Modeled Effect on Twin State:/i)).toBeInTheDocument();
  });

  it('navigates to Evolution & Memory tab and renders historical windows and memory governance', async () => {
    render(
      <BrowserRouter>
        <SimulationLabPage />
      </BrowserRouter>
    );

    const evoTab = screen.getByRole('button', { name: /Evolution & Memory/i });
    fireEvent.click(evoTab);

    await waitFor(() => {
      expect(api.getBaselineEvolution).toHaveBeenCalled();
      expect(api.getDigitalTwinMemories).toHaveBeenCalled();
    });

    expect(screen.getByRole('heading', { name: /Longitudinal Baseline Evolution/i })).toBeInTheDocument();
    expect(screen.getByText(/Digital Twin Memory Governance/i)).toBeInTheDocument();
    expect(screen.getByText(/AUTHENTIC RECORD ISOLATION:/i)).toBeInTheDocument();
  });
});
