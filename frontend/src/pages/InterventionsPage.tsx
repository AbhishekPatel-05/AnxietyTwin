import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Wind,
  Eye,
  Moon,
  Heart,
  Sliders,
  Filter,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  Plus
} from 'lucide-react';
import { api } from '../services/api';
import {
  InterventionsStatusResponse,
  InterventionSession,
  EarlyWarningSignal,
  BaselineComparisonMetric,
  InterventionRecommendation,
} from '../types';
import { InteractiveInterventionModal } from '../components/InteractiveInterventionModal';

export const InterventionsPage: React.FC = () => {
  const [statusData, setStatusData] = useState<InterventionsStatusResponse | null>(null);
  const [history, setHistory] = useState<InterventionSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<'matrix' | 'recommendations' | 'history'>('matrix');
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [signalTypeFilter, setSignalTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all');
  const [hideSimulated, setHideSimulated] = useState<boolean>(true);
  const [dismissedRecIds, setDismissedRecIds] = useState<Set<string>>(new Set());

  // Interactive Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedActivity, setSelectedActivity] = useState<
    'breathing_478' | 'grounding_54321' | 'sleep_hygiene' | 'checkin_prompt' | null
  >('breathing_478');
  const [activeTriggerSignal, setActiveTriggerSignal] = useState<string>('user_initiated');

  // Evidence Drawer / Inspection State
  const [expandedSignalId, setExpandedSignalId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statusRes, historyRes] = await Promise.all([
        api.getInterventionsStatus(72),
        api.getInterventionsHistory({
          period_days: periodDays,
          activity_type: activityFilter !== 'all' ? activityFilter : undefined,
          signal_type: signalTypeFilter !== 'all' ? signalTypeFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          source_type: sourceTypeFilter !== 'all' ? sourceTypeFilter : undefined,
          hide_simulated: hideSimulated,
        }),
      ]);
      setStatusData(statusRes);
      setHistory(historyRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load early-warning status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [periodDays, activityFilter, signalTypeFilter, statusFilter, sourceTypeFilter, hideSimulated]);

  const handleLaunchActivity = (
    actType: 'breathing_478' | 'grounding_54321' | 'sleep_hygiene' | 'checkin_prompt',
    triggerSig: string = 'user_initiated'
  ) => {
    setSelectedActivity(actType);
    setActiveTriggerSignal(triggerSig);
    setModalOpen(true);
  };

  const handleDismissActivity = async (rec: InterventionRecommendation) => {
    try {
      await api.recordIntervention({
        intervention_type: rec.intervention_type,
        trigger_signal: rec.trigger_signal_id || 'recommendation_panel',
        status: 'dismissed',
        user_notes: 'Dismissed by user from supportive activity panel',
        source_type: 'user_entered',
        context_snapshot: {
          dismissed_recommendation: rec.title,
          rational_summary: rec.rational_summary,
        },
      });
      setDismissedRecIds((prev) => new Set(prev).add(rec.id));
      const historyRes = await api.getInterventionsHistory({
        period_days: periodDays,
        activity_type: activityFilter !== 'all' ? activityFilter : undefined,
        signal_type: signalTypeFilter !== 'all' ? signalTypeFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        source_type: sourceTypeFilter !== 'all' ? sourceTypeFilter : undefined,
        hide_simulated: hideSimulated,
      });
      setHistory(historyRes);
    } catch (err: any) {
      console.error('Failed to dismiss activity', err);
    }
  };

  const handleModalCompleted = (newSession: InterventionSession) => {
    setHistory((prev) => [newSession, ...prev]);
    // Refresh status to reflect newly updated checkin context
    api.getInterventionsStatus(72).then(setStatusData).catch(() => {});
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ------------------------------------------------------------- */}
      {/* 1. Header & Disclaimers */}
      {/* ------------------------------------------------------------- */}
      <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center space-x-2">
              <span>Early-Warning & Personalized Interventions</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-teal-500/10 text-teal-300 border border-teal-500/30">
              {statusData?.baseline_status || 'Digital Twin Calibrated'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Rule-based early-warning signal detection comparing recent observations against your empirical baseline,
            paired with personalized evidence-based coping exercises and post-activity feedback reflection.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => handleLaunchActivity('breathing_478')}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white text-xs font-bold shadow-lg shadow-teal-500/20 transition-all flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Start Supportive Activity</span>
          </button>
        </div>
      </div>

      {/* Mandatory Scientific Non-Causal Disclosure Banner */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-start space-x-3">
        <Info className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-200">
            Scientific Protocol & Non-Diagnostic Disclosure
          </p>
          <p className="text-slate-400 leading-relaxed">
            Early-warning indicators are computed from transparent empirical rules comparing recent observations with your personal baseline.
            <b> Observational association does not establish clinical causation.</b> These indicators are experimental wellness tools, not medical diagnoses
            or predictions of imminent panic attacks.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. Navigation Tabs */}
      {/* ------------------------------------------------------------- */}
      <div className="flex space-x-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 self-start">
        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'matrix'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-900/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-teal-300" />
          <span>Baseline Matrix & Early Warnings</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('recommendations')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'recommendations'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-900/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-300" />
          <span>Supportive Recommendations ({statusData?.recommendations?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'history'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-900/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-teal-300" />
          <span>Intervention Feedback History ({history.length})</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: BASELINE MATRIX & EARLY WARNINGS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'matrix' && (
        <div className="space-y-8">
          {/* Section A: 6 Baseline Comparison Cards */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <span>Personalized Baseline Comparison Matrix</span>
              <span className="text-slate-500 text-xs font-normal lowercase">(vs personal empirical baseline)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {statusData?.metrics?.map((m) => {
                const isDetected = m.status === 'change_detected';
                const isInsuff = m.status === 'insufficient_data';
                return (
                  <div
                    key={m.metric_key}
                    className={`p-5 rounded-2xl border transition-all ${
                      isDetected
                        ? 'bg-amber-500/10 border-amber-500/30 shadow-md shadow-amber-950/20'
                        : isInsuff
                        ? 'bg-slate-900/50 border-slate-800/80 opacity-80'
                        : 'bg-slate-900/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">{m.metric_name}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          isDetected
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : isInsuff
                            ? 'bg-slate-800 text-slate-400 border border-slate-700'
                            : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {isDetected ? 'Change Detected' : isInsuff ? 'Calibrating' : 'Within Range'}
                      </span>
                    </div>

                    <div className="mt-4 flex items-baseline justify-between">
                      <div>
                        <div className="text-2xl font-black font-mono text-white">
                          {m.current_value !== null && m.current_value !== undefined
                            ? `${m.current_value} ${m.unit}`
                            : 'No reading'}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 font-mono">
                          Baseline:{' '}
                          {m.baseline_value !== null && m.baseline_value !== undefined
                            ? `${m.baseline_value} ${m.unit}`
                            : 'Uncalibrated'}
                        </div>
                      </div>

                      {m.delta_value !== null && m.delta_value !== undefined && (
                        <div
                          className={`flex items-center space-x-1 font-mono font-bold text-xs px-2.5 py-1 rounded-lg ${
                            isDetected
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {m.delta_value > 0 ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : m.delta_value < 0 ? (
                            <TrendingDown className="w-3.5 h-3.5" />
                          ) : (
                            <Minus className="w-3.5 h-3.5" />
                          )}
                          <span>{m.delta_value > 0 ? `+${m.delta_value}` : m.delta_value}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>Records: {m.observations_count}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          m.provenance === 'measured'
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            : m.provenance === 'simulated'
                            ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        Source: {m.provenance.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section B: Early-Warning Signal Cards */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <span>Detected Early-Warning Signals ({statusData?.signals?.length || 0})</span>
            </h2>

            <div className="space-y-3">
              {statusData?.signals?.map((sig) => {
                const isChange = sig.level === 'Change Detected';
                const isExpanded = expandedSignalId === sig.signal_id;

                return (
                  <div
                    key={sig.signal_id}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isChange
                        ? 'bg-slate-900 border-amber-500/40 shadow-lg shadow-amber-950/20'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2.5">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              isChange
                                ? 'bg-amber-400 animate-pulse'
                                : sig.level === 'Insufficient Data'
                                ? 'bg-slate-500'
                                : 'bg-emerald-400'
                            }`}
                          />
                          <h3 className="text-sm font-bold text-white">{sig.title}</h3>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              isChange
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : sig.level === 'Insufficient Data'
                                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {sig.level}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">
                            Rule-Based Indicator
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                            sig.data_provenance === 'measured'
                              ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                              : sig.data_provenance === 'simulated'
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                              : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                          }`}>
                            {sig.data_provenance}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">{sig.what_changed}</p>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {isChange && (
                          <button
                            type="button"
                            onClick={() =>
                              handleLaunchActivity(
                                sig.suggested_intervention_type as any,
                                sig.signal_type
                              )
                            }
                            className="px-3.5 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-teal-300 text-xs font-semibold transition"
                          >
                            Launch Activity
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setExpandedSignalId(isExpanded ? null : sig.signal_id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition flex items-center space-x-1"
                        >
                          <span>{isExpanded ? 'Hide Evidence' : 'View Evidence'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Supporting Records Drawer */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-2 border-t border-slate-800/80 bg-slate-950/40 space-y-3 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider">
                              Why it was flagged:
                            </span>
                            <p className="text-slate-300">{sig.why_flagged}</p>

                            <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider block pt-1">
                              Evidence Comparison:
                            </span>
                            <p className="text-teal-300 font-mono text-[11px]">{sig.evidence_summary}</p>
                          </div>

                          <div className="space-y-1.5">
                            <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider">
                              Supporting Record IDs:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {sig.supporting_record_ids.length > 0 ? (
                                sig.supporting_record_ids.map((id) => (
                                  <span
                                    key={id}
                                    className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] text-slate-300"
                                  >
                                    {id}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-500 font-mono text-[11px]">No specific records</span>
                              )}
                            </div>

                            <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider block pt-1">
                              Data Provenance & Quality:
                            </span>
                            <p className="text-slate-400 font-mono text-[11px]">
                              {sig.data_quality} (Provenance: {sig.data_provenance})
                            </p>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                          <b>Non-Causal Note:</b> {sig.limitations}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: PERSONALIZED RECOMMENDATIONS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Evidence-Based Supportive Activity Recommendations
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Activities prioritized dynamically based on detected autonomic tone, circadian debt, or subjective tension.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {statusData?.recommendations?.map((rec) => {
              const isHigh = rec.priority === 'high';
              const isDismissed = dismissedRecIds.has(rec.id);
              return (
                <div
                  key={rec.id}
                  className={`p-6 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                    isDismissed
                      ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                      : isHigh
                      ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/30 border-teal-500/40 shadow-lg shadow-teal-950/20'
                      : 'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {rec.intervention_type === 'breathing_478' ? (
                          <Wind className="w-5 h-5 text-teal-400" />
                        ) : rec.intervention_type === 'grounding_54321' ? (
                          <Eye className="w-5 h-5 text-indigo-400" />
                        ) : rec.intervention_type === 'sleep_hygiene' ? (
                          <Moon className="w-5 h-5 text-purple-400" />
                        ) : (
                          <Sparkles className="w-5 h-5 text-emerald-400" />
                        )}
                        <h3 className="text-sm font-bold text-white">{rec.title}</h3>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          isHigh
                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {rec.priority} Priority &bull; ~{rec.estimated_duration_min} min
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{rec.description}</p>

                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                      <span className="font-semibold text-slate-300">Why offered:</span>
                      <p>{rec.rational_summary}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {rec.is_medical ? 'Medical' : 'Wellness Support • Non-Prescription'}
                    </span>

                    {isDismissed ? (
                      <span className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 text-xs font-mono">
                        Dismissed
                      </span>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleDismissActivity(rec)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold border border-slate-700 transition"
                          title="Dismiss recommendation"
                        >
                          Dismiss
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleLaunchActivity(
                              rec.intervention_type as any,
                              rec.trigger_signal_id || 'recommendation_panel'
                            )
                          }
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white text-xs font-bold shadow-md shadow-teal-500/20 transition-all flex items-center space-x-1.5"
                        >
                          <span>Start Exercise</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: LONGITUDINAL FEEDBACK HISTORY */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Filtering Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Filter History:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={periodDays}
                onChange={(e) => setPeriodDays(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none"
              >
                <option value={7}>Last 7 Days</option>
                <option value={14}>Last 14 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={90}>Last 90 Days</option>
                <option value={365}>All History (1 Year)</option>
              </select>

              <select
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none"
              >
                <option value="all">All Activities</option>
                <option value="breathing_478">4-7-8 Breathing</option>
                <option value="grounding_54321">5-4-3-2-1 Grounding</option>
                <option value="sleep_hygiene">Sleep Hygiene</option>
                <option value="checkin_prompt">Check-In</option>
              </select>

              <select
                value={signalTypeFilter}
                onChange={(e) => setSignalTypeFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none"
              >
                <option value="all">All Trigger Signals</option>
                <option value="elevated_heart_rate">Elevated HR</option>
                <option value="reduced_hrv">Reduced HRV</option>
                <option value="disrupted_sleep">Disrupted Sleep</option>
                <option value="increased_distress">Distress Surge</option>
                <option value="composite_autonomic_strain">Composite Strain</option>
                <option value="conflicting_observations">Conflicting Observations</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="dismissed">Dismissed</option>
              </select>

              <select
                value={sourceTypeFilter}
                onChange={(e) => setSourceTypeFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none"
              >
                <option value="all">All Sources</option>
                <option value="measured">Measured</option>
                <option value="user_entered">User-Reported</option>
                <option value="simulated">Simulated</option>
              </select>

              <label className="flex items-center space-x-2 text-xs text-slate-300 ml-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideSimulated}
                  onChange={(e) => setHideSimulated(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-teal-500 focus:ring-0"
                />
                <span>Hide Simulated</span>
              </label>
            </div>
          </div>

          {/* History List */}
          {history.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
              <Clock className="w-8 h-8 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-white">No Intervention Sessions Recorded</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Completed supportive exercises and their before-and-after distress ratings will be tracked here.
              </p>
              <button
                type="button"
                onClick={() => handleLaunchActivity('breathing_478')}
                className="px-4 py-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/40 text-xs font-semibold hover:bg-teal-500/30 transition"
              >
                Record First Activity
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((h) => {
                const actName =
                  h.intervention_type === 'breathing_478'
                    ? '4-7-8 Breathing Pacer'
                    : h.intervention_type === 'grounding_54321'
                    ? '5-4-3-2-1 Sensory Grounding'
                    : h.intervention_type === 'sleep_hygiene'
                    ? 'Circadian Sleep Hygiene'
                    : h.intervention_type === 'checkin_prompt'
                    ? 'Subjective Check-In'
                    : h.intervention_type.replace('_', ' ').toUpperCase();

                const delta = h.rating_delta;
                const isDismissed = h.status === 'dismissed';

                return (
                  <div
                    key={h.id}
                    className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                        <span className="text-xs font-bold text-white">{actName}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            isDismissed
                              ? 'bg-slate-800 text-slate-400 border border-slate-700'
                              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {h.status}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(h.started_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} at{' '}
                          {new Date(h.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                            h.source_type === 'measured'
                              ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                              : h.source_type === 'simulated'
                              ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {h.source_type}
                        </span>
                        {h.trigger_signal && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                            Trigger: {h.trigger_signal.replace('_', ' ')}
                          </span>
                        )}
                      </div>

                      {h.user_notes && (
                        <p className="text-xs text-slate-300 italic">"{h.user_notes}"</p>
                      )}

                      {h.context_snapshot && (
                        <div className="text-[11px] text-slate-400 font-mono pt-1">
                          {h.context_snapshot.dismissed_recommendation && (
                            <span>Dismissed: {h.context_snapshot.dismissed_recommendation}</span>
                          )}
                          {h.context_snapshot.resting_hr && (
                            <span>Snapshot HR: {h.context_snapshot.resting_hr} BPM</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-4 shrink-0">
                      {h.pre_distress_rating !== null && h.post_distress_rating !== null && (
                        <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center space-x-2 text-xs font-mono">
                          <span className="text-slate-400">Pre: <b>{h.pre_distress_rating}/10</b></span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                          <span className="text-slate-400">Post: <b>{h.post_distress_rating}/10</b></span>
                          {delta !== null && delta !== undefined && (
                            <span
                              className={`px-2 py-0.5 rounded font-bold ${
                                delta < 0
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : delta === 0
                                  ? 'bg-slate-800 text-slate-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              Δ {delta > 0 ? `+${delta}` : delta}
                            </span>
                          )}
                        </div>
                      )}

                      {h.helpfulness && (
                        <span className="px-2.5 py-1 rounded-xl text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {h.helpfulness.replace('_', ' ').toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. Interactive Coping & Feedback Modal */}
      {/* ------------------------------------------------------------- */}
      <InteractiveInterventionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialActivity={selectedActivity}
        triggerSignal={activeTriggerSignal}
        onCompleted={handleModalCompleted}
      />
    </div>
  );
};
