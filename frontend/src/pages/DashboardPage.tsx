import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Brain, 
  Activity, 
  Heart, 
  Moon, 
  Coffee, 
  Plus, 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus,
  RefreshCw,
  Info,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Clock,
  ShieldCheck,
  ChevronRight,
  Sliders,
  Target,
  BookOpen,
  FileText,
  Lock
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  AreaChart, 
  Area 
} from 'recharts';
import { api } from '../services/api';
import { TwinState, BaselineSummary, LongitudinalTrendPoint, ClinicianFollowUpTask } from '../types';
import { TwinStateBadge, ProvenanceTag } from '../components/TwinStateBadge';

export const DashboardPage: React.FC = () => {
  const [twinState, setTwinState] = useState<TwinState | null>(null);
  const [baseline, setBaseline] = useState<BaselineSummary | null>(null);
  const [trends, setTrends] = useState<LongitudinalTrendPoint[]>([]);
  const [patientTasks, setPatientTasks] = useState<ClinicianFollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [showObsModal, setShowObsModal] = useState(false);
  const [userName, setUserName] = useState<string>('User');

  // Unified quick observation form fields
  const [hr, setHr] = useState<number | ''>(76);
  const [hrv, setHrv] = useState<number | ''>(42);
  const [steps, setSteps] = useState<number | ''>(4500);
  const [sleep, setSleep] = useState<number | ''>(7.5);
  const [caffeine, setCaffeine] = useState<number | ''>(1.0);
  const [anxietyScore, setAnxietyScore] = useState<number>(3);
  const [obsMessage, setObsMessage] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const userStr = localStorage.getItem('anxietytwin_user');
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (u.full_name) setUserName(u.full_name);
          else if (u.email) setUserName(u.email.split('@')[0]);
        } catch {
          // ignore
        }
      }

      const [stateRes, baseRes, trendRes, tasksRes] = await Promise.all([
        api.getTwinState(),
        api.getBaseline(),
        api.getTrends(30),
        api.getPatientVisibleTasks().catch(() => []),
      ]);
      setTwinState(stateRes);
      setBaseline(baseRes);
      setTrends(trendRes.points);
      setPatientTasks(tasksRes || []);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAcknowledgeTask = async (taskId: number) => {
    const notes = prompt('Add an optional response note for your clinician (or leave blank):');
    try {
      await api.acknowledgePatientTask(taskId, notes || undefined);
      const updated = await api.getPatientVisibleTasks();
      setPatientTasks(updated);
      alert('Task acknowledged! Your clinician can see your progress.');
    } catch (err: any) {
      alert('Failed to acknowledge task: ' + err.message);
    }
  };

  const handlePlayDemoStream = async () => {
    try {
      setStreaming(true);
      await api.playSyntheticStream('SYM2-1-285', 7);
      await fetchData();
      setObsMessage('Loaded 7 days of demonstration stream from research study participant SYM2-1-285 (Tagged: synthetic)!');
      setTimeout(() => setObsMessage(null), 5000);
    } catch (err: any) {
      alert('Failed to stream demo data: ' + err.message);
    } finally {
      setStreaming(false);
    }
  };

  const handleCreateObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createCheckin({
        subjective_anxiety_score: anxietyScore,
        energy_level: 3,
        somatic_symptoms: [],
        triggers_noted: 'Dashboard Quick Observation',
        notes: 'Recorded via Dashboard modal.',
        sleep_hours: sleep ? Number(sleep) : undefined,
        caffeine_cups: caffeine ? Number(caffeine) : undefined,
        heart_rate_bpm: hr ? Number(hr) : undefined,
        steps_count: steps ? Number(steps) : undefined,
      });

      setShowObsModal(false);
      setObsMessage('Observation saved! Your Digital Twin state has been updated.');
      setTimeout(() => setObsMessage(null), 4000);
      await fetchData();
    } catch (err: any) {
      alert('Failed to save observation: ' + err.message);
    }
  };

  if (loading && !twinState) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
          <p className="text-sm text-slate-400 font-mono">Syncing Virtual Patient State...</p>
        </div>
      </div>
    );
  }

  const deviation = twinState?.baseline_deviation_score || 0;
  const csi = twinState?.composite_stress_index || 0;
  const isColdStart = baseline?.has_sufficient_data === false || baseline?.is_cold_start === true;
  const progressPercent = baseline?.history_progress_percent ?? 0;
  const totalObsCount = baseline?.total_observations_count ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast Notification */}
      {obsMessage && (
        <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{obsMessage}</span>
          </div>
          <button onClick={() => setObsMessage(null)} className="text-teal-400 hover:text-white text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Welcome & Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Welcome back, {userName}
            </h1>
            {twinState && <TwinStateBadge label={twinState.state_label} size="lg" />}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Personal Mode: Virtual patient state, empirical baseline calibration, and longitudinal monitoring.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowObsModal(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md shadow-teal-900/30 transition-all hover:scale-[1.01]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Quick Observation</span>
          </button>

          <Link
            to="/twin"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-teal-900/30 transition-all hover:scale-[1.01]"
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Live Scenario Engine</span>
          </Link>

          <Link
            to="/checkin"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all hover:scale-[1.01]"
          >
            <Heart className="w-3.5 h-3.5 text-rose-400" />
            <span>Daily Check-In</span>
          </Link>

          <Link
            to="/interventions"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-teal-300 text-xs font-semibold transition-all hover:scale-[1.01]"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>Supportive Interventions</span>
          </Link>

          <button
            onClick={handlePlayDemoStream}
            disabled={streaming}
            title="Load authentic 7-day stream from research study cohort (CC BY 4.0)"
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 text-xs font-medium transition-all disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>{streaming ? 'Ingesting Stream...' : 'Replay Cohort Demo Stream'}</span>
          </button>
        </div>
      </div>

      {/* Baseline Status / Cold-Start Engine Card */}
      {isColdStart ? (
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-indigo-500/30 space-y-4 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>Cold-Start Baseline Calibration In Progress</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-500/30">
                    Population Reference Benchmark Active
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  The engine requires at least <strong>5 valid observations across 3 distinct days</strong> to establish your empirical individual baseline
                  (and <strong>7 prior days</strong> for personalized ML prediction).
                  Current indicators are benchmarked against demographic priors until personal history is accumulated.
                </p>
              </div>
            </div>

            <Link
              to="/checkin"
              className="inline-flex items-center space-x-1 text-xs font-semibold text-teal-400 hover:text-teal-300 shrink-0"
            >
              <span>Record Today's Check-In</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400 font-mono">
              <span>Calibration Progress: {totalObsCount} of 5 observations ({baseline?.unique_days_count ?? 0} days recorded)</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, progressPercent)}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-900/80 border border-teal-500/30 flex items-center justify-between text-xs shadow-md">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            <span className="text-slate-200">
              <strong>Empirical Individual Baseline Active:</strong> Calibrated using {totalObsCount} logged historical observations across {baseline?.unique_days_count ?? 0} days.
            </span>
          </div>
          <Link to="/twin" className="text-teal-400 hover:text-teal-300 font-medium inline-flex items-center space-x-1">
            <span>View Architecture</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Primary Virtual Patient State (Hero Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* State Gauge Card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Current Virtual Patient State</h3>
                <p className="text-[11px] text-slate-400">
                  Last State Engine Snapshot: {twinState?.timestamp ? new Date(twinState.timestamp).toLocaleTimeString() : 'Active'}
                </p>
              </div>
            </div>
            <ProvenanceTag source={twinState?.source || 'user_entered'} />
          </div>

          {/* Composite Stress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">Composite Stress Index (CSI)</span>
              <span className="font-mono font-bold text-white text-sm">{csi} / 100</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden relative">
              <div
                className={`h-full transition-all duration-700 rounded-full ${
                  csi < 30 ? 'bg-emerald-400' : csi < 50 ? 'bg-sky-400' : csi < 70 ? 'bg-amber-400' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(5, csi))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
              <span>0 (Stable Baseline)</span>
              <span>30 (Mild Strain)</span>
              <span>50 (Elevated Arousal)</span>
              <span>70+ (High Vulnerability)</span>
            </div>
          </div>

          {/* Metric Sub-cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1">
              <span className="text-[11px] font-medium text-slate-400">Autonomic Arousal (35%)</span>
              <p className="text-lg font-bold font-mono text-slate-100">{twinState?.physiological_arousal_score ?? 0}</p>
              <p className="text-[10px] text-slate-400">Heart rate surge &amp; autonomic tone</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1">
              <span className="text-[11px] font-medium text-slate-400">Circadian Disruption (25%)</span>
              <p className="text-lg font-bold font-mono text-slate-100">{twinState?.circadian_disruption_index ?? 0}</p>
              <p className="text-[10px] text-slate-400">Sleep deficit &amp; caffeine excess</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1">
              <span className="text-[11px] font-medium text-slate-400">Baseline Deviation</span>
              <div className="flex items-center space-x-1">
                {deviation > 0 ? (
                  <ArrowUpRight className="w-4 h-4 text-amber-400" />
                ) : deviation < 0 ? (
                  <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Minus className="w-4 h-4 text-slate-400" />
                )}
                <span className={`text-lg font-bold font-mono ${
                  deviation > 0 ? 'text-amber-400' : deviation < 0 ? 'text-emerald-400' : 'text-slate-300'
                }`}>
                  {deviation > 0 ? `+${deviation}` : deviation} pts
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Shift from personal baseline norm</p>
            </div>
          </div>
        </div>

        {/* Right Card: Multi-modal Baseline Comparison Matrix */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <span>Observed vs Baseline</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400">
                {isColdStart ? 'Reference Prior' : 'Empirical Personal'}
              </span>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              {/* Resting HR */}
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-800/40">
                <span className="text-slate-300 flex items-center space-x-2">
                  <Heart className="w-3.5 h-3.5 text-rose-400" />
                  <span>Resting HR</span>
                </span>
                <span className="font-mono text-slate-100 font-bold">
                  {twinState?.details?.heart_rate_bpm != null ? (
                    `${twinState.details.heart_rate_bpm} BPM`
                  ) : (
                    <span className="text-slate-400 font-normal italic">Unrecorded</span>
                  )}{' '}
                  <span className="text-slate-400 font-normal">
                    / {baseline?.mean_resting_hr != null ? `${baseline.mean_resting_hr}` : '72 (ref)'} base
                  </span>
                </span>
              </div>

              {/* Sleep Duration */}
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-800/40">
                <span className="text-slate-300 flex items-center space-x-2">
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Sleep Duration</span>
                </span>
                <span className="font-mono text-slate-100 font-bold">
                  {twinState?.details?.sleep_hours != null ? (
                    `${twinState.details.sleep_hours} hrs`
                  ) : (
                    <span className="text-slate-400 font-normal italic">Unrecorded</span>
                  )}{' '}
                  <span className="text-slate-400 font-normal">
                    / {baseline?.mean_sleep_hours != null ? `${baseline.mean_sleep_hours}` : '7.5 (ref)'} base
                  </span>
                </span>
              </div>

              {/* Caffeine Cups */}
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-800/40">
                <span className="text-slate-300 flex items-center space-x-2">
                  <Coffee className="w-3.5 h-3.5 text-amber-400" />
                  <span>Caffeine Intake</span>
                </span>
                <span className="font-mono text-slate-100 font-bold">
                  {twinState?.details?.caffeine_cups != null ? (
                    `${twinState.details.caffeine_cups} cups`
                  ) : (
                    <span className="text-slate-400 font-normal italic">Unrecorded</span>
                  )}{' '}
                  <span className="text-slate-400 font-normal">
                    / {baseline?.mean_caffeine_cups != null ? `${baseline.mean_caffeine_cups}` : '1.0 (ref)'} base
                  </span>
                </span>
              </div>

              {/* Anxiety Score */}
              <div className="flex justify-between items-center p-2 rounded-lg bg-slate-800/40">
                <span className="text-slate-300 flex items-center space-x-2">
                  <Brain className="w-3.5 h-3.5 text-sky-400" />
                  <span>Self-Reported Mood</span>
                </span>
                <span className="font-mono text-slate-100 font-bold">
                  {twinState?.details?.anxiety_score != null ? (
                    `${twinState.details.anxiety_score} / 10`
                  ) : (
                    <span className="text-slate-400 font-normal italic">Pending Check-In</span>
                  )}{' '}
                  <span className="text-slate-400 font-normal">
                    / {baseline?.mean_anxiety_score != null ? `${baseline.mean_anxiety_score}` : '2.5 (ref)'} base
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <Link
              to="/twin"
              className="w-full text-center py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold block transition-colors"
            >
              Inspect Complete Baseline Engine
            </Link>
          </div>
        </div>
      </div>

      {/* Longitudinal Trends Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-teal-400" />
              <span>Longitudinal Stress &amp; Autonomic Trends (30 Days)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Chronological trajectory of Composite Stress Index (CSI), resting heart rate, and sleep duration.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs font-mono text-slate-400">
              {trends.length} recorded data point{trends.length === 1 ? '' : 's'}
            </span>
            <Link
              to="/history"
              className="inline-flex items-center space-x-1 text-xs text-teal-400 hover:text-teal-300 font-semibold transition-colors"
            >
              <span>View All Logs</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {trends.length < 2 ? (
          <div className="p-10 text-center rounded-xl bg-slate-800/30 border border-slate-800 space-y-3">
            <Clock className="w-8 h-8 text-slate-600 mx-auto" />
            <h4 className="text-sm font-semibold text-white">Building Your Longitudinal Series</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Continue recording daily check-ins to unlock interactive trend charts, or load the authentic research demonstration stream to preview full trajectory analytics.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Link
                to="/checkin"
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow"
              >
                Log Today's Check-In
              </Link>
              <button
                onClick={handlePlayDemoStream}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold"
              >
                Load Demo Stream
              </button>
            </div>
          </div>
        ) : (
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="csiGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="composite_stress"
                  name="Composite Stress (CSI)"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#csiGradient)"
                />
                <Line
                  type="monotone"
                  dataKey="heart_rate"
                  name="Heart Rate (BPM)"
                  stroke="#f43f5e"
                  strokeWidth={1.5}
                  dot={{ r: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="sleep_hours"
                  name="Sleep (hrs)"
                  stroke="#818cf8"
                  strokeWidth={1.5}
                  dot={{ r: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Patient-Visible Clinician Tasks & Care Coordination */}
      {patientTasks.length > 0 && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/30 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Care Coordination Tasks</h3>
                <p className="text-[11px] text-slate-400">Items assigned by your verified clinician for self-care support.</p>
              </div>
            </div>
            <span className="text-xs font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
              {patientTasks.filter((t) => !t.patient_acknowledged).length} Pending Acknowledgment
            </span>
          </div>

          <div className="space-y-3">
            {patientTasks.map((task) => (
              <div
                key={task.id}
                className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white">{task.title}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-teal-300">
                      {task.priority}
                    </span>
                    {task.patient_acknowledged && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        Acknowledged
                      </span>
                    )}
                  </div>
                  {task.patient_visible_notes && (
                    <p className="text-xs text-slate-300">{task.patient_visible_notes}</p>
                  )}
                  {task.due_date && (
                    <span className="text-[11px] text-slate-500 font-mono">Due: {task.due_date}</span>
                  )}
                </div>

                {!task.patient_acknowledged && (
                  <button
                    onClick={() => handleAcknowledgeTask(task.id)}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow self-start sm:self-auto cursor-pointer"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Feature Workspaces Navigation Grid */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-teal-400" />
            <span>Advanced Wellness &amp; Evidence Workspaces</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Explore personal triggers, self-care routines, private reflections, and transparent evidence metrics.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            to="/patterns"
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-teal-500/50 hover:bg-slate-900/80 transition-all space-y-2 group shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 transition-colors" />
            </div>
            <h4 className="text-sm font-bold text-white group-hover:text-teal-300 transition-colors">Pattern Discovery</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Identify recurring correlations between context tags, sleep irregularity, and self-reported distress.
            </p>
          </Link>

          <Link
            to="/goals"
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-teal-500/50 hover:bg-slate-900/80 transition-all space-y-2 group shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Target className="w-4 h-4" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
            </div>
            <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">Wellness Goals &amp; Care Plan</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Set voluntary self-care intentions, track weekly completion pace, and review evidence-based suggestions.
            </p>
          </Link>

          <Link
            to="/journal"
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-teal-500/50 hover:bg-slate-900/80 transition-all space-y-2 group shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <BookOpen className="w-4 h-4" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
            </div>
            <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">Emotion Journal</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Private sanctuary with structured reflection prompts and consent-gated AI theme synthesis.
            </p>
          </Link>

          <Link
            to="/data-quality"
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-teal-500/50 hover:bg-slate-900/80 transition-all space-y-2 group shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
            </div>
            <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">Data Quality Center</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Audit data coverage, sensor provenance, baseline reliability tier, and analytical model boundaries.
            </p>
          </Link>

          <Link
            to="/weekly-report"
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-teal-500/50 hover:bg-slate-900/80 transition-all space-y-2 group shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileText className="w-4 h-4" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
            </div>
            <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">Weekly Insights Report</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Compile longitudinal check-ins, baseline shifts, coping efficacy, and download ReportLab PDF summaries.
            </p>
          </Link>

          <Link
            to="/privacy"
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-teal-500/50 hover:bg-slate-900/80 transition-all space-y-2 group shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Lock className="w-4 h-4" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 transition-colors" />
            </div>
            <h4 className="text-sm font-bold text-white group-hover:text-rose-300 transition-colors">Privacy &amp; Consent Center</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Manage clinician access grants, download complete JSON data archives, and inspect immutable audit logs.
            </p>
          </Link>
        </div>
      </div>

      {/* Quick Observation Modal */}
      {showObsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Plus className="w-4 h-4 text-teal-400" />
                <span>Quick Observation</span>
              </h3>
              <button onClick={() => setShowObsModal(false)} className="text-slate-400 hover:text-white text-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateObservation} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Resting Heart Rate</label>
                  <input
                    type="number"
                    min="40"
                    max="180"
                    value={hr}
                    onChange={(e) => setHr(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">HRV (RMSSD, ms)</label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={hrv}
                    onChange={(e) => setHrv(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Sleep (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    max="16"
                    step="0.5"
                    value={sleep}
                    onChange={(e) => setSleep(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Caffeine (Cups)</label>
                  <input
                    type="number"
                    min="0"
                    max="15"
                    step="0.5"
                    value={caffeine}
                    onChange={(e) => setCaffeine(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label className="font-medium text-slate-300">Subjective Mood (0-10)</label>
                  <span className="font-mono text-teal-300 font-bold">{anxietyScore} / 10</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={anxietyScore}
                  onChange={(e) => setAnxietyScore(Number(e.target.value))}
                  className="w-full accent-teal-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowObsModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow"
                >
                  Save &amp; Update Twin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
