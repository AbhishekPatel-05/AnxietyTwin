import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCheck,
  Brain,
  Calendar,
  Clock,
  Filter,
  FileText,
  Download,
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronRight,
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  Activity,
  Heart,
  Moon,
  Coffee,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Layers,
  Shield,
  MessageSquare,
  Lock,
  PlusCircle,
  X,
  ArrowLeft
} from 'lucide-react';
import { api } from '../services/api';
import {
  PatientCardOut,
  PatientOverviewOut,
  TimelineEventOut,
  TwinInsightOut,
  ClinicianReviewNoteOut,
  ClinicianReviewNoteCreate,
  PdfExportOptions,
  InterventionsStatusResponse,
  InterventionSession,
  EarlyWarningSignal,
  ClinicianFollowUpTask,
  ClinicianFollowUpTaskCreate,
  ClinicianTasksOverview,
} from '../types';

export const ClinicianWorkspacePage: React.FC = () => {
  // Authentication & Role
  const userStr = localStorage.getItem('anxietytwin_user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isClinician = user?.role === 'clinician' || user?.role === 'admin';

  // Patient List State
  const [patients, setPatients] = useState<PatientCardOut[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(true);

  // Patient Detail State
  const [overview, setOverview] = useState<PatientOverviewOut | null>(null);
  const [timeline, setTimeline] = useState<TimelineEventOut[]>([]);
  const [insights, setInsights] = useState<TwinInsightOut[]>([]);
  const [notes, setNotes] = useState<ClinicianReviewNoteOut[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timeline Filtering State
  const [periodDays, setPeriodDays] = useState<number>(14);
  const [hideSimulated, setHideSimulated] = useState<boolean>(true);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');

  // Modals & Active Inspect State
  const [activeTab, setActiveTab] = useState<'timeline' | 'insights' | 'prediction' | 'notes' | 'interventions' | 'followup'>('timeline');
  const [patientInterventions, setPatientInterventions] = useState<{
    status: InterventionsStatusResponse | null;
    history: InterventionSession[];
  } | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<TwinInsightOut | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<EarlyWarningSignal | null>(null);
  const [intervActivityFilter, setIntervActivityFilter] = useState<string>('all');
  const [intervSignalFilter, setIntervSignalFilter] = useState<string>('all');
  const [intervStatusFilter, setIntervStatusFilter] = useState<string>('all');
  const [intervSourceFilter, setIntervSourceFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<TimelineEventOut | null>(null);
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
  const [generatingPdf, setGeneratingPdf] = useState<boolean>(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);

  // PDF Export Customization Options
  const [pdfOptions, setPdfOptions] = useState<PdfExportOptions>({
    include_checkins: true,
    include_physiology: true,
    include_lifestyle: true,
    include_digital_twin_insights: true,
    include_ml_predictions: true,
    include_clinician_notes: true,
    include_interventions: true,
    include_simulated_data: false, // Default unchecked to maintain clinical clarity
  });

  // Note Creation Form State
  const [newNote, setNewNote] = useState<ClinicianReviewNoteCreate>({
    summary_observations: '',
    discussion_topics: '',
    follow_up_plan: '',
    follow_up_date: '',
    follow_up_status: 'planned'
  });
  const [submittingNote, setSubmittingNote] = useState<boolean>(false);
  const [noteSuccess, setNoteSuccess] = useState<string | null>(null);

  // Follow-Up Tasks State
  const [followUpTasks, setFollowUpTasks] = useState<ClinicianFollowUpTask[]>([]);
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>('all');
  const [showNewTaskModal, setShowNewTaskModal] = useState<boolean>(false);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskDesc, setNewTaskDesc] = useState<string>('');
  const [newTaskPatientNotes, setNewTaskPatientNotes] = useState<string>('');
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>('');
  const [newTaskPriority, setNewTaskPriority] = useState<string>('medium');
  const [newTaskVisible, setNewTaskVisible] = useState<boolean>(true);
  const [submittingTask, setSubmittingTask] = useState<boolean>(false);
  const [taskSuccess, setTaskSuccess] = useState<string | null>(null);

  // Reset Demo State
  const [resettingDemo, setResettingDemo] = useState<boolean>(false);

  // Load authorized patients
  const loadPatients = async () => {
    try {
      setLoadingPatients(true);
      setError(null);
      const data = await api.getClinicianPatients();
      setPatients(data);
      if (data.length > 0 && !selectedPatientId) {
        setSelectedPatientId(data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load authorized patient registry');
    } finally {
      setLoadingPatients(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  // Load selected patient data
  const loadPatientData = async (patientId: number) => {
    try {
      setLoadingData(true);
      setError(null);
      
      const [overviewData, timelineData, insightsData, notesData, interventionsData, tasksData] = await Promise.all([
        api.getPatientOverview(patientId),
        api.getPatientTimeline(patientId, {
          period_days: periodDays,
          hide_simulated: hideSimulated,
          event_types: eventTypeFilter !== 'all' ? eventTypeFilter : undefined
        }),
        api.getClinicalInsights(patientId, { period_days: periodDays }),
        api.getPatientNotes(patientId),
        api.getPatientInterventions
          ? api.getPatientInterventions(patientId, { period_days: periodDays, hide_simulated: hideSimulated }).catch(() => null)
          : Promise.resolve(null),
        api.getPatientFollowUpTasks
          ? api.getPatientFollowUpTasks(patientId).catch(() => [])
          : Promise.resolve([]),
      ]);

      setOverview(overviewData);
      setTimeline(timelineData);
      setInsights(insightsData);
      setNotes(notesData);
      setFollowUpTasks(tasksData || []);
      if (interventionsData) {
        setPatientInterventions(interventionsData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load patient records');
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !newTaskTitle.trim()) return;
    try {
      setSubmittingTask(true);
      await api.createFollowUpTask({
        patient_id: selectedPatientId,
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim() || undefined,
        patient_visible_notes: newTaskPatientNotes.trim() || undefined,
        due_date: newTaskDueDate || undefined,
        priority: newTaskPriority,
        is_patient_visible: newTaskVisible,
      });
      setShowNewTaskModal(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskPatientNotes('');
      setNewTaskDueDate('');
      const updated = await api.getPatientFollowUpTasks(selectedPatientId);
      setFollowUpTasks(updated);
      setTaskSuccess('Care coordination task created successfully.');
      setTimeout(() => setTaskSuccess(null), 3000);
    } catch (err: any) {
      alert('Failed to create task: ' + err.message);
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      await api.updateFollowUpTask(taskId, { status: newStatus });
      if (selectedPatientId) {
        const updated = await api.getPatientFollowUpTasks(selectedPatientId);
        setFollowUpTasks(updated);
      }
      setTaskSuccess(`Task status updated to ${newStatus}.`);
      setTimeout(() => setTaskSuccess(null), 3000);
    } catch (err: any) {
      alert('Failed to update task: ' + err.message);
    }
  };

  useEffect(() => {
    if (selectedPatientId) {
      loadPatientData(selectedPatientId);
    }
  }, [selectedPatientId, periodDays, hideSimulated, eventTypeFilter]);

  // Handle Note Submission
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !newNote.summary_observations.trim()) return;

    try {
      setSubmittingNote(true);
      setNoteSuccess(null);
      await api.createPatientNote(selectedPatientId, newNote);
      setNoteSuccess('Clinical review note successfully saved.');
      setNewNote({
        summary_observations: '',
        discussion_topics: '',
        follow_up_plan: '',
        follow_up_date: '',
        follow_up_status: 'planned'
      });
      // Refresh notes and overview
      const updatedNotes = await api.getPatientNotes(selectedPatientId);
      setNotes(updatedNotes);
    } catch (err: any) {
      setError(err.message || 'Failed to record clinical note.');
    } finally {
      setSubmittingNote(false);
    }
  };

  // Handle PDF Export
  const handleDownloadPdf = async () => {
    if (!selectedPatientId) return;
    try {
      setGeneratingPdf(true);
      setPdfSuccessMessage(null);
      const blob = await api.downloadPatientPdfSummary(selectedPatientId, pdfOptions);
      
      // Create download trigger
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AnxietyTwin_Patient_Summary_ID${selectedPatientId}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setPdfSuccessMessage('Patient summary PDF successfully exported.');
      setTimeout(() => setShowPdfModal(false), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to generate PDF summary.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Handle Synthetic Demo Reset
  const handleResetDemo = async () => {
    try {
      setResettingDemo(true);
      const res = await api.resetDemoPatient();
      await loadPatients();
      if (selectedPatientId === res.patient_id) {
        await loadPatientData(res.patient_id);
      }
      alert('Synthetic demo patient history reset successfully (8 distinct baseline days seeded).');
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setResettingDemo(false);
    }
  };

  const filteredPatients = patients.filter(p =>
    p.display_name.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.email.toLowerCase().includes(patientSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Clinician Workspace Header */}
      <div className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-white tracking-tight">Patient Review & Clinical Insight Workspace</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Prototype
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Decision-Support Prototype & Longitudinal Digital Twin Review (Non-Diagnostic)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-medium text-slate-200">
                {user?.full_name || user?.email || 'Clinician Reviewer'}
              </span>
              <span className="text-[10px] text-teal-400 block font-mono">
                Role: {user?.role || 'Clinician'} (Authorized)
              </span>
            </div>

            <button
              onClick={handleResetDemo}
              disabled={resettingDemo}
              title="Reset synthetic demo cohort data for testing"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${resettingDemo ? 'animate-spin' : ''}`} />
              <span>{resettingDemo ? 'Resetting...' : 'Reset Demo Cohort'}</span>
            </button>

            <Link
              to="/dashboard"
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Personal View</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Clinician Prototype & Regulatory Disclaimer */}
        <div className="mb-6 p-3.5 rounded-xl bg-slate-900/60 border border-teal-500/20 text-xs text-slate-400 flex items-start space-x-3">
          <Shield className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-teal-300">Clinician Workspace Research Protocol</span>
            <p className="leading-relaxed">
              This workspace is an investigative prototype for longitudinal digital twin inspection. Statistical associations and twin insights do not establish clinical causality or panic attack predictions. All records maintain cryptographic provenance; simulated streams are isolated from genuine patient data.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Patient Registry Sidebar (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Authorized Patients</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-teal-400 font-mono">
                    {patients.length}
                  </span>
                </div>
              </div>

              {/* Search Registry */}
              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter by name or email..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Patient List */}
              {loadingPatients ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-teal-400" />
                  Loading authorized registry...
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  No authorized patients matching query.
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {filteredPatients.map((p) => {
                    const isSelected = p.id === selectedPatientId;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPatientId(p.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition text-left ${
                          isSelected
                            ? 'bg-teal-500/10 border-teal-500/40 shadow-sm shadow-teal-500/10'
                            : 'bg-slate-800/40 border-slate-800/80 hover:bg-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs font-semibold text-slate-100">{p.display_name}</span>
                              {p.is_demo_patient && (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                  Demo Cohort
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block font-mono">{p.email}</span>
                          </div>
                          <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-teal-400' : 'text-slate-600'}`} />
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] text-slate-400 border-t border-slate-800/80 pt-2">
                          <div>
                            <span className="text-slate-500 block">Baseline</span>
                            <span className="text-slate-300 font-medium">{p.baseline_status}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Completeness</span>
                            <span className="text-teal-400 font-medium">{p.data_completeness_percent}%</span>
                          </div>
                        </div>

                        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                          <span>{p.total_observations_count} records logged</span>
                          {p.recent_anxiety_score !== null && (
                            <span className="text-slate-300">
                              Latest check-in: <strong className="text-amber-400">{p.recent_anxiety_score}/10</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Export Summary Trigger */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                <FileText className="w-4 h-4 text-teal-400" />
                <span>Patient Summary PDF</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Generate an exportable clinical summary document for this patient. Allows selective exclusion of simulated observations, clinician notes, and predictions.
              </p>
              <button
                onClick={() => setShowPdfModal(true)}
                disabled={!selectedPatientId || loadingData}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition disabled:opacity-50 shadow-md shadow-teal-600/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Customizable Summary</span>
              </button>
            </div>
          </div>

          {/* Patient Overview & Details Workspace (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            {overview && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-xl font-bold text-white tracking-tight">{overview.display_name}</h2>
                      {overview.is_demo_patient && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          Synthetic Patient
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1 font-mono">
                      <span>ID #{overview.patient_id}</span>
                      <span>•</span>
                      <span>{overview.email}</span>
                      <span>•</span>
                      <span>{overview.biological_sex || 'Unspecified'} ({overview.age ? `${overview.age} yrs` : '20-25 yrs cohort'})</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                      {overview.baseline_status}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-teal-500/10 text-teal-300 border border-teal-500/30">
                      {overview.data_completeness_percent}% Data Quality
                    </span>
                  </div>
                </div>

                {/* Patient Vitals & Twin Status Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
                    <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] mb-1">
                      <Heart className="w-3.5 h-3.5 text-rose-400" />
                      <span>Mean Resting HR</span>
                    </div>
                    <p className="text-base font-bold text-white">
                      {overview.mean_resting_hr ? `${overview.mean_resting_hr.toFixed(1)} bpm` : 'N/A'}
                    </p>
                    <span className="text-[10px] text-slate-500">Personal baseline</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
                    <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] mb-1">
                      <Activity className="w-3.5 h-3.5 text-teal-400" />
                      <span>Mean HRV</span>
                    </div>
                    <p className="text-base font-bold text-white">
                      {overview.mean_hrv_ms ? `${overview.mean_hrv_ms.toFixed(1)} ms` : 'N/A'}
                    </p>
                    <span className="text-[10px] text-slate-500">Parasympathetic tone</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
                    <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] mb-1">
                      <Moon className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Mean Sleep</span>
                    </div>
                    <p className="text-base font-bold text-white">
                      {overview.mean_sleep_hours ? `${overview.mean_sleep_hours.toFixed(1)} hrs` : 'N/A'}
                    </p>
                    <span className="text-[10px] text-slate-500">Circadian input</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
                    <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] mb-1">
                      <Coffee className="w-3.5 h-3.5 text-amber-400" />
                      <span>Caffeine Intake</span>
                    </div>
                    <p className="text-base font-bold text-white">
                      {overview.mean_caffeine_cups ? `${overview.mean_caffeine_cups.toFixed(1)} cups` : '0 cups'}
                    </p>
                    <span className="text-[10px] text-slate-500">Stimulant exposure</span>
                  </div>
                </div>

                {/* Historical Span & Prediction Readiness Indicator */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-2">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-teal-400" />
                    <span>
                      Logging Span: <strong className="text-slate-200">{overview.distinct_days} distinct days</strong> ({overview.total_observations} total observations)
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Brain className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-slate-400">ML Production Status:</span>
                    {overview.prediction_availability === 'available' ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono text-[10px] border border-emerald-500/20">
                        Eligible (~24h DBP Target)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono text-[10px] border border-amber-500/20">
                        Cold-Start Gate (&lt; 7 prior days)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setActiveTab('timeline')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'timeline'
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Longitudinal Timeline ({timeline.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('insights')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'insights'
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Explainable Twin Insights ({insights.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('prediction')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'prediction'
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>ML Model Review</span>
              </button>

              <button
                onClick={() => setActiveTab('interventions')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'interventions'
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Early Warnings & Coping ({patientInterventions?.history?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveTab('notes')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'notes'
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Review Notes & Follow-up ({notes.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('followup')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'followup'
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Follow-up Tasks ({followUpTasks.length})</span>
              </button>
            </div>

            {/* TAB 1: LONGITUDINAL PATIENT TIMELINE */}
            {activeTab === 'timeline' && (
              <div className="space-y-4">
                {/* Timeline Filters */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* Reporting Periods */}
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400 font-medium">Reporting Window:</span>
                    {[7, 14, 30].map((days) => (
                      <button
                        key={days}
                        onClick={() => setPeriodDays(days)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                          periodDays === days
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                        }`}
                      >
                        Last {days}d
                      </button>
                    ))}
                  </div>

                  {/* Simulated Data Toggle Switch (Phase 6.2 Key Requirement: Default Hide Simulated) */}
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setHideSimulated(!hideSimulated)}
                      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                        hideSimulated
                          ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      }`}
                    >
                      {hideSimulated ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{hideSimulated ? 'Simulated Data Hidden' : 'Showing Simulated Data'}</span>
                    </button>

                    <div className="flex items-center space-x-1">
                      <Filter className="w-3.5 h-3.5 text-slate-500" />
                      <select
                        value={eventTypeFilter}
                        onChange={(e) => setEventTypeFilter(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="all">All Event Types</option>
                        <option value="checkin">User Check-ins</option>
                        <option value="physiological">Physiological</option>
                        <option value="lifestyle">Lifestyle & Sleep</option>
                        <option value="twin_state">Twin State Updates</option>
                        <option value="coping_feedback">Coping Feedback</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Timeline Stream */}
                {loadingData ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-400" />
                    ColCountrying chronological timeline events...
                  </div>
                ) : timeline.length === 0 ? (
                  <div className="py-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800/80 p-8 space-y-2">
                    <Info className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-sm font-medium text-slate-300">No events found in selected period</p>
                    <p className="text-xs text-slate-500">
                      Try expanding the reporting window to 30 days or toggling simulated stream visibility.
                    </p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-slate-800 ml-4 pl-6 space-y-4">
                    {timeline.map((event) => {
                      const isSimulated = event.is_simulated;
                      return (
                        <div
                          key={event.id}
                          className={`relative group p-4 rounded-xl border transition ${
                            isSimulated
                              ? 'bg-amber-950/20 border-amber-500/20 hover:border-amber-500/40'
                              : 'bg-slate-900/70 border-slate-800/90 hover:border-slate-700'
                          }`}
                        >
                          {/* Timeline node icon */}
                          <div className={`absolute -left-[31px] top-4 w-4 h-4 rounded-full border-2 bg-slate-950 flex items-center justify-center ${
                            isSimulated ? 'border-amber-400' : 'border-teal-400'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isSimulated ? 'bg-amber-400' : 'bg-teal-400'}`} />
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-slate-200">{event.title}</span>
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                                isSimulated
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : event.source_type === 'user_entered'
                                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                              }`}>
                                {event.source_type}
                              </span>
                            </div>

                            <span className="text-[11px] text-slate-400 font-mono">
                              {new Date(event.timestamp).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short'
                              })}
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 mb-2">{event.summary}</p>

                          {/* Values Preview Chips */}
                          <div className="flex flex-wrap gap-2 text-[11px] mb-2">
                            {Object.entries(event.values).map(([k, v]) => (
                              <span
                                key={k}
                                className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60 font-mono"
                              >
                                {k}: <strong className="text-white">{String(v)}</strong>
                              </span>
                            ))}
                          </div>

                          {/* Raw Detail Expander Trigger */}
                          {event.details && (
                            <button
                              onClick={() => setSelectedEvent(event)}
                              className="text-[11px] text-teal-400 hover:text-teal-300 underline font-medium"
                            >
                              Inspect Raw Payload & Metadata →
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: EXPLAINABLE DIGITAL TWIN INSIGHTS */}
            {activeTab === 'insights' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-1">
                  <div className="flex items-center space-x-1.5 font-semibold text-slate-200">
                    <Sparkles className="w-4 h-4 text-teal-400" />
                    <span>Explainable Longitudinal Baseline Comparisons</span>
                  </div>
                  <p>
                    Insights are derived by comparing the patient's observations during the selected {periodDays}-day window against their established personal baseline. Click <strong>"View Supporting Records"</strong> to inspect the exact underlying records and timestamps.
                  </p>
                </div>

                {insights.length === 0 ? (
                  <div className="py-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800/80 p-8 space-y-2">
                    <Info className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-sm font-medium text-slate-300">No twin insights generated</p>
                    <p className="text-xs text-slate-500">
                      Personal baseline requires at least 3 distinct recorded days to perform mathematical differential analysis.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {insights.map((ins) => {
                      const isElevated = ins.direction === 'elevated';
                      const isSuppressed = ins.direction === 'suppressed';
                      return (
                        <div
                          key={ins.id}
                          className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/80 pb-3">
                            <div className="flex items-center space-x-2">
                              {isElevated ? (
                                <TrendingUp className="w-4 h-4 text-rose-400" />
                              ) : isSuppressed ? (
                                <TrendingDown className="w-4 h-4 text-indigo-400" />
                              ) : (
                                <Activity className="w-4 h-4 text-teal-400" />
                              )}
                              <h3 className="text-sm font-bold text-white">{ins.factor}</h3>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                {ins.category}
                              </span>
                            </div>

                            <span className="text-[11px] text-slate-400 font-mono">
                              Window: {ins.time_window}
                            </span>
                          </div>

                          <p className="text-xs text-slate-200 leading-relaxed font-medium">
                            {ins.observation}
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                            <div>
                              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Comparison Baseline</span>
                              <span className="text-slate-300">{ins.comparison_baseline}</span>
                            </div>

                            <div>
                              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Provenance & Reliability</span>
                              <span className="text-teal-400 font-mono">{ins.source_provenance}</span>
                            </div>
                          </div>

                          {/* Non-causal disclosure */}
                          <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/60 text-[11px] text-slate-400 space-y-0.5">
                            <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
                              <Info className="w-3.5 h-3.5 text-teal-400" />
                              <span>Clinical Interpretation (Non-Causal):</span>
                            </div>
                            <p>{ins.non_causal_interpretation}</p>
                            <span className="text-[10px] text-slate-500 block">
                              Data Limitation: {ins.data_limitation}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-slate-400">
                              Supported by <strong>{ins.supporting_record_ids.length}</strong> recorded observation(s)
                            </span>

                            <button
                              onClick={() => setSelectedInsight(ins)}
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold transition"
                            >
                              <span>View Supporting Records ({ins.supporting_record_ids.length})</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: TRANSPARENT ML PREDICTION REVIEW */}
            {activeTab === 'prediction' && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
                  <div className="flex items-center space-x-2 text-white font-bold">
                    <Brain className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-base">Production ML Target: Next-Day Diastolic Blood Pressure (DBP)</h3>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs text-slate-300">
                    <span className="font-semibold text-teal-300 block">Scientific & Diagnostic Boundary</span>
                    <p className="leading-relaxed">
                      The AnxietyTwin production machine learning pipeline was trained on longitudinal physiological cohort data to forecast <strong>next-day diastolic blood pressure (~24-hour horizon)</strong> as a hemodynamic marker of autonomic strain.
                    </p>
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>Non-Diagnostic Disclaimer:</strong> This model is NOT a clinical predictor of imminent panic attacks, acute anxiety crises, or cardiovascular disease. It does not replace clinical evaluation or diagnostic assessment.
                      </span>
                    </div>
                  </div>

                  {/* Cold-Start Data Honesty Panel */}
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2 text-xs">
                    <span className="font-semibold text-slate-200 block">Longitudinal Cold-Start Integrity Requirements</span>
                    <p className="text-slate-400 leading-relaxed">
                      To prevent synthetic contamination and ensure statistical validity, personalized inference strictly requires <strong>at least 7 distinct past calendar days of observations</strong> prior to the forecast target.
                    </p>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block uppercase">Available Distinct Days</span>
                        <span className="text-lg font-bold text-white font-mono">{overview?.distinct_days || 0} Days</span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block uppercase">Gate Status</span>
                        <span className={`text-xs font-bold font-mono ${
                          (overview?.distinct_days || 0) >= 7 ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {(overview?.distinct_days || 0) >= 7 ? 'Requirements Satisfied' : 'Under Cold-Start Gate'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CLINICIAN REVIEW NOTES & FOLLOW-UP */}
            {activeTab === 'notes' && (
              <div className="space-y-6">
                {/* Note Editor */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
                  <div className="flex items-center space-x-2 text-white font-bold">
                    <FileText className="w-4 h-4 text-teal-400" />
                    <h3 className="text-sm">Document Clinical Review Note</h3>
                  </div>

                  {noteSuccess && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{noteSuccess}</span>
                    </div>
                  )}

                  <form onSubmit={handleCreateNote} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">
                        Summary of Clinical Observations <span className="text-rose-400">*</span>
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={newNote.summary_observations}
                        onChange={(e) => setNewNote({ ...newNote, summary_observations: e.target.value })}
                        placeholder="e.g., Patient reports elevated anticipatory anxiety during exam period. Resting HR elevated by +5.6 BPM relative to baseline. Sleep duration irregular..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">
                          Questions & Topics for Patient Discussion
                        </label>
                        <input
                          type="text"
                          value={newNote.discussion_topics || ''}
                          onChange={(e) => setNewNote({ ...newNote, discussion_topics: e.target.value })}
                          placeholder="e.g., Sleep hygiene routine, caffeine intake schedule..."
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-medium mb-1">
                          Follow-Up Plan
                        </label>
                        <input
                          type="text"
                          value={newNote.follow_up_plan || ''}
                          onChange={(e) => setNewNote({ ...newNote, follow_up_plan: e.target.value })}
                          placeholder="e.g., Review again in 14 days; practice 4-7-8 breathing twice daily..."
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">
                          Proposed Follow-Up Date
                        </label>
                        <input
                          type="date"
                          value={newNote.follow_up_date || ''}
                          onChange={(e) => setNewNote({ ...newNote, follow_up_date: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-medium mb-1">
                          Follow-Up Status
                        </label>
                        <select
                          value={newNote.follow_up_status || 'planned'}
                          onChange={(e) => setNewNote({ ...newNote, follow_up_status: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                        >
                          <option value="planned">Follow-Up Planned</option>
                          <option value="completed">Follow-Up Completed</option>
                          <option value="none">No Follow-Up Required</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={submittingNote || !newNote.summary_observations.trim()}
                        className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold transition disabled:opacity-50 shadow-md shadow-teal-600/20"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>{submittingNote ? 'Saving Note...' : 'Save Clinical Review Note'}</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Review Notes History */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Archived Review Notes ({notes.length})
                  </h4>

                  {notes.length === 0 ? (
                    <div className="p-6 text-center bg-slate-900/40 rounded-2xl border border-slate-800/80 text-xs text-slate-500">
                      No clinical review notes recorded yet for this patient.
                    </div>
                  ) : (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-slate-200">
                              {note.clinician_name || 'Authorized Clinician'}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-teal-400 font-mono">
                              Status: {note.follow_up_status}
                            </span>
                          </div>

                          <span className="text-[11px] text-slate-500 font-mono">
                            {new Date(note.review_date).toLocaleDateString()}
                          </span>
                        </div>

                        <p className="text-slate-300 leading-relaxed font-sans">{note.summary_observations}</p>

                        {note.discussion_topics && (
                          <p className="text-slate-400">
                            <strong className="text-slate-300">Discussion Topics:</strong> {note.discussion_topics}
                          </p>
                        )}

                        {note.follow_up_plan && (
                          <div className="p-2 rounded bg-slate-800/50 text-[11px] text-slate-300 flex items-center justify-between">
                            <span><strong>Plan:</strong> {note.follow_up_plan}</span>
                            {note.follow_up_date && (
                              <span className="text-teal-400 font-mono">Date: {note.follow_up_date}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: PATIENT EARLY-WARNING SIGNALS & COPING INTERVENTIONS */}
            {activeTab === 'interventions' && (
              <div className="space-y-6">
                {/* 1. Distinct Clinical Scope & Non-Diagnostic Framing Callout */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
                      <span className="font-bold text-white text-sm">
                        Rule-Based Early-Warning Indicators &amp; Coping Feedback
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 self-start sm:self-auto">
                      Distinct from 24h ML Model (DBP Target)
                    </span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Evaluates longitudinal deviations from the patient's empirical baseline using explainable, deterministic thresholds.
                    <strong className="text-slate-300"> Non-Diagnostic Disclaimer:</strong> These indicators are experimental supportive tools. They do not diagnose generalized anxiety, panic disorder, or infer medical etiology. Observational association does not establish clinical causation.
                  </p>
                </div>

                {/* 2. Insufficient Data / Baseline Status Banner */}
                {patientInterventions?.status?.is_cold_start ? (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start space-x-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Insufficient Longitudinal Data for Empirical Baseline</span>
                      <p className="text-amber-300/80 text-[11px] mt-0.5">
                        Baseline calculation requires at least 3 distinct observation days. Current indicators are evaluated against population reference ranges to avoid premature ungrounded inferences.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/20 text-xs text-slate-300 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-400" />
                      <span>Empirical Longitudinal Baseline Established ({overview?.distinct_days || 0} distinct days recorded)</span>
                    </div>
                    <span className="text-[10px] font-mono text-teal-300">Calibrated &amp; Active</span>
                  </div>
                )}

                {/* 3. Personalized Baseline Comparison Matrix */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                      <Activity className="w-3.5 h-3.5 text-teal-400" />
                      <span>Personal Baseline Comparison Matrix</span>
                    </h3>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {patientInterventions?.status?.metrics?.length || 0} trackable metrics
                    </span>
                  </div>

                  {(!patientInterventions?.status?.metrics || patientInterventions.status.metrics.length === 0) ? (
                    <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-500">
                      No baseline metrics available.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {patientInterventions.status.metrics.map((m) => {
                        const isChange = m.status === 'change_detected';
                        const isInsuff = m.status === 'insufficient_data';
                        return (
                          <div
                            key={m.metric_key}
                            className={`p-4 rounded-xl border transition ${
                              isChange
                                ? 'bg-amber-500/10 border-amber-500/30'
                                : isInsuff
                                ? 'bg-slate-900/30 border-dashed border-slate-800'
                                : 'bg-slate-900/60 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-semibold text-slate-300">{m.metric_name}</span>
                              <div className="flex items-center space-x-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${
                                  m.provenance === 'measured'
                                    ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                                    : m.provenance === 'simulated'
                                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                    : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                                }`}>
                                  {m.provenance}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                                  isChange
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : isInsuff
                                    ? 'bg-slate-800 text-slate-400'
                                    : 'bg-teal-500/10 text-teal-300'
                                }`}>
                                  {isChange ? 'Change' : isInsuff ? 'No Data' : 'Within Range'}
                                </span>
                              </div>
                            </div>

                            <div className="mt-2 text-lg font-bold font-mono text-white">
                              {m.current_value !== null ? `${m.current_value} ${m.unit}` : 'Insufficient Data'}
                            </div>

                            <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center justify-between">
                              <span>
                                Baseline: {m.baseline_value !== null ? `${m.baseline_value} ${m.unit}` : 'Uncalibrated'}
                              </span>
                              {m.delta_value !== null && m.delta_value !== undefined && (
                                <span className={`font-bold ${
                                  m.delta_value > 0 ? 'text-amber-400' : m.delta_value < 0 ? 'text-teal-400' : 'text-slate-400'
                                }`}>
                                  {m.delta_value > 0 ? `+${m.delta_value}` : m.delta_value}
                                </span>
                              )}
                            </div>

                            {m.latest_timestamp && (
                              <div className="text-[10px] text-slate-500 font-mono mt-2 pt-1 border-t border-slate-800/60">
                                Last: {new Date(m.latest_timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 4. Active Early-Warning Signals (Explainable Insight Cards) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Active Early-Warning Signals ({patientInterventions?.status?.signals?.length || 0})</span>
                    </h3>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Deterministic Rules &bull; Fully Traceable Evidence
                    </span>
                  </div>

                  {(!patientInterventions?.status?.signals || patientInterventions.status.signals.length === 0) ? (
                    <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-500">
                      No active early warning signals flagged. All evaluated metrics are within personal baseline ranges.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {patientInterventions.status.signals.map((sig) => {
                        const isChange = sig.level === 'Change Detected';
                        return (
                          <div
                            key={sig.signal_id}
                            className={`p-4 rounded-xl border transition ${
                              isChange
                                ? 'bg-amber-950/20 border-amber-500/30'
                                : 'bg-slate-900/60 border-slate-800'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/80 pb-2 mb-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-white">{sig.title}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  isChange
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-teal-500/10 text-teal-300'
                                }`}>
                                  {sig.level}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-400">
                                  Rule-Based
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-slate-800/80 text-teal-400">
                                  {sig.data_provenance}
                                </span>
                              </div>

                              {sig.timestamps && sig.timestamps.length > 0 && (
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {new Date(sig.timestamps[0]).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-3">
                              <div className="space-y-1">
                                <p className="text-slate-300">
                                  <strong className="text-slate-200">What Changed:</strong> {sig.what_changed}
                                </p>
                                <p className="text-slate-400 text-[11px]">
                                  <strong className="text-slate-300">Evidence:</strong> {sig.evidence_summary}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-slate-300">
                                  <strong className="text-slate-200">Why Flagged:</strong> {sig.why_flagged}
                                </p>
                                <p className="text-teal-400/90 text-[11px]">
                                  <strong className="text-teal-300">Suggested Action:</strong> {sig.suggested_activity}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-slate-800/60 text-[11px]">
                              <span className="text-slate-500 italic">
                                Note: {sig.limitations}
                              </span>

                              {sig.supporting_record_ids && sig.supporting_record_ids.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedSignal(sig)}
                                  className="text-teal-400 hover:text-teal-300 font-semibold flex items-center space-x-1 shrink-0"
                                >
                                  <span>Inspect Source Records ({sig.supporting_record_ids.length})</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 5. Filterable Longitudinal Coping Activity & Feedback Log */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-teal-400" />
                      <span>Longitudinal Coping Activity &amp; Feedback Log</span>
                    </h3>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Showing filtered records
                    </span>
                  </div>

                  {/* Filter Controls Bar */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center gap-3 text-xs">
                    {/* Activity Filter */}
                    <div className="flex items-center space-x-1.5">
                      <span className="text-slate-400 text-[11px]">Activity:</span>
                      <select
                        value={intervActivityFilter}
                        onChange={(e) => setIntervActivityFilter(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="all">All Activities</option>
                        <option value="breathing_478">4-7-8 Breathing</option>
                        <option value="grounding_54321">5-4-3-2-1 Grounding</option>
                        <option value="sleep_hygiene">Sleep Hygiene</option>
                        <option value="checkin_prompt">Check-in Prompt</option>
                      </select>
                    </div>

                    {/* Signal Filter */}
                    <div className="flex items-center space-x-1.5">
                      <span className="text-slate-400 text-[11px]">Signal:</span>
                      <select
                        value={intervSignalFilter}
                        onChange={(e) => setIntervSignalFilter(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="all">All Signals</option>
                        <option value="elevated_heart_rate">Elevated Heart Rate</option>
                        <option value="reduced_hrv">Reduced HRV</option>
                        <option value="sleep_disruption">Sleep Disruption</option>
                        <option value="increased_distress">Elevated Distress</option>
                        <option value="composite_autonomic_strain">Composite Strain</option>
                        <option value="conflicting_observations">Conflicting Observations</option>
                      </select>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center space-x-1.5">
                      <span className="text-slate-400 text-[11px]">Status:</span>
                      <select
                        value={intervStatusFilter}
                        onChange={(e) => setIntervStatusFilter(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="all">All Statuses</option>
                        <option value="completed">Completed</option>
                        <option value="dismissed">Dismissed</option>
                        <option value="recommended">Recommended</option>
                        <option value="abandoned">Abandoned</option>
                      </select>
                    </div>

                    {/* Source Filter */}
                    <div className="flex items-center space-x-1.5">
                      <span className="text-slate-400 text-[11px]">Provenance:</span>
                      <select
                        value={intervSourceFilter}
                        onChange={(e) => setIntervSourceFilter(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="all">All Provenance</option>
                        <option value="measured">Measured (Device)</option>
                        <option value="user_reported">User Reported</option>
                        <option value="simulated">Simulated</option>
                      </select>
                    </div>
                  </div>

                  {/* Filtered History List */}
                  {(() => {
                    const filtered = (patientInterventions?.history || []).filter((s) => {
                      if (intervActivityFilter !== 'all' && s.intervention_type !== intervActivityFilter) return false;
                      if (intervSignalFilter !== 'all' && s.trigger_signal !== intervSignalFilter) return false;
                      if (intervStatusFilter !== 'all' && s.status !== intervStatusFilter) return false;
                      if (intervSourceFilter !== 'all' && s.source_type !== intervSourceFilter) return false;
                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-500">
                          No supportive coping sessions match the selected filters.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {filtered.map((sess) => {
                          const actName =
                            sess.intervention_type === 'breathing_478'
                              ? '4-7-8 Breathing Pacer'
                              : sess.intervention_type === 'grounding_54321'
                              ? '5-4-3-2-1 Sensory Grounding'
                              : sess.intervention_type === 'sleep_hygiene'
                              ? 'Circadian Sleep Hygiene'
                              : sess.intervention_type === 'checkin_prompt'
                              ? 'Contextual Check-in'
                              : sess.intervention_type;

                          const isDismissed = sess.status === 'dismissed';
                          const isCompleted = sess.status === 'completed';

                          return (
                            <div
                              key={sess.id}
                              className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition ${
                                isDismissed
                                  ? 'bg-slate-900/30 border-slate-800/60 opacity-80'
                                  : 'bg-slate-900/60 border-slate-800'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-white">{actName}</span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                    isCompleted
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : isDismissed
                                      ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                      : 'bg-amber-500/20 text-amber-300'
                                  }`}>
                                    {sess.status}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-slate-800 text-slate-400">
                                    {sess.source_type}
                                  </span>
                                  {sess.trigger_signal && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                      Trigger: {sess.trigger_signal}
                                    </span>
                                  )}
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {new Date(sess.started_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                  </span>
                                </div>
                                {sess.user_notes && (
                                  <p className="text-slate-300 italic">"{sess.user_notes}"</p>
                                )}
                              </div>

                              <div className="flex items-center space-x-3 shrink-0">
                                {sess.pre_distress_rating !== null && sess.post_distress_rating !== null && (
                                  <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center space-x-1.5 font-mono text-[11px]">
                                    <span className="text-slate-400">
                                      Distress: {sess.pre_distress_rating} → {sess.post_distress_rating}
                                    </span>
                                    {sess.rating_delta !== null && sess.rating_delta !== undefined && (
                                      <span className={`px-1.5 py-0.5 rounded font-bold ${
                                        sess.rating_delta < 0
                                          ? 'bg-emerald-500/20 text-emerald-300'
                                          : sess.rating_delta > 0
                                          ? 'bg-rose-500/20 text-rose-300'
                                          : 'bg-slate-800 text-slate-400'
                                      }`}>
                                        Δ {sess.rating_delta > 0 ? `+${sess.rating_delta}` : sess.rating_delta}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {sess.helpfulness && (
                                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${
                                    sess.helpfulness === 'helpful'
                                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                                      : 'bg-slate-800 text-slate-300'
                                  }`}>
                                    {sess.helpfulness.replace('_', ' ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* TAB 6: CLINICIAN FOLLOW-UP TASKS & CARE COORDINATION */}
            {activeTab === 'followup' && (
              <div className="space-y-6">
                {/* Non-prescription disclaimer */}
                <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-200 text-xs flex items-start space-x-3 leading-relaxed shadow-sm">
                  <Info className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold text-teal-300">Care Coordination Disclosure:</strong> Follow-up tasks support structured self-care accountability and multidisciplinary care continuity. These tasks do not constitute medical prescription orders. Patients with visibility can view and acknowledge their tasks.
                  </div>
                </div>

                {taskSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{taskSuccess}</span>
                  </div>
                )}

                {/* Task Controls */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="flex items-center space-x-1">
                      <span className="text-slate-400 text-[11px]">Status:</span>
                      <select
                        value={taskStatusFilter}
                        onChange={(e) => setTaskStatusFilter(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-teal-500"
                      >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    <div className="flex items-center space-x-1">
                      <span className="text-slate-400 text-[11px]">Priority:</span>
                      <select
                        value={taskPriorityFilter}
                        onChange={(e) => setTaskPriorityFilter(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-teal-500"
                      >
                        <option value="all">All Priorities</option>
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowNewTaskModal(true)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md shadow-teal-600/20 cursor-pointer self-start sm:self-auto"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Assign Follow-up Task</span>
                  </button>
                </div>

                {/* Tasks List */}
                {followUpTasks.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-slate-500 mx-auto" />
                    <h4 className="text-sm font-semibold text-slate-300">No Follow-up Tasks Recorded</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Create a follow-up action item to coordinate care, review sleep routines, or schedule next evaluations.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {followUpTasks
                      .filter((t) => taskStatusFilter === 'all' || t.status === taskStatusFilter)
                      .filter((t) => taskPriorityFilter === 'all' || t.priority === taskPriorityFilter)
                      .map((task) => {
                        const priorityColor =
                          task.priority === 'urgent'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : task.priority === 'high'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : task.priority === 'medium'
                            ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700';

                        return (
                          <div
                            key={task.id}
                            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-md hover:border-slate-700 transition"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <h4 className="text-sm font-bold text-white">{task.title}</h4>
                                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${priorityColor}`}>
                                    {task.priority}
                                  </span>
                                  {task.is_patient_visible && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                      Patient Visible
                                    </span>
                                  )}
                                </div>
                                {task.due_date && (
                                  <span className="text-[11px] text-slate-400 font-mono">
                                    Due: {task.due_date}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-slate-400">Status:</span>
                                <select
                                  value={task.status}
                                  onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                                  className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-teal-500"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="completed">Completed</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                              </div>
                            </div>

                            {task.description && (
                              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                {task.description}
                              </p>
                            )}

                            {task.patient_visible_notes && (
                              <div className="text-xs text-indigo-300 bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20">
                                <span className="font-semibold block mb-0.5 text-indigo-200">Patient-Visible Guidance:</span>
                                {task.patient_visible_notes}
                              </div>
                            )}

                            {task.patient_acknowledged && (
                              <div className="text-xs text-emerald-300 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 flex items-center space-x-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>Patient acknowledged this task{task.patient_response_notes ? `: "${task.patient_response_notes}"` : '.'}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: EVIDENCE INSPECTOR (SUPPORTING RECORDS) */}
      {selectedInsight && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <h3 className="text-base font-bold text-white">Supporting Evidence Records</h3>
              </div>
              <button
                onClick={() => setSelectedInsight(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <span className="font-semibold text-slate-200 block">{selectedInsight.factor} Insight</span>
              <p className="text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                {selectedInsight.observation}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Linked Record IDs ({selectedInsight.supporting_record_ids.length})
              </span>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {selectedInsight.supporting_record_ids.map((recId, idx) => (
                  <div
                    key={recId}
                    className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs font-mono flex items-center justify-between"
                  >
                    <span className="text-teal-300">Record #{recId}</span>
                    <span className="text-[10px] text-slate-400">Authenticated Evidence Link [{idx + 1}]</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/50 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300 block mb-0.5">Scientific Transparency Note:</span>
              Supporting records represent authenticated database observations that contributed to this heuristic differential comparison. No fabricated feature attributions or unvalidated black-box weights are utilized.
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedInsight(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EARLY-WARNING SIGNAL SOURCE OBSERVATIONS INSPECTOR */}
      {selectedSignal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="text-base font-bold text-white">Source Observation Inspection</h3>
              </div>
              <button
                onClick={() => setSelectedSignal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 text-sm">{selectedSignal.title}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {selectedSignal.level}
                </span>
              </div>
              <p className="text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800 leading-relaxed">
                {selectedSignal.what_changed}
              </p>
              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1">
                <p className="text-slate-300"><strong className="text-slate-200">Triggering Rule:</strong> {selectedSignal.why_flagged}</p>
                <p className="text-slate-400"><strong className="text-slate-300">Evidence:</strong> {selectedSignal.evidence_summary}</p>
                <p className="text-teal-400"><strong className="text-teal-300">Suggested Activity:</strong> {selectedSignal.suggested_activity}</p>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Linked Source Observation Records ({selectedSignal.supporting_record_ids.length})
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {selectedSignal.supporting_record_ids.map((recId, idx) => (
                  <div
                    key={recId}
                    className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs font-mono flex items-center justify-between"
                  >
                    <span className="text-teal-300 font-bold">{recId}</span>
                    <span className="text-[10px] text-slate-400">Authenticated Observation Trace #{idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/50 text-[11px] text-slate-400 space-y-1">
              <span className="font-semibold text-slate-300 block">Scientific Transparency &amp; Provenance:</span>
              <p>
                Data provenance: <strong className="text-slate-200 uppercase font-mono">{selectedSignal.data_provenance}</strong>. Quality: {selectedSignal.data_quality}.
              </p>
              <p className="italic text-slate-500">
                {selectedSignal.limitations}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedSignal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: TIMELINE EVENT RAW DETAIL */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedEvent.title}</h3>
                <span className="text-[10px] text-slate-400 font-mono">{selectedEvent.id}</span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <span className="text-slate-400">Raw Structured Payload:</span>
              <pre className="p-3 rounded-xl bg-slate-950 text-teal-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
                {JSON.stringify({ ...selectedEvent.values, ...selectedEvent.details }, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CUSTOMIZABLE PDF SUMMARY EXPORT */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-teal-400" />
                <h3 className="text-base font-bold text-white">Export Patient Summary PDF</h3>
              </div>
              <button
                onClick={() => setShowPdfModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pdfSuccessMessage && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{pdfSuccessMessage}</span>
              </div>
            )}

            <p className="text-xs text-slate-400">
              Customize the sections to include in the generated patient summary. Simulated data is excluded by default to preserve clinical record integrity.
            </p>

            {/* Checkbox Section Switches */}
            <div className="space-y-2.5 text-xs bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfOptions.include_checkins}
                  onChange={(e) => setPdfOptions({ ...pdfOptions, include_checkins: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700 text-teal-500 focus:ring-0"
                />
                <span className="text-slate-200 font-medium">User Check-in History & Distress Ratings</span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfOptions.include_physiology}
                  onChange={(e) => setPdfOptions({ ...pdfOptions, include_physiology: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700 text-teal-500 focus:ring-0"
                />
                <span className="text-slate-200 font-medium">Physiological Observations (Resting HR & HRV)</span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfOptions.include_lifestyle}
                  onChange={(e) => setPdfOptions({ ...pdfOptions, include_lifestyle: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700 text-teal-500 focus:ring-0"
                />
                <span className="text-slate-200 font-medium">Lifestyle Metrics (Sleep & Caffeine Intake)</span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfOptions.include_digital_twin_insights}
                  onChange={(e) => setPdfOptions({ ...pdfOptions, include_digital_twin_insights: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700 text-teal-500 focus:ring-0"
                />
                <span className="text-slate-200 font-medium">Explainable Digital Twin Insights & Evidence</span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfOptions.include_ml_predictions}
                  onChange={(e) => setPdfOptions({ ...pdfOptions, include_ml_predictions: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700 text-teal-500 focus:ring-0"
                />
                <span className="text-slate-200 font-medium">ML Model Prediction Boundaries</span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfOptions.include_clinician_notes}
                  onChange={(e) => setPdfOptions({ ...pdfOptions, include_clinician_notes: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700 text-teal-500 focus:ring-0"
                />
                <span className="text-slate-200 font-medium">Clinician Review Notes & Follow-Up Plans</span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pdfOptions.include_interventions ?? true}
                  onChange={(e) => setPdfOptions({ ...pdfOptions, include_interventions: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700 text-teal-500 focus:ring-0"
                />
                <span className="text-slate-200 font-medium">Early-Warning Signals & Coping Feedback History</span>
              </label>

              <div className="pt-2 border-t border-slate-800/80">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pdfOptions.include_simulated_data}
                    onChange={(e) => setPdfOptions({ ...pdfOptions, include_simulated_data: e.target.checked })}
                    className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0"
                  />
                  <span className="text-amber-300 font-medium">
                    Include Simulated Prototype Streams (Explicitly Labelled)
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowPdfModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={handleDownloadPdf}
                disabled={generatingPdf}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition disabled:opacity-50 shadow-md shadow-teal-600/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{generatingPdf ? 'Generating PDF...' : 'Download Summary PDF'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE FOLLOW-UP TASK */}
      {showNewTaskModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <PlusCircle className="w-5 h-5 text-teal-400" />
                <h3 className="text-base font-bold text-white">Assign Follow-Up Task</h3>
              </div>
              <button
                onClick={() => setShowNewTaskModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Task Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Practice 4-7-8 breathing before evening study sessions"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Clinician Notes / Rationale (Internal)
                </label>
                <textarea
                  rows={2}
                  placeholder="Clinical purpose or discussion context..."
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Patient-Visible Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Clear, supportive guidance visible to the patient..."
                  value={newTaskPatientNotes}
                  onChange={(e) => setNewTaskPatientNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Target Due Date</label>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-white font-medium block">Patient Visible</span>
                  <span className="text-[11px] text-slate-400">Allow patient to view and acknowledge this task</span>
                </div>
                <input
                  type="checkbox"
                  checked={newTaskVisible}
                  onChange={(e) => setNewTaskVisible(e.target.checked)}
                  className="accent-teal-500 w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTask || !newTaskTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md disabled:opacity-50"
                >
                  {submittingTask ? 'Creating Task...' : 'Assign Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
