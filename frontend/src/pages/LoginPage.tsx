import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brain, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login({ email, password });
      if (res.role === 'clinician') {
        navigate('/clinician');
      } else if (!res.onboarding_completed) {
        navigate('/onboarding');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-md w-full space-y-8 bg-slate-900/80 p-8 rounded-2xl border border-slate-800 backdrop-blur shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center mx-auto shadow-lg shadow-teal-500/20">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h2>
          <p className="text-xs text-slate-400">
            Log in to view your Digital Twin state and personal baseline.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="participant@domain.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold shadow-md shadow-teal-600/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <span className="text-[11px] text-slate-500 font-medium block text-center">
            Judge & Reviewer Quick Demo Logins:
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setEmail('demo_clinician@happiesthealth.org');
                setPassword('ClinicianSecure2026!');
              }}
              className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-300 hover:bg-teal-500/20 text-[11px] font-medium transition text-center"
            >
              Demo Clinician
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('alex.demo.patient@happiesthealth.org');
                setPassword('DemoPatient2026!');
              }}
              className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 text-[11px] font-medium transition text-center"
            >
              Demo Patient
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-slate-400">
          New to AnxietyTwin?{' '}
          <Link to="/register" className="text-teal-400 hover:underline font-medium">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
};
