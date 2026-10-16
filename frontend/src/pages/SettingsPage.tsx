import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  ShieldCheck, 
  Download, 
  Trash2, 
  User, 
  Lock, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { api } from '../services/api';
import { UserProfile } from '../types';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Form states
  const [restingHr, setRestingHr] = useState(72);
  const [sleepHours, setSleepHours] = useState(7.5);
  const [caffeineCups, setCaffeineCups] = useState(1);
  const [hasPanicHistory, setHasPanicHistory] = useState(false);
  const [medicalNotes, setMedicalNotes] = useState('');

  // Consent states
  const [consentHealth, setConsentHealth] = useState(true);
  const [consentResearch, setConsentResearch] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const p = await api.getProfile();
        setProfile(p);
        setRestingHr(p.baseline_resting_hr);
        setSleepHours(p.baseline_sleep_hours);
        setCaffeineCups(p.baseline_caffeine_cups);
        setHasPanicHistory(p.has_panic_history);
        setMedicalNotes(p.medical_history_notes || '');
      } catch (err) {
        console.error('Failed to load profile', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProfile({
        baseline_resting_hr: Number(restingHr),
        baseline_sleep_hours: Number(sleepHours),
        baseline_caffeine_cups: Number(caffeineCups),
        has_panic_history: hasPanicHistory,
        medical_history_notes: medicalNotes,
      });
      setSaveMessage('Profile settings updated successfully!');
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      alert('Failed to update profile: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      const history = await api.getObservationHistory(500);
      const state = await api.getTwinState();
      const exportBlob = new Blob([
        JSON.stringify({ export_date: new Date().toISOString(), twin_state: state, history }, null, 2),
      ], { type: 'application/json' });

      const url = URL.createObjectURL(exportBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AnxietyTwin_Data_Export_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmText = prompt(
      'Type "DELETE" to permanently erase your profile, observations, and Digital Twin history:'
    );
    if (confirmText !== 'DELETE') return;

    try {
      await api.deleteAccount();
      alert('Your account and all associated health records have been permanently erased.');
      navigate('/');
    } catch (err: any) {
      alert('Deletion error: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Settings & Privacy Controls</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Manage your baseline priors, review privacy consents, and exercise data deletion rights.
        </p>
      </div>

      {saveMessage && (
        <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Section 1: Baseline Priors */}
      <form onSubmit={handleSaveProfile} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center space-x-2 text-white font-semibold text-sm border-b border-slate-800 pb-3">
          <User className="w-4 h-4 text-teal-400" />
          <span>Personal Baseline Prior Defaults</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Baseline Resting HR (BPM)</label>
            <input
              type="number"
              min="40"
              max="120"
              value={restingHr}
              onChange={(e) => setRestingHr(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Target Sleep (Hours)</label>
            <input
              type="number"
              step="0.5"
              min="4"
              max="12"
              value={sleepHours}
              onChange={(e) => setSleepHours(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Typical Caffeine (Cups)</label>
            <input
              type="number"
              min="0"
              max="10"
              value={caffeineCups}
              onChange={(e) => setCaffeineCups(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasPanicHistory}
              onChange={(e) => setHasPanicHistory(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-xs text-slate-300">History of panic disorder or sudden impending panic episodes.</span>
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Personal Context / Medical Notes</label>
          <textarea
            rows={2}
            value={medicalNotes}
            onChange={(e) => setMedicalNotes(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Update Baseline Priors'}
        </button>
      </form>

      {/* Section 2: Consents & Export */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center space-x-2 text-white font-semibold text-sm border-b border-slate-800 pb-3">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span>Privacy & Data Management</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <div>
            <h4 className="text-xs font-semibold text-white">Export Complete Data Archive</h4>
            <p className="text-[11px] text-slate-400">
              Download all your stored observations, check-ins, and Digital Twin snapshots as a JSON archive.
            </p>
          </div>
          <button
            onClick={handleExportData}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-teal-300 border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
        </div>

        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-3">
          <div className="flex items-center space-x-2 text-rose-300 font-semibold text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Danger Zone: Right to Erasure</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Permanently delete your user account and all personal observation logs from PostgreSQL.
            This action cannot be undone.
          </p>
          <button
            onClick={handleDeleteAccount}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors shadow-md shadow-rose-600/20"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Permanently Delete My Data & Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};
