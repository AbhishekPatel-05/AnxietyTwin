import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Sparkles, 
  ShieldAlert, 
  CheckCircle2, 
  Wind, 
  HelpCircle,
  Play, 
  Pause,
  AlertCircle,
  Moon,
  Coffee,
  Activity,
  History,
  Trash2,
  Edit2,
  Calendar,
  Clock,
  ArrowRight,
  RefreshCw,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { AnxietyCheckin } from '../types';
import { BreathingPacer } from '../components/BreathingPacer';

const SOMATIC_OPTIONS = [
  'Chest Tightness',
  'Heart Palpitations / Racing Heart',
  'Trembling or Shaking',
  'Shortness of Breath',
  'Dizziness / Lightheadedness',
  'Sweating / Cold Chills',
  'Nausea / Stomach Distress',
  'Muscle Tension',
];

const TRIGGER_OPTIONS = [
  'Work / Study Pressure',
  'Social Interaction',
  'Poor Sleep / Fatigue',
  'Excess Caffeine Intake',
  'Health Anxiety / Physical Sensations',
  'Interpersonal Conflict',
  'Sudden Unidentified Surge',
  'None / Routine Check-In',
];

export const CheckinPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  
  // Unified Check-in Form fields
  const [score, setScore] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [sleepHours, setSleepHours] = useState(7.5);
  const [caffeineCups, setCaffeineCups] = useState(1.0);
  const [stepsCount, setStepsCount] = useState<number | ''>(5500);
  const [heartRate, setHeartRate] = useState<number | ''>('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedTrigger, setSelectedTrigger] = useState<string>('');
  const [notes, setNotes] = useState('');
  
  // UI states
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Historical check-ins state
  const [historyList, setHistoryList] = useState<AnxietyCheckin[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingCheckin, setEditingCheckin] = useState<AnxietyCheckin | null>(null);

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const items = await api.getCheckins(30);
      setHistoryList(items);
    } catch (err: any) {
      console.warn('Failed to load check-ins', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const toggleSymptom = (sym: string) => {
    if (selectedSymptoms.includes(sym)) {
      setSelectedSymptoms(selectedSymptoms.filter((s) => s !== sym));
    } else {
      setSelectedSymptoms([...selectedSymptoms, sym]);
    }
  };

  const handleCheckinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.createCheckin({
        subjective_anxiety_score: Number(score),
        energy_level: Number(energy),
        somatic_symptoms: selectedSymptoms,
        triggers_noted: selectedTrigger,
        notes,
        sleep_hours: Number(sleepHours),
        caffeine_cups: Number(caffeineCups),
        heart_rate_bpm: heartRate ? Number(heartRate) : undefined,
        steps_count: stepsCount ? Number(stepsCount) : undefined,
      });

      setResult(res);
      await fetchHistory();
    } catch (err: any) {
      setError(err.message || 'Failed to save check-in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCheckin = async (id: number) => {
    if (!confirm('Are you sure you want to delete this check-in record? This will update your Digital Twin baseline.')) return;
    try {
      await api.deleteCheckin(id);
      await fetchHistory();
    } catch (err: any) {
      alert('Failed to delete check-in: ' + err.message);
    }
  };

  const handleUpdateCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCheckin) return;
    try {
      await api.updateCheckin(editingCheckin.id, {
        subjective_anxiety_score: editingCheckin.subjective_anxiety_score,
        energy_level: editingCheckin.energy_level,
        triggers_noted: editingCheckin.triggers_noted,
        notes: editingCheckin.notes,
      });
      setEditingCheckin(null);
      await fetchHistory();
    } catch (err: any) {
      alert('Failed to update check-in: ' + err.message);
    }
  };

  const getScoreDescription = (val: number) => {
    if (val <= 2) return 'Calm & Grounded — Autonomic state relaxed and settled.';
    if (val <= 4) return 'Mild Nervousness — Manageable tension within typical baseline range.';
    if (val <= 6) return 'Moderate Strain — Distinct sympathetic arousal noted.';
    if (val <= 8) return 'Significant Distress — Substantial emotional & bodily tension.';
    return 'Acute Anxiety — Parasympathetic calming tool recommended below.';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-300 text-xs font-medium border border-rose-500/20">
            <Heart className="w-3.5 h-3.5" />
            <span>Voluntary Daily Health &amp; Mood Observation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">Daily Twin Check-In</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Log your current emotional state, sleep, caffeine, and optional physiological readings to calibrate your Digital Twin.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex space-x-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('new')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'new'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            New Check-In
          </button>
          <button
            onClick={() => { setActiveTab('history'); fetchHistory(); }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'history'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({historyList.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'new' ? (
        <>
          {result ? (
            /* Result Confirmation Card */
            <div className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-3 text-teal-400">
                  <CheckCircle2 className="w-8 h-8 shrink-0" />
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Check-In Recorded Successfully</h2>
                    <p className="text-xs text-slate-400 font-mono">
                      Digital Twin State Updated: <strong>{result.twin_state_updated.state_label}</strong> (CSI: {result.twin_state_updated.composite_stress_index})
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setResult(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold border border-slate-700"
                >
                  Log Another
                </button>
              </div>

              {/* Acute Safety Guidance Card if triggered */}
              {result.safety_guidance && (
                <div className="p-5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 space-y-3">
                  <div className="flex items-center space-x-2 text-indigo-300 font-semibold text-sm">
                    <ShieldAlert className="w-5 h-5 text-teal-400" />
                    <span>Supportive Grounding Guidance &amp; Crisis Contacts</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {result.safety_guidance.support_note}
                  </p>
                  <div className="pt-2 text-xs font-mono text-teal-300 space-y-1 bg-slate-900/60 p-3 rounded-lg border border-indigo-500/20">
                    {Object.entries(result.safety_guidance.crisis_contacts || {})
                      .filter(([key]) => key !== 'safety_message')
                      .map(([key, val]) => (
                        <p key={key}>• {String(val)}</p>
                      ))}
                    <p className="text-[10px] text-slate-400 font-sans mt-2">
                      {result.safety_guidance.crisis_contacts.safety_message}
                    </p>
                  </div>
                </div>
              )}

              {/* Interactive Breathing Tool */}
              <BreathingPacer />
            </div>
          ) : (
            <>
              {/* Check-in Form */}
              <form onSubmit={handleCheckinSubmit} className="space-y-6">
              {error && (
                <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Section 1: Subjective Emotional Rating */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    1. Self-Reported Anxiety / Tension Rating (0 – 10)
                  </label>
                  <span className={`text-base font-bold font-mono px-3 py-0.5 rounded-full border ${
                    score <= 3 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                    score <= 6 ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                    'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  }`}>
                    {score} / 10
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="10"
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                  className="w-full accent-teal-500"
                />

                <p className="text-xs text-slate-300 italic">
                  {getScoreDescription(score)}
                </p>

                {/* Energy slider */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Current Energy Level:</span>
                  <div className="flex space-x-2">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        type="button"
                        key={lvl}
                        onClick={() => setEnergy(lvl)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                          energy === lvl
                            ? 'bg-teal-600 text-white shadow-md'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 2: Daily Lifestyle Observations (Sleep, Caffeine, Steps, HR) */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  2. Lifestyle &amp; Physiological Observations (Today)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Sleep */}
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                        <Moon className="w-4 h-4 text-indigo-400" />
                        <span>Last Night's Sleep</span>
                      </label>
                      <span className="text-xs font-mono text-indigo-300 font-bold">{sleepHours} hrs</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="14"
                      step="0.5"
                      value={sleepHours}
                      onChange={(e) => setSleepHours(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  {/* Caffeine */}
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                        <Coffee className="w-4 h-4 text-amber-400" />
                        <span>Caffeine Intake Today</span>
                      </label>
                      <span className="text-xs font-mono text-amber-300 font-bold">{caffeineCups} cups</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="8"
                      step="0.5"
                      value={caffeineCups}
                      onChange={(e) => setCaffeineCups(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>

                  {/* Step Count / Activity */}
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                    <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                      <Activity className="w-4 h-4 text-teal-400" />
                      <span>Estimated Steps / Activity (Optional)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50000"
                      placeholder="e.g. 5500"
                      value={stepsCount}
                      onChange={(e) => setStepsCount(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {/* Resting Heart Rate */}
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                    <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                      <Heart className="w-4 h-4 text-rose-400" />
                      <span>Resting Heart Rate (BPM, Optional)</span>
                    </label>
                    <input
                      type="number"
                      min="40"
                      max="180"
                      placeholder="e.g. 74 (Manual / Wearable)"
                      value={heartRate}
                      onChange={(e) => setHeartRate(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                    />
                    <p className="text-[10px] text-slate-400">
                      Provenance tag: <strong>user_entered</strong> (leave blank if unavailable).
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 3: Somatic Symptoms Checklist */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3">
                <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider block">
                  3. Bodily / Somatic Sensations (Check all that apply)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SOMATIC_OPTIONS.map((sym) => {
                    const isSelected = selectedSymptoms.includes(sym);
                    return (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => toggleSymptom(sym)}
                        className={`p-2.5 rounded-lg border text-[11px] text-left transition-all ${
                          isSelected
                            ? 'bg-rose-950/40 border-rose-500 text-rose-200 font-semibold'
                            : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:text-white'
                        }`}
                      >
                        {sym}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 4: Context Triggers & Notes */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  4. Contextual Trigger &amp; Notes
                </h3>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Primary Perceived Trigger</label>
                  <select
                    value={selectedTrigger}
                    onChange={(e) => setSelectedTrigger(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="">Select a contextual factor...</option>
                    {TRIGGER_OPTIONS.map((trig) => (
                      <option key={trig} value={trig}>{trig}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Reflective Notes (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Describe context, thoughts, or grounding techniques applied..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-teal-500 resize-none"
                  />
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold shadow-lg shadow-teal-900/30 transition-all hover:scale-[1.01] disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Check-In...</span>
                    </>
                  ) : (
                    <>
                      <span>Record Check-In &amp; Update Twin</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Optional Grounding Support Tool */}
            <div className="pt-2">
              <BreathingPacer />
            </div>
          </>
        )}
        </>
      ) : (
        /* Historical Check-Ins List with Edit/Delete Controls */
        <div className="space-y-4">
          {historyLoading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
            </div>
          ) : historyList.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <Clock className="w-8 h-8 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-white">No Check-Ins Found</h3>
              <p className="text-xs text-slate-400">Complete your first daily check-in to start tracking.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyList.map((chk) => (
                <div
                  key={chk.id}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-3">
                      <span className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded-full border ${
                        chk.subjective_anxiety_score <= 3 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                        chk.subjective_anxiety_score <= 6 ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                        'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      }`}>
                        Rating: {chk.subjective_anxiety_score} / 10
                      </span>
                      {chk.triggers_noted && (
                        <span className="text-xs text-slate-300 font-medium">
                          {chk.triggers_noted}
                        </span>
                      )}
                    </div>
                    {chk.notes && (
                      <p className="text-xs text-slate-400 line-clamp-1 italic">
                        "{chk.notes}"
                      </p>
                    )}
                    <span className="text-[10px] text-slate-500 font-mono block">
                      {new Date(chk.timestamp).toLocaleString()} • Tag: {chk.source_type}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-center">
                    <button
                      onClick={() => setEditingCheckin(chk)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Edit Check-in"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCheckin(chk.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                      title="Delete Check-in"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Check-in Modal */}
      {editingCheckin && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Edit Check-in #{editingCheckin.id}</h3>
              <button onClick={() => setEditingCheckin(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateCheckin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Anxiety Rating (0-10)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={editingCheckin.subjective_anxiety_score}
                  onChange={(e) => setEditingCheckin({ ...editingCheckin, subjective_anxiety_score: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Trigger Context</label>
                <input
                  type="text"
                  value={editingCheckin.triggers_noted || ''}
                  onChange={(e) => setEditingCheckin({ ...editingCheckin, triggers_noted: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editingCheckin.notes || ''}
                  onChange={(e) => setEditingCheckin({ ...editingCheckin, notes: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white resize-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCheckin(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
