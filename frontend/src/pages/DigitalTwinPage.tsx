import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Activity, 
  Heart, 
  Moon, 
  Coffee, 
  ShieldCheck, 
  RefreshCw, 
  BarChart2, 
  Sliders, 
  HelpCircle,
  Clock,
  Zap
} from 'lucide-react';
import { api } from '../services/api';
import { TwinState, BaselineSummary } from '../types';
import { TwinStateBadge } from '../components/TwinStateBadge';
import { LiveScenarioEngine } from '../components/LiveScenarioEngine';

export const DigitalTwinPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'live' | 'architecture'>('live');
  const [twinState, setTwinState] = useState<TwinState | null>(null);
  const [baseline, setBaseline] = useState<BaselineSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [st, base] = await Promise.all([api.getTwinState(), api.getBaseline()]);
        setTwinState(st);
        setBaseline(base);
      } catch (err) {
        console.error('Error loading twin view', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const details = twinState?.details || {};
  const isHrMeasured = details.is_heart_rate_measured ?? (details.heart_rate_bpm !== null && details.heart_rate_bpm !== undefined);
  const currentHr = (isHrMeasured && typeof details.heart_rate_bpm === 'number') ? details.heart_rate_bpm : null;
  const baseHr = baseline?.mean_resting_hr ?? 72;
  const hrDiff = currentHr !== null ? Math.round(currentHr - baseHr) : null;

  const isHrvMeasured = details.is_hrv_measured ?? (details.hrv_ms !== null && details.hrv_ms !== undefined);
  const currentHrv = (isHrvMeasured && typeof details.hrv_ms === 'number') ? details.hrv_ms : null;
  const baseHrv = baseline?.mean_hrv_ms ?? 45;
  const hrvDiff = currentHrv !== null ? Math.round(currentHrv - baseHrv) : null;

  const currentSleep = details.sleep_hours !== null && details.sleep_hours !== undefined ? details.sleep_hours : null;
  const baseSleep = baseline?.mean_sleep_hours ?? 7.5;
  const sleepDiff = currentSleep !== null ? Number((currentSleep - baseSleep).toFixed(1)) : null;

  const currentCaff = details.caffeine_cups !== null && details.caffeine_cups !== undefined ? details.caffeine_cups : null;
  const baseCaff = baseline?.mean_caffeine_cups ?? 1;
  const caffDiff = currentCaff !== null ? Number((currentCaff - baseCaff).toFixed(1)) : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title */}
      <div className="border-b border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">My Digital Twin Architecture</h1>
            {twinState && <TwinStateBadge label={twinState.state_label} size="lg" />}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Mathematical representation of autonomic tone, circadian balance, and individual baselines.
          </p>
        </div>

        <div className="text-right text-xs text-slate-400 font-mono">
          <span>Snapshot ID: #{twinState?.id ?? 'Live'}</span>
          <br />
          <span>Updated: {twinState?.timestamp ? new Date(twinState.timestamp).toLocaleString() : 'Realtime'}</span>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex space-x-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 self-start">
        <button
          type="button"
          onClick={() => setActiveTab('live')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'live'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-900/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-teal-300" />
          <span>Live Scenario Engine (Interactive Stream)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('architecture')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'architecture'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-900/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Brain className="w-3.5 h-3.5 text-teal-300" />
          <span>Twin Architecture &amp; Baseline Formulation</span>
        </button>
      </div>

      {activeTab === 'live' ? (
        <LiveScenarioEngine />
      ) : loading || !twinState ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Cold-start vs Empirical Status Banner */}
          {baseline && (
            <div className={`p-5 rounded-2xl border ${
              baseline.has_sufficient_data
                ? 'bg-slate-900/80 border-teal-500/30'
                : 'bg-slate-900/90 border-indigo-500/30'
            } space-y-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <ShieldCheck className={`w-4 h-4 ${baseline.has_sufficient_data ? 'text-teal-400' : 'text-indigo-400'}`} />
              <h3 className="text-sm font-bold text-white">
                {baseline.has_sufficient_data ? 'Empirical Personal Baseline Active' : 'Cold-Start Baseline Calibration'}
              </h3>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              baseline.has_sufficient_data
                ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                : 'bg-indigo-900/60 text-indigo-300 border-indigo-500/30'
            }`}>
              {baseline.has_sufficient_data ? 'Personal Longitudinal' : 'Population Reference Prior'}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {baseline.status_message}
            {!baseline.has_sufficient_data && ' Individual deviation metrics will gain higher specificity once at least 5 observations across 3 distinct days are recorded.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800 text-[11px]">
            <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">Total Observations / Unique Days</span>
              <span className="text-white font-mono font-semibold">{baseline.total_observations_count} obs / {baseline.unique_days_count ?? 0} days</span>
            </div>
            <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">Descriptive Baseline (&ge; 5 obs, &ge; 3 days)</span>
              <span className={`font-semibold ${baseline.descriptive_baseline_ready ?? baseline.has_sufficient_data ? 'text-teal-400' : 'text-amber-400'}`}>
                {baseline.descriptive_baseline_ready ?? baseline.has_sufficient_data ? 'Ready' : 'Calibrating'}
              </span>
            </div>
            <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block">ML Personalization (&ge; 7 prior days)</span>
              <span className={`font-semibold ${baseline.personalized_prediction_ready ? 'text-teal-400' : 'text-indigo-400'}`}>
                {baseline.personalized_prediction_ready ? 'Qualified' : 'Requires &ge; 7 days'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Baseline vs Current Deviation Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Heart Rate */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center space-x-1.5 font-medium text-slate-300">
              <Heart className="w-4 h-4 text-rose-400" />
              <span>Heart Rate</span>
            </span>
            <span className={`font-mono text-[11px] font-semibold ${
              hrDiff === null ? 'text-slate-500' : hrDiff > 5 ? 'text-amber-400' : hrDiff < -5 ? 'text-teal-400' : 'text-slate-400'
            }`}>
              {hrDiff === null ? 'Unrecorded' : hrDiff > 0 ? `+${hrDiff} BPM` : `${hrDiff} BPM`}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-bold font-mono text-white">
                {currentHr !== null ? currentHr : '—'}
              </span>
              <span className="text-xs text-slate-400 ml-1">current</span>
            </div>
            <div className="text-right text-xs text-slate-400">
              <span className="font-mono text-slate-300">{baseHr}</span> {baseline?.has_sufficient_data ? 'base' : 'ref prior'}
            </div>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-rose-400 h-full rounded-full transition-all" 
              style={{ width: currentHr ? `${Math.min(100, (currentHr / 120) * 100)}%` : '0%' }} 
            />
          </div>
        </div>

        {/* HRV */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center space-x-1.5 font-medium text-slate-300">
              <Activity className="w-4 h-4 text-teal-400" />
              <span>HRV (RMSSD)</span>
            </span>
            <span className={`font-mono text-[11px] font-semibold ${
              hrvDiff === null ? 'text-slate-500' : hrvDiff < -5 ? 'text-amber-400' : hrvDiff > 5 ? 'text-teal-400' : 'text-slate-400'
            }`}>
              {hrvDiff === null ? 'Unrecorded' : hrvDiff > 0 ? `+${hrvDiff} ms` : `${hrvDiff} ms`}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-bold font-mono text-white">
                {currentHrv !== null ? currentHrv : '—'}
              </span>
              <span className="text-xs text-slate-400 ml-1">current</span>
            </div>
            <div className="text-right text-xs text-slate-400">
              <span className="font-mono text-slate-300">{baseHrv}</span> {baseline?.has_sufficient_data ? 'base' : 'ref prior'}
            </div>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-teal-400 h-full rounded-full transition-all" 
              style={{ width: currentHrv ? `${Math.min(100, (currentHrv / 90) * 100)}%` : '0%' }} 
            />
          </div>
        </div>

        {/* Sleep Duration */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center space-x-1.5 font-medium text-slate-300">
              <Moon className="w-4 h-4 text-indigo-400" />
              <span>Sleep Duration</span>
            </span>
            <span className={`font-mono text-[11px] font-semibold ${
              sleepDiff === null ? 'text-slate-500' : sleepDiff < -1 ? 'text-amber-400' : sleepDiff > 1 ? 'text-teal-400' : 'text-slate-400'
            }`}>
              {sleepDiff === null ? 'Unrecorded' : sleepDiff > 0 ? `+${sleepDiff} hrs` : `${sleepDiff} hrs`}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-bold font-mono text-white">
                {currentSleep !== null ? currentSleep : '—'}
              </span>
              <span className="text-xs text-slate-400 ml-1">hrs</span>
            </div>
            <div className="text-right text-xs text-slate-400">
              <span className="font-mono text-slate-300">{baseSleep}</span> {baseline?.has_sufficient_data ? 'base' : 'ref prior'}
            </div>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-indigo-400 h-full rounded-full transition-all" 
              style={{ width: currentSleep ? `${Math.min(100, (currentSleep / 10) * 100)}%` : '0%' }} 
            />
          </div>
        </div>

        {/* Caffeine */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center space-x-1.5 font-medium text-slate-300">
              <Coffee className="w-4 h-4 text-amber-400" />
              <span>Caffeine Intake</span>
            </span>
            <span className={`font-mono text-[11px] font-semibold ${
              caffDiff === null ? 'text-slate-500' : caffDiff > 1 ? 'text-amber-400' : 'text-slate-400'
            }`}>
              {caffDiff === null ? 'Unrecorded' : caffDiff > 0 ? `+${caffDiff} cups` : `${caffDiff} cups`}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-bold font-mono text-white">
                {currentCaff !== null ? currentCaff : '—'}
              </span>
              <span className="text-xs text-slate-400 ml-1">cups</span>
            </div>
            <div className="text-right text-xs text-slate-400">
              <span className="font-mono text-slate-300">{baseCaff}</span> {baseline?.has_sufficient_data ? 'base' : 'ref prior'}
            </div>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-amber-400 h-full rounded-full transition-all" 
              style={{ width: currentCaff ? `${Math.min(100, (currentCaff / 5) * 100)}%` : '0%' }} 
            />
          </div>
        </div>
      </div>

      {/* State Synthesis Equation Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 border border-slate-800 space-y-6">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <Brain className="w-5 h-5 text-teal-400" />
            <span>Digital Twin Synthesis Engine Formulation</span>
          </h3>
          <p className="text-xs text-slate-400">
            Mathematical breakdown of how multi-modal observations are continuously integrated into the virtual patient state.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs sm:text-sm text-teal-300 overflow-x-auto space-y-2">
          <p className="text-slate-400 font-sans text-xs">// Multi-modal Composite Stress Index Formula</p>
          <p className="text-white font-bold">
            Composite Stress Index (CSI) = (0.35 × Arousal) + (0.25 × Circadian Debt) + (0.40 × Psychological Strain)
          </p>
          <div className="text-xs text-slate-400 pt-1 space-y-1">
            <p>• Arousal: Calibrated z-score delta of HR surge above baseline + HRV depression below baseline.</p>
            <p>• Circadian Debt: Sleep duration deficit from personal baseline + caffeine excess factor.</p>
            <p>• Psychological Strain: Voluntary 0-10 anxiety check-in ratings + reported somatic symptom weights.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1">
            <span className="text-xs font-semibold text-teal-300">Autonomic Weight (35%)</span>
            <p className="text-xs text-slate-300">Continuous sympathetic/parasympathetic tone monitoring.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1">
            <span className="text-xs font-semibold text-indigo-300">Circadian Weight (25%)</span>
            <p className="text-xs text-slate-300">Restorative sleep duration and stimulant rhythm alignment.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1">
            <span className="text-xs font-semibold text-rose-300">Subjective Weight (40%)</span>
            <p className="text-xs text-slate-300">Direct patient self-reported emotional &amp; somatic state.</p>
          </div>
        </div>
      </div>

        {/* Investigational Prototype Disclaimer */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-start space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-slate-300">Investigational Prototype Notice:</strong> The Digital Twin state and Composite Stress Index are mathematical representations developed for research and educational demonstrations. They are non-diagnostic, non-clinical estimates and do not predict imminent panic attacks or substitute for professional medical care.
          </p>
        </div>
      </>
    )}
  </div>
);
};
