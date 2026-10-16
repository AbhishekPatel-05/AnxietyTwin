import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Calendar,
  Sparkles,
  TrendingUp,
  Activity,
  Heart,
  Moon,
  Info,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lock,
  Target,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { api } from '../services/api';
import { WeeklyReportOut } from '../types';

export const WeeklyReportPage: React.FC = () => {
  const [report, setReport] = useState<WeeklyReportOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Period filters
  const today = new Date();
  const pastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [startDate, setStartDate] = useState(pastWeek.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  // Privacy toggles for export
  const [includeJournal, setIncludeJournal] = useState(false);
  const [includeGoals, setIncludeGoals] = useState(true);
  const [includePatterns, setIncludePatterns] = useState(true);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getWeeklyReport({
        start_date: startDate,
        end_date: endDate,
        include_journal_summary: includeJournal,
        include_goals: includeGoals,
        include_patterns: includePatterns,
      });
      setReport(res);
    } catch (err: any) {
      console.error('Failed to load weekly report', err);
      setError(err.message || 'Failed to generate weekly report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate, includeJournal, includeGoals, includePatterns]);

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const blob = await api.exportWeeklyReportPdf({
        start_date: startDate,
        end_date: endDate,
        include_journal_summary: includeJournal,
        include_goals: includeGoals,
        include_patterns: includePatterns,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AnxietyTwin_Weekly_Report_${startDate}_to_${endDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMessage('Weekly Insights PDF downloaded successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert('Failed to download PDF report: ' + err.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shadow-lg shadow-teal-500/10">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Weekly Personal Insights Report</h1>
              <p className="text-xs text-slate-400">
                Understandable multi-dimensional synthesis of longitudinal check-ins, vitals, coping feedback, and goal adherence.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf || !report}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white text-xs font-semibold shadow-lg shadow-teal-500/20 hover:from-teal-400 hover:to-emerald-500 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Download className={`w-4 h-4 ${downloadingPdf ? 'animate-bounce' : ''}`} />
            <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF Report'}</span>
          </button>
        </div>
      </div>

      {/* Non-Diagnostic Disclaimer Banner */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start space-x-3 shadow-sm leading-relaxed">
        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-amber-300">Non-Diagnostic Evaluation Notice:</strong> This weekly summary compiles self-reported experiences and available physiological observations. It does not constitute a clinical psychiatric diagnosis or evidence of medical improvement. Always discuss trends with your licensed healthcare provider.
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

      {/* Report Controls Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-300">
            <Calendar className="w-4 h-4 text-teal-400" />
            <span>Reporting Window:</span>
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-teal-500"
          />
          <span className="text-slate-500 text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-teal-500"
          />
        </div>

        {/* Sensitive sections toggles */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300">
            <input
              type="checkbox"
              checked={includeGoals}
              onChange={(e) => setIncludeGoals(e.target.checked)}
              className="accent-teal-500"
            />
            <span>Wellness Goals</span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300">
            <input
              type="checkbox"
              checked={includePatterns}
              onChange={(e) => setIncludePatterns(e.target.checked)}
              className="accent-teal-500"
            />
            <span>Recurring Patterns</span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300">
            <input
              type="checkbox"
              checked={includeJournal}
              onChange={(e) => setIncludeJournal(e.target.checked)}
              className="accent-teal-500"
            />
            <span className="flex items-center space-x-1">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Private Reflections</span>
            </span>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center text-slate-400 text-xs">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-teal-400" />
          Compiling longitudinal trends for report...
        </div>
      ) : !report ? null : (
        <div className="space-y-6">
          {/* Executive Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400">Total Check-Ins</div>
              <div className="text-2xl font-bold text-white font-mono mt-1">
                {report.checkin_count}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Logged across reporting dates</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400">Mean Distress Rating</div>
              <div className="text-2xl font-bold text-teal-400 font-mono mt-1">
                {report.avg_distress_rating !== null && report.avg_distress_rating !== undefined
                  ? `${report.avg_distress_rating.toFixed(1)} / 10`
                  : 'N/A'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 capitalize">Trend: {report.distress_trend}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400">Resting HR / HRV Mean</div>
              <div className="text-lg font-bold text-white font-mono mt-2">
                {report.resting_hr_avg ? `${report.resting_hr_avg.toFixed(0)} BPM` : '—'}
                <span className="text-xs text-slate-400 font-normal"> / </span>
                {report.hrv_avg_ms ? `${report.hrv_avg_ms.toFixed(0)} ms` : '—'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Physiological averages</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400">Mean Sleep Duration</div>
              <div className="text-2xl font-bold text-indigo-400 font-mono mt-1">
                {report.sleep_avg_hours ? `${report.sleep_avg_hours.toFixed(1)} hrs` : 'N/A'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Nightly rest average</p>
            </div>
          </div>

          {/* Baseline Deviations Table */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Activity className="w-4 h-4 text-teal-400" />
                <span>Baseline Deviations & Observed Shifts</span>
              </h2>
              <span className="text-xs text-slate-400">Compared to personal rolling baseline</span>
            </div>

            {report.baseline_deviations.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                All available metrics remained within expected baseline ranges this week.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Metric</th>
                      <th className="py-2.5 px-3">Weekly Mean</th>
                      <th className="py-2.5 px-3">Baseline</th>
                      <th className="py-2.5 px-3">Shift (Delta)</th>
                      <th className="py-2.5 px-3">Plain-English Interpretation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {report.baseline_deviations.map((d, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-semibold text-white capitalize">{d.metric.replace('_', ' ')}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-200">{d.weekly_average.toFixed(1)}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{d.baseline.toFixed(1)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-teal-300">{d.delta}</td>
                        <td className="py-2.5 px-3 text-slate-300">{d.interpretation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Coping Interventions & Wellness Goals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Coping Feedback Summary */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Coping Activities & Helpfulness</span>
              </h3>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Completed Sessions</div>
                  <div className="text-xl font-bold text-white font-mono mt-1">
                    {report.coping_interventions_summary.total_completed}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Rated Helpful</div>
                  <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
                    {report.coping_interventions_summary.reported_helpful}
                  </div>
                </div>
              </div>

              {report.coping_interventions_summary.interventions_used.length > 0 && (
                <div className="pt-2">
                  <span className="text-[11px] text-slate-400">Activities Completed:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {report.coping_interventions_summary.interventions_used.map((act, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-teal-300 text-[10px] font-medium">
                        {act}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Wellness Goals Progress */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Target className="w-4 h-4 text-teal-400" />
                <span>Wellness Goals Progress</span>
              </h3>

              {report.wellness_goals_progress.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No active wellness goals recorded for this period.
                </p>
              ) : (
                <div className="space-y-2 pt-1">
                  {report.wellness_goals_progress.map((g, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-white">{g.title}</span>
                        <span className="font-mono text-teal-300">{g.progress} / {g.target}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-teal-500 rounded-full"
                          style={{ width: `${Math.min(100, (g.progress / (g.target || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recurring Patterns in Report */}
          {report.recurring_patterns.length > 0 && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Recurring Contextual Patterns</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.recurring_patterns.map((p, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white">{p.title}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        {p.confidence}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{p.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Private Reflections Summary (If Included) */}
          {report.private_reflections_included && report.reflections_summary && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center space-x-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Private Journal Theme Synthesis</h3>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
                {report.reflections_summary}
              </p>
            </div>
          )}

          {/* Data Quality & Missing Observations Notices */}
          {report.data_quality_notices.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs text-slate-400">
              <div className="font-semibold text-slate-300">Data Coverage & Observations Notice:</div>
              <ul className="list-disc list-inside space-y-1">
                {report.data_quality_notices.map((n, idx) => (
                  <li key={idx}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
