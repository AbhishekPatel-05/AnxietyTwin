import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Brain, 
  Heart, 
  Coffee, 
  Moon, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  User,
  Activity,
  Smile,
  Lock,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [ageRange, setAgeRange] = useState('26-35');
  const [sex, setSex] = useState('prefer_not_to_say');
  const [activityLevel, setActivityLevel] = useState<'light' | 'moderate' | 'active'>('moderate');
  const [sleepHours, setSleepHours] = useState(7.5);
  const [caffeineCups, setCaffeineCups] = useState(1);
  const [restingHr, setRestingHr] = useState<number | ''>(72);
  const [baselineAnxiety, setBaselineAnxiety] = useState(3);
  const [medicalNotes, setMedicalNotes] = useState('');
  const [consentHealth, setConsentHealth] = useState(true);
  const [consentResearch, setConsentResearch] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Recover any existing onboarding data
    const loadExistingProfile = async () => {
      try {
        const userStr = localStorage.getItem('anxietytwin_user');
        if (userStr) {
          const u = JSON.parse(userStr);
          if (u.full_name) setDisplayName(u.full_name);
        }

        const profile = await api.getProfile();
        if (profile) {
          if (profile.baseline_resting_hr) setRestingHr(profile.baseline_resting_hr);
          if (profile.baseline_sleep_hours) setSleepHours(profile.baseline_sleep_hours);
          if (profile.baseline_caffeine_cups !== undefined) setCaffeineCups(profile.baseline_caffeine_cups);
          if (profile.medical_history_notes) setMedicalNotes(profile.medical_history_notes);
          if (profile.biological_sex) setSex(profile.biological_sex);
        }
      } catch (err) {
        console.warn('No previous profile draft found', err);
      } finally {
        setInitLoading(false);
      }
    };
    loadExistingProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentHealth) {
      setError('Health data processing consent is required to calibrate your Digital Twin.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const consents = ['health_data_processing'];
      if (consentResearch) consents.push('simulation_research');

      // Approximate age midpoint for demographic context if entered
      const ageMap: Record<string, number> = {
        '18-25': 22,
        '26-35': 30,
        '36-50': 43,
        '51-65': 58,
        '65+': 70,
        'prefer_not_to_say': 30,
      };

      await api.completeOnboarding({
        age: ageMap[ageRange] || 30,
        biological_sex: sex,
        baseline_resting_hr: restingHr ? Number(restingHr) : 72.0,
        baseline_sleep_hours: Number(sleepHours),
        baseline_caffeine_cups: Number(caffeineCups),
        baseline_hrv_ms: 45.0,
        has_panic_history: false,
        medical_history_notes: medicalNotes,
        trait_anxiety_score: baselineAnxiety * 4.0,
        consents,
      });

      // Also record first day observations from onboarding inputs
      try {
        await api.createCheckin({
          subjective_anxiety_score: baselineAnxiety,
          energy_level: 3,
          somatic_symptoms: [],
          triggers_noted: 'Initial onboarding check-in',
          notes: 'Baseline initialization during onboarding.',
          sleep_hours: Number(sleepHours),
          caffeine_cups: Number(caffeineCups),
          heart_rate_bpm: restingHr ? Number(restingHr) : 72.0,
          steps_count: activityLevel === 'active' ? 9500 : activityLevel === 'moderate' ? 6000 : 3500,
        });
      } catch (err) {
        console.warn('Initial observation auto-record notice:', err);
      }

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  if (initLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Non-Diagnostic Clear Notice */}
      <div className="p-4 rounded-xl bg-slate-900 border border-teal-500/30 text-teal-300 text-xs flex items-center space-x-2">
        <ShieldCheck className="w-4 h-4 shrink-0 text-teal-400" />
        <span>
          <strong>Research Calibration Notice:</strong> This onboarding survey establishes baseline priors for your virtual Digital Twin.
          It does NOT diagnose medical conditions or calculate clinical risk.
        </span>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl space-y-8 backdrop-blur">
        {/* Header */}
        <div className="border-b border-slate-800 pb-6 space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-500/10 text-teal-300 text-xs font-medium border border-teal-500/20">
            <Brain className="w-3.5 h-3.5" />
            <span>Digital Twin Calibration Step</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Personal Baseline &amp; Privacy Setup</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Your Digital Twin begins with these initial estimates. As you record daily check-ins, the engine transitions from these priors to your empirical rolling baseline.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Identity & General Context */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-teal-300 uppercase tracking-wider flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5" />
              <span>1. Profile Context</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Preferred Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Age Range (Optional)</label>
                <select
                  value={ageRange}
                  onChange={(e) => setAgeRange(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="18-25">18 – 25 years</option>
                  <option value="26-35">26 – 35 years</option>
                  <option value="36-50">36 – 50 years</option>
                  <option value="51-65">51 – 65 years</option>
                  <option value="65+">65+ years</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Biological Sex (Optional)</label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="prefer_not_to_say">Prefer not to say</option>
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Daily Lifestyle Priors */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-teal-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span>2. Daily Lifestyle &amp; Activity Baseline</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Sleep */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                    <Moon className="w-4 h-4 text-indigo-400" />
                    <span>Typical Sleep Duration</span>
                  </label>
                  <span className="text-xs font-mono text-indigo-300 font-bold">{sleepHours} hrs</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="12"
                  step="0.5"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
                <p className="text-[11px] text-slate-400">Used as reference prior for circadian debt calculations.</p>
              </div>

              {/* Caffeine */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                    <Coffee className="w-4 h-4 text-amber-400" />
                    <span>Typical Caffeine Intake</span>
                  </label>
                  <span className="text-xs font-mono text-amber-300 font-bold">{caffeineCups} cups/day</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="6"
                  step="0.5"
                  value={caffeineCups}
                  onChange={(e) => setCaffeineCups(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <p className="text-[11px] text-slate-400">Tracks stimulant consumption relative to your personal norm.</p>
              </div>
            </div>

            {/* Daily Activity Level */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
              <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                <Activity className="w-4 h-4 text-teal-400" />
                <span>General Daily Activity Pattern</span>
              </label>
              <div className="grid grid-cols-3 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setActivityLevel('light')}
                  className={`p-2.5 rounded-lg border text-xs text-center transition-all ${
                    activityLevel === 'light'
                      ? 'bg-teal-950/50 border-teal-500 text-teal-200'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <p className="font-semibold">Light / Sedentary</p>
                  <span className="text-[10px] text-slate-400">&lt; 5,000 steps</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivityLevel('moderate')}
                  className={`p-2.5 rounded-lg border text-xs text-center transition-all ${
                    activityLevel === 'moderate'
                      ? 'bg-teal-950/50 border-teal-500 text-teal-200'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <p className="font-semibold">Moderate</p>
                  <span className="text-[10px] text-slate-400">5k – 10k steps</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivityLevel('active')}
                  className={`p-2.5 rounded-lg border text-xs text-center transition-all ${
                    activityLevel === 'active'
                      ? 'bg-teal-950/50 border-teal-500 text-teal-200'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <p className="font-semibold">Active</p>
                  <span className="text-[10px] text-slate-400">&gt; 10,000 steps</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Physiological Prior & Check-in */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-teal-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              <span>3. Physiological Observation &amp; Mood Check-In</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Resting HR (Manual or wearable) */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                    <Heart className="w-4 h-4 text-rose-400" />
                    <span>Typical Resting Heart Rate</span>
                  </label>
                  <span className="text-xs font-mono text-rose-300 font-bold">{restingHr || 72} BPM</span>
                </div>
                <input
                  type="number"
                  min="40"
                  max="140"
                  placeholder="72"
                  value={restingHr}
                  onChange={(e) => setRestingHr(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500"
                />
                <p className="text-[11px] text-slate-400">
                  Label: <strong>Manual Entry</strong> (or from Apple Watch / Fitbit / Garmin reading). Normal range: 60–80 BPM.
                </p>
              </div>

              {/* Baseline Mood / Anxiety Rating */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                    <Smile className="w-4 h-4 text-sky-400" />
                    <span>Initial Anxiety / Mood Rating</span>
                  </label>
                  <span className="text-xs font-mono text-sky-300 font-bold">{baselineAnxiety} / 10</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={baselineAnxiety}
                  onChange={(e) => setBaselineAnxiety(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
                <p className="text-[11px] text-slate-400">
                  0 = Completely calm, 10 = Acute tension. Provides the starting psychological reference point.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Privacy & Research Consents */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <h3 className="text-xs font-semibold text-teal-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>4. Data Privacy &amp; Consent</span>
            </h3>

            <div className="space-y-3">
              <label className="flex items-start space-x-3 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentHealth}
                  onChange={(e) => setConsentHealth(e.target.checked)}
                  className="mt-1 accent-teal-500 rounded"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-semibold text-slate-200">Consent for Digital Twin Baseline Processing (Required)</span>
                  <p className="text-slate-400">
                    Allows AnxietyTwin to compute rolling averages and autonomic strain indicators exclusively for your authenticated user account.
                  </p>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentResearch}
                  onChange={(e) => setConsentResearch(e.target.checked)}
                  className="mt-1 accent-teal-500 rounded"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-semibold text-slate-200">Consent for Counterfactual Simulation Evaluation (Optional)</span>
                  <p className="text-slate-400">
                    Allows evaluating hypothetical scenarios against research study archetypes in the Simulation Workbench.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Submit CTA */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-400">
              You can update any of these settings anytime in Settings &amp; Privacy.
            </span>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold shadow-lg shadow-teal-900/30 transition-all hover:scale-[1.01] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Calibrating Twin...</span>
                </>
              ) : (
                <>
                  <span>Complete Setup &amp; Launch Twin</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
