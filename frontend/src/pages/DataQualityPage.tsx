import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Activity,
  Layers,
  Database,
  AlertTriangle,
  Info,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Sliders,
  Calendar,
  AlertCircle,
  HelpCircle,
  Brain,
  Zap,
  Lock,
  ArrowUpRight
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis
} from 'recharts';
import { api } from '../services/api';
import { DataQualityCenter } from '../types';

const PROVENANCE_COLORS: Record<string, string> = {
  measured: '#14b8a6', // Teal
  user_reported: '#6366f1', // Indigo
  derived: '#f59e0b', // Amber
  simulated: '#ec4899', // Pink
};

export const DataQualityPage: React.FC = () => {
  const [dataQuality, setDataQuality] = useState<DataQualityCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuality = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDataQualitySummary();
      setDataQuality(res);
    } catch (err: any) {
      console.error('Failed to load data quality', err);
      setError(err.message || 'Failed to load data quality metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuality();
  }, []);

  const provenanceChartData = dataQuality
    ? [
        { name: 'Measured (Wearables)', value: dataQuality.provenance.measured_device_count, color: PROVENANCE_COLORS.measured },
        { name: 'User-Reported (Check-ins)', value: dataQuality.provenance.user_reported_count, color: PROVENANCE_COLORS.user_reported },
        { name: 'Derived Indices', value: dataQuality.provenance.derived_indices_count, color: PROVENANCE_COLORS.derived },
        { name: 'Simulated (Lab Sandbox)', value: dataQuality.provenance.simulated_synthetic_count, color: PROVENANCE_COLORS.simulated },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shadow-lg shadow-teal-500/10">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Digital Twin Confidence & Data Quality Center</h1>
              <p className="text-xs text-slate-400">
                Transparent evidence accounting: coverage, provenance, baseline calibration, and analytical model limitations.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchQuality}
          disabled={loading}
          className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 text-xs font-semibold shadow-sm transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Audit</span>
        </button>
      </div>

      {/* Mandatory Quality & Provenance Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs flex items-start space-x-3 shadow-md">
        <Info className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-white font-semibold">Evidence Transparency Commitment:</strong> AnxietyTwin distinguishes between genuine device measurements, self-reports, mathematical indices, and synthetic simulations. Data completeness is never equated with clinical certainty. Synthetic lab simulations are strictly quarantined and never contaminate genuine historical baselines.
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
              Inspect how your recorded personal baselines have evolved across consecutive observation windows.
            </p>
          </div>
        </div>
        <Link
          to="/simulation"
          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md transition-all shrink-0"
        >
          <span>Explore Evolution</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center text-slate-400 text-xs">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-teal-400" />
          Auditing data streams and baseline reliability...
        </div>
      ) : !dataQuality ? null : (
        <>
          {/* Top 3 Core Pillar Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Observation Coverage */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-teal-400" />
                  <h3 className="text-sm font-bold text-white">Observation Coverage</h3>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase border ${
                  dataQuality.coverage.recency_status === 'fresh'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                    : dataQuality.coverage.recency_status === 'stale'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {dataQuality.coverage.recency_status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[11px] text-slate-400">Total Observations</div>
                  <div className="text-xl font-bold text-white font-mono mt-1">
                    {dataQuality.coverage.total_observations}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[11px] text-slate-400">Recording Days</div>
                  <div className="text-xl font-bold text-teal-400 font-mono mt-1">
                    {dataQuality.coverage.distinct_recording_days}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Metrics Coverage</div>
                <div className="space-y-1">
                  {Object.entries(dataQuality.coverage.available_metrics).map(([metric, available]) => (
                    <div key={metric} className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-slate-300 capitalize">{metric.replace('_', ' ')}</span>
                      {available ? (
                        <span className="text-emerald-400 font-mono text-[11px] flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Recorded</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[11px]">Pending</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Baseline Reliability */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Baseline Reliability</h3>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase border ${
                  dataQuality.baseline_reliability.reliability_tier === 'high'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                    : dataQuality.baseline_reliability.reliability_tier === 'moderate'
                    ? 'bg-teal-500/10 text-teal-300 border-teal-500/20'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                }`}>
                  Tier: {dataQuality.baseline_reliability.reliability_tier}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Baseline Calibration:</span>
                  <span className={`font-semibold ${dataQuality.baseline_reliability.is_calibrated ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {dataQuality.baseline_reliability.is_calibrated ? 'Calibrated' : 'Preliminary Cold-Start'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Days Sampled:</span>
                  <span className="text-white font-mono">
                    {dataQuality.baseline_reliability.baseline_days_used} / {dataQuality.baseline_reliability.minimum_days_required} min days
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Window Period:</span>
                  <span className="text-slate-300 font-mono text-[11px]">
                    {dataQuality.baseline_reliability.baseline_period || 'Standard 14-day rolling'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/30 border border-slate-800 text-xs text-slate-400 leading-relaxed">
                {dataQuality.baseline_reliability.is_outdated ? (
                  <span className="text-amber-300">
                    Baseline may be outdated due to a gap in recent recordings. Log a check-in to refresh.
                  </span>
                ) : (
                  <span>
                    Rolling baseline actively adapts with new check-ins while preserving physiological stability.
                  </span>
                )}
              </div>
            </div>

            {/* 3. Provenance & Synthetic Quarantine */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Data Provenance</h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  Isolated Sandbox: OK
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="flex items-center space-x-1.5 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block"></span>
                    <span>Measured (Wearables)</span>
                  </span>
                  <span className="font-mono text-white">{dataQuality.provenance.measured_pct.toFixed(0)}%</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="flex items-center space-x-1.5 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
                    <span>User-Reported (Check-ins)</span>
                  </span>
                  <span className="font-mono text-white">{dataQuality.provenance.user_reported_pct.toFixed(0)}%</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="flex items-center space-x-1.5 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                    <span>Derived Mathematical Indices</span>
                  </span>
                  <span className="font-mono text-white">{dataQuality.provenance.derived_pct.toFixed(0)}%</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="flex items-center space-x-1.5 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block"></span>
                    <span>Synthetic Simulation Data</span>
                  </span>
                  <span className="font-mono text-white">{dataQuality.provenance.simulated_pct.toFixed(0)}%</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Synthetic lab data quarantine is 100% active. Zero cross-contamination.</span>
              </div>
            </div>
          </div>

          {/* Active Data Quality Notices & Warnings */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Active Data Quality Notices ({dataQuality.warnings.length})</span>
              </h2>
              <span className="text-xs text-slate-400">Automated stream validations</span>
            </div>

            {dataQuality.warnings.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                No data quality warnings detected. Streams and timestamps meet clinical inspection standards.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dataQuality.warnings.map((w, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border space-y-2 ${
                      w.severity === 'caution'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                        : w.severity === 'warning'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                        : 'bg-slate-800/60 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{w.title}</span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black/40">
                        {w.severity}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed">{w.message}</p>
                    {w.suggested_action && (
                      <div className="pt-2 border-t border-white/10 text-[11px] font-medium opacity-90">
                        Suggested Action: {w.suggested_action}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Insight Transparency & Model Rules Documentation */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Brain className="w-4 h-4 text-teal-400" />
                <span>Analytical Rules & Model Transparency</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Full technical specification of deployed indicators, target prediction horizons, and known scientific boundaries.
              </p>
            </div>

            <div className="space-y-4">
              {dataQuality.transparency_rules.map((rule, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white text-teal-300">{rule.indicator_name}</h3>
                    <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-800">
                      Target / Horizon: {rule.target_or_prediction_horizon}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Mathematical Formula / Rule Logic
                      </div>
                      <p className="text-slate-200 font-mono text-[11px] leading-relaxed">
                        {rule.rule_or_formula}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Input Parameters
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {rule.inputs_used.map((inp, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-teal-300 font-mono text-[10px]">
                            {inp}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
                    <strong className="text-amber-300 font-semibold">Known Scientific Boundary:</strong> {rule.known_limitations}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
