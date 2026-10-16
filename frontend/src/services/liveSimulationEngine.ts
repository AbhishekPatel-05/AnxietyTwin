/**
 * AnxietyTwin - Live Scenario Engine
 * Pure, deterministic simulated physiological data generator,
 * schema/bounds validator, digital twin state synthesizer,
 * and differential explanation engine.
 */

export type SimulationScenarioId = 'usual_baseline' | 'elevated_stress' | 'recovery';

export type SampleProvenance = 'simulated' | 'user_reported' | 'historical_research' | 'device_measured';

export interface PhysiologicalSample {
  id: string;
  timestamp: string; // ISO 8601
  heartRateBpm: number;
  hrvMs: number; // rMSSD in ms (Root Mean Square of Successive Differences)
  sleepHours: number;
  sleepQualityPercent: number;
  stepsCount: number;
  userReportedStress: number | null; // 0-10 scale
  provenance: SampleProvenance;
  scenarioId: SimulationScenarioId;
  isValid: boolean;
  validationErrors?: string[];
}

export interface SyntheticBaseline {
  meanRestingHr: number;
  stdRestingHr: number;
  meanHrvMs: number;
  stdHrvMs: number;
  meanSleepHours: number;
  meanCaffeineCups: number;
  meanAnxietyScore: number;
  isDescriptiveBaselineReady: boolean;
  observationCount: number;
}

export interface LiveTwinState {
  compositeStressIndex: number; // 0 - 100
  physiologicalArousalScore: number; // 0 - 100
  circadianDisruptionIndex: number; // 0 - 100
  psychologicalStrainScore: number; // 0 - 100
  baselineDeviationScore: number; // -100 to +100
  stateLabel: 'STABLE_BASELINE' | 'MILD_STRAIN' | 'ELEVATED_AROUSAL' | 'HIGH_VULNERABILITY' | 'RECOVERY';
  timestamp: string;
  provenance: SampleProvenance;
  sampleCount: number;
}

export interface TwinExplanation {
  factor: string;
  observedChange: string;
  comparisonBaseline: string;
  source: SampleProvenance;
  timestamp: string;
  limitationNote: string;
  direction: 'increase' | 'decrease' | 'stable';
  significance: 'low' | 'moderate' | 'high';
}

export interface CopingFeedback {
  id: string;
  actionName: string;
  preDistressRating: number; // 0-10
  postDistressRating: number; // 0-10
  ratingDelta: number;
  helpfulness: 'helpful' | 'somewhat_helpful' | 'not_helpful' | 'prefer_not_to_say';
  notes?: string;
  timestamp: string;
  provenance: 'user_reported';
}

// -------------------------------------------------------------
// 1. Seeded Deterministic Pseudo-Random Number Generator (PRNG)
// -------------------------------------------------------------
export class SeededPRNG {
  private state: number;

  constructor(seed: number = 42) {
    this.state = seed >>> 0;
  }

  /**
   * Generates a floating point number in [0, 1) using Mulberry32
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Bounded normal-like variation around mean
   */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Approximate Gaussian distribution via Box-Muller transform
   */
  gaussian(mean: number, std: number): number {
    const u1 = Math.max(1e-7, this.next());
    const u2 = this.next();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z * std;
  }
}

// -------------------------------------------------------------
// 2. Default Baselines & Bounds Validation
// -------------------------------------------------------------
export const DEFAULT_SYNTHETIC_BASELINE: SyntheticBaseline = {
  meanRestingHr: 70.0,
  stdRestingHr: 7.0,
  meanHrvMs: 48.0,
  stdHrvMs: 10.0,
  meanSleepHours: 7.5,
  meanCaffeineCups: 1.0,
  meanAnxietyScore: 2.5,
  isDescriptiveBaselineReady: true,
  observationCount: 14,
};

export const PHYSIOLOGICAL_BOUNDS = {
  heartRate: { min: 35, max: 210, unit: 'BPM' },
  hrv: { min: 5, max: 250, unit: 'ms (rMSSD)' },
  sleep: { min: 0, max: 24, unit: 'hours' },
  sleepQuality: { min: 0, max: 100, unit: '%' },
  steps: { min: 0, max: 100000, unit: 'steps' },
  anxiety: { min: 0, max: 10, unit: '0-10 rating' },
};

export function validateSample(sample: Partial<PhysiologicalSample>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (sample.heartRateBpm === undefined || sample.heartRateBpm < PHYSIOLOGICAL_BOUNDS.heartRate.min || sample.heartRateBpm > PHYSIOLOGICAL_BOUNDS.heartRate.max) {
    errors.push(`Heart rate ${sample.heartRateBpm} BPM is outside physiological bounds (${PHYSIOLOGICAL_BOUNDS.heartRate.min}-${PHYSIOLOGICAL_BOUNDS.heartRate.max} BPM).`);
  }

  if (sample.hrvMs === undefined || sample.hrvMs < PHYSIOLOGICAL_BOUNDS.hrv.min || sample.hrvMs > PHYSIOLOGICAL_BOUNDS.hrv.max) {
    errors.push(`HRV ${sample.hrvMs} ms is outside expected bounds (${PHYSIOLOGICAL_BOUNDS.hrv.min}-${PHYSIOLOGICAL_BOUNDS.hrv.max} ms).`);
  }

  if (sample.sleepHours !== undefined && (sample.sleepHours < PHYSIOLOGICAL_BOUNDS.sleep.min || sample.sleepHours > PHYSIOLOGICAL_BOUNDS.sleep.max)) {
    errors.push(`Sleep duration ${sample.sleepHours}h is invalid.`);
  }

  if (sample.userReportedStress !== null && sample.userReportedStress !== undefined && (sample.userReportedStress < 0 || sample.userReportedStress > 10)) {
    errors.push(`Self-reported anxiety score must be in range 0-10.`);
  }

  if (!sample.timestamp || isNaN(Date.parse(sample.timestamp))) {
    errors.push(`Invalid timestamp format.`);
  }

  if (sample.provenance !== 'simulated' && sample.provenance !== 'user_reported' && sample.provenance !== 'historical_research') {
    errors.push(`Invalid sample provenance tag: ${sample.provenance}. Device measured must not be assigned to synthetic stream.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// -------------------------------------------------------------
// 3. Scenario Sample Generator
// -------------------------------------------------------------
export function generateScenarioSample(
  scenarioId: SimulationScenarioId,
  stepIndex: number,
  baseline: SyntheticBaseline = DEFAULT_SYNTHETIC_BASELINE,
  prng: SeededPRNG = new SeededPRNG(42 + stepIndex),
  baseDate: Date = new Date()
): PhysiologicalSample {
  const timestamp = new Date(baseDate.getTime() + stepIndex * 60000).toISOString();

  let hr = baseline.meanRestingHr;
  let hrv = baseline.meanHrvMs;
  let sleep = baseline.meanSleepHours;
  let sleepQuality = 85;
  let steps = 4500 + stepIndex * 25;
  let stress: number | null = Math.round(baseline.meanAnxietyScore);

  if (scenarioId === 'usual_baseline') {
    // Stable readings with bounded natural variation (e.g. ±3 BPM, ±4 ms HRV)
    hr = Math.round(prng.gaussian(baseline.meanRestingHr, 2.5));
    hrv = Math.round(prng.gaussian(baseline.meanHrvMs, 3.5));
    sleep = baseline.meanSleepHours;
    sleepQuality = Math.round(prng.range(80, 92));
    stress = Math.min(3, Math.max(1, Math.round(prng.range(1.5, 2.5))));
  } else if (scenarioId === 'elevated_stress') {
    // Controlled synthetic elevation: sympathetic surge, depressed parasympathetic HRV
    // Progressively escalates with stepIndex (clamped between bounds)
    const surgeProgress = Math.min(1.0, 0.4 + (stepIndex * 0.08));
    const targetHr = baseline.meanRestingHr + 22.0 * surgeProgress; // e.g. 70 -> 92 BPM
    const targetHrv = Math.max(18.0, baseline.meanHrvMs - 22.0 * surgeProgress); // e.g. 48 -> 26 ms
    hr = Math.round(prng.gaussian(targetHr, 3.0));
    hrv = Math.round(prng.gaussian(targetHrv, 2.5));
    sleep = Math.max(4.0, baseline.meanSleepHours - 2.5); // sleep debt
    sleepQuality = Math.round(prng.range(45, 60));
    stress = Math.min(10, Math.max(6, Math.round(5.5 + 3.0 * surgeProgress)));
  } else if (scenarioId === 'recovery') {
    // Controlled synthetic recovery: gradual trajectory back toward baseline
    const recoveryProgress = Math.min(1.0, 0.2 + (stepIndex * 0.12));
    const startElevatedHr = baseline.meanRestingHr + 20.0;
    const startDepressedHrv = baseline.meanHrvMs - 20.0;
    const currentHrTarget = startElevatedHr - (startElevatedHr - baseline.meanRestingHr) * recoveryProgress;
    const currentHrvTarget = startDepressedHrv + (baseline.meanHrvMs - startDepressedHrv) * recoveryProgress;
    hr = Math.round(prng.gaussian(currentHrTarget, 2.0));
    hrv = Math.round(prng.gaussian(currentHrvTarget, 3.0));
    sleep = baseline.meanSleepHours;
    sleepQuality = Math.round(prng.range(75, 88));
    stress = Math.min(4, Math.max(2, Math.round(6.0 - 3.5 * recoveryProgress)));
  }

  // Clamp within safe bounds
  hr = Math.max(PHYSIOLOGICAL_BOUNDS.heartRate.min, Math.min(PHYSIOLOGICAL_BOUNDS.heartRate.max, hr));
  hrv = Math.max(PHYSIOLOGICAL_BOUNDS.hrv.min, Math.min(PHYSIOLOGICAL_BOUNDS.hrv.max, hrv));

  const candidate: Partial<PhysiologicalSample> = {
    id: `sample_${scenarioId}_${stepIndex}_${Date.now()}`,
    timestamp,
    heartRateBpm: hr,
    hrvMs: hrv,
    sleepHours: Number(sleep.toFixed(1)),
    sleepQualityPercent: sleepQuality,
    stepsCount: steps,
    userReportedStress: stress,
    provenance: 'simulated',
    scenarioId,
  };

  const validation = validateSample(candidate);

  return {
    ...candidate as PhysiologicalSample,
    isValid: validation.isValid,
    validationErrors: validation.errors,
  };
}

// -------------------------------------------------------------
// 4. Digital Twin State Calculation (Symmetric with backend engine)
// -------------------------------------------------------------
export function calculateLiveTwinState(
  sample: PhysiologicalSample,
  baseline: SyntheticBaseline = DEFAULT_SYNTHETIC_BASELINE,
  sampleCount: number = 1,
  previousState?: LiveTwinState
): LiveTwinState {
  // 1. Physiological Arousal Score (0 - 100)
  const hrZ = (sample.heartRateBpm - baseline.meanRestingHr) / Math.max(1.0, baseline.stdRestingHr);
  const hrComponent = Math.min(100.0, Math.max(0.0, 50.0 + (hrZ * 18.0)));

  const hrvZ = (baseline.meanHrvMs - sample.hrvMs) / Math.max(1.0, baseline.stdHrvMs);
  const hrvComponent = Math.min(100.0, Math.max(0.0, 50.0 + (hrvZ * 16.0)));

  const physioArousal = Math.min(100.0, Math.max(0.0, 0.55 * hrComponent + 0.45 * hrvComponent));

  // 2. Circadian Disruption Index (0 - 100)
  const sleepDeficit = Math.max(0.0, baseline.meanSleepHours - sample.sleepHours);
  const circadianDisruption = Math.min(100.0, Math.max(0.0, sleepDeficit * 20.0));

  // 3. Psychological Strain (0 - 100)
  const stressRating = sample.userReportedStress !== null ? sample.userReportedStress : baseline.meanAnxietyScore;
  const psychStrain = Math.min(100.0, Math.max(0.0, stressRating * 10.0));

  // 4. Multi-modal Composite Stress Index (CSI)
  const csi = Math.min(100.0, Math.max(0.0, 0.35 * physioArousal + 0.25 * circadianDisruption + 0.40 * psychStrain));
  const roundedCsi = Number(csi.toFixed(1));

  // 5. Baseline Deviation Score
  const baseComposite = 0.35 * 50.0 + 0.25 * 10.0 + 0.40 * (baseline.meanAnxietyScore * 10.0);
  const baselineDeviation = Number((roundedCsi - baseComposite).toFixed(1));

  // 6. State Label Classification
  let stateLabel: LiveTwinState['stateLabel'] = 'STABLE_BASELINE';
  if (roundedCsi < 30.0 && Math.abs(baselineDeviation) < 15.0) {
    stateLabel = 'STABLE_BASELINE';
  } else if (roundedCsi >= 30.0 && roundedCsi < 50.0) {
    stateLabel = 'MILD_STRAIN';
  } else if (roundedCsi >= 50.0 && roundedCsi < 70.0) {
    stateLabel = 'ELEVATED_AROUSAL';
  } else {
    stateLabel = 'HIGH_VULNERABILITY';
  }

  // Recovery transition check
  if (
    previousState &&
    (previousState.stateLabel === 'ELEVATED_AROUSAL' || previousState.stateLabel === 'HIGH_VULNERABILITY') &&
    roundedCsi < 42.0 &&
    sample.scenarioId === 'recovery'
  ) {
    stateLabel = 'RECOVERY';
  }

  return {
    compositeStressIndex: roundedCsi,
    physiologicalArousalScore: Number(physioArousal.toFixed(1)),
    circadianDisruptionIndex: Number(circadianDisruption.toFixed(1)),
    psychologicalStrainScore: Number(psychStrain.toFixed(1)),
    baselineDeviationScore: baselineDeviation,
    stateLabel,
    timestamp: sample.timestamp,
    provenance: sample.provenance,
    sampleCount,
  };
}

// -------------------------------------------------------------
// 5. Differential Explanation Engine ("What Changed in Your Twin?")
// -------------------------------------------------------------
export function generateTwinExplanations(
  currentSample: PhysiologicalSample,
  currentState: LiveTwinState,
  previousSample: PhysiologicalSample | null,
  previousState: LiveTwinState | null,
  baseline: SyntheticBaseline = DEFAULT_SYNTHETIC_BASELINE
): TwinExplanation[] {
  const explanations: TwinExplanation[] = [];
  const hrDiff = currentSample.heartRateBpm - baseline.meanRestingHr;
  const hrvDiff = baseline.meanHrvMs - currentSample.hrvMs;

  // Heart Rate Explanation
  if (Math.abs(hrDiff) >= 4.0) {
    explanations.push({
      factor: 'Autonomic Heart Rate',
      observedChange: `Current simulated reading of ${currentSample.heartRateBpm} BPM (${hrDiff > 0 ? '+' : ''}${hrDiff} BPM relative to baseline).`,
      comparisonBaseline: `Personal reference mean: ${baseline.meanRestingHr} BPM (±${baseline.stdRestingHr} BPM).`,
      source: currentSample.provenance,
      timestamp: currentSample.timestamp,
      limitationNote: 'Simulated reading for educational scenario exploration. Heart rate variation reflects multi-factorial physical and psychological factors and does not prove anxiety.',
      direction: hrDiff > 0 ? 'increase' : 'decrease',
      significance: Math.abs(hrDiff) > 15 ? 'high' : 'moderate',
    });
  }

  // HRV Explanation
  if (Math.abs(hrvDiff) >= 6.0) {
    explanations.push({
      factor: 'Autonomic Tone (HRV rMSSD)',
      observedChange: `Current simulated HRV is ${currentSample.hrvMs} ms (${hrvDiff > 0 ? '-' : '+'}${Math.abs(hrvDiff)} ms change).`,
      comparisonBaseline: `Personal reference mean: ${baseline.meanHrvMs} ms.`,
      source: currentSample.provenance,
      timestamp: currentSample.timestamp,
      limitationNote: 'rMSSD parasympathetic marker. Transient drops in HRV occur during posture changes, caffeine intake, or exercise, not solely psychological distress.',
      direction: hrvDiff > 0 ? 'decrease' : 'increase',
      significance: Math.abs(hrvDiff) > 18 ? 'high' : 'moderate',
    });
  }

  // Self-Reported Distress
  if (currentSample.userReportedStress !== null && Math.abs(currentSample.userReportedStress - baseline.meanAnxietyScore) >= 1.5) {
    const stressDiff = currentSample.userReportedStress - baseline.meanAnxietyScore;
    explanations.push({
      factor: 'Self-Reported Distress',
      observedChange: `Check-in rating of ${currentSample.userReportedStress}/10 (${stressDiff > 0 ? '+' : ''}${stressDiff.toFixed(1)} from typical baseline).`,
      comparisonBaseline: `Typical baseline rating: ${baseline.meanAnxietyScore.toFixed(1)}/10.`,
      source: 'simulated',
      timestamp: currentSample.timestamp,
      limitationNote: 'Subjective rating reflecting voluntary user mood or simulated scenario context.',
      direction: stressDiff > 0 ? 'increase' : 'decrease',
      significance: Math.abs(stressDiff) >= 3.0 ? 'high' : 'moderate',
    });
  }

  // CSI Composite Explanation
  if (previousState && Math.abs(currentState.compositeStressIndex - previousState.compositeStressIndex) >= 3.0) {
    const csiDelta = currentState.compositeStressIndex - previousState.compositeStressIndex;
    explanations.push({
      factor: 'Composite Stress Index (CSI)',
      observedChange: `Twin state transitioned from ${previousState.stateLabel} to ${currentState.stateLabel} (CSI $\\Delta$: ${csiDelta > 0 ? '+' : ''}${csiDelta.toFixed(1)} pts).`,
      comparisonBaseline: `Baseline Reference State: STABLE_BASELINE (CSI ~25.0).`,
      source: currentState.provenance,
      timestamp: currentState.timestamp,
      limitationNote: 'Mathematical synthesis of 35% autonomic, 25% circadian, and 40% subjective inputs. Non-diagnostic heuristic.',
      direction: csiDelta > 0 ? 'increase' : 'decrease',
      significance: Math.abs(csiDelta) >= 15.0 ? 'high' : 'moderate',
    });
  }

  if (explanations.length === 0) {
    explanations.push({
      factor: 'Steady State Equilibrium',
      observedChange: `Simulated readings remain tightly aligned with personal baseline (${currentSample.heartRateBpm} BPM, ${currentSample.hrvMs} ms HRV).`,
      comparisonBaseline: `Baseline: ${baseline.meanRestingHr} BPM, ${baseline.meanHrvMs} ms HRV.`,
      source: currentSample.provenance,
      timestamp: currentSample.timestamp,
      limitationNote: 'Natural bounded physiological homeostasis.',
      direction: 'stable',
      significance: 'low',
    });
  }

  return explanations;
}
