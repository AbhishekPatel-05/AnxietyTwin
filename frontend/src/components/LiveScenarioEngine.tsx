import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  FastForward,
  Activity,
  Heart,
  Moon,
  Footprints,
  ShieldAlert,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  GitCompare,
  Sliders,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Eye,
  Smile,
  Meh,
  Frown,
  Wind
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  SimulationScenarioId,
  PhysiologicalSample,
  SyntheticBaseline,
  LiveTwinState,
  TwinExplanation,
  CopingFeedback,
  SeededPRNG,
  DEFAULT_SYNTHETIC_BASELINE,
  generateScenarioSample,
  calculateLiveTwinState,
  generateTwinExplanations,
} from '../services/liveSimulationEngine';
import { TwinStateBadge } from './TwinStateBadge';
import { BreathingPacer } from './BreathingPacer';
import { api } from '../services/api';
import { InterventionsStatusResponse, EarlyWarningSignal } from '../types';

interface LiveScenarioEngineProps {
  initialProfileId?: string;
}

export const LiveScenarioEngine: React.FC<LiveScenarioEngineProps> = () => {
  // Simulation Execution State
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<SimulationScenarioId>('usual_baseline');
  const [simulationSpeed, setSimulationSpeed] = useState<number>(5); // 1x, 5x, 10x, 30x
  const [demoStep, setDemoStep] = useState<number>(1);

  // Baseline & Data Samples
  const [baseline, setBaseline] = useState<SyntheticBaseline>({ ...DEFAULT_SYNTHETIC_BASELINE });
  const [sampleBuffer, setSampleBuffer] = useState<PhysiologicalSample[]>([]);
  const [currentSample, setCurrentSample] = useState<PhysiologicalSample | null>(null);
  const [currentTwinState, setCurrentTwinState] = useState<LiveTwinState | null>(null);
  const [previousTwinState, setPreviousTwinState] = useState<LiveTwinState | null>(null);
  const [explanations, setExplanations] = useState<TwinExplanation[]>([]);
  const [syntheticStatus, setSyntheticStatus] = useState<InterventionsStatusResponse | null>(null);

  const computeLocalSyntheticSignals = (sample: PhysiologicalSample | null, base: SyntheticBaseline): EarlyWarningSignal[] => {
    if (!sample) return [];
    const deltaHr = sample.heartRateBpm - base.meanRestingHr;
    const deltaHrv = sample.hrvMs - base.meanHrvMs;
    const deltaSleep = sample.sleepHours - base.meanSleepHours;
    const stress = sample.userReportedStress ?? 3.0;

    const signals: EarlyWarningSignal[] = [
      {
        signal_id: 'sim_hr',
        signal_type: 'elevated_heart_rate',
        title: deltaHr >= 5.0 ? 'Elevated Heart Rate (Simulated)' : 'Heart Rate within Range (Simulated)',
        level: deltaHr >= 5.0 ? 'Change Detected' : 'Within Personal Range',
        what_changed: deltaHr >= 5.0
          ? `Synthetic heart rate (${sample.heartRateBpm} BPM) elevated by +${deltaHr.toFixed(1)} BPM relative to baseline.`
          : `Synthetic heart rate (${sample.heartRateBpm} BPM) remains within normal variation of baseline (${base.meanRestingHr} BPM).`,
        why_flagged: deltaHr >= 5.0 ? `Observed delta exceeds threshold (+5.0 BPM).` : `Delta (+${deltaHr.toFixed(1)} BPM) within normal variation.`,
        evidence_summary: `Sample: ${sample.heartRateBpm} BPM vs Baseline: ${base.meanRestingHr} BPM`,
        unit: 'BPM',
        timestamps: [sample.timestamp],
        supporting_record_ids: ['sim_sample_live'],
        data_quality: 'Synthetic stream',
        data_provenance: 'simulated',
        suggested_activity: 'Test 4-7-8 Breathing Pacer in simulation',
        suggested_intervention_type: 'breathing_478',
        limitations: 'Observational association does not establish clinical causation.',
        is_rule_based: true,
      },
      {
        signal_id: 'sim_hrv',
        signal_type: 'reduced_hrv',
        title: deltaHrv <= -6.0 ? 'Reduced Parasympathetic Tone (Simulated)' : 'Vagal Tone within Range (Simulated)',
        level: deltaHrv <= -6.0 ? 'Change Detected' : 'Within Personal Range',
        what_changed: deltaHrv <= -6.0
          ? `Synthetic HRV (${sample.hrvMs} ms) dropped by ${deltaHrv.toFixed(1)} ms relative to baseline.`
          : `Synthetic HRV (${sample.hrvMs} ms) consistent with baseline (${base.meanHrvMs} ms).`,
        why_flagged: deltaHrv <= -6.0 ? `Observed drop indicates reduced vagal tone (<= -6.0 ms threshold).` : `Delta within normal baseline boundaries.`,
        evidence_summary: `Sample: ${sample.hrvMs} ms vs Baseline: ${base.meanHrvMs} ms`,
        unit: 'ms',
        timestamps: [sample.timestamp],
        supporting_record_ids: ['sim_sample_live'],
        data_quality: 'Synthetic stream',
        data_provenance: 'simulated',
        suggested_activity: 'Test 5-4-3-2-1 Sensory Grounding',
        suggested_intervention_type: 'grounding_54321',
        limitations: 'Observational association does not establish clinical causation.',
        is_rule_based: true,
      },
      {
        signal_id: 'sim_sleep',
        signal_type: 'sleep_disruption',
        title: (deltaSleep <= -1.5 || sample.sleepHours < 5.0) ? 'Sleep Disruption & Circadian Debt (Simulated)' : 'Sleep Duration within Range (Simulated)',
        level: (deltaSleep <= -1.5 || sample.sleepHours < 5.0) ? 'Change Detected' : 'Within Personal Range',
        what_changed: (deltaSleep <= -1.5 || sample.sleepHours < 5.0)
          ? `Synthetic sleep duration (${sample.sleepHours} hrs) fell below simulated baseline (${base.meanSleepHours} hrs).`
          : `Synthetic sleep duration (${sample.sleepHours} hrs) matches simulated baseline target.`,
        why_flagged: (deltaSleep <= -1.5 || sample.sleepHours < 5.0) ? `Observed deficit (${deltaSleep.toFixed(1)} hrs) indicates circadian debt.` : `Sleep duration matches baseline.`,
        evidence_summary: `Sample: ${sample.sleepHours}h vs Baseline: ${base.meanSleepHours}h`,
        unit: 'hours',
        timestamps: [sample.timestamp],
        supporting_record_ids: ['sim_sample_live'],
        data_quality: 'Synthetic stream',
        data_provenance: 'simulated',
        suggested_activity: 'Review Circadian Sleep Hygiene guidance',
        suggested_intervention_type: 'sleep_hygiene',
        limitations: 'Observational association does not establish clinical causation.',
        is_rule_based: true,
      },
      {
        signal_id: 'sim_distress',
        signal_type: 'increased_distress',
        title: stress >= 7.0 ? 'Elevated Distress Surge (Simulated)' : 'Subjective Distress within Range (Simulated)',
        level: stress >= 7.0 ? 'Change Detected' : 'Within Personal Range',
        what_changed: stress >= 7.0
          ? `Synthetic distress rating (${stress}/10) indicates acute strain.`
          : `Synthetic distress rating (${stress}/10) is within baseline range.`,
        why_flagged: stress >= 7.0 ? `Score exceeds acute distress threshold (>= 7.0/10).` : `Rating is below acute threshold.`,
        evidence_summary: `Sample: ${stress}/10 vs Baseline: 2.5/10`,
        unit: 'rating (0-10)',
        timestamps: [sample.timestamp],
        supporting_record_ids: ['sim_sample_live'],
        data_quality: 'Synthetic stream',
        data_provenance: 'simulated',
        suggested_activity: 'Test 5-4-3-2-1 Sensory Grounding or Paced Breathing',
        suggested_intervention_type: 'breathing_478',
        limitations: 'Observational association does not establish clinical causation.',
        is_rule_based: true,
      },
    ];

    if ((deltaHr >= 5.0 || deltaHrv <= -6.0) && stress >= 7.0) {
      signals.unshift({
        signal_id: 'sim_composite',
        signal_type: 'composite_autonomic_strain',
        title: 'Composite Autonomic & Subjective Strain (Simulated)',
        level: 'Change Detected',
        what_changed: `Simultaneous physiological shift (HR: +${deltaHr.toFixed(1)} BPM) and elevated distress (${stress}/10).`,
        why_flagged: `Both physiological autonomic markers and subjective ratings exceeded thresholds concurrently.`,
        evidence_summary: `HR +${deltaHr.toFixed(1)} BPM, HRV ${deltaHrv.toFixed(1)} ms, Distress ${stress}/10`,
        unit: 'composite',
        timestamps: [sample.timestamp],
        supporting_record_ids: ['sim_sample_live'],
        data_quality: 'Synthetic stream',
        data_provenance: 'simulated',
        suggested_activity: 'Test 5-4-3-2-1 Sensory Grounding',
        suggested_intervention_type: 'grounding_54321',
        limitations: 'Observational association does not establish clinical causation.',
        is_rule_based: true,
      });
    } else if ((deltaHr >= 5.0 || deltaHrv <= -6.0) && stress <= 2.0) {
      signals.push({
        signal_id: 'sim_conflicting',
        signal_type: 'conflicting_observations',
        title: 'Divergent Physiological & Subjective Signals (Simulated)',
        level: 'Change Detected',
        what_changed: `Synthetic physiological arousal (HR: +${deltaHr.toFixed(1)} BPM) divergent with low subjective tension (${stress}/10).`,
        why_flagged: `Physiological markers changed while subjective self-report remained calm. Non-psychological factors (exercise, caffeine) likely.`,
        evidence_summary: `HR delta: +${deltaHr.toFixed(1)} BPM vs Distress: ${stress}/10`,
        unit: 'composite',
        timestamps: [sample.timestamp],
        supporting_record_ids: ['sim_sample_live'],
        data_quality: 'Synthetic stream',
        data_provenance: 'simulated',
        suggested_activity: 'Test contextual check-in',
        suggested_intervention_type: 'checkin_prompt',
        limitations: 'Observational association does not establish clinical causation.',
        is_rule_based: true,
      });
    }

    return signals;
  };

  const updateSyntheticStatus = async (sample: PhysiologicalSample, base: SyntheticBaseline) => {
    try {
      const res = await api.evaluateSyntheticScenario({
        sample: {
          heartRateBpm: sample.heartRateBpm,
          hrvMs: sample.hrvMs,
          sleepHours: sample.sleepHours,
          userReportedStress: sample.userReportedStress,
          timestamp: sample.timestamp,
        },
        baseline: {
          mean_resting_hr: base.meanRestingHr,
          mean_hrv_ms: base.meanHrvMs,
          mean_sleep_hours: base.meanSleepHours,
          mean_anxiety_score: 2.5,
        },
      });
      if (res && res.signals) {
        setSyntheticStatus(res);
      }
    } catch {
      // Fallback silently if offline or test mock
    }
  };

  useEffect(() => {
    if (currentSample) {
      updateSyntheticStatus(currentSample, baseline);
    }
  }, [currentSample?.scenarioId, currentSample?.heartRateBpm, currentSample?.hrvMs]);

  // What-If Scenario Compare State
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [customHr, setCustomHr] = useState<number>(75);
  const [customHrv, setCustomHrv] = useState<number>(45);
  const [customSleep, setCustomSleep] = useState<number>(7.5);
  const [customStress, setCustomStress] = useState<number>(3);

  // Next Step & Feedback Loop State
  const [selectedAction, setSelectedAction] = useState<'breathing' | 'grounding' | 'routine' | null>(null);
  const [preRating, setPreRating] = useState<number>(6);
  const [postRating, setPostRating] = useState<number>(4);
  const [helpfulness, setHelpfulness] = useState<CopingFeedback['helpfulness']>('helpful');
  const [feedbackHistory, setFeedbackHistory] = useState<CopingFeedback[]>([]);
  const [feedbackSavedNotice, setFeedbackSavedNotice] = useState(false);

  // Selected sample for timeline inspection
  const [inspectedSample, setInspectedSample] = useState<PhysiologicalSample | null>(null);

  // Mutable refs for timer lifecycle
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepCountRef = useRef<number>(0);
  const prngRef = useRef<SeededPRNG>(new SeededPRNG(42));

  // Initialize initial state on mount
  useEffect(() => {
    resetEngineState();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const resetEngineState = (seed: number = 42) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
    setIsPaused(false);
    stepCountRef.current = 0;
    prngRef.current = new SeededPRNG(seed);

    // Initial seed sample
    const initSample = generateScenarioSample('usual_baseline', 0, DEFAULT_SYNTHETIC_BASELINE, prngRef.current);
    const initState = calculateLiveTwinState(initSample, DEFAULT_SYNTHETIC_BASELINE, 1);
    const initExplanations = generateTwinExplanations(initSample, initState, null, null, DEFAULT_SYNTHETIC_BASELINE);

    setSampleBuffer([initSample]);
    setCurrentSample(initSample);
    setCurrentTwinState(initState);
    setPreviousTwinState(null);
    setExplanations(initExplanations);
    setInspectedSample(initSample);
    setDemoStep(1);
  };

  // Start Simulation
  const handleStart = () => {
    if (isRunning) return;
    setIsRunning(true);
    setIsPaused(false);
    if (demoStep === 1) setDemoStep(2);
  };

  // Pause Simulation
  const handlePause = () => {
    setIsRunning(false);
    setIsPaused(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Resume Simulation
  const handleResume = () => {
    setIsRunning(true);
    setIsPaused(false);
  };

  // Stop Simulation
  const handleStop = () => {
    setIsRunning(false);
    setIsPaused(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Timer Tick Effect
  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Interval derived from simulation speed: 1000ms / speed (e.g. 5x = 200ms tick)
    const intervalMs = Math.max(100, Math.round(1000 / simulationSpeed));

    timerRef.current = setInterval(() => {
      stepCountRef.current += 1;
      const step = stepCountRef.current;

      // 1. Generate sample
      const newSample = generateScenarioSample(selectedScenario, step, baseline, prngRef.current);

      // 2. Validate sample (pure schema validation)
      if (!newSample.isValid) {
        console.warn('Invalid synthetic sample rejected:', newSample.validationErrors);
        return;
      }

      // 3. Update sample buffer (ring buffer capped at 60 points)
      setSampleBuffer((prev) => {
        const next = [...prev, newSample];
        return next.length > 60 ? next.slice(next.length - 60) : next;
      });

      // 4. Update twin state
      setCurrentTwinState((prevTwinState) => {
        setPreviousTwinState(prevTwinState);
        const nextTwinState = calculateLiveTwinState(
          newSample,
          baseline,
          step + 1,
          prevTwinState || undefined
        );

        // 5. Generate differential explanations
        const diffExplanations = generateTwinExplanations(
          newSample,
          nextTwinState,
          currentSample,
          prevTwinState,
          baseline
        );
        setExplanations(diffExplanations);

        return nextTwinState;
      });

      setCurrentSample(newSample);
    }, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, selectedScenario, simulationSpeed, baseline, currentSample]);

  // Scenario Switcher
  const handleSwitchScenario = (scenario: SimulationScenarioId) => {
    setSelectedScenario(scenario);
    if (scenario === 'elevated_stress') setDemoStep(3);
    if (scenario === 'recovery') setDemoStep(5);
  };

  // What-If Custom Scenario State calculation
  const customSyntheticSample: PhysiologicalSample = {
    id: 'what_if_custom',
    timestamp: new Date().toISOString(),
    heartRateBpm: customHr,
    hrvMs: customHrv,
    sleepHours: customSleep,
    sleepQualityPercent: 80,
    stepsCount: 5000,
    userReportedStress: customStress,
    provenance: 'simulated',
    scenarioId: 'usual_baseline',
    isValid: true,
  };
  const whatIfCustomState = calculateLiveTwinState(customSyntheticSample, baseline, 1);

  // Submit Feedback Loop
  const handleRecordFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAction) return;

    const feedbackItem: CopingFeedback = {
      id: `feedback_${Date.now()}`,
      actionName:
        selectedAction === 'breathing'
          ? '4-7-8 Breathing Pacer'
          : selectedAction === 'grounding'
          ? '5-4-3-2-1 Sensory Grounding'
          : 'Sleep & Rhythm Restructuring',
      preDistressRating: preRating,
      postDistressRating: postRating,
      ratingDelta: Number((postRating - preRating).toFixed(1)),
      helpfulness,
      timestamp: new Date().toLocaleTimeString(),
      provenance: 'user_reported',
    };

    setFeedbackHistory((prev) => [feedbackItem, ...prev]);
    setFeedbackSavedNotice(true);
    setTimeout(() => setFeedbackSavedNotice(false), 4000);
    setDemoStep(7);

    // Asynchronously log to intervention engine with explicit simulated provenance (0% contamination)
    api.recordIntervention({
      intervention_type:
        selectedAction === 'breathing'
          ? 'breathing_478'
          : selectedAction === 'grounding'
          ? 'grounding_54321'
          : 'sleep_hygiene',
      trigger_signal: `simulation_${selectedScenario}`,
      status: 'completed',
      pre_distress_rating: preRating,
      post_distress_rating: postRating,
      helpfulness,
      source_type: 'simulated',
    }).catch(() => {});
  };

  // Formatting chart data
  const chartData = sampleBuffer.map((s, idx) => ({
    index: idx + 1,
    time: new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    heartRate: s.heartRateBpm,
    hrv: s.hrvMs,
    stress: s.userReportedStress,
    scenario: s.scenarioId,
  }));

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* 1. Prominent Simulation Provenance Banner & Judge Demo Header */}
      {/* ------------------------------------------------------------- */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-indigo-950/40 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 tracking-wide uppercase flex items-center space-x-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulated Data &bull; No Physical Sensor Connected</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-500/10 text-teal-300 border border-teal-500/30">
              Demo Profile: Alex (Student Cohort)
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            This live scenario engine generates deterministic synthetic physiological readings using a seeded mathematical model.
            It demonstrates how AnxietyTwin consumes streams, recalculates autonomic tone, and explains deviations without contaminating clinical databases.
          </p>
        </div>

        {/* 1-Click Reproducible Demo Reset */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => resetEngineState(42)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold shadow transition-all"
            title="Reset simulation to initial baseline state (Seed: 42)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Reset Demo (Seed 42)</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. Interactive Simulation Stream Controls Bar                  */}
      {/* ------------------------------------------------------------- */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-md">
        {/* Play/Pause/Stop Buttons */}
        <div className="flex items-center space-x-2">
          {!isRunning ? (
            <button
              type="button"
              onClick={handleStart}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-900/30 transition-all hover:scale-[1.02]"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isPaused ? 'Resume Stream' : 'Start Simulation'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePause}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow transition-all"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause Stream</span>
            </button>
          )}

          {(isRunning || isPaused) && (
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition-all"
            >
              <Square className="w-3.5 h-3.5 text-rose-400" />
              <span>Stop</span>
            </button>
          )}

          <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* Scenario Selector Pills */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => handleSwitchScenario('usual_baseline')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedScenario === 'usual_baseline'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Scenario A: Usual Baseline
            </button>
            <button
              type="button"
              onClick={() => handleSwitchScenario('elevated_stress')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedScenario === 'elevated_stress'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Scenario B: Elevated Stress
            </button>
            <button
              type="button"
              onClick={() => handleSwitchScenario('recovery')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedScenario === 'recovery'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Scenario C: Recovery
            </button>
          </div>
        </div>

        {/* Speed Adjustment */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-400 flex items-center space-x-1">
            <FastForward className="w-3.5 h-3.5 text-slate-400" />
            <span>Clock Speed:</span>
          </span>
          <div className="flex space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {[1, 5, 10, 30].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSimulationSpeed(spd)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                  simulationSpeed === spd
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. Section A: Digital Twin Live Status Card                    */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Status Card 1: Twin State */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
            Digital Twin Virtual State
          </span>
          <div className="flex items-center space-x-2 pt-1">
            {currentTwinState && <TwinStateBadge label={currentTwinState.stateLabel} size="md" />}
          </div>
          <p className="text-xs text-slate-400 pt-1">
            CSI: <strong className="text-white font-mono">{currentTwinState?.compositeStressIndex ?? 25.0}</strong> / 100
            &bull; &Delta;Base: <span className="font-mono">{currentTwinState?.baselineDeviationScore ?? 0}</span>
          </p>
        </div>

        {/* Status Card 2: Personal Baseline Status */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
            Personal Baseline Status
          </span>
          <div className="flex items-center space-x-2 pt-1">
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-semibold text-white">Descriptive Baseline Ready</span>
          </div>
          <p className="text-xs text-slate-400 pt-1">
            Calibrated on <strong className="text-slate-200">{baseline.observationCount} days</strong> (Reference: {baseline.meanRestingHr} BPM, {baseline.meanHrvMs} ms).
          </p>
        </div>

        {/* Status Card 3: Stream Freshness & Count */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
            Data Sufficiency &amp; Freshness
          </span>
          <p className="text-lg font-bold font-mono text-white pt-1">
            {sampleBuffer.length} <span className="text-xs font-normal text-slate-400">valid samples buffered</span>
          </p>
          <p className="text-xs text-slate-400">
            Latest: <span className="font-mono text-teal-300">{currentSample ? new Date(currentSample.timestamp).toLocaleTimeString() : 'N/A'}</span>
          </p>
        </div>

        {/* Status Card 4: ML Prediction Qualification */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
            ML 24h Prospective Forecast
          </span>
          <div className="flex items-center space-x-2 pt-1">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold text-purple-200">Experimental DBP Model</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            Horizon: ~24h Day Before Panic. Synthetic stream isolates live simulation from clinical inference.
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. Section B: Live Readings & Scrolling Time-Series Chart      */}
      {/* ------------------------------------------------------------- */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Activity className="w-5 h-5 text-teal-400" />
              <span>Live Physiological Readings (Synthetic Stream)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Continuously generated time-series tracking autonomic sympathetic/parasympathetic equilibrium.
            </p>
          </div>

          <div className="flex items-center space-x-3 text-xs font-mono">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-800 text-teal-300 border border-slate-700">
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              <span>HR: {currentSample?.heartRateBpm ?? 70} BPM</span>
            </span>
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-800 text-indigo-300 border border-slate-700">
              <Activity className="w-3.5 h-3.5 text-teal-400" />
              <span>HRV: {currentSample?.hrvMs ?? 48} ms</span>
            </span>
          </div>
        </div>

        {/* Real-time Recharts Chart */}
        <div className="h-64 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" domain={[40, 140]} stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" domain={[10, 80]} stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="heartRate"
                  name="Heart Rate (BPM)"
                  stroke="#f43f5e"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="hrv"
                  name="HRV rMSSD (ms)"
                  stroke="#2dd4bf"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs">
              Press "Start Simulation" to begin receiving physiological data points.
            </div>
          )}
        </div>

        {/* Sample Timeline Inspector */}
        <div className="border-t border-slate-800 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <Eye className="w-3.5 h-3.5 text-teal-400" />
              <span>Inspect Recent Samples (Click to review exact metadata &amp; bounds)</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">Showing last 8 samples</span>
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto pb-2">
            {sampleBuffer.slice(-8).reverse().map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => setInspectedSample(sample)}
                className={`p-2.5 rounded-xl border text-left shrink-0 transition-all ${
                  inspectedSample?.id === sample.id
                    ? 'bg-teal-500/15 border-teal-500/50 text-white'
                    : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-[10px] font-mono text-slate-400">
                  {new Date(sample.timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="text-xs font-bold text-rose-300">{sample.heartRateBpm} BPM</div>
                <div className="text-[11px] font-mono text-teal-300">{sample.hrvMs} ms HRV</div>
              </button>
            ))}
          </div>

          {/* Inspected Sample Metadata Drawer */}
          {inspectedSample && (
            <div className="mt-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1 font-mono">
              <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/60 pb-1.5">
                <span>Sample ID: {inspectedSample.id}</span>
                <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 text-[10px]">
                  Provenance: {inspectedSample.provenance}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <p>HR: <strong className="text-white">{inspectedSample.heartRateBpm} BPM</strong></p>
                <p>HRV (rMSSD): <strong className="text-white">{inspectedSample.hrvMs} ms</strong></p>
                <p>Sleep: <strong className="text-white">{inspectedSample.sleepHours} hrs</strong></p>
                <p>Distress Rating: <strong className="text-white">{inspectedSample.userReportedStress ?? 'N/A'}/10</strong></p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. Section C & D: Baseline Comparison & "What Changed?"        */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section C: Personal Baseline Comparison */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-teal-400" />
              <span>Personal Baseline Comparison Matrix</span>
            </h3>
            <span className="text-[10px] font-mono text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
              Descriptive Baseline Established
            </span>
          </div>

          <div className="space-y-3">
            {/* HR Comparison */}
            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs text-slate-400">Heart Rate</span>
                <p className="text-sm font-bold text-white">
                  {currentSample?.heartRateBpm ?? 70} BPM{' '}
                  <span className="text-xs font-normal text-slate-400">
                    (Base: {baseline.meanRestingHr} BPM)
                  </span>
                </p>
              </div>
              <div className="text-right">
                {currentSample && (
                  <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${
                    currentSample.heartRateBpm - baseline.meanRestingHr > 5
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-teal-500/20 text-teal-300'
                  }`}>
                    {currentSample.heartRateBpm - baseline.meanRestingHr > 0 ? '+' : ''}
                    {(currentSample.heartRateBpm - baseline.meanRestingHr).toFixed(1)} BPM
                  </span>
                )}
              </div>
            </div>

            {/* HRV Comparison */}
            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs text-slate-400">HRV (rMSSD)</span>
                <p className="text-sm font-bold text-white">
                  {currentSample?.hrvMs ?? 48} ms{' '}
                  <span className="text-xs font-normal text-slate-400">
                    (Base: {baseline.meanHrvMs} ms)
                  </span>
                </p>
              </div>
              <div className="text-right">
                {currentSample && (
                  <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${
                    baseline.meanHrvMs - currentSample.hrvMs > 6
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-teal-500/20 text-teal-300'
                  }`}>
                    {(currentSample.hrvMs - baseline.meanHrvMs).toFixed(1)} ms
                  </span>
                )}
              </div>
            </div>

            {/* Sleep Comparison */}
            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs text-slate-400">Sleep Duration</span>
                <p className="text-sm font-bold text-white">
                  {currentSample?.sleepHours ?? 7.5} hrs{' '}
                  <span className="text-xs font-normal text-slate-400">
                    (Base: {baseline.meanSleepHours} hrs)
                  </span>
                </p>
              </div>
              <div className="text-right">
                {currentSample && (
                  <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-slate-800 text-slate-300">
                    {(currentSample.sleepHours - baseline.meanSleepHours).toFixed(1)} hrs
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section D: "What Changed in Your Twin?" Differential Explanations */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span>What Changed in Your Twin?</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              Live Differential Explanation
            </span>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {explanations.map((exp, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center space-x-1.5">
                    {exp.direction === 'increase' ? (
                      <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
                    ) : exp.direction === 'decrease' ? (
                      <TrendingDown className="w-3.5 h-3.5 text-teal-400" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>{exp.factor}</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    {exp.source}
                  </span>
                </div>
                <p className="text-slate-300 font-medium">{exp.observedChange}</p>
                <p className="text-slate-400 text-[11px]">{exp.comparisonBaseline}</p>
                <p className="text-[10px] text-slate-500 italic pt-0.5">{exp.limitationNote}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5B. Early-Warning Engine & Rule-Based Indicators Response     */}
      {/* (Digital Twin Integration)                                     */}
      {/* ------------------------------------------------------------- */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-teal-400" />
              <h3 className="text-base font-bold text-white">
                Early-Warning Signal Engine (Digital Twin Integration)
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Demonstrates how the early-warning engine evaluates synthetic scenario observations against baseline in real time.
              <strong className="text-slate-300"> 0% Patient Data Contamination:</strong> Synthetic streams are strictly isolated and never modify genuine patient records or production ML predictions.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
              SIMULATED PROTOCOL
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-teal-500/10 text-teal-300 border border-teal-500/30">
              RULE-BASED HEURISTICS
            </span>
          </div>
        </div>

        {/* Signals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(syntheticStatus?.signals || computeLocalSyntheticSignals(currentSample, baseline)).map((sig) => {
            const isChange = sig.level === 'Change Detected';
            return (
              <div
                key={sig.signal_id}
                className={`p-4 rounded-xl border transition ${
                  isChange
                    ? 'bg-amber-950/20 border-amber-500/30'
                    : 'bg-slate-800/40 border-slate-700/60'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-xs font-bold text-white leading-tight">{sig.title}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                    isChange
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-teal-500/10 text-teal-300'
                  }`}>
                    {sig.level}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <p className="text-slate-300 text-[11px] leading-snug">
                    <strong className="text-slate-200">What Changed:</strong> {sig.what_changed}
                  </p>
                  <p className="text-slate-400 text-[11px] leading-snug">
                    <strong className="text-slate-300">Why Flagged:</strong> {sig.why_flagged}
                  </p>
                  <p className="text-teal-300/90 text-[11px] pt-1 border-t border-slate-800/60 leading-snug">
                    <strong>Suggested Action:</strong> {sig.suggested_activity}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Non-Diagnostic Disclaimer */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-start space-x-2">
          <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
          <span>
            <strong>Scientific Disclosure:</strong> These indicators illustrate transparent, deterministic rule-based comparisons against personal baseline. They do not predict panic attacks or diagnose medical conditions from physiological changes alone.
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 6. Section E: "What-If" Scenario Side-by-Side Comparison      */}
      {/* ------------------------------------------------------------- */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <GitCompare className="w-5 h-5 text-indigo-400" />
              <span>What-If Scenario Comparison (Hypothetical Exploration)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Evaluate how synthetic changes to sleep, caffeine, and stress exposure shift virtual twin states without contaminating your real records.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowWhatIf(!showWhatIf)}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all self-start sm:self-auto"
          >
            {showWhatIf ? 'Hide Comparison Controls' : 'Configure Custom Scenario'}
          </button>
        </div>

        {/* Custom Input Sliders when toggled */}
        {showWhatIf && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-[11px] text-slate-300 font-medium flex justify-between">
                <span>Hypothetical HR:</span>
                <span className="font-mono text-rose-300">{customHr} BPM</span>
              </label>
              <input
                type="range"
                min="50"
                max="120"
                value={customHr}
                onChange={(e) => setCustomHr(Number(e.target.value))}
                className="w-full accent-rose-500 mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-medium flex justify-between">
                <span>Hypothetical HRV:</span>
                <span className="font-mono text-teal-300">{customHrv} ms</span>
              </label>
              <input
                type="range"
                min="15"
                max="80"
                value={customHrv}
                onChange={(e) => setCustomHrv(Number(e.target.value))}
                className="w-full accent-teal-500 mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-medium flex justify-between">
                <span>Hypothetical Sleep:</span>
                <span className="font-mono text-indigo-300">{customSleep} hrs</span>
              </label>
              <input
                type="range"
                min="3"
                max="10"
                step="0.5"
                value={customSleep}
                onChange={(e) => setCustomSleep(Number(e.target.value))}
                className="w-full accent-indigo-500 mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-medium flex justify-between">
                <span>Distress Rating:</span>
                <span className="font-mono text-amber-300">{customStress}/10</span>
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={customStress}
                onChange={(e) => setCustomStress(Number(e.target.value))}
                className="w-full accent-amber-500 mt-1"
              />
            </div>
          </div>
        )}

        {/* Side-by-Side Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card A: Current Live Twin State */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
              <span className="text-xs font-bold text-white">Scenario A: Live Stream State</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-300">
                {currentSample?.scenarioId === 'elevated_stress' ? 'Elevated Stress' : 'Baseline Stream'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Composite Stress Index</span>
              <span className="text-lg font-bold font-mono text-white">
                {currentTwinState?.compositeStressIndex ?? 25.0}
              </span>
            </div>
            <div className="text-xs text-slate-400 space-y-1">
              <p>• HR: <strong className="text-slate-200">{currentSample?.heartRateBpm ?? 70} BPM</strong></p>
              <p>• HRV: <strong className="text-slate-200">{currentSample?.hrvMs ?? 48} ms</strong></p>
              <p>• Sleep: <strong className="text-slate-200">{currentSample?.sleepHours ?? 7.5} hrs</strong></p>
            </div>
          </div>

          {/* Card B: Custom Hypothetical State */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-indigo-500/40 space-y-3">
            <div className="flex items-center justify-between border-b border-indigo-500/30 pb-2">
              <span className="text-xs font-bold text-white">Scenario B: Custom Hypothetical</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                Hypothetical Counterfactual
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Composite Stress Index</span>
              <span className="text-lg font-bold font-mono text-purple-300">
                {whatIfCustomState.compositeStressIndex}
              </span>
            </div>
            <div className="text-xs text-slate-400 space-y-1">
              <p>• HR: <strong className="text-slate-200">{customHr} BPM</strong></p>
              <p>• HRV: <strong className="text-slate-200">{customHrv} ms</strong></p>
              <p>• Sleep: <strong className="text-slate-200">{customSleep} hrs</strong></p>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 italic">
          Disclaimer: Scenario comparisons estimate statistical differences based on research cohort distributions. They do not claim clinical causation or guarantee anxiety prevention.
        </p>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 7. Section F: "Explore Your Next Step" & Feedback Loop        */}
      {/* ------------------------------------------------------------- */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-slate-800 space-y-5">
        <div className="border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-teal-400" />
            <span>Explore Your Next Step (Voluntary Coping Actions)</span>
          </h3>
          <p className="text-xs text-slate-400">
            Select a grounding or pacing exercise based on current autonomic state. You may record voluntary pre- and post-distress ratings to evaluate what you find helpful.
          </p>
        </div>

        {/* Action Selection Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setSelectedAction('breathing')}
            className={`p-4 rounded-xl border text-left transition-all ${
              selectedAction === 'breathing'
                ? 'bg-teal-500/20 border-teal-500 text-white shadow-md'
                : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2 text-teal-400 font-semibold text-xs mb-1">
              <Wind className="w-4 h-4" />
              <span>4-7-8 Breathing Pacer</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Parasympathetic regulation exercise with guided second-by-second countdown.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedAction('grounding')}
            className={`p-4 rounded-xl border text-left transition-all ${
              selectedAction === 'grounding'
                ? 'bg-indigo-500/20 border-indigo-500 text-white shadow-md'
                : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-xs mb-1">
              <Activity className="w-4 h-4" />
              <span>5-4-3-2-1 Sensory Grounding</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Cognitive grounding technique engaging visual, tactile, and auditory awareness.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedAction('routine')}
            className={`p-4 rounded-xl border text-left transition-all ${
              selectedAction === 'routine'
                ? 'bg-purple-500/20 border-purple-500 text-white shadow-md'
                : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2 text-purple-400 font-semibold text-xs mb-1">
              <Moon className="w-4 h-4" />
              <span>Circadian Rhythm Hygiene</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Review caffeine cutoff timing and restorative nocturnal sleep regularity.
            </p>
          </button>
        </div>

        {/* Selected Action Interactive Content */}
        {selectedAction === 'breathing' && (
          <div className="pt-2">
            <BreathingPacer />
          </div>
        )}

        {selectedAction === 'grounding' && (
          <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-2 text-xs text-slate-300">
            <h4 className="font-bold text-white text-sm">5-4-3-2-1 Sensory Grounding Guide</h4>
            <p>1. Notice <strong>5 things</strong> you can see around you right now.</p>
            <p>2. Notice <strong>4 things</strong> you can physically feel (e.g. feet on floor, fabric).</p>
            <p>3. Notice <strong>3 things</strong> you can hear in your environment.</p>
            <p>4. Notice <strong>2 things</strong> you can smell.</p>
            <p>5. Notice <strong>1 positive thing</strong> about yourself or current moment.</p>
          </div>
        )}

        {selectedAction === 'routine' && (
          <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-2 text-xs text-slate-300">
            <h4 className="font-bold text-white text-sm">Circadian Rhythm &amp; Stimulant Alignment</h4>
            <p>&bull; Maintain a consistent bedtime within a 45-minute window nightly.</p>
            <p>&bull; Limit caffeine intake after 2:00 PM to protect deep slow-wave sleep architecture.</p>
            <p>&bull; Ensure 15 minutes of natural morning sunlight to entrain suprachiasmatic clock rhythms.</p>
          </div>
        )}

        {/* Pre / Post Self-Reported Feedback Form */}
        {selectedAction && (
          <form onSubmit={handleRecordFeedback} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-white flex items-center space-x-2">
              <Smile className="w-4 h-4 text-teal-400" />
              <span>Record Voluntary Exercise Feedback (Before &amp; After)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="pre-distress" className="text-[11px] text-slate-400 block mb-1">Pre-Exercise Distress (0-10):</label>
                <input
                  id="pre-distress"
                  type="number"
                  min="0"
                  max="10"
                  value={preRating}
                  onChange={(e) => setPreRating(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                />
              </div>

              <div>
                <label htmlFor="post-distress" className="text-[11px] text-slate-400 block mb-1">Post-Exercise Distress (0-10):</label>
                <input
                  id="post-distress"
                  type="number"
                  min="0"
                  max="10"
                  value={postRating}
                  onChange={(e) => setPostRating(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                />
              </div>

              <div>
                <label htmlFor="helpfulness-select" className="text-[11px] text-slate-400 block mb-1">Was this helpful?</label>
                <select
                  id="helpfulness-select"
                  value={helpfulness}
                  onChange={(e) => setHelpfulness(e.target.value as CopingFeedback['helpfulness'])}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                >
                  <option value="helpful">Helpful</option>
                  <option value="somewhat_helpful">Somewhat helpful</option>
                  <option value="not_helpful">Not helpful</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-500">
                Data saved isolated as user-reported feedback; never mixed with simulated sensor streams.
              </span>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow transition-all"
              >
                Save Feedback
              </button>
            </div>

            {feedbackSavedNotice && (
              <div className="p-2 rounded bg-teal-500/20 text-teal-300 text-xs text-center border border-teal-500/30">
                Exercise feedback logged successfully!
              </div>
            )}
          </form>
        )}

        {/* Feedback History Log */}
        {feedbackHistory.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-300 block">Logged Coping History:</span>
            <div className="space-y-1.5">
              {feedbackHistory.map((fb) => (
                <div
                  key={fb.id}
                  className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50 flex items-center justify-between text-xs"
                >
                  <div>
                    <strong className="text-white">{fb.actionName}</strong> &bull;{' '}
                    <span className="text-slate-400">Pre: {fb.preDistressRating}/10 &rarr; Post: {fb.postDistressRating}/10</span>{' '}
                    <span className="font-mono text-teal-300">(&Delta;: {fb.ratingDelta > 0 ? '+' : ''}{fb.ratingDelta})</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300">
                      {fb.helpfulness.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{fb.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
