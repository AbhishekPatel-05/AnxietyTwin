import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  History, 
  Trash2, 
  Heart, 
  Moon, 
  Coffee, 
  Activity, 
  RefreshCw, 
  Clock,
  Calendar,
  AlertCircle,
  Edit2,
  X,
  Check,
  Sparkles,
  Filter,
  Eye,
  EyeOff,
  Smile,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../services/api';
import { ProvenanceTag } from '../components/TwinStateBadge';
import { InterventionSession } from '../types';

export const HistoryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'physio' | 'lifestyle' | 'checkins' | 'interventions'>('all');
  const [loading, setLoading] = useState(true);
  const [interventionsData, setInterventionsData] = useState<InterventionSession[]>([]);
  const [loadingInterventions, setLoadingInterventions] = useState(false);
  const [periodDaysFilter, setPeriodDaysFilter] = useState<number>(14);
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>('all');
  const [signalTypeFilter, setSignalTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [provenanceFilter, setProvenanceFilter] = useState<string>('all');
  const [hideSimulated, setHideSimulated] = useState<boolean>(false);

  const [editingItem, setEditingItem] = useState<{
    type: 'physiological' | 'lifestyle' | 'checkin';
    item: any;
  } | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [data, setData] = useState<{
    physiological: any[];
    lifestyle: any[];
    checkins: any[];
  }>({
    physiological: [],
    lifestyle: [],
    checkins: [],
  });

  const loadInterventions = async () => {
    try {
      setLoadingInterventions(true);
      const res = await api.getInterventionsHistory({
        period_days: periodDaysFilter > 0 ? periodDaysFilter : undefined,
        activity_type: activityTypeFilter !== 'all' ? activityTypeFilter : undefined,
        signal_type: signalTypeFilter !== 'all' ? signalTypeFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        source_type: provenanceFilter !== 'all' ? provenanceFilter : undefined,
        hide_simulated: hideSimulated,
        limit: 100,
      });
      setInterventionsData(res);
    } catch (err) {
      console.error('Failed to load interventions history', err);
    } finally {
      setLoadingInterventions(false);
    }
  };

  const loadHistory = async () => {
    try {
      setLoading(true);
      const [res, intervRes] = await Promise.all([
        api.getObservationHistory(100),
        api.getInterventionsHistory({ hide_simulated: false, limit: 100 }).catch(() => []),
      ]);
      setData(res);
      setInterventionsData(intervRes);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (activeTab === 'interventions') {
      loadInterventions();
    }
  }, [activeTab, periodDaysFilter, activityTypeFilter, signalTypeFilter, statusFilter, provenanceFilter, hideSimulated]);

  const openEdit = (type: 'physiological' | 'lifestyle' | 'checkin', item: any) => {
    setEditingItem({ type, item });
    if (type === 'physiological') {
      setEditFormData({
        heart_rate_bpm: item.heart_rate_bpm,
        heart_rate_variability_ms: item.heart_rate_variability_ms ?? '',
        steps_count: item.steps_count ?? '',
      });
    } else if (type === 'lifestyle') {
      setEditFormData({
        sleep_hours: item.sleep_hours,
        caffeine_cups: item.caffeine_cups,
        exercise_minutes: item.exercise_minutes ?? 0,
      });
    } else if (type === 'checkin') {
      setEditFormData({
        subjective_anxiety_score: item.subjective_anxiety_score,
        triggers_noted: item.triggers_noted ?? '',
      });
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSavingEdit(true);
    try {
      if (editingItem.type === 'physiological') {
        await api.updatePhysiological(editingItem.item.id, {
          heart_rate_bpm: Number(editFormData.heart_rate_bpm),
          heart_rate_variability_ms: editFormData.heart_rate_variability_ms !== '' ? Number(editFormData.heart_rate_variability_ms) : undefined,
          steps_count: editFormData.steps_count !== '' ? Number(editFormData.steps_count) : undefined,
        });
      } else if (editingItem.type === 'lifestyle') {
        await api.updateLifestyle(editingItem.item.id, {
          sleep_hours: Number(editFormData.sleep_hours),
          caffeine_cups: Number(editFormData.caffeine_cups),
          exercise_minutes: Number(editFormData.exercise_minutes),
        });
      } else if (editingItem.type === 'checkin') {
        await api.updateCheckin(editingItem.item.id, {
          subjective_anxiety_score: Number(editFormData.subjective_anxiety_score),
          triggers_noted: editFormData.triggers_noted,
        });
      }
      setEditingItem(null);
      await loadHistory();
    } catch (err: any) {
      alert('Failed to update observation: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (type: 'physiological' | 'lifestyle' | 'checkin', id: number) => {
    if (!confirm('Are you sure you want to delete this record? This will recompute your Digital Twin baseline.')) return;
    try {
      await api.deleteObservation(type, id);
      await loadHistory();
    } catch (err: any) {
      alert('Failed to delete observation: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
      </div>
    );
  }

  const totalCount = data.physiological.length + data.lifestyle.length + data.checkins.length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Observation History</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Audit trial of all timestamped inputs contributing to your virtual patient model.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
          <History className="w-4 h-4 text-teal-400" />
          <span>Total Records: {totalCount}</span>
        </div>
      </div>

      {/* Cross-Link Banner to Longitudinal Baseline Evolution */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-950/60 via-slate-900/80 to-purple-950/50 border border-teal-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Longitudinal Baseline Evolution</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Review how your recorded personal baselines have evolved across historical observation windows.
            </p>
          </div>
        </div>
        <Link
          to="/simulation"
          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md transition-all shrink-0"
        >
          <span>View Evolution</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'all'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          All Observations ({totalCount})
        </button>
        <button
          onClick={() => setActiveTab('physio')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'physio'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Physiological ({data.physiological.length})
        </button>
        <button
          onClick={() => setActiveTab('lifestyle')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'lifestyle'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Lifestyle ({data.lifestyle.length})
        </button>
        <button
          onClick={() => setActiveTab('checkins')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'checkins'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Anxiety Check-Ins ({data.checkins.length})
        </button>
        <button
          onClick={() => setActiveTab('interventions')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
            activeTab === 'interventions'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-300" />
          <span>Early Warnings &amp; Coping ({interventionsData.length})</span>
        </button>
      </div>

      {/* Content list */}
      {activeTab === 'interventions' ? (
        <div className="space-y-6">
          {/* Transparent Non-diagnostic Callout */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-start space-x-3">
            <Sparkles className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white">Longitudinal Early Warning &amp; Coping Feedback Log</span>
              <p className="text-slate-400 leading-relaxed mt-0.5">
                Audit trail of detected heuristic pattern changes, supportive coping activities completed or dismissed, and voluntary pre- and post-distress ratings.
                <strong className="text-slate-300"> Observational correlation does not establish clinical causation.</strong>
              </p>
            </div>
          </div>

          {/* Multi-Dimensional Filter Bar */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Reporting Window */}
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 font-medium">Window:</span>
              {[7, 14, 30, 0].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setPeriodDaysFilter(days)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    periodDaysFilter === days
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {days === 0 ? 'All Time' : `Last ${days}d`}
                </button>
              ))}
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Activity Filter */}
              <div className="flex items-center space-x-1">
                <span className="text-slate-500 text-[11px]">Activity:</span>
                <select
                  value={activityTypeFilter}
                  onChange={(e) => setActivityTypeFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="all">All Activities</option>
                  <option value="breathing_478">4-7-8 Breathing</option>
                  <option value="grounding_54321">5-4-3-2-1 Grounding</option>
                  <option value="sleep_hygiene">Sleep Hygiene</option>
                  <option value="checkin_prompt">Check-in Prompt</option>
                </select>
              </div>

              {/* Signal Filter */}
              <div className="flex items-center space-x-1">
                <span className="text-slate-500 text-[11px]">Signal:</span>
                <select
                  value={signalTypeFilter}
                  onChange={(e) => setSignalTypeFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="all">All Signals</option>
                  <option value="elevated_heart_rate">Elevated Heart Rate</option>
                  <option value="reduced_hrv">Reduced HRV</option>
                  <option value="sleep_disruption">Sleep Disruption</option>
                  <option value="increased_distress">Elevated Distress</option>
                  <option value="composite_autonomic_strain">Composite Strain</option>
                  <option value="conflicting_observations">Conflicting Observations</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-1">
                <span className="text-slate-500 text-[11px]">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="recommended">Recommended</option>
                  <option value="abandoned">Abandoned</option>
                </select>
              </div>

              {/* Provenance Filter */}
              <div className="flex items-center space-x-1">
                <span className="text-slate-500 text-[11px]">Provenance:</span>
                <select
                  value={provenanceFilter}
                  onChange={(e) => setProvenanceFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="all">All Provenance</option>
                  <option value="measured">Measured (Device)</option>
                  <option value="user_reported">User Reported</option>
                  <option value="simulated">Simulated</option>
                </select>
              </div>

              {/* Hide Simulated Toggle */}
              <button
                type="button"
                onClick={() => setHideSimulated(!hideSimulated)}
                className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
                  hideSimulated
                    ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                {hideSimulated ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{hideSimulated ? 'Simulated Hidden' : 'Showing Simulated'}</span>
              </button>
            </div>
          </div>

          {/* Interventions Stream */}
          {loadingInterventions ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
              Loading coping interventions and feedback...
            </div>
          ) : interventionsData.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <Clock className="w-8 h-8 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-white">No Coping Interventions Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No sessions match the selected filter criteria. You can explore supportive activities anytime in the Early Warnings page.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {interventionsData.map((session) => {
                const actName =
                  session.intervention_type === 'breathing_478'
                    ? '4-7-8 Breathing Pacer'
                    : session.intervention_type === 'grounding_54321'
                    ? '5-4-3-2-1 Sensory Grounding'
                    : session.intervention_type === 'sleep_hygiene'
                    ? 'Circadian Sleep Hygiene'
                    : session.intervention_type === 'checkin_prompt'
                    ? 'Contextual Check-in'
                    : session.intervention_type;

                const isCompleted = session.status === 'completed';
                const isDismissed = session.status === 'dismissed';

                return (
                  <div
                    key={session.id}
                    className={`p-4 rounded-xl border transition ${
                      isDismissed
                        ? 'bg-slate-900/40 border-slate-800/60 opacity-80'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/70 pb-2.5 mb-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white">{actName}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          isCompleted
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : isDismissed
                            ? 'bg-slate-800 text-slate-400 border border-slate-700'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {session.status}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-slate-800 text-slate-400">
                          {session.source_type}
                        </span>
                        {session.trigger_signal && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            Trigger: {session.trigger_signal}
                          </span>
                        )}
                      </div>

                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(session.started_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>

                    {/* Context Snapshot if available */}
                    {session.context_snapshot && (
                      <div className="flex flex-wrap gap-2 text-[11px] mb-2 font-mono">
                        {Object.entries(session.context_snapshot).map(([k, v]) => (
                          <span key={k} className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                            {k}: <strong className="text-teal-300">{String(v)}</strong>
                          </span>
                        ))}
                      </div>
                    )}

                    {session.user_notes && (
                      <p className="text-xs text-slate-300 italic mb-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                        "{session.user_notes}"
                      </p>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs">
                      <div className="flex items-center space-x-3">
                        {session.pre_distress_rating !== null && session.post_distress_rating !== null && (
                          <div className="flex items-center space-x-1.5 font-mono text-[11px]">
                            <span className="text-slate-400">
                              Distress: {session.pre_distress_rating} → {session.post_distress_rating}
                            </span>
                            {session.rating_delta !== null && session.rating_delta !== undefined && (
                              <span className={`px-1.5 py-0.5 rounded font-bold ${
                                session.rating_delta < 0
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : session.rating_delta > 0
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-slate-800 text-slate-400'
                              }`}>
                                Δ {session.rating_delta > 0 ? `+${session.rating_delta}` : session.rating_delta}
                              </span>
                            )}
                          </div>
                        )}

                        {session.helpfulness && (
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${
                            session.helpfulness === 'helpful'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {session.helpfulness.replace('_', ' ')}
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-500 italic">
                        Observational correlation does not establish clinical causation.
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : totalCount === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <Clock className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No Historical Observations Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You can record new measurements from the dashboard or check-in page.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Physiological records */}
          {(activeTab === 'all' || activeTab === 'physio') && data.physiological.map((p) => (
            <div key={`p-${p.id}`} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                  <Heart className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white">Heart Rate: {p.heart_rate_bpm} BPM</span>
                    {p.heart_rate_variability_ms && (
                      <span className="text-xs text-teal-300 font-mono">| HRV: {p.heart_rate_variability_ms} ms</span>
                    )}
                    {p.steps_count && (
                      <span className="text-xs text-slate-400 font-mono">| Steps: {p.steps_count}</span>
                    )}
                    <ProvenanceTag source={p.source_type} />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {new Date(p.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => openEdit('physiological', p)}
                  title="Edit observation"
                  className="p-2 text-slate-500 hover:text-teal-400 rounded-lg hover:bg-teal-500/10 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete('physiological', p.id)}
                  title="Delete observation"
                  className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Lifestyle records */}
          {(activeTab === 'all' || activeTab === 'lifestyle') && data.lifestyle.map((l) => (
            <div key={`l-${l.id}`} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white">Sleep: {l.sleep_hours} hrs</span>
                    <span className="text-xs text-amber-300 font-mono">| Caffeine: {l.caffeine_cups} cups</span>
                    {l.exercise_minutes > 0 && (
                      <span className="text-xs text-emerald-300 font-mono">| Exercise: {l.exercise_minutes} min</span>
                    )}
                    <ProvenanceTag source={l.source_type} />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Date: {l.date}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => openEdit('lifestyle', l)}
                  title="Edit observation"
                  className="p-2 text-slate-500 hover:text-teal-400 rounded-lg hover:bg-teal-500/10 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete('lifestyle', l.id)}
                  title="Delete observation"
                  className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Check-ins */}
          {(activeTab === 'all' || activeTab === 'checkins') && data.checkins.map((c) => (
            <div key={`c-${c.id}`} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white">Anxiety Score: {c.subjective_anxiety_score}/10</span>
                    {c.triggers_noted && (
                      <span className="text-xs text-slate-300">({c.triggers_noted})</span>
                    )}
                    <ProvenanceTag source={c.source_type} />
                  </div>
                  {c.somatic_symptoms && c.somatic_symptoms.length > 0 && (
                    <p className="text-[11px] text-teal-300 mt-0.5">
                      Symptoms: {c.somatic_symptoms.join(', ')}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {new Date(c.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => openEdit('checkin', c)}
                  title="Edit check-in"
                  className="p-2 text-slate-500 hover:text-teal-400 rounded-lg hover:bg-teal-500/10 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete('checkin', c.id)}
                  title="Delete check-in"
                  className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Observation Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-teal-400" />
                <span>
                  Edit {editingItem.type === 'physiological' ? 'Physiological Record' : editingItem.type === 'lifestyle' ? 'Lifestyle Record' : 'Check-In Record'}
                </span>
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {editingItem.type === 'physiological' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Heart Rate (BPM)</label>
                    <input
                      type="number"
                      min="30"
                      max="240"
                      required
                      value={editFormData.heart_rate_bpm ?? ''}
                      onChange={(e) => setEditFormData({ ...editFormData, heart_rate_bpm: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">HRV RMSSD (ms, optional)</label>
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={editFormData.heart_rate_variability_ms ?? ''}
                      onChange={(e) => setEditFormData({ ...editFormData, heart_rate_variability_ms: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Steps Count (optional)</label>
                    <input
                      type="number"
                      min="0"
                      max="100000"
                      value={editFormData.steps_count ?? ''}
                      onChange={(e) => setEditFormData({ ...editFormData, steps_count: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </>
              )}

              {editingItem.type === 'lifestyle' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Sleep Duration (hours)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      required
                      value={editFormData.sleep_hours ?? ''}
                      onChange={(e) => setEditFormData({ ...editFormData, sleep_hours: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Caffeine (cups)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="20"
                      required
                      value={editFormData.caffeine_cups ?? ''}
                      onChange={(e) => setEditFormData({ ...editFormData, caffeine_cups: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Exercise (minutes)</label>
                    <input
                      type="number"
                      min="0"
                      max="720"
                      value={editFormData.exercise_minutes ?? 0}
                      onChange={(e) => setEditFormData({ ...editFormData, exercise_minutes: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </>
              )}

              {editingItem.type === 'checkin' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Subjective Anxiety Rating (0-10)</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      required
                      value={editFormData.subjective_anxiety_score ?? ''}
                      onChange={(e) => setEditFormData({ ...editFormData, subjective_anxiety_score: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Triggers Noted</label>
                    <input
                      type="text"
                      value={editFormData.triggers_noted ?? ''}
                      onChange={(e) => setEditFormData({ ...editFormData, triggers_noted: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </>
              )}

              <p className="text-[11px] text-slate-400">
                Saving updates this observation and recomputes your Digital Twin state and baselines.
              </p>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-600/20 flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {savingEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
