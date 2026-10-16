import React, { useState } from 'react';
import { PhoneCall, ShieldAlert, X, Globe } from 'lucide-react';

export const CrisisBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Mental Health Safety Guardrail"
      className="bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border-b border-indigo-500/30 px-3 sm:px-4 py-2 text-xs"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-300">
          <div className="flex items-center space-x-1.5 text-teal-400 shrink-0 font-semibold">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span className="text-slate-100">Safety Guardrail:</span>
          </div>

          <span className="text-slate-300 text-[11px] sm:text-xs">
            Not an emergency service. In crisis, free 24/7 confidential help is available:
          </span>

          <span className="inline-flex items-center space-x-1 font-mono text-teal-300 font-semibold text-[11px] sm:text-xs">
            <PhoneCall className="w-3 h-3 shrink-0" />
            <span>US &amp; CA: Call/Text 988</span>
          </span>

          <span className="text-slate-400 text-[11px]">|</span>

          <span className="text-slate-300 text-[11px] font-mono">
            US/CA Text: 741741 &bull; UK Text: 85258
          </span>

          <span className="text-slate-400 text-[11px]">|</span>

          <span className="text-slate-300 text-[11px] font-mono">
            UK: Call 111 &bull; EU: Call 112
          </span>

          <span className="text-slate-400 text-[11px]">|</span>

          <a
            href="https://findahelpline.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 text-indigo-300 hover:text-white underline text-[11px]"
            title="Global Crisis Directory covering 130+ countries"
          >
            <Globe className="w-3 h-3 shrink-0" />
            <span>Global Directory: findahelpline.com</span>
          </a>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="self-end sm:self-auto text-slate-400 hover:text-slate-200 p-1 rounded transition-colors"
          title="Dismiss banner"
          aria-label="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
