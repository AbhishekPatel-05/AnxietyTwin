import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { CrisisBanner } from './components/CrisisBanner';
import { Footer } from './components/Footer';
import { AIAssistantDrawer } from './components/AIAssistantDrawer';

import { LandingPage } from './pages/LandingPage';
import { RegisterPage } from './pages/RegisterPage';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { DigitalTwinPage } from './pages/DigitalTwinPage';
import { HistoryPage } from './pages/HistoryPage';
import { CheckinPage } from './pages/CheckinPage';
import { SimulationLabPage } from './pages/SimulationLabPage';
import { SettingsPage } from './pages/SettingsPage';
import { ClinicianWorkspacePage } from './pages/ClinicianWorkspacePage';
import { InterventionsPage } from './pages/InterventionsPage';
import { PatternDiscoveryPage } from './pages/PatternDiscoveryPage';
import { WellnessGoalsPage } from './pages/WellnessGoalsPage';
import { JournalPage } from './pages/JournalPage';
import { DataQualityPage } from './pages/DataQualityPage';
import { WeeklyReportPage } from './pages/WeeklyReportPage';
import { PrivacyConsentPage } from './pages/PrivacyConsentPage';

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('anxietytwin_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500/30 selection:text-teal-200">
        <CrisisBanner />
        <Navbar />
        <main className="flex-1">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/simulation" element={<SimulationLabPage />} />

            {/* Protected Routes */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/twin"
              element={
                <ProtectedRoute>
                  <DigitalTwinPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <HistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/checkin"
              element={
                <ProtectedRoute>
                  <CheckinPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interventions"
              element={
                <ProtectedRoute>
                  <InterventionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patterns"
              element={
                <ProtectedRoute>
                  <PatternDiscoveryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/goals"
              element={
                <ProtectedRoute>
                  <WellnessGoalsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/journal"
              element={
                <ProtectedRoute>
                  <JournalPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/data-quality"
              element={
                <ProtectedRoute>
                  <DataQualityPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/weekly-report"
              element={
                <ProtectedRoute>
                  <WeeklyReportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/privacy"
              element={
                <ProtectedRoute>
                  <PrivacyConsentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clinician"
              element={
                <ProtectedRoute>
                  <ClinicianWorkspacePage />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <AIAssistantDrawer />
        <Footer />
      </div>
    </Router>
  );
};

export default App;
