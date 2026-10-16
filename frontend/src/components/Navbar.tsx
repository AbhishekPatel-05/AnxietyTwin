import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Activity, 
  Brain, 
  Heart, 
  History, 
  Sliders, 
  Settings, 
  LogOut, 
  Sparkles,
  Menu,
  X,
  UserCheck,
  BookOpen,
  Target,
  ShieldCheck,
  FileText,
  ChevronDown
} from 'lucide-react';
import { api } from '../services/api';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const token = localStorage.getItem('anxietytwin_token');
  const userStr = localStorage.getItem('anxietytwin_user');
  const user = userStr ? JSON.parse(userStr) : null;

  const handleLogout = () => {
    api.clearToken();
    navigate('/login');
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown and mobile menu on route change
  useEffect(() => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Primary links visible directly on desktop
  const primaryLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: Activity, protected: true },
    { name: 'Twin', path: '/twin', icon: Brain, protected: true },
    { name: 'Check-in', path: '/checkin', icon: Heart, protected: true },
    { name: 'Interventions', path: '/interventions', icon: Sparkles, protected: true },
    { name: 'History', path: '/history', icon: History, protected: true },
    { name: 'Simulation Lab', path: '/simulation', icon: Sliders, protected: false },
  ];

  // Secondary tools & insights in dropdown
  const secondaryLinks = [
    { name: 'Emotion Journal', path: '/journal', icon: BookOpen, protected: true },
    { name: 'Pattern Discovery', path: '/patterns', icon: Sparkles, protected: true },
    { name: 'Wellness Goals', path: '/goals', icon: Target, protected: true },
    { name: 'Data Quality', path: '/data-quality', icon: ShieldCheck, protected: true },
    { name: 'Weekly Report', path: '/weekly-report', icon: FileText, protected: true },
    { name: 'Clinician Review', path: '/clinician', icon: UserCheck, protected: true },
    { name: 'Privacy Center', path: '/privacy', icon: Settings, protected: true },
  ];

  const filteredPrimary = primaryLinks.filter(l => !l.protected || (l.protected && token));
  const filteredSecondary = secondaryLinks.filter(l => !l.protected || (l.protected && token));

  const isDropdownActive = filteredSecondary.some(l => location.pathname === l.path);

  return (
    <nav className="bg-slate-900/95 border-b border-slate-800 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Logo & Brand */}
          <Link to={token ? "/dashboard" : "/"} className="flex items-center space-x-3 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-teal-500/20 group-hover:scale-105 transition-transform">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold tracking-tight text-white font-sans">Anxiety<span className="text-teal-400">Twin</span></span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20">Research</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-tight -mt-0.5">Healthcare Digital Twin Lab</p>
            </div>
          </Link>

          {/* Desktop Nav Items */}
          <div className="hidden lg:flex items-center space-x-1">
            {filteredPrimary.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm shadow-teal-500/10'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                  <span className="whitespace-nowrap">{item.name}</span>
                </Link>
              );
            })}

            {/* Dropdown for Secondary Tools & Insights */}
            {filteredSecondary.length > 0 && (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isDropdownActive
                      ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm shadow-teal-500/10'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <span>Insights &amp; Tools</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${dropdownOpen ? 'rotate-180 text-teal-400' : 'text-slate-400'}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 space-y-1 backdrop-blur-xl">
                    <div className="px-3 py-1.5 text-[10px] uppercase font-mono tracking-wider text-slate-500 border-b border-slate-800 mb-1">
                      Extended Workspaces
                    </div>
                    {filteredSecondary.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            isActive
                              ? 'bg-teal-500/20 text-teal-300 font-semibold'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                          <span className="whitespace-nowrap">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User actions */}
          <div className="hidden md:flex items-center space-x-2.5 shrink-0">
            {token ? (
              <div className="flex items-center space-x-2.5">
                <Link
                  to="/checkin"
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-600 text-white text-xs font-semibold shadow-md shadow-teal-500/20 hover:from-teal-400 hover:to-emerald-500 transition-all hover:scale-[1.02] whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Quick Check-In</span>
                </Link>

                <div className="text-right hidden sm:block">
                  <p className="text-xs font-medium text-slate-200 truncate max-w-[120px]">{user?.full_name || user?.email || 'Participant'}</p>
                  {user?.role === 'clinician' ? (
                    <p className="text-[10px] text-teal-400 flex items-center justify-end space-x-1 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></span>
                      <span>Clinician Verified</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-emerald-400 flex items-center justify-end space-x-1 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>Twin Synced</span>
                    </p>
                  )}
                </div>

                <button
                  onClick={handleLogout}
                  title="Log out"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-500 rounded-lg shadow-md shadow-teal-600/20 transition-all whitespace-nowrap"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu trigger */}
          <div className="flex lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 pt-2 pb-4 space-y-3 max-h-[80vh] overflow-y-auto">
          {token && (
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">{user?.full_name || user?.email || 'Participant'}</p>
                <p className="text-[10px] text-teal-400 font-mono">
                  {user?.role === 'clinician' ? 'Clinician Verified' : 'Twin Synced'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center space-x-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log out</span>
              </button>
            </div>
          )}

          <div>
            <div className="text-[10px] font-mono uppercase text-slate-500 px-2 py-1">Core Actions</div>
            <div className="space-y-1">
              {filteredPrimary.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium ${
                      isActive ? 'bg-teal-500/20 text-teal-300' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-teal-400" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {filteredSecondary.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase text-slate-500 px-2 py-1 border-t border-slate-800/80 pt-2">
                Insights &amp; Care
              </div>
              <div className="space-y-1">
                {filteredSecondary.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium ${
                        isActive ? 'bg-teal-500/20 text-teal-300' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-teal-400" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};
