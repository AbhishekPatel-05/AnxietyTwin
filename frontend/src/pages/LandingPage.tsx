import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Brain, 
  Activity, 
  Sliders, 
  ShieldCheck, 
  ArrowRight, 
  HeartPulse, 
  Lock, 
  FileText,
  Sparkles,
  BarChart3,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Compass,
  CheckCircle2,
  LogIn
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="space-y-20 pb-16">
      {/* Hero Section */}
      <section className="relative pt-12 pb-16 overflow-hidden border-b border-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(13,148,136,0.12),rgba(2,6,23,0))]"></div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900 border border-teal-500/30 text-teal-300 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>Digital Twin Research Prototype • Prospective Phenotyping Cohort</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white font-sans leading-tight">
            Personalized Anxiety-Pattern Monitoring &amp; Virtual Digital Twin
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal">
            AnxietyTwin maintains a <strong className="text-teal-300 font-medium">continuously evolving virtual patient state</strong>.
            By computing empirical individual baselines from daily sleep, autonomic markers, and subjective check-ins,
            it models multi-modal strain deviations alongside experimental, non-diagnostic 24-hour vulnerability estimates.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-3">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold shadow-lg shadow-teal-900/30 transition-all hover:scale-[1.01]"
            >
              <span>Launch My Digital Twin</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold transition-all hover:scale-[1.01]"
            >
              <LogIn className="w-4 h-4 text-slate-400" />
              <span>Log In to Existing Twin</span>
            </Link>

            <Link
              to="/simulation"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-teal-500/40 text-teal-300 font-semibold transition-all hover:scale-[1.01]"
            >
              <Sliders className="w-4 h-4 text-teal-400" />
              <span>Explore Simulation Lab</span>
            </Link>
          </div>

          <p className="text-xs text-slate-400 pt-1">
            Manual-entry supported • Optional wearable data • Strict user-isolated encryption • Free research demo
          </p>
        </div>
      </section>

      {/* Transparent Research Prototype Disclaimer Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/90 border border-amber-500/30 space-y-3">
          <div className="flex items-center space-x-2.5 text-amber-400 font-semibold text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Investigational Healthcare Prototype Notice</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            AnxietyTwin is an <strong>experimental research prototype</strong> developed for the Happiest Health Digital Twin Challenge 2026.
            It is <strong>not a medical device, diagnostic instrument, or clinical treatment tool</strong>. It does not provide medical diagnoses,
            recommend medications, or prove panic attack inevitability. If you are experiencing psychological distress, please connect with a qualified healthcare professional or call the 988 Suicide &amp; Crisis Lifeline (dial <strong>988</strong> in the US / Canada).
          </p>
        </div>
      </section>

      {/* Core Concept: How the Digital Twin Works (4 Steps) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">How the Digital Twin Engine Works</h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm">
            Conventional apps generate static snapshot predictions. AnxietyTwin continuously updates an evolving virtual patient model across four functional stages.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold">
              1
            </div>
            <h3 className="font-semibold text-white text-sm">Collect Observations</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Record daily sleep hours, caffeine, activity, optional heart rate, and subjective anxiety ratings. Every source is explicitly labeled with data provenance.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
              2
            </div>
            <h3 className="font-semibold text-white text-sm">Establish Personal Baseline</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Once minimum history is reached (5+ observations), the engine computes rolling individual mean and variance rather than relying on generic population norms.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold">
              3
            </div>
            <h3 className="font-semibold text-white text-sm">Explore Longitudinal Patterns</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Track autonomic arousal, circadian debt, and multi-modal composite strain across time to identify personal trends and recovery dynamics.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
              4
            </div>
            <h3 className="font-semibold text-white text-sm">Simulate Scenarios</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Interact with hypothetical counterfactual variables in the Research Lab to explore how changes in sleep or caffeine alter strain scores and model forecasts.
            </p>
          </div>
        </div>
      </section>

      {/* Feature Pillars: Personal Mode, Longitudinal Insights, Research Simulation Lab */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Platform Capabilities</h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm">
            Designed for both personal longitudinal self-reflection and rigorous clinical research simulation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pillar 1: Personal Mode */}
          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 hover:border-teal-500/40 transition-colors flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Brain className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Personal Mode</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Your living Digital Twin dashboard. View your Composite Stress Index, autonomic arousal gauge, circadian disruption index, and personal deviation from baseline.
              </p>
              <ul className="text-xs text-slate-400 space-y-2 pt-2">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>Transparent cold-start baseline tracking</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>Integrated daily check-in flow</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>Non-alarmist physiological status indicators</span>
                </li>
              </ul>
            </div>
            <div className="pt-4 border-t border-slate-800">
              <Link to="/register" className="text-teal-400 text-xs font-semibold hover:text-teal-300 inline-flex items-center space-x-1">
                <span>Configure your digital twin</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Pillar 2: Longitudinal Insights */}
          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 hover:border-sky-500/40 transition-colors flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Longitudinal Tracking</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Chronological observation records, multi-week time-series trends, and detailed deviation metrics comparing today's values against established individual baselines.
              </p>
              <ul className="text-xs text-slate-400 space-y-2 pt-2">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>Interactive 30-day multi-modal charts</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>Audit trail with full record deletion control</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>JSON clinical data export (Right to Access)</span>
                </li>
              </ul>
            </div>
            <div className="pt-4 border-t border-slate-800">
              <Link to="/login" className="text-sky-400 text-xs font-semibold hover:text-sky-300 inline-flex items-center space-x-1">
                <span>View tracking history</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Pillar 3: Research & Simulation Lab */}
          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 hover:border-purple-500/40 transition-colors flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Sliders className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Research &amp; Simulation Lab</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Interactive counterfactual workbench. Select patient archetypes, test hypothetical physiological adjustments, and view resulting 24-hr DBP model inferences.
              </p>
              <ul className="text-xs text-slate-400 space-y-2 pt-2">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Reset-to-baseline &amp; restore-defaults controls</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Side-by-side Scenario A vs Scenario B comparisons</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Deployed 35-feature Random Forest inference</span>
                </li>
              </ul>
            </div>
            <div className="pt-4 border-t border-slate-800">
              <Link to="/simulation" className="text-purple-400 text-xs font-semibold hover:text-purple-300 inline-flex items-center space-x-1">
                <span>Open Simulation Workbench</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Scientific Integrity & Research Background */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-slate-900/80 border border-teal-500/30 p-6 sm:p-8 space-y-4">
          <div className="flex items-center space-x-2 text-teal-400 font-semibold text-sm">
            <FileText className="w-4 h-4" />
            <span>Research Foundation &amp; Leakage Audit (Nature Scientific Data 2024)</span>
          </div>
          <h3 className="text-lg font-bold text-white">Why Digital Twin Personalization is Imperative</h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            The reference research dataset (Jang et al., 2024) prospectively tracked 43 adult outpatients over 3,969 days, targeting
            <strong> Day Before Panic (DBP)</strong> (254 events, 6.4% prevalence). While naive random cross-validation yields inflated AUCs (~0.90) due to static patient questionnaire memorization,
            strict participant-aware GroupKFold validation demonstrates that generic population classifiers generalize modestly to unseen individuals (~0.72 AUC).
          </p>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            AnxietyTwin bridges this gap by calculating <em>individual empirical baselines</em> to track person-specific autonomic strain deviations, providing clinically responsible insights with explicit 95% uncertainty bounds.
          </p>
          <div className="pt-2 flex flex-wrap gap-2.5">
            <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-slate-800 text-teal-300 border border-teal-500/20">
              Target: Day Before Panic (~24h lookahead)
            </span>
            <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-slate-800 text-teal-300 border border-teal-500/20">
              Deployed Model: RandomForest (35 dynamic features)
            </span>
            <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-slate-800 text-teal-300 border border-teal-500/20">
              License: CC BY 4.0 Clinical Phenotyping Cohort
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
