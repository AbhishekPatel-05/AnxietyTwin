import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  Brain,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  Filter,
  Calendar,
  Layers,
  ChevronRight,
  Info,
  Clock,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  HelpCircle,
  Activity,
  Heart,
  Moon,
  Coffee
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell
} from 'recharts';
import { api } from '../services/api';
import { DiscoveredPattern, PatternSummary } from '../types';

export const PatternDiscoveryPage: React.FC = () => {
  const [patterns, setPatterns] = useState<DiscoveredPattern[]>([]);
  const [summary, setSummary] = useState<PatternSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPattern, setSelectedPattern] = useState<DiscoveredPattern | null>(null);

  const fetchPatternsAndSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const [patternsRes, summaryRes] = await Promise.all([
        api.getPatterns(),
        api.getPatternSummary(),
      ]);
      setPatterns(patternsRes);
      setSummary(summaryRes);
      if (patternsRes.length > 0 && !selectedPattern) {
        setSelectedPattern(patternsRes[0]);
      }
    } catch (err: any) {
      console.error('Failed to load patterns', err);
      setError(err.message || 'Failed to load pattern discovery data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatternsAndSummary();
  }, []);

  const handleRunDiscovery = async () => {
    try {
      setAnalyzing(true);
      setError(null);
      const res = await api.discoverPatterns();
      setPatterns(res.patterns);
      if (res.patterns.length > 0) {
        setSelectedPattern(res.patterns[0]);
      }
      setSuccessMessage(`Analysis complete: ${res.patterns.length} recurring pattern(s) identified across ${res.analyzed_observation_days} observation days.`);
      setTimeout(() => setSuccessMessage(null), 5000);
      const updatedSummary = await api.getPatternSummary();
      setSummary(updatedSummary);
    } catch (err: any) {
      setError(err.message || 'Pattern analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    try {
      const updated = await api.updatePatternFeedback(id, newStatus);
      setPatterns((prev) => prev.map((p) => (p.id === id ? updated : p)));
      if (selectedPattern?.id === id) {
        setSelectedPattern(updated);
      }
      setSuccessMessage(`Pattern marked as "${newStatus}".`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      alert('Failed to update pattern feedback: ' + err.message);
    }
  };

  // Helpers for pattern status and confidence
  const getStatus = (p: DiscoveredPattern) => p.user_status || p.status;
  const getConfidenceScore = (p: DiscoveredPattern): number => {
    if (typeof p.confidence_score === 'number') return p.confidence_score;
    if (p.confidence_level === 'robust') return 0.85;
    if (p.confidence_level === 'moderate') return 0.65;
    return 0.45;
  };

  // Filtered patterns
  const filteredPatterns = patterns.filter((p) => {
    const matchesType = typeFilter === 'all' || p.pattern_type === typeFilter;
    const matchesStatus = statusFilter === 'all' || getStatus(p) === statusFilter;
    return matchesType && matchesStatus;
  });

  // Chart data for top context factors
  const contextChartData = summary?.top_context_factors?.map((f) => ({
    factor: f.factor,
    count: f.count,
  })) || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shadow-lg shadow-teal-500/10">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Personal Trigger & Pattern Discovery</h1>
              <p className="text-xs text-slate-400">
                Explore recurring relationships between your self-reported experiences and longitudinal observations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleRunDiscovery}
            disabled={analyzing}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white text-sm font-semibold shadow-lg shadow-teal-500/20 hover:from-teal-400 hover:to-emerald-500 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
            <span>{analyzing ? 'Analyzing Observations...' : 'Run Discovery Analysis'}</span>
          </button>
        </div>
      </div>

      {/* Mandatory Scientific Disclaimer Banner */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start space-x-3 leading-relaxed shadow-sm">
        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-amber-300">Non-Causal Scientific Disclosure:</strong> The relationships displayed below represent mathematical correlations observed in your longitudinal check-ins and recordings.
          <span className="font-semibold"> Correlation does not imply causation.</span> AnxietyTwin does not claim that a tagged context or physiological shift directly causes distress. Discovered patterns are designed for self-reflection and care dialogue, not clinical diagnosis.
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

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Analyzed Check-ins</span>
            <Activity className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2 font-mono">
            {summary?.total_checkins ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Logged check-in entries</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Recording Days</span>
            <Calendar className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2 font-mono">
            {summary?.distinct_days_recorded ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Distinct days with data</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Discovered Patterns</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2 font-mono">
            {patterns.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {patterns.filter((p) => getStatus(p) === 'relevant').length} marked relevant
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Top Context Factor</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-white mt-2 truncate">
            {summary?.top_context_factors?.[0]?.factor || 'None recorded'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {summary?.top_context_factors?.[0] ? `${summary.top_context_factors[0].count} occurrences` : 'Log context tags in check-ins'}
          </p>
        </div>
      </div>

      {/* Main Content Layout: Pattern List on Left, Detail & Charts on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Pattern Cards & Filters (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Filter Bar */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap gap-2 text-xs">
            <div className="flex items-center space-x-1">
              <span className="text-slate-400 text-[11px]">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-teal-500"
              >
                <option value="all">All Types</option>
                <option value="context_trigger">Context Triggers</option>
                <option value="sleep_distress">Sleep & Distress</option>
                <option value="coping_efficacy">Coping Activities</option>
              </select>
            </div>

            <div className="flex items-center space-x-1">
              <span className="text-slate-400 text-[11px]">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-teal-500"
              >
                <option value="all">All Statuses</option>
                <option value="discovered">New Discovered</option>
                <option value="relevant">Marked Relevant</option>
                <option value="irrelevant">Marked Irrelevant</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
          </div>

          {/* Pattern Cards List */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
              Loading patterns...
            </div>
          ) : filteredPatterns.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800/80 text-center space-y-3">
              <Sparkles className="w-8 h-8 mx-auto text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-300">No Patterns Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {patterns.length === 0
                  ? 'We need at least 3 check-ins with context tags or physiological observations to discover recurring patterns.'
                  : 'No patterns match your selected filter criteria.'}
              </p>
              {patterns.length === 0 && (
                <div className="pt-2">
                  <Link
                    to="/checkin"
                    className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-teal-600/30 text-teal-300 border border-teal-500/40 text-xs font-medium hover:bg-teal-600/50"
                  >
                    <span>Record a Check-In</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPatterns.map((p) => {
                const isSelected = selectedPattern?.id === p.id;
                const confidencePct = Math.round(getConfidenceScore(p) * 100);
                const confidenceBadgeColor =
                  confidencePct >= 75
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : confidencePct >= 50
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-slate-700/50 text-slate-300 border-slate-600';

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPattern(p)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 border-teal-500/60 shadow-md shadow-teal-500/10'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-semibold text-white">{p.title}</span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>
                      </div>

                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${confidenceBadgeColor}`}>
                        {confidencePct}% Conf
                      </span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{p.observation_count} observation(s)</span>
                      </span>

                      <span className="capitalize px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {getStatus(p)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Pattern Detail & Evidence Transparency (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {selectedPattern ? (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
              {/* Pattern Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      {selectedPattern.pattern_type.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Recorded: {new Date(selectedPattern.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white mt-1">{selectedPattern.title}</h2>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleUpdateStatus(selectedPattern.id, 'relevant')}
                    title="Mark as Relevant for my care"
                    className={`p-2 rounded-lg border text-xs flex items-center space-x-1.5 transition-colors cursor-pointer ${
                      getStatus(selectedPattern) === 'relevant'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-emerald-300'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Relevant</span>
                  </button>

                  <button
                    onClick={() => handleUpdateStatus(selectedPattern.id, 'irrelevant')}
                    title="Mark as Irrelevant / Coincidental"
                    className={`p-2 rounded-lg border text-xs flex items-center space-x-1.5 transition-colors cursor-pointer ${
                      getStatus(selectedPattern) === 'irrelevant'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-amber-300'
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span>Irrelevant</span>
                  </button>

                  <button
                    onClick={() => handleUpdateStatus(selectedPattern.id, 'dismissed')}
                    title="Dismiss this pattern"
                    className="p-2 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 text-xs transition-colors cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Observed Correlation</h3>
                <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                  {selectedPattern.description}
                </p>
              </div>

              {/* Evidence Strength & Data Sufficiency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-1">
                  <div className="text-[11px] font-medium text-slate-400">Supporting Observations</div>
                  <div className="text-xl font-bold text-white font-mono">
                    {selectedPattern.observation_count} <span className="text-xs font-normal text-slate-400">check-in events</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Window: {selectedPattern.time_range_start || selectedPattern.time_range?.split(' - ')[0] || 'Recent'} to {selectedPattern.time_range_end || selectedPattern.time_range?.split(' - ')[1] || 'Present'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-1">
                  <div className="text-[11px] font-medium text-slate-400">Evidence Strength Score</div>
                  <div className="text-xl font-bold text-teal-400 font-mono">
                    {(getConfidenceScore(selectedPattern) * 100).toFixed(0)}%
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Calculated from observation count and frequency threshold
                  </p>
                </div>
              </div>

              {/* Scientific Evidence Explanation */}
              {(selectedPattern.evidence_explanation || (typeof selectedPattern.evidence_summary?.explanation === 'string' && selectedPattern.evidence_summary.explanation)) && (
                <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-200 space-y-1">
                  <div className="font-semibold text-teal-300 flex items-center space-x-1.5">
                    <Info className="w-4 h-4 text-teal-400" />
                    <span>Evidence Behind This Finding:</span>
                  </div>
                  <p className="leading-relaxed text-slate-300">
                    {selectedPattern.evidence_explanation || selectedPattern.evidence_summary?.explanation}
                  </p>
                </div>
              )}

              {/* Underlying Data Factors */}
              {((selectedPattern.factors_json && Object.keys(selectedPattern.factors_json).length > 0) || (selectedPattern.evidence_summary && Object.keys(selectedPattern.evidence_summary).length > 0)) && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Identified Factors & Values</h3>
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 font-mono text-xs text-slate-300 space-y-1 overflow-x-auto">
                    {Object.entries(selectedPattern.factors_json || selectedPattern.evidence_summary || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-0.5 border-b border-slate-800/50 last:border-0">
                        <span className="text-slate-400">{k}:</span>
                        <span className="text-teal-300 font-medium">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-slate-400 text-xs">
              Select a pattern card from the left column to view supporting evidence and correlation details.
            </div>
          )}

          {/* Context Frequency Chart */}
          {contextChartData.length > 0 && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Recurring Context Factors Distribution</h3>
                  <p className="text-xs text-slate-400">Frequency of user-tagged factors across longitudinal records</p>
                </div>
                <span className="text-xs font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                  {contextChartData.length} Factors
                </span>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={contextChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis
                      dataKey="factor"
                      stroke="#94a3b8"
                      fontSize={11}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                    />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        color: '#f8fafc',
                      }}
                    />
                    <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]}>
                      {contextChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#14b8a6' : '#06b6d4'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
