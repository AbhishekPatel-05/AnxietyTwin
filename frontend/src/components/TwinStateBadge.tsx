import React from 'react';

interface TwinStateBadgeProps {
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

export const TwinStateBadge: React.FC<TwinStateBadgeProps> = ({ label, size = 'md' }) => {
  const getStyles = () => {
    switch (label) {
      case 'STABLE_BASELINE':
        return {
          bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
          dot: 'bg-emerald-400',
          text: 'Stable Baseline',
          desc: 'Physiological arousal & lifestyle within normal personal range.',
        };
      case 'MILD_STRAIN':
        return {
          bg: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
          dot: 'bg-sky-400',
          text: 'Mild Strain',
          desc: 'Minor elevation in sympathetic activity or slight sleep deficit.',
        };
      case 'ELEVATED_AROUSAL':
        return {
          bg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
          dot: 'bg-amber-400',
          text: 'Elevated Arousal',
          desc: 'Noticeable autonomic arousal; baseline deviation detected.',
        };
      case 'HIGH_VULNERABILITY':
        return {
          bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          dot: 'bg-rose-400',
          text: 'High Vulnerability',
          desc: 'High multi-modal stress index; self-care grounding recommended.',
        };
      case 'RECOVERY':
        return {
          bg: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
          dot: 'bg-teal-400',
          text: 'Recovery Phase',
          desc: 'Physiological parameters normalizing following acute elevation.',
        };
      default:
        return {
          bg: 'bg-slate-700/30 text-slate-300 border-slate-600',
          dot: 'bg-slate-400',
          text: label.replace('_', ' '),
          desc: 'Virtual patient state snapshot.',
        };
    }
  };

  const style = getStyles();
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3.5 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center space-x-1.5 rounded-full border font-semibold tracking-wide ${style.bg} ${sizeClasses[size]}`}
      title={style.desc}
    >
      <span className={`w-2 h-2 rounded-full ${style.dot} animate-pulse`} />
      <span>{style.text}</span>
    </span>
  );
};

export const ProvenanceTag: React.FC<{ source: string }> = ({ source }) => {
  let badgeStyle = 'bg-slate-800 text-slate-300 border-slate-700';
  let label = 'User Entered';

  if (source === 'synthetic' || source === 'simulation_lab' || source === 'synthetic_playback') {
    badgeStyle = 'bg-purple-950/40 text-purple-300 border-purple-500/30';
    label = 'Synthetic Demo';
  } else if (source === 'device_measurement' || source === 'device_measured') {
    badgeStyle = 'bg-teal-950/40 text-teal-300 border-teal-500/30';
    label = 'Device Measured';
  }

  return (
    <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${badgeStyle}`}>
      {label}
    </span>
  );
};
