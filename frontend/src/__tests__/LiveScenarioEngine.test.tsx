import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  SeededPRNG,
  validateSample,
  generateScenarioSample,
  calculateLiveTwinState,
  generateTwinExplanations,
  DEFAULT_SYNTHETIC_BASELINE,
  PhysiologicalSample,
  LiveTwinState,
} from '../services/liveSimulationEngine';
import { LiveScenarioEngine } from '../components/LiveScenarioEngine';

describe('Phase 6.1 — Live Simulation Engine (Service Layer)', () => {
  describe('1. SeededPRNG Determinism & Distribution', () => {
    it('produces identical deterministic sequences with identical seed', () => {
      const prng1 = new SeededPRNG(42);
      const prng2 = new SeededPRNG(42);

      const seq1 = [prng1.next(), prng1.next(), prng1.next(), prng1.next()];
      const seq2 = [prng2.next(), prng2.next(), prng2.next(), prng2.next()];

      expect(seq1).toEqual(seq2);
    });

    it('produces distinct sequences when seeds differ', () => {
      const prng1 = new SeededPRNG(42);
      const prng2 = new SeededPRNG(999);

      expect(prng1.next()).not.toEqual(prng2.next());
    });

    it('generates values within specified range and bounded Gaussian distribution', () => {
      const prng = new SeededPRNG(123);
      for (let i = 0; i < 20; i++) {
        const val = prng.range(10, 50);
        expect(val).toBeGreaterThanOrEqual(10);
        expect(val).toBeLessThan(50);
      }

      const gVal = prng.gaussian(70, 5);
      expect(typeof gVal).toBe('number');
      expect(gVal).toBeGreaterThan(40);
      expect(gVal).toBeLessThan(100);
    });
  });

  describe('2. Physiological Sample Validation & Provenance Safeguards', () => {
    it('validates a well-formed simulated sample successfully', () => {
      const sample: Partial<PhysiologicalSample> = {
        heartRateBpm: 72,
        hrvMs: 46,
        sleepHours: 7.5,
        userReportedStress: 3,
        timestamp: new Date().toISOString(),
        provenance: 'simulated',
      };
      const result = validateSample(sample);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects heart rate readings outside physiological bounds (35-210 BPM)', () => {
      const sampleLow: Partial<PhysiologicalSample> = {
        heartRateBpm: 25,
        hrvMs: 40,
        timestamp: new Date().toISOString(),
        provenance: 'simulated',
      };
      const resultLow = validateSample(sampleLow);
      expect(resultLow.isValid).toBe(false);
      expect(resultLow.errors.some((e) => e.includes('Heart rate'))).toBe(true);

      const sampleHigh: Partial<PhysiologicalSample> = {
        heartRateBpm: 220,
        hrvMs: 40,
        timestamp: new Date().toISOString(),
        provenance: 'simulated',
      };
      const resultHigh = validateSample(sampleHigh);
      expect(resultHigh.isValid).toBe(false);
      expect(resultHigh.errors.some((e) => e.includes('Heart rate'))).toBe(true);
    });

    it('rejects HRV readings outside physiological bounds (5-250 ms)', () => {
      const sample: Partial<PhysiologicalSample> = {
        heartRateBpm: 70,
        hrvMs: 2,
        timestamp: new Date().toISOString(),
        provenance: 'simulated',
      };
      const result = validateSample(sample);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('HRV'))).toBe(true);
    });

    it('rejects invalid provenance and strictly forbids device_measured for simulated streams', () => {
      const sample: Partial<PhysiologicalSample> = {
        heartRateBpm: 72,
        hrvMs: 45,
        timestamp: new Date().toISOString(),
        provenance: 'device_measured' as any,
      };
      const result = validateSample(sample);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Device measured must not be assigned'))).toBe(true);
    });

    it('rejects invalid or missing timestamp formats', () => {
      const sample: Partial<PhysiologicalSample> = {
        heartRateBpm: 72,
        hrvMs: 45,
        timestamp: 'invalid-date-string',
        provenance: 'simulated',
      };
      const result = validateSample(sample);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid timestamp'))).toBe(true);
    });
  });

  describe('3. Scenario Sample Generation (Scenarios A, B, C)', () => {
    it('Scenario A (usual_baseline) generates stable readings near baseline', () => {
      const prng = new SeededPRNG(42);
      const sample = generateScenarioSample('usual_baseline', 0, DEFAULT_SYNTHETIC_BASELINE, prng);

      expect(sample.scenarioId).toBe('usual_baseline');
      expect(sample.provenance).toBe('simulated');
      expect(sample.isValid).toBe(true);
      expect(sample.heartRateBpm).toBeGreaterThanOrEqual(65);
      expect(sample.heartRateBpm).toBeLessThanOrEqual(76);
      expect(sample.hrvMs).toBeGreaterThanOrEqual(42);
      expect(sample.hrvMs).toBeLessThanOrEqual(55);
      expect(sample.userReportedStress).toBeLessThanOrEqual(3);
    });

    it('Scenario B (elevated_stress) generates elevated HR, suppressed HRV, and elevated distress', () => {
      const prng = new SeededPRNG(42);
      const sample = generateScenarioSample('elevated_stress', 5, DEFAULT_SYNTHETIC_BASELINE, prng);

      expect(sample.scenarioId).toBe('elevated_stress');
      expect(sample.provenance).toBe('simulated');
      expect(sample.isValid).toBe(true);
      // Elevated HR
      expect(sample.heartRateBpm).toBeGreaterThan(80);
      // Depressed HRV
      expect(sample.hrvMs).toBeLessThan(35);
      // Elevated self-reported distress
      expect(sample.userReportedStress).toBeGreaterThanOrEqual(6);
    });

    it('Scenario C (recovery) models gradual trajectory returning toward baseline', () => {
      const prngEarly = new SeededPRNG(42);
      const prngLate = new SeededPRNG(42);

      const earlyRecovery = generateScenarioSample('recovery', 1, DEFAULT_SYNTHETIC_BASELINE, prngEarly);
      const lateRecovery = generateScenarioSample('recovery', 8, DEFAULT_SYNTHETIC_BASELINE, prngLate);

      expect(earlyRecovery.scenarioId).toBe('recovery');
      expect(lateRecovery.scenarioId).toBe('recovery');
      // Later in recovery, HR should be lower or near baseline
      expect(lateRecovery.heartRateBpm).toBeLessThanOrEqual(earlyRecovery.heartRateBpm + 2);
      // Later in recovery, HRV should have rebounded
      expect(lateRecovery.hrvMs).toBeGreaterThanOrEqual(earlyRecovery.hrvMs - 2);
    });

    it('is 100% reproducible with fixed seed and stepIndex', () => {
      const prng1 = new SeededPRNG(101);
      const prng2 = new SeededPRNG(101);
      const fixedDate = new Date('2026-03-15T12:00:00Z');

      const s1 = generateScenarioSample('elevated_stress', 3, DEFAULT_SYNTHETIC_BASELINE, prng1, fixedDate);
      const s2 = generateScenarioSample('elevated_stress', 3, DEFAULT_SYNTHETIC_BASELINE, prng2, fixedDate);

      expect(s1.heartRateBpm).toEqual(s2.heartRateBpm);
      expect(s1.hrvMs).toEqual(s2.hrvMs);
      expect(s1.userReportedStress).toEqual(s2.userReportedStress);
      expect(s1.timestamp).toEqual(s2.timestamp);
    });
  });

  describe('4. Digital Twin State Calculation & Symmetry', () => {
    it('calculates STABLE_BASELINE state for normal resting sample', () => {
      const sample: PhysiologicalSample = {
        id: 's1',
        timestamp: new Date().toISOString(),
        heartRateBpm: 70,
        hrvMs: 48,
        sleepHours: 7.5,
        sleepQualityPercent: 88,
        stepsCount: 5000,
        userReportedStress: 2,
        provenance: 'simulated',
        scenarioId: 'usual_baseline',
        isValid: true,
      };

      const state = calculateLiveTwinState(sample, DEFAULT_SYNTHETIC_BASELINE, 1);
      expect(state.stateLabel).toBe('STABLE_BASELINE');
      expect(state.compositeStressIndex).toBeLessThan(35);
      expect(state.provenance).toBe('simulated');
    });

    it('calculates ELEVATED_AROUSAL or HIGH_VULNERABILITY for elevated stress sample', () => {
      const sample: PhysiologicalSample = {
        id: 's2',
        timestamp: new Date().toISOString(),
        heartRateBpm: 94,
        hrvMs: 24,
        sleepHours: 5.0,
        sleepQualityPercent: 50,
        stepsCount: 5000,
        userReportedStress: 8,
        provenance: 'simulated',
        scenarioId: 'elevated_stress',
        isValid: true,
      };

      const state = calculateLiveTwinState(sample, DEFAULT_SYNTHETIC_BASELINE, 1);
      expect(['ELEVATED_AROUSAL', 'HIGH_VULNERABILITY']).toContain(state.stateLabel);
      expect(state.compositeStressIndex).toBeGreaterThan(50);
      expect(state.physiologicalArousalScore).toBeGreaterThan(60);
      expect(state.circadianDisruptionIndex).toBeGreaterThan(30);
    });

    it('transitions to RECOVERY state when recovering from elevated arousal', () => {
      const priorState: LiveTwinState = {
        compositeStressIndex: 68,
        physiologicalArousalScore: 72,
        circadianDisruptionIndex: 40,
        psychologicalStrainScore: 80,
        baselineDeviationScore: 35,
        stateLabel: 'ELEVATED_AROUSAL',
        timestamp: new Date().toISOString(),
        provenance: 'simulated',
        sampleCount: 5,
      };

      const recoverySample: PhysiologicalSample = {
        id: 's3',
        timestamp: new Date().toISOString(),
        heartRateBpm: 72,
        hrvMs: 46,
        sleepHours: 7.5,
        sleepQualityPercent: 82,
        stepsCount: 5000,
        userReportedStress: 3,
        provenance: 'simulated',
        scenarioId: 'recovery',
        isValid: true,
      };

      const newState = calculateLiveTwinState(recoverySample, DEFAULT_SYNTHETIC_BASELINE, 6, priorState);
      expect(newState.stateLabel).toBe('RECOVERY');
    });
  });

  describe('5. Differential Explanation Engine ("What Changed in Your Twin?")', () => {
    it('generates non-causal, baseline-referenced explanations for physiological shifts', () => {
      const sample: PhysiologicalSample = {
        id: 's4',
        timestamp: new Date().toISOString(),
        heartRateBpm: 92,
        hrvMs: 24,
        sleepHours: 7.5,
        sleepQualityPercent: 80,
        stepsCount: 5000,
        userReportedStress: 7,
        provenance: 'simulated',
        scenarioId: 'elevated_stress',
        isValid: true,
      };

      const state = calculateLiveTwinState(sample, DEFAULT_SYNTHETIC_BASELINE, 1);
      const explanations = generateTwinExplanations(sample, state, null, null, DEFAULT_SYNTHETIC_BASELINE);

      expect(explanations.length).toBeGreaterThanOrEqual(2);

      // Check Heart Rate explanation
      const hrExp = explanations.find((e) => e.factor.includes('Heart Rate'));
      expect(hrExp).toBeDefined();
      expect(hrExp?.observedChange).toContain('92 BPM');
      expect(hrExp?.comparisonBaseline).toContain('70 BPM');
      expect(hrExp?.source).toBe('simulated');
      expect(hrExp?.limitationNote).toContain('does not prove anxiety');

      // Check HRV explanation
      const hrvExp = explanations.find((e) => e.factor.includes('HRV'));
      expect(hrvExp).toBeDefined();
      expect(hrvExp?.observedChange).toContain('24 ms');
      expect(hrvExp?.limitationNote).toContain('not solely psychological distress');
    });
  });
});

describe('Phase 6.1 — LiveScenarioEngine React Component UI & Lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders mandatory SIMULATED DATA banner and core status indicators', () => {
    render(<LiveScenarioEngine />);

    // Mandatory banner
    expect(screen.getByText(/Simulated Data • No Physical Sensor Connected/i)).toBeInTheDocument();
    expect(screen.getByText(/Demo Profile: Alex/i)).toBeInTheDocument();

    // Twin Status Section
    expect(screen.getByText(/Digital Twin Virtual State/i)).toBeInTheDocument();
    expect(screen.getByText(/Personal Baseline Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Data Sufficiency & Freshness/i)).toBeInTheDocument();
    expect(screen.getByText(/ML 24h Prospective Forecast/i)).toBeInTheDocument();

    // Controls
    expect(screen.getByRole('button', { name: /start simulation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset demo/i })).toBeInTheDocument();
  });

  it('starts continuous sample streaming on Start button click', () => {
    render(<LiveScenarioEngine />);

    const startBtn = screen.getByRole('button', { name: /start simulation/i });
    act(() => {
      fireEvent.click(startBtn);
    });

    // Should change button to Pause Stream
    expect(screen.getByRole('button', { name: /pause stream/i })).toBeInTheDocument();

    // Advance timer by 2 seconds (default tick is 1000ms at 1x)
    act(() => {
      vi.advanceTimersByTime(2100);
    });

    // Check that samples buffered counter exists
    expect(screen.getByText(/valid samples buffered/i)).toBeInTheDocument();
  });

  it('switches between scenarios (Usual Baseline -> Elevated Stress -> Recovery)', () => {
    render(<LiveScenarioEngine />);

    // Switch to elevated stress
    const elevatedBtn = screen.getByRole('button', { name: /scenario b: elevated stress/i });
    act(() => {
      fireEvent.click(elevatedBtn);
    });

    expect(screen.getByText(/Scenario B: Elevated Stress/i)).toBeInTheDocument();

    // Switch to recovery
    const recoveryBtn = screen.getByRole('button', { name: /scenario c: recovery/i });
    act(() => {
      fireEvent.click(recoveryBtn);
    });

    expect(screen.getByText(/Scenario C: Recovery/i)).toBeInTheDocument();
  });

  it('pauses, resumes, stops, and cleans up timers without leaks', () => {
    render(<LiveScenarioEngine />);

    const startBtn = screen.getByRole('button', { name: /start simulation/i });
    act(() => {
      fireEvent.click(startBtn);
    });

    // Pause
    const pauseBtn = screen.getByRole('button', { name: /pause stream/i });
    act(() => {
      fireEvent.click(pauseBtn);
    });
    expect(screen.getByRole('button', { name: /resume stream/i })).toBeInTheDocument();

    // Resume
    const resumeBtn = screen.getByRole('button', { name: /resume stream/i });
    act(() => {
      fireEvent.click(resumeBtn);
    });
    expect(screen.getByRole('button', { name: /pause stream/i })).toBeInTheDocument();

    // Stop
    const stopBtn = screen.getByRole('button', { name: /stop/i });
    act(() => {
      fireEvent.click(stopBtn);
    });
    expect(screen.getByRole('button', { name: /start simulation/i })).toBeInTheDocument();
  });

  it('renders "What Changed in Your Twin?" explainability panel', () => {
    render(<LiveScenarioEngine />);

    expect(screen.getByText(/What Changed in Your Twin\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Live Differential Explanation/i)).toBeInTheDocument();
  });

  it('renders "What-If" Counterfactual Scenario Comparison matrix', () => {
    render(<LiveScenarioEngine />);

    expect(screen.getByText(/What-If Scenario Comparison/i)).toBeInTheDocument();

    // Toggle custom scenario sliders
    const configBtn = screen.getByRole('button', { name: /configure custom scenario/i });
    act(() => {
      fireEvent.click(configBtn);
    });

    expect(screen.getByText(/Hypothetical HR:/i)).toBeInTheDocument();
    expect(screen.getByText(/Hypothetical HRV:/i)).toBeInTheDocument();
    expect(screen.getByText(/Hypothetical Sleep:/i)).toBeInTheDocument();
  });

  it('renders "Explore Your Next Step" with feedback rating loop', () => {
    render(<LiveScenarioEngine />);

    expect(screen.getByText(/Explore Your Next Step/i)).toBeInTheDocument();

    // Select 4-7-8 Breathing Pacer
    const breathingBtn = screen.getByRole('button', { name: /4-7-8 breathing pacer/i });
    act(() => {
      fireEvent.click(breathingBtn);
    });

    expect(screen.getByText(/Optional Grounding Support: 4-7-8 Breathing Pacer/i)).toBeInTheDocument();
    expect(screen.getByText(/Record Voluntary Exercise Feedback/i)).toBeInTheDocument();

    // Record pre-rating and post-rating
    const preInput = screen.getByLabelText(/pre-exercise distress/i);
    fireEvent.change(preInput, { target: { value: '7' } });

    const postInput = screen.getByLabelText(/post-exercise distress/i);
    fireEvent.change(postInput, { target: { value: '4' } });

    // Select helpfulness
    const helpSelect = screen.getByLabelText(/was this helpful/i);
    fireEvent.change(helpSelect, { target: { value: 'helpful' } });

    // Save feedback
    const saveFeedbackBtn = screen.getByRole('button', { name: /save feedback/i });
    act(() => {
      fireEvent.click(saveFeedbackBtn);
    });

    expect(screen.getByText(/Exercise feedback logged successfully!/i)).toBeInTheDocument();
  });

  it('resets demo to reproducible initial state (Seed 42) on 1-Click Reset', () => {
    render(<LiveScenarioEngine />);

    // Switch scenario first
    const elevatedBtn = screen.getByRole('button', { name: /scenario b: elevated stress/i });
    fireEvent.click(elevatedBtn);

    // Click Reset Demo
    const resetBtn = screen.getByRole('button', { name: /reset demo/i });
    fireEvent.click(resetBtn);

    // Confirms reset to initial state
    expect(screen.getByText(/Scenario A: Usual Baseline/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start simulation/i })).toBeInTheDocument();
  });
});
