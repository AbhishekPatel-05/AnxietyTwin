import React, { useState, useEffect } from 'react';
import {
  Target,
  Plus,
  CheckCircle2,
  Clock,
  Sparkles,
  Pause,
  Play,
  Trash2,
  Edit2,
  Calendar,
  Activity,
  Heart,
  Moon,
  Wind,
  BookOpen,
  Info,
  AlertCircle,
  ThumbsUp,
  RefreshCw,
  X,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { WellnessGoal, WellnessGoalCreate, GoalSuggestion, WeeklyCarePlanSummary } from '../types';

const CATEGORY_META: Record<string, { label: string; icon: any; color: string }> = {
  checkin: { label: 'Daily Check-in', icon: Heart, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  sleep_routine: { label: 'Sleep Routine', icon: Moon, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  breathing: { label: 'Breathing Exercise', icon: Wind, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  grounding: { label: 'Grounding Routine', icon: Sparkles, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  journaling: { label: 'Emotion Journaling', icon: BookOpen, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  physical_activity: { label: 'Physical Activity', icon: Activity, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
};

export const WellnessGoalsPage: React.FC = () => {
  const [goals, setGoals] = useState<WellnessGoal[]>([]);
  const [carePlan, setCarePlan] = useState<WeeklyCarePlanSummary | null>(null);
  const [suggestions, setSuggestions] = useState<GoalSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newGoal, setNewGoal] = useState<WellnessGoalCreate>({
    title: '',
    description: '',
    category: 'checkin',
    target_frequency: 'weekly',
    target_count: 5,
    start_date: new Date().toISOString().split('T')[0],
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [goalsRes, planRes, suggestionsRes] = await Promise.all([
        api.getGoals(),
        api.getWeeklyCarePlanSummary(),
        api.getGoalSuggestions(),
      ]);
      setGoals(goalsRes);
      setCarePlan(planRes);
      setSuggestions(suggestionsRes);
    } catch (err: any) {
      console.error('Failed to load goals data', err);
      setError(err.message || 'Failed to load wellness goals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.title.trim()) return;

    try {
      setSubmitting(true);
      await api.createGoal(newGoal);
      setShowCreateModal(false);
      setNewGoal({
        title: '',
        description: '',
        category: 'checkin',
        target_frequency: 'weekly',
        target_count: 5,
        start_date: new Date().toISOString().split('T')[0],
      });
      setSuccessMessage('Wellness goal created successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchData();
    } catch (err: any) {
      alert('Failed to create goal: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdoptSuggestion = async (s: GoalSuggestion) => {
    try {
      await api.createGoal({
        title: s.title,
        description: s.description,
        category: s.category,
        target_frequency: s.target_frequency,
        target_count: s.target_count,
        start_date: new Date().toISOString().split('T')[0],
      });
      setSuccessMessage(`Adopted suggestion: "${s.title}"!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchData();
    } catch (err: any) {
      alert('Failed to adopt suggestion: ' + err.message);
    }
  };

  const handleToggleStatus = async (goal: WellnessGoal) => {
    const nextStatus = goal.status === 'active' ? 'paused' : 'active';
    try {
      await api.updateGoal(goal.id, { status: nextStatus });
      setSuccessMessage(`Goal status set to ${nextStatus}.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchData();
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleDeleteGoal = async (id: number) => {
    if (!confirm('Are you sure you want to remove this wellness goal?')) return;
    try {
      await api.deleteGoal(id);
      setSuccessMessage('Goal removed.');
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchData();
    } catch (err: any) {
      alert('Failed to delete goal: ' + err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shadow-lg shadow-teal-500/10">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Personalized Wellness Goals & Care Plan</h1>
              <p className="text-xs text-slate-400">
                Transform personal insights into voluntary, supportive self-care routines.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white text-sm font-semibold shadow-lg shadow-teal-500/20 hover:from-teal-400 hover:to-emerald-500 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Set New Goal</span>
        </button>
      </div>

      {/* Voluntary Care Notice */}
      <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-200 text-xs flex items-start space-x-3 leading-relaxed shadow-sm">
        <Info className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-teal-300">Self-Care Autonomy Notice:</strong> All wellness goals are voluntary, editable, and designed to support personal agency. Missed days are normal and never penalized. Wellness goals connect directly to your existing check-in and intervention records and are distinct from clinician medical prescriptions.
        </div>
      </div>

      {successMessage && (
        <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Weekly Care Plan Summary Banner */}
      {carePlan && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider font-mono">
                Current Week Overview ({carePlan.week_start} to {carePlan.week_end})
              </span>
              <h2 className="text-lg font-bold text-white">Weekly Care Plan Progress</h2>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-xs text-slate-400">Completion Pace:</span>
              <span className="text-sm font-bold font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                {carePlan.completion_rate_pct.toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-xs text-slate-400">Active Goals</div>
              <div className="text-2xl font-bold text-white mt-1 font-mono">
                {carePlan.planned_goals_count}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Monitored routine intentions</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-xs text-slate-400">Completed Activities</div>
              <div className="text-2xl font-bold text-teal-400 mt-1 font-mono">
                {carePlan.total_completed_activities} <span className="text-xs text-slate-400">/ {carePlan.total_planned_activities}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Logged check-ins & exercises</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-xs text-slate-400">Coping Helpfulness</div>
              <div className="text-sm font-bold text-slate-200 mt-1">
                {Object.keys(carePlan.user_helpfulness_summary || {}).length > 0
                  ? `${Object.values(carePlan.user_helpfulness_summary).reduce((a, b) => a + b, 0)} rated helpful`
                  : 'No ratings logged yet'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">From post-exercise feedback</p>
            </div>
          </div>

          {carePlan.supportive_message && (
            <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-300 italic flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
              <span>{carePlan.supportive_message}</span>
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Goals List on Left, Suggestions on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Goals List (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Your Wellness Goals ({goals.length})</h2>
            <span className="text-xs text-slate-400 font-mono">
              {goals.filter((g) => g.status === 'active').length} Active
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
              Loading goals...
            </div>
          ) : goals.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
              <Target className="w-8 h-8 text-slate-500 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-300">No Wellness Goals Set Yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Setting a modest, consistent goal helps build mindful self-regulation routines at your own pace.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-teal-600/30 text-teal-300 border border-teal-500/40 text-xs font-medium hover:bg-teal-600/50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Your First Goal</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map((g) => {
                const meta = CATEGORY_META[g.category] || CATEGORY_META.checkin;
                const Icon = meta.icon;
                const progressPct = Math.min(100, Math.round((g.current_week_progress / (g.current_week_target || 1)) * 100));

                return (
                  <div
                    key={g.id}
                    className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-md hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start space-x-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${meta.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-bold text-white">{g.title}</h3>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-mono ${
                              g.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {g.status}
                            </span>
                          </div>
                          {g.description && (
                            <p className="text-xs text-slate-400 leading-relaxed">{g.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => handleToggleStatus(g)}
                          title={g.status === 'active' ? 'Pause Goal' : 'Resume Goal'}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                        >
                          {g.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleDeleteGoal(g.id)}
                          title="Delete Goal"
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar & Counter */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400">
                          This week: <strong className="text-white">{g.current_week_progress}</strong> of {g.current_week_target} {g.target_frequency}
                        </span>
                        <span className={g.is_on_track ? 'text-emerald-400' : 'text-slate-400'}>
                          {progressPct}% Completed
                        </span>
                      </div>

                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            progressPct >= 100
                              ? 'bg-emerald-500'
                              : 'bg-gradient-to-r from-teal-500 to-emerald-400'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Evidence-based Goal Suggestions (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span>Suggested Intentions</span>
            </h2>
            <span className="text-xs text-slate-400">Based on your history</span>
          </div>

          <div className="space-y-3">
            {suggestions.map((s, idx) => {
              const meta = CATEGORY_META[s.category] || CATEGORY_META.checkin;
              const Icon = meta.icon;

              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${meta.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="text-xs font-bold text-white">{s.title}</h3>
                    </div>
                    <span className="text-[10px] font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20 shrink-0">
                      {s.target_count}x/{s.target_frequency}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">{s.description}</p>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500 italic truncate max-w-[220px]">
                      {s.rationale}
                    </p>
                    <button
                      onClick={() => handleAdoptSuggestion(s)}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-teal-600/20 text-teal-300 border border-teal-500/30 text-xs font-medium hover:bg-teal-600/40 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Adopt Goal</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Goal Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Target className="w-5 h-5 text-teal-400" />
                <span>Create Voluntary Wellness Goal</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Goal Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Evening Box Breathing Routine"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                <select
                  value={newGoal.category}
                  onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="checkin">Daily Check-in</option>
                  <option value="sleep_routine">Sleep & Wind-down Routine</option>
                  <option value="breathing">Breathing Exercise</option>
                  <option value="grounding">Grounding Routine</option>
                  <option value="journaling">Emotion Journaling</option>
                  <option value="physical_activity">Mindful Physical Activity</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Why is this routine meaningful to you?"
                  value={newGoal.description || ''}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Frequency</label>
                  <select
                    value={newGoal.target_frequency}
                    onChange={(e) => setNewGoal({ ...newGoal, target_frequency: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="weekly">Weekly Target</option>
                    <option value="daily">Daily Target</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Target Times ({newGoal.target_frequency})</label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={newGoal.target_count}
                    onChange={(e) => setNewGoal({ ...newGoal, target_count: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
