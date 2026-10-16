import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sliders,
  Brain,
  Activity,
  Heart,
  Moon,
  Coffee,
  Sparkles,
  GitCompare,
  Save,
  AlertTriangle,
  Info,
  RefreshCw,
  CheckCircle2,
  RotateCcw,
  Undo2,
  FileText,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap,
  TrendingDown,
  TrendingUp,
  ArrowUpRight,
  Download,
  Play,
  Layers,
  History,
  Lock,
  Calendar,
  Award,
  HelpCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { api } from '../services/api';
import {
  SimulationInput,
  ScenarioReplayResponse,
  PersonalizedInitializationResponse,
  ExplainableScenarioComparisonResponse,
  CounterfactualPerturbationResponse,
  LongitudinalBaselineEvolutionOut,
  DigitalTwinMemoryOut
} from '../types';
import { TwinStateBadge } from '../components/TwinStateBadge';

const DEFAULT_INPUTS: SimulationInput = {
  sleep_hours: 7.5,
  caffeine_cups: 1.0,
  physical_activity_mins: 30.0,
  heart_rate_bpm: 72.0,
  hrv_ms: 45.0,
  self_reported_anxiety: 3,
  recent_stress_exposure: 2,
};

type ActiveLabTab = 'builder' | 'compare' | 'explain' | 'evolution' | 'replay';
type PresetType = 'baseline' | 'alternative' | 'recovery' | 'custom';

export const SimulationLabPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveLabTab>('builder');
  const [loading, setLoading] = useState(true);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // Profiles & Initialization
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('DEMO-PATIENT-01');
  const [initData, setInitData] = useState<PersonalizedInitializationResponse | null>(null);

  // Scenario presets & inputs
  const [preset, setPreset] = useState<PresetType>('baseline');
  const [inputs, setInputs] = useState<SimulationInput>({ ...DEFAULT_INPUTS });
  const [inputsB, setInputsB] = useState<SimulationInput>({
    sleep_hours: 4.5,
    caffeine_cups: 3.5,
    physical_activity_mins: 15.0,
    heart_rate_bpm: 88.0,
    hrv_ms: 28.0,
    self_reported_anxiety: 7,
    recent_stress_exposure: 4,
  });

  // Validation
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Single Simulation State
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Comparison State
  const [compareResult, setCompareResult] = useState<ExplainableScenarioComparisonResponse | null>(null);
  const [comparing, setComparing] = useState(false);
  const [selectedChartStep, setSelectedChartStep] = useState<number | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Counterfactual State
  const [cfParam, setCfParam] = useState<string>('sleep_hours');
  const [cfValue, setCfValue] = useState<number>(4.5);
  const [cfResult, setCfResult] = useState<CounterfactualPerturbationResponse | null>(null);
  const [cfLoading, setCfLoading] = useState(false);

  // Longitudinal Evolution & Memory State
  const [evolutionData, setEvolutionData] = useState<LongitudinalBaselineEvolutionOut | null>(null);
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [memories, setMemories] = useState<DigitalTwinMemoryOut[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);

  // Scenario Replay State
  const [replaySeed, setReplaySeed] = useState<number>(42);
  const [replayStepsCount, setReplayStepsCount] = useState<number>(24);
  const [replayResult, setReplayResult] = useState<ScenarioReplayResponse | null>(null);
  const [replaying, setReplaying] = useState(false);

  // 1. Load initial profiles and adaptive baseline
  useEffect(() => {
    const initLab = async () => {
      try {
        setLoading(true);
        const [profRes, initRes] = await Promise.all([
          api.getSimulationProfiles(),
          api.getAdaptiveBaselineInitialization().catch(() => null),
        ]);
        setProfiles(profRes.profiles);

        if (initRes) {
          setInitData(initRes);
          if (initRes.is_personalized) {
            setSelectedProfileId(initRes.profile_id);
            setInputs({
              sleep_hours: initRes.baseline_summary.mean_sleep_hours || 7.5,
              caffeine_cups: initRes.baseline_summary.mean_caffeine_cups || 1.0,
              physical_activity_mins: 35.0,
              heart_rate_bpm: initRes.baseline_summary.mean_resting_hr || 70.0,
              hrv_ms: initRes.baseline_summary.mean_hrv_ms || 48.0,
              self_reported_anxiety: initRes.baseline_summary.mean_anxiety_score ? Math.round(initRes.baseline_summary.mean_anxiety_score) : 2,
              recent_stress_exposure: 1,
            });
          }
        }
      } catch (err) {
        console.error('Failed to initialize lab', err);
      } finally {
        setLoading(false);
      }
    };
    initLab();
  }, []);

  // 2. Validate inputs
  const validateInputs = (vals: SimulationInput): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (vals.sleep_hours < 1 || vals.sleep_hours > 16) errs.sleep_hours = 'Sleep must be between 1 and 16 hours.';
    if (vals.caffeine_cups < 0 || vals.caffeine_cups > 15) errs.caffeine_cups = 'Caffeine cups must be 0 to 15.';
    if (vals.heart_rate_bpm < 40 || vals.heart_rate_bpm > 180) errs.heart_rate_bpm = 'Heart rate must be 40 to 180 BPM.';
    if (vals.hrv_ms < 5 || vals.hrv_ms > 150) errs.hrv_ms = 'HRV must be 5 to 150 ms.';
    if (vals.self_reported_anxiety < 0 || vals.self_reported_anxiety > 10) errs.self_reported_anxiety = 'Anxiety score must be 0 to 10.';
    if (vals.physical_activity_mins < 0 || vals.physical_activity_mins > 300) errs.physical_activity_mins = 'Activity must be 0 to 300 mins.';
    return errs;
  };

  // 3. Reactive Simulation execution
  const executeSimulation = async () => {
    const errs = validateInputs(inputs);
    setValidationErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      setSimulating(true);
      const res = await api.runSimulation(inputs, selectedProfileId);
      setSimResult(res);
    } catch (err: any) {
      console.warn('Simulation execution note:', err);
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      executeSimulation();
    }
  }, [inputs, selectedProfileId]);

  // Apply Presets
  const applyPreset = (newPreset: PresetType) => {
    setPreset(newPreset);
    const activeBase = initData?.is_personalized && selectedProfileId.startsWith('USER-')
      ? {
          hr: initData.baseline_summary.mean_resting_hr || 70.0,
          hrv: initData.baseline_summary.mean_hrv_ms || 48.0,
          sleep: initData.baseline_summary.mean_sleep_hours || 7.5,
          caffeine: initData.baseline_summary.mean_caffeine_cups || 1.0,
          anxiety: initData.baseline_summary.mean_anxiety_score ? Math.round(initData.baseline_summary.mean_anxiety_score) : 2,
        }
      : { hr: 70.0, hrv: 48.0, sleep: 7.5, caffeine: 1.0, anxiety: 2 };

    if (newPreset === 'baseline') {
      setInputs({
        sleep_hours: activeBase.sleep,
        caffeine_cups: activeBase.caffeine,
        physical_activity_mins: 35.0,
        heart_rate_bpm: activeBase.hr,
        hrv_ms: activeBase.hrv,
        self_reported_anxiety: activeBase.anxiety,
        recent_stress_exposure: 1,
      });
    } else if (newPreset === 'alternative') {
      setInputs({
        sleep_hours: Math.max(4.0, activeBase.sleep - 2.8),
        caffeine_cups: activeBase.caffeine + 3.0,
        physical_activity_mins: 15.0,
        heart_rate_bpm: activeBase.hr + 16.0,
        hrv_ms: Math.max(15.0, activeBase.hrv - 16.0),
        self_reported_anxiety: Math.min(10, activeBase.anxiety + 5),
        recent_stress_exposure: 4,
      });
    } else if (newPreset === 'recovery') {
      setInputs({
        sleep_hours: Math.min(10.0, activeBase.sleep + 1.2),
        caffeine_cups: 0.0,
        physical_activity_mins: 45.0,
        heart_rate_bpm: Math.max(55.0, activeBase.hr - 4.0),
        hrv_ms: Math.min(85.0, activeBase.hrv + 8.0),
        self_reported_anxiety: Math.max(0, activeBase.anxiety - 1),
        recent_stress_exposure: 0,
      });
    }
  };

  // Compare Scenarios
  const runComparison = async () => {
    try {
      setComparing(true);
      const res = await api.compareScenariosAdaptive(inputs, inputsB, selectedProfileId);
      setCompareResult(res);
    } catch (err: any) {
      alert('Error comparing scenarios: ' + err.message);
    } finally {
      setComparing(false);
    }
  };

  // Run Counterfactual Perturbation
  const executeCounterfactual = async (param: string, val: number) => {
    try {
      setCfLoading(true);
      const res = await api.runCounterfactualPerturbation({
        parameter_to_vary: param,
        perturbed_value: val,
        base_scenario: inputs,
        baseline_profile_id: selectedProfileId,
        seed: 42,
      });
      setCfResult(res);
    } catch (err: any) {
      console.warn('Counterfactual error', err);
    } finally {
      setCfLoading(false);
    }
  };

  // Load Evolution and Memory
  const loadEvolution = async () => {
    try {
      setEvolutionLoading(true);
      const [evo, mem] = await Promise.all([
        api.getBaselineEvolution(7, 4),
        api.getDigitalTwinMemories(),
      ]);
      setEvolutionData(evo);
      setMemories(mem);
    } catch (err: any) {
      console.error('Failed to load evolution', err);
    } finally {
      setEvolutionLoading(false);
    }
  };

  const handleResetMemory = async () => {
    if (!window.confirm('Reset derived Digital Twin memory? This clears calculated personalization snapshots. Your genuine medical observations will NEVER be deleted.')) {
      return;
    }
    try {
      const res = await api.resetDigitalTwinMemory();
      setSavedMessage(res.message);
      setTimeout(() => setSavedMessage(null), 4500);
      loadEvolution();
    } catch (err: any) {
      alert('Reset failed: ' + err.message);
    }
  };

  const handleSnapshotMemory = async () => {
    try {
      await api.snapshotDigitalTwinMemory();
      setSavedMessage('Baseline version snapshot saved to Digital Twin Memory!');
      setTimeout(() => setSavedMessage(null), 4000);
      loadEvolution();
    } catch (err: any) {
      alert('Snapshot failed: ' + err.message);
    }
  };

  // Run Replay
  const handleRunReplay = async () => {
    try {
      setReplaying(true);
      const res = await api.replayScenario({
        scenario_input: inputs,
        baseline_profile_id: selectedProfileId,
        seed: Number(replaySeed),
        steps_count: Number(replayStepsCount),
      });
      setReplayResult(res);
      setSavedMessage(`Deterministic replay complete (Seed ${res.seed}). Hash: ${res.reproducibility_hash.substring(0, 8)}`);
      setTimeout(() => setSavedMessage(null), 4000);
    } catch (err: any) {
      alert('Replay failed: ' + err.message);
    } finally {
      setReplaying(false);
    }
  };

  // Export PDF
  const handleExportComparisonPdf = async () => {
    try {
      setExportingPdf(true);
      const blob = await api.exportScenarioComparisonPdf({
        scenario_a: inputs,
        scenario_b: inputsB,
        scenario_a_name: 'Scenario A (Baseline)',
        scenario_b_name: 'Scenario B (Alternative)',
        baseline_profile_id: selectedProfileId,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AnxietyTwin_Comparison_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSavedMessage('Comparison PDF downloaded successfully.');
      setTimeout(() => setSavedMessage(null), 4000);
    } catch (err: any) {
      alert('Failed to export PDF: ' + err.message);
    } finally {
      setExportingPdf(false);
    }
  };

  // Save Scenario
  const handleSaveScenario = async () => {
    const name = prompt('Enter a title for this simulation scenario:', 'Adaptive Restorative Counterfactual');
    if (!name) return;
    try {
      await api.saveScenario(name, 'Saved from Adaptive Digital Twin Lab', inputs, selectedProfileId);
      setSavedMessage(`Scenario "${name}" saved to your personal library!`);
      setTimeout(() => setSavedMessage(null), 4000);
    } catch (err: any) {
      alert('Failed to save scenario: ' + err.message);
    }
  };

  // Build synthetic 24-step trajectory for chart comparison
  const comparisonTrajectory = React.useMemo(() => {
    const steps = [];
    const baseA = inputs.heart_rate_bpm;
    const baseB = inputsB.heart_rate_bpm;
    const csiA = simResult?.twin_state?.composite_stress_index || 28.0;
    const csiB = compareResult?.scenario_b_result?.composite_stress_index || 62.0;

    for (let h = 0; h < 24; h++) {
      const rad = (2 * Math.PI * h) / 24.0;
      const diurnalA = Math.sin(rad - 1.5) * 5.0;
      const diurnalB = Math.sin(rad - 1.5) * 6.5;
      const caffSurgeA = (8 <= h && h <= 13) ? inputs.caffeine_cups * 2.2 : 0;
      const caffSurgeB = (8 <= h && h <= 13) ? inputsB.caffeine_cups * 2.2 : 0;

      const hrA = Math.round(baseA + diurnalA + caffSurgeA);
      const hrB = Math.round(baseB + diurnalB + caffSurgeB);
      const stressA = Math.min(100, Math.max(0, Math.round(csiA + diurnalA * 0.8)));
      const stressB = Math.min(100, Math.max(0, Math.round(csiB + diurnalB * 0.8)));

      steps.push({
        hour: `${h}:00`,
        stepIndex: h,
        scenarioA_CSI: stressA,
        scenarioB_CSI: stressB,
        scenarioA_HR: hrA,
        scenarioB_HR: hrB,
        delta_CSI: stressB - stressA,
        delta_HR: hrB - hrA,
      });
    }
    return steps;
  }, [inputs, inputsB, simResult, compareResult]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Prominent Simulation Quarantine Banner */}
      <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/40 text-purple-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-purple-300" />
          </div>
          <div>
            <div className="font-bold text-white uppercase tracking-wider text-[11px]">
              SIMULATED SCENARIO — NOT A REAL-WORLD FORECAST
            </div>
            <p className="text-purple-300/80 mt-0.5">
              Hypothetical what-if exploration engine. Synthetic simulations are strictly quarantined from genuine health records and do not alter ML production models.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase bg-purple-900/60 px-3 py-1.5 rounded-lg border border-purple-500/40 text-purple-200 shrink-0 font-semibold">
          Engine v2.0-Adaptive
        </span>
      </div>

      {savedMessage && (
        <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs flex items-center space-x-2.5 shadow-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-teal-400" />
          <span className="font-medium">{savedMessage}</span>
        </div>
      )}

      {/* Header & Tabs */}
      <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Adaptive Digital Twin Lab
            </h1>
            {initData?.is_personalized ? (
              <span className="px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30 text-[11px] font-semibold flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                <span>Personalized Baseline</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[11px] font-semibold flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Generic Demo Mode</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
            Interactively explore physiological what-if counterfactuals, compare simulated trajectories, and inspect longitudinal baseline evolution.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
          <button
            onClick={() => setActiveTab('builder')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'builder'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>What-If Builder</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('compare');
              runComparison();
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'compare'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Comparison</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('explain');
              runComparison();
              executeCounterfactual(cfParam, cfValue);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'explain'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Explain &amp; Counterfactuals</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('evolution');
              loadEvolution();
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'evolution'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Evolution &amp; Memory</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('replay');
              if (!replayResult) handleRunReplay();
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'replay'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Replay</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: WHAT-IF SCENARIO BUILDER & PERSONALIZED INITIALIZATION  */}
      {/* ============================================================== */}
      {activeTab === 'builder' && (
        <div className="space-y-8">
          {/* Personalized Digital Twin Initialization Status Panel */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-teal-400" />
                  <span>Digital Twin Baseline Initialization</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {initData?.disclaimer}
                </p>
              </div>

              {/* Profile selector */}
              <div className="flex items-center space-x-2 self-start sm:self-auto">
                <span className="text-xs text-slate-400 font-medium">Archetype:</span>
                <select
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {initData?.is_personalized && (
                    <option value={initData.profile_id}>
                      {initData.profile_name} (Empirical)
                    </option>
                  )}
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 6 Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {initData?.metrics.map((m) => (
                <div
                  key={m.metric_key}
                  className="bg-slate-950/70 rounded-xl p-3.5 border border-slate-800/80 space-y-2 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">{m.display_name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase ${
                        m.sufficient_data
                          ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30'
                          : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {m.provenance}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <span className="text-lg font-bold text-white">
                        {m.current_value !== null ? m.current_value : '—'}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-1">{m.unit}</span>
                    </div>
                    <div className="text-right text-[11px] text-slate-400">
                      <span>Baseline: </span>
                      <strong className="text-slate-200">
                        {m.baseline_value !== null ? m.baseline_value : '—'}
                      </strong>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 border-t border-slate-850 pt-2 flex items-center justify-between">
                    <span>{m.status_note}</span>
                    <span>{m.observation_count} obs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive What-If Builder Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Input Controls (Left Column) */}
            <div className="lg:col-span-7 bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    <span>Hypothetical Scenario Inputs</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Adjust variables to observe real-time mathematical reactions in your virtual twin.
                  </p>
                </div>

                {/* Presets */}
                <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                  <button
                    onClick={() => applyPreset('baseline')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      preset === 'baseline' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Baseline
                  </button>
                  <button
                    onClick={() => applyPreset('alternative')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      preset === 'alternative' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Stress Surge
                  </button>
                  <button
                    onClick={() => applyPreset('recovery')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      preset === 'recovery' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Restorative
                  </button>
                </div>
              </div>

              {/* Slider Grid */}
              <div className="space-y-4">
                {/* Sleep Duration */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium flex items-center space-x-1.5">
                      <Moon className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Sleep Duration (Hours)</span>
                    </span>
                    <span className="font-mono text-white font-bold">{inputs.sleep_hours}h</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="14"
                    step="0.5"
                    value={inputs.sleep_hours}
                    onChange={(e) => {
                      setPreset('custom');
                      setInputs({ ...inputs, sleep_hours: parseFloat(e.target.value) });
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  {validationErrors.sleep_hours && (
                    <p className="text-[11px] text-rose-400">{validationErrors.sleep_hours}</p>
                  )}
                </div>

                {/* Caffeine Cups */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium flex items-center space-x-1.5">
                      <Coffee className="w-3.5 h-3.5 text-amber-400" />
                      <span>Caffeine Intake (Cups)</span>
                    </span>
                    <span className="font-mono text-white font-bold">{inputs.caffeine_cups} cups</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="8"
                    step="0.5"
                    value={inputs.caffeine_cups}
                    onChange={(e) => {
                      setPreset('custom');
                      setInputs({ ...inputs, caffeine_cups: parseFloat(e.target.value) });
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                {/* Resting Heart Rate */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium flex items-center space-x-1.5">
                      <Heart className="w-3.5 h-3.5 text-rose-400" />
                      <span>Simulated Resting Heart Rate (BPM)</span>
                    </span>
                    <span className="font-mono text-white font-bold">{inputs.heart_rate_bpm} BPM</span>
                  </div>
                  <input
                    type="range"
                    min="45"
                    max="140"
                    step="1"
                    value={inputs.heart_rate_bpm}
                    onChange={(e) => {
                      setPreset('custom');
                      setInputs({ ...inputs, heart_rate_bpm: parseFloat(e.target.value) });
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                </div>

                {/* HRV */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium flex items-center space-x-1.5">
                      <Activity className="w-3.5 h-3.5 text-teal-400" />
                      <span>HRV rMSSD (ms)</span>
                    </span>
                    <span className="font-mono text-white font-bold">{inputs.hrv_ms} ms</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="1"
                    value={inputs.hrv_ms}
                    onChange={(e) => {
                      setPreset('custom');
                      setInputs({ ...inputs, hrv_ms: parseFloat(e.target.value) });
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                  />
                </div>

                {/* Self-reported anxiety */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium flex items-center space-x-1.5">
                      <Brain className="w-3.5 h-3.5 text-purple-400" />
                      <span>Self-Reported Distress Rating (0 - 10)</span>
                    </span>
                    <span className="font-mono text-white font-bold">{inputs.self_reported_anxiety}/10</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={inputs.self_reported_anxiety}
                    onChange={(e) => {
                      setPreset('custom');
                      setInputs({ ...inputs, self_reported_anxiety: parseInt(e.target.value) });
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* Physical activity & stress exposure */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-medium">Activity (mins)</span>
                      <span className="font-mono text-slate-300">{inputs.physical_activity_mins}m</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="180"
                      step="5"
                      value={inputs.physical_activity_mins}
                      onChange={(e) => {
                        setPreset('custom');
                        setInputs({ ...inputs, physical_activity_mins: parseFloat(e.target.value) });
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-400"
                    />
                    <span className="text-[10px] text-slate-500 block">Unmodeled in core CSI</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-medium">Stress Exposure (0-5)</span>
                      <span className="font-mono text-slate-300">{inputs.recent_stress_exposure}/5</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="1"
                      value={inputs.recent_stress_exposure}
                      onChange={(e) => {
                        setPreset('custom');
                        setInputs({ ...inputs, recent_stress_exposure: parseInt(e.target.value) });
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-400"
                    />
                    <span className="text-[10px] text-slate-500 block">ML annoyance proxy</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={() => applyPreset('baseline')}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-semibold transition-all flex items-center space-x-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Baseline</span>
                </button>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSaveScenario}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white font-semibold transition-all flex items-center space-x-1.5 shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Scenario</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('compare');
                      runComparison();
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-semibold transition-all flex items-center space-x-1.5 shadow-md shadow-indigo-900/30"
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                    <span>Compare with B</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Simulation Feedback Cards (Right Column) */}
            <div className="lg:col-span-5 space-y-5">
              {/* Twin State Response Card */}
              <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-5 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Simulated State Reaction</span>
                  </h3>
                  {simResult?.twin_state?.state_label && (
                    <TwinStateBadge label={simResult.twin_state.state_label} size="sm" />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 font-medium">Composite Stress (CSI)</span>
                    <div className="text-2xl font-black text-white mt-1">
                      {simResult?.twin_state?.composite_stress_index ?? '—'}
                    </div>
                    <span className="text-[10px] text-slate-500">Scale: 0 - 100</span>
                  </div>

                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 font-medium">Physiological Arousal</span>
                    <div className="text-2xl font-black text-rose-400 mt-1">
                      {simResult?.twin_state?.physiological_arousal_score ?? '—'}
                    </div>
                    <span className="text-[10px] text-slate-500">Autonomic HR &amp; HRV</span>
                  </div>

                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 font-medium">Circadian Disruption</span>
                    <div className="text-2xl font-black text-indigo-400 mt-1">
                      {simResult?.twin_state?.circadian_disruption_index ?? '—'}
                    </div>
                    <span className="text-[10px] text-slate-500">Sleep &amp; Caffeine debt</span>
                  </div>

                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 font-medium">Baseline Departure</span>
                    <div className="text-2xl font-black text-amber-400 mt-1">
                      {simResult?.twin_state?.baseline_deviation_score !== undefined
                        ? `${simResult.twin_state.baseline_deviation_score > 0 ? '+' : ''}${simResult.twin_state.baseline_deviation_score}`
                        : '—'}
                    </div>
                    <span className="text-[10px] text-slate-500">Relative to reference</span>
                  </div>
                </div>

                {/* Experimental Indicator Notice */}
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-200">Experimental Physiological Rules:</div>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
                    <li>CSI is synthesized as: 35% Arousal + 25% Circadian + 40% Distress.</li>
                    <li>Sleep deficit &gt; 2h incurs progressive circadian strain penalty.</li>
                    <li>Caffeine excess beyond personal baseline scales stimulant disruption.</li>
                  </ul>
                </div>
              </div>

              {/* Research Model Risk Projection Card */}
              {simResult?.research_prediction && !simResult.research_prediction.error && (
                <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Impending DBP Elevation Risk</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                      24h ML Horizon
                    </span>
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-black text-white">
                      {(simResult.research_prediction.predicted_probability * 100).toFixed(1)}%
                    </span>
                    <span className="text-xs text-slate-400">
                      Risk Band: <strong className="text-indigo-400">{simResult.research_prediction.risk_band}</strong>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Target is next-day diastolic blood pressure elevation from the research cohort. Does not predict acute panic attacks.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: SCENARIO COMPARISON WORKSPACE                           */}
      {/* ============================================================== */}
      {activeTab === 'compare' && (
        <div className="space-y-8">
          {/* Header controls for compare */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <GitCompare className="w-4 h-4 text-indigo-400" />
                <span>Side-by-Side Scenario Trajectory Comparison</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Compare Scenario A (Current What-If) against Scenario B across diurnal timeline steps.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={runComparison}
                disabled={comparing}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-semibold transition-all flex items-center space-x-1.5 shadow-md shadow-indigo-900/30 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${comparing ? 'animate-spin' : ''}`} />
                <span>Recalculate Diff</span>
              </button>
              <button
                onClick={handleExportComparisonPdf}
                disabled={exportingPdf}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white font-semibold transition-all flex items-center space-x-1.5 border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exportingPdf ? 'Exporting...' : 'Export PDF'}</span>
              </button>
            </div>
          </div>

          {/* Side by side parameter comparison table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Scenario A Card */}
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-sm font-bold text-teal-300">Scenario A (Current Configuration)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/30">
                  Primary
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Sleep Duration</span>
                  <span className="font-bold text-white text-sm">{inputs.sleep_hours}h</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Caffeine Cups</span>
                  <span className="font-bold text-white text-sm">{inputs.caffeine_cups}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Resting HR</span>
                  <span className="font-bold text-white text-sm">{inputs.heart_rate_bpm} BPM</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">HRV rMSSD</span>
                  <span className="font-bold text-white text-sm">{inputs.hrv_ms} ms</span>
                </div>
              </div>
            </div>

            {/* Scenario B Card */}
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-sm font-bold text-rose-300">Scenario B (Alternative Scenario)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30">
                  Alternative
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Sleep Duration</span>
                  <span className="font-bold text-white text-sm">{inputsB.sleep_hours}h</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Caffeine Cups</span>
                  <span className="font-bold text-white text-sm">{inputsB.caffeine_cups}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Resting HR</span>
                  <span className="font-bold text-white text-sm">{inputsB.heart_rate_bpm} BPM</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">HRV rMSSD</span>
                  <span className="font-bold text-white text-sm">{inputsB.hrv_ms} ms</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Timeline Trajectory Chart */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">24-Hour Diurnal Trajectory Comparison</h3>
                <p className="text-xs text-slate-400">Click any hour on the timeline to inspect delta telemetry.</p>
              </div>
              <span className="text-[10px] font-mono uppercase bg-slate-800 px-2.5 py-1 rounded text-slate-300">
                Hourly Synchronized Axis
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={comparisonTrajectory}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload[0]) {
                      setSelectedChartStep(e.activePayload[0].payload.stepIndex);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="scenarioA_CSI" name="Scenario A (CSI)" stroke="#14b8a6" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="scenarioB_CSI" name="Scenario B (CSI)" stroke="#f43f5e" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Step Inspector Detail Box */}
            {selectedChartStep !== null && (
              <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/40 text-xs space-y-2">
                <div className="flex items-center justify-between font-bold text-white">
                  <span>Selected Hour: {comparisonTrajectory[selectedChartStep]?.hour}</span>
                  <span className="text-indigo-400 font-mono">
                    Delta CSI: {comparisonTrajectory[selectedChartStep]?.delta_CSI > 0 ? '+' : ''}
                    {comparisonTrajectory[selectedChartStep]?.delta_CSI} pts
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300 pt-1">
                  <div>Scenario A CSI: <strong className="text-teal-400">{comparisonTrajectory[selectedChartStep]?.scenarioA_CSI}</strong></div>
                  <div>Scenario B CSI: <strong className="text-rose-400">{comparisonTrajectory[selectedChartStep]?.scenarioB_CSI}</strong></div>
                  <div>Scenario A HR: <strong className="text-white">{comparisonTrajectory[selectedChartStep]?.scenarioA_HR} BPM</strong></div>
                  <div>Scenario B HR: <strong className="text-white">{comparisonTrajectory[selectedChartStep]?.scenarioB_HR} BPM</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: EXPLAINABLE DIFFERENCES & COUNTERFACTUAL EXPLORER        */}
      {/* ============================================================== */}
      {activeTab === 'explain' && (
        <div className="space-y-8">
          {/* Why Did the Digital Twin Change? Explanation Panel */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-lg">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Brain className="w-4 h-4 text-teal-400" />
                <span>Why Did the Digital Twin Change?</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Transparent attribution explaining how individual input adjustments mapped into mathematical twin state fluctuations.
              </p>
            </div>

            {/* 1. Inputs Changed */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                1. Inputs Changed Across Scenarios
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {compareResult?.inputs_changed.map((item) => (
                  <div key={item.parameter} className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">{item.display_name}</span>
                      <span className="font-mono text-indigo-400 font-bold">{item.delta_display}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Original: {item.baseline_val} {item.unit} &rarr; Alternative: {item.alternative_val} {item.unit}
                    </div>
                    <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-850">
                      {item.effect_explanation}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Outputs Changed */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                2. Simulated State Reaction &amp; Deltas
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {compareResult?.outputs_changed.slice(0, 4).map((out) => (
                  <div key={out.metric} className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium">{out.display_name}</span>
                    <div className="text-xl font-black text-white">
                      {out.delta > 0 ? '+' : ''}{out.delta} pts
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {out.baseline_value} &rarr; {out.alternative_value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Inputs with NO Modeled Effect */}
            {compareResult && compareResult.unmodeled_inputs.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200 text-xs space-y-1.5">
                <div className="font-bold flex items-center space-x-1.5 text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Inputs With No Modeled Effect on Twin State:</span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-amber-200/90 text-[11px]">
                  {compareResult.unmodeled_inputs.map((msg, idx) => (
                    <li key={idx}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 4. Limitations */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
              <span className="font-bold text-slate-300">Methodological Disclaimers &amp; Limitations:</span>
              <ul className="list-disc pl-5 space-y-0.5 text-slate-400 text-[11px]">
                {compareResult?.scientific_limitations.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Controlled Counterfactual Exploration (1 Variable at a Time) */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-lg">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Zap className="w-4 h-4 text-purple-400" />
                <span>Controlled Counterfactual Explorer (One Variable at a Time)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Isolate exactly one input to measure direct contribution attribution holding all other parameters fixed.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Variable chooser & slider */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Select Variable to Perturb:</label>
                  <select
                    value={cfParam}
                    onChange={(e) => {
                      const param = e.target.value;
                      setCfParam(param);
                      const defaultVal = param === 'sleep_hours' ? 5.0 : param === 'caffeine_cups' ? 3.0 : param === 'heart_rate_bpm' ? 88.0 : param === 'hrv_ms' ? 28.0 : 6.0;
                      setCfValue(defaultVal);
                      executeCounterfactual(param, defaultVal);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="sleep_hours">Sleep Duration (hours)</option>
                    <option value="caffeine_cups">Caffeine Intake (cups)</option>
                    <option value="heart_rate_bpm">Resting Heart Rate (BPM)</option>
                    <option value="hrv_ms">HRV rMSSD (ms)</option>
                    <option value="self_reported_anxiety">Self-Reported Distress (0-10)</option>
                    <option value="physical_activity_mins">Physical Activity (mins - Unmodeled)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">Perturbed Value:</span>
                    <span className="font-mono text-purple-400">{cfValue}</span>
                  </div>
                  <input
                    type="range"
                    min={cfParam === 'sleep_hours' ? 1 : cfParam === 'caffeine_cups' ? 0 : cfParam === 'heart_rate_bpm' ? 45 : cfParam === 'hrv_ms' ? 10 : 0}
                    max={cfParam === 'sleep_hours' ? 12 : cfParam === 'caffeine_cups' ? 8 : cfParam === 'heart_rate_bpm' ? 130 : cfParam === 'hrv_ms' ? 100 : 10}
                    step={cfParam === 'self_reported_anxiety' ? 1 : 0.5}
                    value={cfValue}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setCfValue(val);
                      executeCounterfactual(cfParam, val);
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              </div>

              {/* Counterfactual Results Breakdown */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-300 block">Direct Contribution Attribution:</span>
                {cfResult ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>CSI Net Shift:</span>
                      <strong className="text-white font-mono text-sm">
                        {cfResult.metric_deltas.delta_composite_stress > 0 ? '+' : ''}
                        {cfResult.metric_deltas.delta_composite_stress} pts
                      </strong>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                      <div className="font-semibold text-indigo-400">Formula Rule:</div>
                      <div>{cfResult.simulation_rule_explanation}</div>
                      <div className="pt-1 text-slate-400">{cfResult.formula_attribution}</div>
                    </div>
                    {cfResult.unmodeled_effect_note && (
                      <p className="text-[11px] text-amber-400 bg-amber-950/20 p-2.5 rounded border border-amber-500/20">
                        {cfResult.unmodeled_effect_note}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Adjust the slider to run counterfactual calculation.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: LONGITUDINAL EVOLUTION & DIGITAL TWIN MEMORY            */}
      {/* ============================================================== */}
      {activeTab === 'evolution' && (
        <div className="space-y-8">
          {/* Historical Evolution Header */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <History className="w-4 h-4 text-teal-400" />
                  <span>Longitudinal Baseline Evolution</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  How your empirical personal baseline has changed over authentic historical time windows.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSnapshotMemory}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white font-semibold transition-all flex items-center space-x-1.5 border border-slate-700"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Snapshot Memory</span>
                </button>
                <button
                  onClick={handleResetMemory}
                  className="px-3.5 py-1.5 rounded-xl border border-rose-500/30 hover:bg-rose-950/30 text-rose-300 text-xs font-semibold transition-all flex items-center space-x-1.5"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Reset Derived Memory</span>
                </button>
              </div>
            </div>

            {/* Distinct view isolation notice */}
            <div className="p-3.5 rounded-xl bg-teal-950/20 border border-teal-500/30 text-teal-200 text-xs flex items-center space-x-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 text-teal-400" />
              <span>
                <strong>AUTHENTIC RECORD ISOLATION:</strong> Longitudinal evolution relies exclusively on genuine historical measurements and validated arithmetic baselines. Synthetic simulation runs are quarantined and never pollute these records.
              </span>
            </div>

            {/* Evolution Windows Table */}
            {evolutionData && evolutionData.windows.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {evolutionData.windows.map((win, idx) => (
                    <div
                      key={win.window_label}
                      className="bg-slate-950/70 rounded-xl p-4 border border-slate-800 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{win.window_label}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {win.unique_days} days
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Resting HR:</span>
                          <strong className="text-white">{win.mean_resting_hr ? `${win.mean_resting_hr} BPM` : '—'}</strong>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>HRV rMSSD:</span>
                          <strong className="text-white">{win.mean_hrv_ms ? `${win.mean_hrv_ms} ms` : '—'}</strong>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Sleep Hours:</span>
                          <strong className="text-white">{win.mean_sleep_hours ? `${win.mean_sleep_hours}h` : '—'}</strong>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Distress Rating:</span>
                          <strong className="text-white">{win.mean_anxiety_score !== null ? `${win.mean_anxiety_score}/10` : '—'}</strong>
                        </div>
                      </div>
                      {win.delta_vs_prior && (
                        <div className="pt-2 border-t border-slate-850 text-[10px] text-indigo-300">
                          <span>Shift vs Prior: </span>
                          <strong>
                            {win.delta_vs_prior.delta_resting_hr !== null && win.delta_vs_prior.delta_resting_hr !== undefined
                              ? `${win.delta_vs_prior.delta_resting_hr > 0 ? '+' : ''}${win.delta_vs_prior.delta_resting_hr} BPM`
                              : 'Equilibrium'}
                          </strong>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Explanations for why baseline changed */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                  <span className="font-bold text-white flex items-center space-x-1.5">
                    <Info className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Why Has the Baseline Changed Over Time?</span>
                  </span>
                  <ul className="list-disc pl-5 space-y-1 text-slate-400 text-[11px]">
                    {evolutionData.change_explanations.map((exp, idx) => (
                      <li key={idx}>{exp}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
                <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p>No historical records found for multi-window evolution.</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Log at least 5 observations across 3 distinct calendar days to start tracking baseline evolution.
                </p>
              </div>
            )}
          </div>

          {/* Stored Digital Twin Memory Records */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-purple-400" />
                  <span>Digital Twin Memory Governance</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Stored audit metadata snapshots of calculated baseline versions. Contains zero speculative psychological profiles.
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">{memories.length} snapshots</span>
            </div>

            {memories.length > 0 ? (
              <div className="space-y-2.5">
                {memories.map((mem) => (
                  <div
                    key={mem.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center space-x-2">
                        <span>Version: {mem.baseline_version}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/30">
                          Active
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{mem.notes}</p>
                    </div>
                    <div className="text-right text-[11px] text-slate-400 font-mono shrink-0">
                      <div>Calculated: {new Date(mem.calculation_timestamp).toLocaleDateString()}</div>
                      <div>Observations: {mem.observation_count}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">
                No archived memory snapshots. Click &quot;Snapshot Memory&quot; to archive your current baseline version.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: DETERMINISTIC TIMELINE REPLAY                           */}
      {/* ============================================================== */}
      {activeTab === 'replay' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <Play className="w-4 h-4 text-teal-400" />
                  <span>Deterministic Scenario Replay</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Generate seed-reproducible diurnal trajectories. Identical seed + inputs produces mathematically identical results.
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1.5 text-xs text-slate-300">
                  <span>Seed:</span>
                  <input
                    type="number"
                    value={replaySeed}
                    onChange={(e) => setReplaySeed(parseInt(e.target.value) || 42)}
                    className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                  />
                </div>
                <button
                  onClick={handleRunReplay}
                  disabled={replaying}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs text-white font-semibold transition-all flex items-center space-x-1.5 shadow-md shadow-teal-900/30 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${replaying ? 'animate-spin' : ''}`} />
                  <span>Replay Trajectory</span>
                </button>
              </div>
            </div>

            {replayResult && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Reproducibility Hash: <strong className="font-mono text-teal-300">{replayResult.reproducibility_hash}</strong></span>
                  <span>Steps: {replayResult.steps.length}</span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={replayResult.steps}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="hour_offset" stroke="#64748b" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                      />
                      <Line type="monotone" dataKey="composite_stress_index" name="CSI Stress" stroke="#14b8a6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="physiological_arousal_score" name="Arousal" stroke="#f43f5e" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="circadian_disruption_index" name="Circadian" stroke="#818cf8" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
