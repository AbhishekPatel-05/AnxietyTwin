import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Lock,
  Unlock,
  Sparkles,
  Calendar,
  Clock,
  Trash2,
  Edit2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  ChevronDown,
  ChevronUp,
  Filter,
  Eye,
  RefreshCw,
  Heart
} from 'lucide-react';
import { api } from '../services/api';
import { EmotionJournalEntry, EmotionJournalEntryCreate, JournalThemeSummaryResponse } from '../types';

const MOOD_OPTIONS = [
  'Anxious',
  'Overwhelmed',
  'Calm',
  'Hopeful',
  'Fatigued',
  'Grateful',
  'Restless',
  'Irritable',
  'Grounded',
  'Discouraged',
];

const CONTEXT_OPTIONS = [
  'Workload / Deadlines',
  'Study Pressure',
  'Social Situation',
  'Sleep Disruption',
  'Caffeine Intake',
  'Physical Activity',
  'Family / Relationship',
  'Commute / Transit',
  'Health Symptoms',
];

const PROMPT_QUESTIONS = [
  { key: 'what_happened', label: '1. What happened or triggered this moment?' },
  { key: 'how_felt', label: '2. How did you feel emotionally and physically?' },
  { key: 'contributing_factors', label: '3. What contextual factors contributed to the experience?' },
  { key: 'what_helped', label: '4. What coping strategy or response helped?' },
  { key: 'next_time', label: '5. What would you like to explore or try next time?' },
];

export const JournalPage: React.FC = () => {
  const [entries, setEntries] = useState<EmotionJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMoodFilter, setSelectedMoodFilter] = useState('');
  const [selectedContextFilter, setSelectedContextFilter] = useState('');

  // New / Edit Entry Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedContexts, setSelectedContexts] = useState<string[]>([]);
  const [distressRating, setDistressRating] = useState<number>(4);
  const [isPrivate, setIsPrivate] = useState<boolean>(true);
  const [sharedWithClinician, setSharedWithClinician] = useState<boolean>(false);
  const [showPrompts, setShowPrompts] = useState<boolean>(false);
  const [promptResponses, setPromptResponses] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // AI Theme Summary Modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiSummaryResult, setAiSummaryResult] = useState<JournalThemeSummaryResponse | null>(null);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getJournalEntries({
        search: searchTerm || undefined,
        mood_tag: selectedMoodFilter || undefined,
        context_tag: selectedContextFilter || undefined,
      });
      setEntries(res);
    } catch (err: any) {
      console.error('Failed to load journal', err);
      setError(err.message || 'Failed to load journal entries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [searchTerm, selectedMoodFilter, selectedContextFilter]);

  const handleOpenNew = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setSelectedMoods([]);
    setSelectedContexts([]);
    setDistressRating(4);
    setIsPrivate(true);
    setSharedWithClinician(false);
    setShowPrompts(false);
    setPromptResponses({});
    setShowModal(true);
  };

  const handleOpenEdit = (entry: EmotionJournalEntry) => {
    setEditingId(entry.id);
    setTitle(entry.title || '');
    setContent(entry.content);
    setSelectedMoods(entry.mood_tags || []);
    setSelectedContexts(entry.context_tags || []);
    setDistressRating(entry.distress_rating ?? 4);
    setIsPrivate(entry.is_private);
    setSharedWithClinician(entry.shared_with_clinician);
    setPromptResponses(entry.prompt_responses || {});
    setShowPrompts(Boolean(entry.prompt_responses && Object.keys(entry.prompt_responses).length > 0));
    setShowModal(true);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      setSubmitting(true);
      const payload: EmotionJournalEntryCreate = {
        title: title.trim() || undefined,
        content: content.trim(),
        mood_tags: selectedMoods,
        context_tags: selectedContexts,
        distress_rating: distressRating,
        prompt_responses: Object.keys(promptResponses).length > 0 ? promptResponses : undefined,
        is_private: isPrivate,
        shared_with_clinician: sharedWithClinician,
      };

      if (editingId) {
        await api.updateJournalEntry(editingId, payload);
        setSuccessMessage('Journal entry updated.');
      } else {
        await api.createJournalEntry(payload);
        setSuccessMessage('Private journal entry recorded.');
      }

      setShowModal(false);
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchEntries();
    } catch (err: any) {
      alert('Failed to save journal entry: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async (id: number) => {
    if (!confirm('Are you sure you want to permanently delete this journal entry?')) return;
    try {
      await api.deleteJournalEntry(id);
      setSuccessMessage('Entry deleted permanently.');
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchEntries();
    } catch (err: any) {
      alert('Failed to delete entry: ' + err.message);
    }
  };

  const handleGenerateAiSummary = async () => {
    if (!aiConsent) {
      alert('Please check the consent box to authorize AI theme summarization.');
      return;
    }

    try {
      setGeneratingAi(true);
      const res = await api.generateJournalThemeSummary(undefined, true);
      setAiSummaryResult(res);
    } catch (err: any) {
      alert('Failed to generate summary: ' + err.message);
    } finally {
      setGeneratingAi(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shadow-lg shadow-teal-500/10">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Emotion Journal & Context Capture</h1>
              <p className="text-xs text-slate-400">
                A private sanctuary to articulate feelings and contextual experiences beyond wearable sensor readings.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setAiSummaryResult(null);
              setAiConsent(false);
              setShowAiModal(true);
            }}
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-teal-400" />
            <span>AI Theme Summary</span>
          </button>

          <button
            onClick={handleOpenNew}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white text-xs font-semibold shadow-lg shadow-teal-500/20 hover:from-teal-400 hover:to-emerald-500 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Reflection</span>
          </button>
        </div>
      </div>

      {/* Strict Privacy Guarantee Banner */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 text-xs flex items-start space-x-3 shadow-md">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-white font-semibold">Strict Privacy Enforced by Default:</strong> Journal reflections are encrypted in database storage and <span className="text-emerald-300 font-semibold">isolated from clinician view</span>. Clinicians cannot access your journal content unless you explicitly toggle &quot;Share with Clinician&quot; on an individual entry.
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

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search keywords in journal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={selectedMoodFilter}
            onChange={(e) => setSelectedMoodFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500"
          >
            <option value="">All Mood Tags</option>
            {MOOD_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={selectedContextFilter}
            onChange={(e) => setSelectedContextFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500"
          >
            <option value="">All Contexts</option>
            {CONTEXT_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Journal Entries List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
          Loading journal reflections...
        </div>
      ) : entries.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
          <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">No Journal Entries Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Writing your feelings can release tension and provide rich context that heart rate sensors alone cannot reveal.
          </p>
          <button
            onClick={handleOpenNew}
            className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-teal-600/30 text-teal-300 border border-teal-500/40 text-xs font-medium hover:bg-teal-600/50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Write First Entry</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const dateStr = new Date(entry.created_at).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            });

            return (
              <div
                key={entry.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-4 shadow-md"
              >
                {/* Entry Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-white">
                        {entry.title || 'Untitled Reflection'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {dateStr}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-[10px]">
                      {entry.shared_with_clinician ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                          <Unlock className="w-3 h-3" />
                          <span>Authorized Clinician Visible</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>Private to You</span>
                        </span>
                      )}

                      {entry.distress_rating !== null && entry.distress_rating !== undefined && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                          Distress: <strong className="text-teal-300">{entry.distress_rating}/10</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenEdit(entry)}
                      title="Edit Entry"
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      title="Delete Entry"
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Free Text Content */}
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                  {entry.content}
                </p>

                {/* Structured Prompts (if any) */}
                {entry.prompt_responses && Object.keys(entry.prompt_responses).length > 0 && (
                  <div className="p-3.5 rounded-xl bg-slate-950/30 border border-slate-800/60 space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-400 font-mono">
                      Structured Reflection Notes
                    </span>
                    <div className="space-y-1.5 text-xs">
                      {Object.entries(entry.prompt_responses).map(([k, ans]) => (
                        <div key={k} className="text-slate-300">
                          <span className="text-slate-500 font-medium">{k.replace('_', ' ')}: </span>
                          <span>{ans}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags Row */}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/80">
                  {entry.mood_tags?.map((m) => (
                    <span key={m} className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/20 text-[10px]">
                      #{m}
                    </span>
                  ))}
                  {entry.context_tags?.map((c) => (
                    <span key={c} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                      @{c}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Entry Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-teal-400" />
                <span>{editingId ? 'Edit Journal Entry' : 'New Emotion Journal Entry'}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Entry Title (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Afternoon meeting tension and sensory overload"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Your Reflection</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Write freely about what you are experiencing..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white leading-relaxed focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Mood Tags Multi-Select */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Mood & Emotion Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {MOOD_OPTIONS.map((m) => {
                    const active = selectedMoods.includes(m);
                    return (
                      <button
                        type="button"
                        key={m}
                        onClick={() => {
                          setSelectedMoods(active ? selectedMoods.filter((x) => x !== m) : [...selectedMoods, m]);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          active
                            ? 'bg-teal-500 text-white shadow-sm'
                            : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Context Tags Multi-Select */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Contextual Factors</label>
                <div className="flex flex-wrap gap-1.5">
                  {CONTEXT_OPTIONS.map((c) => {
                    const active = selectedContexts.includes(c);
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={() => {
                          setSelectedContexts(active ? selectedContexts.filter((x) => x !== c) : [...selectedContexts, c]);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          active
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Distress Slider */}
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1">
                  <span>Subjective Distress Rating:</span>
                  <span className="font-mono text-teal-400 font-bold">{distressRating} / 10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={distressRating}
                  onChange={(e) => setDistressRating(Number(e.target.value))}
                  className="w-full accent-teal-500 cursor-pointer"
                />
              </div>

              {/* Structured Reflection Accordion */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPrompts(!showPrompts)}
                  className="w-full px-4 py-2.5 bg-slate-800/60 hover:bg-slate-800 flex items-center justify-between text-xs font-medium text-slate-300 cursor-pointer"
                >
                  <span>Guided Reflection Prompts (Optional)</span>
                  {showPrompts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showPrompts && (
                  <div className="p-4 bg-slate-950/40 space-y-3">
                    {PROMPT_QUESTIONS.map((q) => (
                      <div key={q.key}>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">{q.label}</label>
                        <input
                          type="text"
                          value={promptResponses[q.key] || ''}
                          onChange={(e) => setPromptResponses({ ...promptResponses, [q.key]: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Privacy Setting Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-medium text-white">Private to Me Only</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={!sharedWithClinician}
                    onChange={(e) => setSharedWithClinician(!e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  When checked, this entry is completely invisible to any authorized clinician.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingId ? 'Update Entry' : 'Save Reflection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Theme Summary Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-teal-400" />
                <span>AI Theme Synthesis (User Consent Required)</span>
              </h3>
              <button onClick={() => setShowAiModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!aiSummaryResult ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  AnxietyTwin can analyze your recorded journal entries to identify recurring contextual themes and coping strategies.
                </p>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-start space-x-2.5">
                    <input
                      type="checkbox"
                      id="ai-consent"
                      checked={aiConsent}
                      onChange={(e) => setAiConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-teal-500 cursor-pointer"
                    />
                    <label htmlFor="ai-consent" className="text-xs text-slate-300 leading-relaxed cursor-pointer">
                      I explicitly consent to an AI summary of my journal themes. I understand that AI summaries are non-diagnostic and distinct from my original private words.
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    onClick={() => setShowAiModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerateAiSummary}
                    disabled={!aiConsent || generatingAi}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {generatingAi ? 'Analyzing Reflections...' : 'Generate Theme Summary'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-300">
                  <strong className="font-semibold">AI Generated Notice:</strong> {aiSummaryResult.distinction_notice}
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Identified Themes</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {aiSummaryResult.themes.map((t, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-lg bg-slate-800 text-teal-300 border border-slate-700 text-xs font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Synthesized Narrative</h4>
                  <p className="text-xs text-slate-200 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
                    {aiSummaryResult.summary_text}
                  </p>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setShowAiModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
