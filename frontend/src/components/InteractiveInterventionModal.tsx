import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Wind,
  Eye,
  Moon,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  RotateCcw,
  Play,
  Pause,
  AlertCircle,
  Heart,
  Smile,
  Meh,
  Frown,
  Sliders,
  HelpCircle
} from 'lucide-react';
import { api } from '../services/api';
import { InterventionSession, InterventionSessionCreate } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialActivity?: 'breathing_478' | 'grounding_54321' | 'sleep_hygiene' | 'checkin_prompt' | null;
  triggerSignal?: string;
  onCompleted?: (session: InterventionSession) => void;
}

export const InteractiveInterventionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialActivity = 'breathing_478',
  triggerSignal = 'user_initiated',
  onCompleted,
}) => {
  const [activity, setActivity] = useState<'breathing_478' | 'grounding_54321' | 'sleep_hygiene'>(
    (initialActivity === 'checkin_prompt' ? 'breathing_478' : initialActivity) || 'breathing_478'
  );
  const [step, setStep] = useState<'pre' | 'active' | 'post'>('pre');
  const [preRating, setPreRating] = useState<number>(6);
  const [postRating, setPostRating] = useState<number>(4);
  const [helpfulness, setHelpfulness] = useState<'helpful' | 'somewhat_helpful' | 'not_helpful' | 'prefer_not_to_say'>('helpful');
  const [userNotes, setUserNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 4-7-8 Breathing State
  const [breathPhase, setBreathPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [breathTimer, setBreathTimer] = useState<number>(4);
  const [breathCycle, setBreathCycle] = useState<number>(1);
  const [isBreathingRunning, setIsBreathingRunning] = useState<boolean>(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Grounding Checklist State
  const [groundingChecks, setGroundingChecks] = useState<{ [key: string]: boolean }>({
    see_5: false,
    touch_4: false,
    hear_3: false,
    smell_2: false,
    taste_1: false,
  });

  // Sleep Hygiene Checklist State
  const [sleepChecks, setSleepChecks] = useState<{ [key: string]: boolean }>({
    screen_cutoff: false,
    caffeine_limit: false,
    dark_cool_room: false,
    fixed_wake_time: false,
  });

  useEffect(() => {
    if (initialActivity && initialActivity !== 'checkin_prompt') {
      setActivity(initialActivity);
    }
    setStep('pre');
    setPreRating(6);
    setPostRating(4);
    setUserNotes('');
    setBreathPhase('inhale');
    setBreathTimer(4);
    setBreathCycle(1);
    setIsBreathingRunning(true);
    setError(null);
  }, [isOpen, initialActivity]);

  // 4-7-8 Breathing Cycle Timer
  useEffect(() => {
    if (step !== 'active' || activity !== 'breathing_478' || !isBreathingRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setBreathTimer((prev) => {
        if (prev > 1) {
          return prev - 1;
        }

        // Transition to next phase
        if (breathPhase === 'inhale') {
          setBreathPhase('hold');
          return 7;
        } else if (breathPhase === 'hold') {
          setBreathPhase('exhale');
          return 8;
        } else {
          setBreathPhase('inhale');
          setBreathCycle((c) => Math.min(c + 1, 8));
          return 4;
        }
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, activity, isBreathingRunning, breathPhase]);

  if (!isOpen) return null;

  const handleStartActivity = () => {
    setStep('active');
    setBreathCycle(1);
    setBreathPhase('inhale');
    setBreathTimer(4);
    setIsBreathingRunning(true);
  };

  const handleFinishActivity = () => {
    // Set post rating initial value relative to pre rating
    setPostRating(Math.max(1, preRating - 2));
    setStep('post');
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload: InterventionSessionCreate = {
        intervention_type: activity,
        trigger_signal: triggerSignal,
        status: 'completed',
        pre_distress_rating: preRating,
        post_distress_rating: postRating,
        helpfulness,
        user_notes: userNotes.trim() || undefined,
        source_type: 'user_entered',
        context_snapshot: {
          activity_name:
            activity === 'breathing_478'
              ? '4-7-8 Breathing Pacer'
              : activity === 'grounding_54321'
              ? '5-4-3-2-1 Sensory Grounding'
              : 'Circadian Sleep Hygiene Protocol',
          completed_at_local: new Date().toLocaleTimeString(),
        },
      };

      const recorded = await api.recordIntervention(payload);
      if (onCompleted) {
        onCompleted(recorded);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record intervention feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const ratingDelta = Number((postRating - preRating).toFixed(1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center space-x-2">
                <span>Personalized Supportive Wellness Exercise</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-500/10 text-teal-300 border border-teal-500/30">
                  Evidence-Based
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Supportive physiological and somatic stabilization. Non-medical research prototype.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Activity Selector Tabs (only shown on 'pre' phase) */}
          {step === 'pre' && (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Select Supportive Activity:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setActivity('breathing_478')}
                  className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between space-y-2 ${
                    activity === 'breathing_478'
                      ? 'bg-teal-500/15 border-teal-500/40 text-teal-200 shadow-md shadow-teal-950/40'
                      : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Wind className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold text-white">4-7-8 Breathing</span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-80">
                    Diaphragmatic pacing to activate vagal parasympathetic tone.
                  </p>
                  <span className="text-[10px] font-mono text-teal-400">~5 mins &bull; Autonomic</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivity('grounding_54321')}
                  className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between space-y-2 ${
                    activity === 'grounding_54321'
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200 shadow-md shadow-indigo-950/40'
                      : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Eye className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white">5-4-3-2-1 Grounding</span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-80">
                    Somatic sensory orientation to interrupt acute anxiety loops.
                  </p>
                  <span className="text-[10px] font-mono text-indigo-400">~4 mins &bull; Somatic</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivity('sleep_hygiene')}
                  className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between space-y-2 ${
                    activity === 'sleep_hygiene'
                      ? 'bg-purple-500/15 border-purple-500/40 text-purple-200 shadow-md shadow-purple-950/40'
                      : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Moon className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-white">Sleep Hygiene</span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-80">
                    Evening wind-down checklist for circadian recovery.
                  </p>
                  <span className="text-[10px] font-mono text-purple-400">~3 mins &bull; Circadian</span>
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 1: PRE-ACTIVITY RATING */}
          {/* ------------------------------------------------------------- */}
          {step === 'pre' && (
            <div className="space-y-6 pt-2">
              <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    How tense or distressed do you feel right now? (0–10)
                  </label>
                  <span className={`text-sm font-bold font-mono px-3 py-0.5 rounded-full border ${
                    preRating <= 3 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                    preRating <= 6 ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                    'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  }`}>
                    {preRating} / 10
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={preRating}
                  onChange={(e) => setPreRating(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-400"
                />
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>0 - Completely Calm</span>
                  <span>5 - Moderate Tension</span>
                  <span>10 - Severe Distress</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-400 max-w-sm">
                  Your rating will establish a baseline before the exercise to evaluate your personal subjective experience.
                </p>
                <button
                  type="button"
                  onClick={handleStartActivity}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white text-xs font-bold shadow-lg shadow-teal-500/20 transition-all flex items-center space-x-2"
                >
                  <span>Begin Exercise</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 2: ACTIVE SESSION INTERFACE */}
          {/* ------------------------------------------------------------- */}
          {step === 'active' && (
            <div className="space-y-6">
              {/* Activity 1: 4-7-8 Breathing Pacer */}
              {activity === 'breathing_478' && (
                <div className="flex flex-col items-center justify-center p-8 bg-slate-950/60 border border-slate-800 rounded-3xl space-y-6">
                  {/* Dynamic Expanding/Contracting Breathing Ring */}
                  <div className="relative w-48 h-48 flex items-center justify-center">
                    <div
                      className={`absolute rounded-full transition-all duration-1000 ease-in-out border-2 ${
                        breathPhase === 'inhale'
                          ? 'w-44 h-44 bg-teal-500/20 border-teal-400 scale-100 animate-pulse'
                          : breathPhase === 'hold'
                          ? 'w-44 h-44 bg-indigo-500/25 border-indigo-400 scale-105'
                          : 'w-28 h-28 bg-emerald-500/20 border-emerald-400 scale-95'
                      }`}
                    />
                    <div className="relative text-center z-10 space-y-1">
                      <span className="text-3xl font-extrabold font-mono text-white tracking-wider">
                        {breathTimer}s
                      </span>
                      <p className="text-xs uppercase font-bold tracking-widest text-teal-300">
                        {breathPhase === 'inhale' ? 'Inhale Deeply (4s)' : breathPhase === 'hold' ? 'Hold Breath (7s)' : 'Slow Exhale (8s)'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 text-xs font-mono text-slate-400">
                    <span>Cycle {breathCycle} of 4</span>
                    <span>&bull;</span>
                    <button
                      type="button"
                      onClick={() => setIsBreathingRunning(!isBreathingRunning)}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    >
                      {isBreathingRunning ? 'Pause' : 'Resume'}
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 text-center max-w-md leading-relaxed">
                    Breathe in gently through your nose for 4 seconds, hold gently for 7 seconds, and exhale slowly with a whoosh sound for 8 seconds.
                  </p>
                </div>
              )}

              {/* Activity 2: 5-4-3-2-1 Sensory Grounding */}
              {activity === 'grounding_54321' && (
                <div className="space-y-4 p-6 bg-slate-950/60 border border-slate-800 rounded-3xl">
                  <div className="border-b border-slate-800 pb-3">
                    <h3 className="text-sm font-bold text-white">5-4-3-2-1 Sensory Orienting Checklist</h3>
                    <p className="text-xs text-slate-400">Take a moment to notice each sensory cue around you.</p>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { key: 'see_5', count: '5', label: 'Acknowledge 5 things you can SEE around you (e.g. lamp, window, pen)' },
                      { key: 'touch_4', count: '4', label: 'Notice 4 things you can physically FEEL (e.g. feet on floor, fabric of shirt)' },
                      { key: 'hear_3', count: '3', label: 'Listen for 3 distinct sounds (e.g. clock ticking, distant traffic, fan)' },
                      { key: 'smell_2', count: '2', label: 'Identify 2 scents you can smell (e.g. coffee, fresh air, paper)' },
                      { key: 'taste_1', count: '1', label: 'Notice 1 taste in your mouth (e.g. mint, water, lingering tea)' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() =>
                          setGroundingChecks((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                        }
                        className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between text-xs ${
                          groundingChecks[item.key]
                            ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-bold text-[10px] text-indigo-400">
                            {item.count}
                          </span>
                          <span>{item.label}</span>
                        </div>
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            groundingChecks[item.key] ? 'text-indigo-400' : 'text-slate-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity 3: Sleep Hygiene Protocol */}
              {activity === 'sleep_hygiene' && (
                <div className="space-y-4 p-6 bg-slate-950/60 border border-slate-800 rounded-3xl">
                  <div className="border-b border-slate-800 pb-3">
                    <h3 className="text-sm font-bold text-white">Circadian Sleep Recovery Protocol</h3>
                    <p className="text-xs text-slate-400">Key evidence-based habits to restore healthy sleep architecture.</p>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { key: 'screen_cutoff', label: 'Screen Wind-Down: Power down bright blue-light screens 60 mins before bed' },
                      { key: 'caffeine_limit', label: 'Caffeine Cutoff: Avoid caffeine intake within 6-8 hours of sleep target' },
                      { key: 'dark_cool_room', label: 'Sleep Environment: Ensure room is dark and cool (around 65-68°F / 19°C)' },
                      { key: 'fixed_wake_time', label: 'Circadian Anchor: Maintain consistent morning wake time within 30 mins' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() =>
                          setSleepChecks((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                        }
                        className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between text-xs ${
                          sleepChecks[item.key]
                            ? 'bg-purple-500/15 border-purple-500/40 text-purple-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span>{item.label}</span>
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            sleepChecks[item.key] ? 'text-purple-400' : 'text-slate-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Complete Action Button */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep('pre')}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition"
                >
                  Back to Setup
                </button>

                <button
                  type="button"
                  onClick={handleFinishActivity}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white text-xs font-bold shadow-lg shadow-teal-500/20 transition-all flex items-center space-x-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Finished &bull; Record Post-Exercise Feedback</span>
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 3: POST-ACTIVITY FEEDBACK & DELTA */}
          {/* ------------------------------------------------------------- */}
          {step === 'post' && (
            <form onSubmit={handleSubmitFeedback} className="space-y-6">
              {/* Post Distress Rating */}
              <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    How do you feel after completing the exercise? (0–10)
                  </label>
                  <span className={`text-sm font-bold font-mono px-3 py-0.5 rounded-full border ${
                    postRating <= 3 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                    postRating <= 6 ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                    'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  }`}>
                    {postRating} / 10
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={postRating}
                  onChange={(e) => setPostRating(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-400"
                />

                {/* Rating Delta Comparison Banner */}
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Pre-Exercise: <b className="text-slate-200">{preRating}/10</b></span>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-400">Post-Exercise: <b className="text-slate-200">{postRating}/10</b></span>
                  <span className={`px-2.5 py-0.5 rounded font-bold ${
                    ratingDelta < 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                    ratingDelta === 0 ? 'bg-slate-800 text-slate-300' :
                    'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}>
                    Δ {ratingDelta > 0 ? `+${ratingDelta}` : ratingDelta} points
                  </span>
                </div>
              </div>

              {/* Subjective Helpfulness */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  Did this activity feel helpful?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'helpful', label: 'Helpful', icon: Smile, color: 'text-emerald-400' },
                    { id: 'somewhat_helpful', label: 'Somewhat', icon: Meh, color: 'text-amber-400' },
                    { id: 'not_helpful', label: 'Not Helpful', icon: Frown, color: 'text-rose-400' },
                    { id: 'prefer_not_to_say', label: 'Neutral / Pass', icon: HelpCircle, color: 'text-slate-400' },
                  ].map((h) => {
                    const Icon = h.icon;
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setHelpfulness(h.id as any)}
                        className={`p-3 rounded-xl border text-xs font-medium transition flex items-center justify-center space-x-2 ${
                          helpfulness === h.id
                            ? 'bg-teal-500/15 border-teal-500/40 text-teal-200'
                            : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${h.color}`} />
                        <span>{h.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Reflection Notes */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  Optional Reflection Notes:
                </label>
                <textarea
                  rows={2}
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  placeholder="e.g., Felt calmer after 3 cycles, chest tightness relaxed..."
                  className="w-full bg-slate-800/60 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                />
              </div>

              {/* Scientific Disclaimer */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p>
                  <b>Scientific Disclosure:</b> Self-reported distress ratings reflect personal subjective experience and do not establish clinical causation.
                  This feedback is logged in your longitudinal history and is NOT used to automatically retrain machine learning models.
                </p>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('active')}
                  className="px-4 py-2.5 rounded-xl text-xs text-slate-400 hover:text-white transition"
                >
                  Back to Exercise
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white text-xs font-bold shadow-lg shadow-teal-500/20 transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submitting ? 'Saving Feedback...' : 'Save Activity & Record Feedback'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
