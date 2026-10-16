import React, { useState, useEffect } from 'react';
import { Wind, Play, Pause, RefreshCw } from 'lucide-react';

export type BreathPhase = 'Inhale (4s)' | 'Hold (7s)' | 'Exhale (8s)';

export const PHASE_DURATIONS: Record<BreathPhase, number> = {
  'Inhale (4s)': 4,
  'Hold (7s)': 7,
  'Exhale (8s)': 8,
};

export const NEXT_PHASES: Record<BreathPhase, BreathPhase> = {
  'Inhale (4s)': 'Hold (7s)',
  'Hold (7s)': 'Exhale (8s)',
  'Exhale (8s)': 'Inhale (4s)',
};

export const BreathingPacer: React.FC = () => {
  const [isBreathingActive, setIsBreathingActive] = useState(false);
  const [isBreathingPaused, setIsBreathingPaused] = useState(false);
  const [breathState, setBreathState] = useState<{
    phase: BreathPhase;
    secondsLeft: number;
  }>({
    phase: 'Inhale (4s)',
    secondsLeft: 4,
  });

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isBreathingActive) {
      interval = setInterval(() => {
        setBreathState((prev) => {
          if (prev.secondsLeft > 0) {
            return {
              ...prev,
              secondsLeft: prev.secondsLeft - 1,
            };
          } else {
            // Transition between Inhale (4s) -> Hold (7s) -> Exhale (8s) -> Inhale (4s)
            const nextPhase = NEXT_PHASES[prev.phase];
            return {
              phase: nextPhase,
              secondsLeft: PHASE_DURATIONS[nextPhase],
            };
          }
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isBreathingActive]);

  const handleTogglePlayPause = () => {
    if (isBreathingActive) {
      setIsBreathingActive(false);
      setIsBreathingPaused(true);
    } else {
      setIsBreathingActive(true);
      setIsBreathingPaused(false);
    }
  };

  const handleStopReset = () => {
    setIsBreathingActive(false);
    setIsBreathingPaused(false);
    setBreathState({
      phase: 'Inhale (4s)',
      secondsLeft: 4,
    });
  };

  return (
    <div className="p-6 rounded-xl bg-slate-800/40 border border-slate-700/50 text-center space-y-4">
      <h3 className="text-sm font-semibold text-white flex items-center justify-center space-x-2">
        <Wind className="w-4 h-4 text-teal-400" />
        <span>Optional Grounding Support: 4-7-8 Breathing Pacer</span>
      </h3>
      <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
        Deep breathing exercises can help down-regulate sympathetic arousal for many people.
        However, breathwork is <strong>completely voluntary</strong> and may not suit everyone
        (e.g., hyperventilation sensitivity or respiratory discomfort). Stop immediately if you feel lightheaded.
        This does not substitute for medical or psychiatric care.
      </p>

      <div className="py-4 flex flex-col items-center justify-center space-y-4">
        <div
          aria-live="polite"
          data-testid="pacer-circle"
          aria-label={`Breathing pacer current phase: ${
            isBreathingActive
              ? `${breathState.phase}, ${breathState.secondsLeft} seconds remaining`
              : isBreathingPaused
              ? `Paused at ${breathState.phase}, ${breathState.secondsLeft} seconds remaining`
              : 'Ready'
          }`}
          className={`w-36 h-36 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-1000 ease-in-out ${
            isBreathingActive
              ? breathState.phase === 'Inhale (4s)'
                ? 'scale-110 border-teal-400 bg-teal-500/20 shadow-lg shadow-teal-500/30'
                : breathState.phase === 'Hold (7s)'
                ? 'scale-110 border-cyan-300 bg-cyan-500/20 shadow-lg shadow-cyan-500/30'
                : 'scale-95 border-teal-400 bg-teal-500/10 shadow-md shadow-teal-500/20'
              : isBreathingPaused
              ? 'scale-100 border-amber-400/80 bg-amber-500/10 shadow-md shadow-amber-500/20'
              : 'scale-100 border-teal-400/50 bg-slate-800'
          }`}
        >
          <span className="text-xs font-mono font-bold text-teal-200" data-testid="pacer-phase">
            {isBreathingActive || isBreathingPaused ? breathState.phase : 'Ready'}
          </span>
          {(isBreathingActive || isBreathingPaused) ? (
            <span className="text-3xl font-mono font-extrabold text-white my-1 tracking-tight" data-testid="pacer-countdown">
              {breathState.secondsLeft}s
            </span>
          ) : (
            <span className="text-sm font-mono text-slate-400 my-1" data-testid="pacer-countdown-ready">
              4-7-8
            </span>
          )}
          <span className="text-[10px] text-teal-400 font-mono" data-testid="pacer-status">
            {isBreathingActive ? 'Cycle Active' : isBreathingPaused ? 'Paused' : 'Press Start'}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleTogglePlayPause}
            aria-label={
              isBreathingActive
                ? "Pause breathing pacer"
                : isBreathingPaused
                ? "Resume breathing pacer"
                : "Start 4-7-8 breathing pacer"
            }
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow transition-all"
          >
            {isBreathingActive ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Pacer</span>
              </>
            ) : isBreathingPaused ? (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Resume Pacer</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Start 4-7-8 Breathing</span>
              </>
            )}
          </button>

          {(isBreathingActive || isBreathingPaused) && (
            <button
              type="button"
              onClick={handleStopReset}
              aria-label="Stop breathing pacer immediately"
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
              <span>Stop &amp; Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
