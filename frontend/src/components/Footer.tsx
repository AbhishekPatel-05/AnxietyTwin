import React from 'react';
import { ShieldCheck, ExternalLink, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-950 border-t border-slate-900 py-10 mt-auto text-xs text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center space-x-2 text-slate-200 font-semibold mb-2">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>AnxietyTwin Healthcare Research Prototype</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              A longitudinal digital twin platform demonstrating personalized autonomic baseline tracking
              and exploratory 24-hour vulnerability risk estimation.
            </p>
          </div>

          <div>
            <h4 className="text-slate-200 font-semibold mb-2">Research Attribution & Ethics</h4>
            <p className="leading-relaxed text-slate-400">
              Built on the open digital phenotyping dataset published by Jang et al., 
              <span className="italic"> Scientific Data (Nature)</span>, 2024 (11:1264).
              Released under Creative Commons Attribution 4.0 International (CC BY 4.0).
            </p>
          </div>

          <div>
            <h4 className="text-slate-200 font-semibold mb-2">Clinical Safety Disclaimer</h4>
            <p className="leading-relaxed text-slate-400">
              AnxietyTwin is an investigational software prototype and is <strong>not</strong> a medical device.
              It does not diagnose anxiety disorders or guarantee panic episode prevention. 
              Always consult qualified healthcare professionals for medical advice.
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 space-y-2 sm:space-y-0">
          <div>
            © 2026 AnxietyTwin Project. All rights reserved.
          </div>
          <div className="flex items-center space-x-4">
            <a 
              href="https://doi.org/10.1038/s41597-024-04147-6" 
              target="_blank" 
              rel="noreferrer" 
              className="hover:text-teal-400 inline-flex items-center space-x-1 transition-colors"
            >
              <span>Scientific Data (Nature) DOI</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a 
              href="https://findahelpline.com" 
              target="_blank" 
              rel="noreferrer" 
              className="hover:text-teal-400 inline-flex items-center space-x-1 transition-colors"
            >
              <span>Global Support Directories</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
