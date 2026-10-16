import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Unlock,
  Download,
  Trash2,
  RefreshCw,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Eye,
  Key,
  Clock,
  Info,
  X,
  Plus
} from 'lucide-react';
import { api } from '../services/api';
import { PrivacyDashboard, PatientAccessGrantOut, PrivacyAuditLog } from '../types';

export const PrivacyConsentPage: React.FC = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<PrivacyDashboard | null>(null);
  const [grants, setGrants] = useState<PatientAccessGrantOut[]>([]);
  const [auditLogs, setAuditLogs] = useState<PrivacyAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Grant Modal
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [clinicianEmail, setClinicianEmail] = useState('');
  const [grantScope, setGrantScope] = useState('longitudinal_observations, twin_insights');
  const [granting, setGranting] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Delete Account Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dashRes, grantsRes, auditRes] = await Promise.all([
        api.getPrivacyDashboard(),
        api.getPrivacyGrants(),
        api.getPrivacyAuditLog(25),
      ]);
      setDashboard(dashRes);
      setGrants(grantsRes);
      setAuditLogs(auditRes);
    } catch (err: any) {
      console.error('Failed to load privacy center', err);
      setError(err.message || 'Failed to load privacy configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicianEmail.trim()) return;

    try {
      setGranting(true);
      await api.grantClinicianAccess({
        clinician_email: clinicianEmail.trim(),
        scope: grantScope,
      });
      setShowGrantModal(false);
      setClinicianEmail('');
      setSuccessMessage('Clinician access grant issued successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchData();
    } catch (err: any) {
      alert('Failed to grant access: ' + err.message);
    } finally {
      setGranting(false);
    }
  };

  const handleRevokeGrant = async (id: number) => {
    if (!confirm('Are you sure you want to revoke clinician access? The clinician will immediately lose visibility into your longitudinal data.')) return;

    try {
      await api.revokePrivacyGrant(id);
      setSuccessMessage('Clinician access revoked immediately.');
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchData();
    } catch (err: any) {
      alert('Failed to revoke access: ' + err.message);
    }
  };

  const handleExportDataBundle = async () => {
    try {
      setExporting(true);
      const blob = await api.exportUserDataBundle();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AnxietyTwin_Complete_Data_Archive_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessMessage('Data archive downloaded successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchData(); // refresh audit logs
    } catch (err: any) {
      alert('Failed to export data: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deletePhrase !== 'PERMANENTLY DELETE') {
      alert('Please type "PERMANENTLY DELETE" exactly to confirm.');
      return;
    }

    try {
      setDeleting(true);
      await api.deleteUserAccount(deletePassword, deletePhrase);
      api.clearToken();
      alert('Account and all associated records have been permanently erased.');
      navigate('/');
    } catch (err: any) {
      alert('Failed to delete account: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shadow-lg shadow-teal-500/10">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Privacy, Consent & Data Governance Center</h1>
              <p className="text-xs text-slate-400">
                Granular control over clinician access grants, stored record provenance, full data portability, and erasure.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportDataBundle}
            disabled={exporting}
            className="inline-flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
            <span>{exporting ? 'Preparing Archive...' : 'Export Complete Archive (JSON)'}</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center text-slate-400 text-xs">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-teal-400" />
          Loading privacy configuration and audit logs...
        </div>
      ) : (
        <>
          {/* Section 1: Clinician Access Grants Management */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-teal-400" />
                  <span>Clinician Access Grants ({grants.length})</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Manage active permissions granted to healthcare professionals. Revocations take effect immediately.
                </p>
              </div>

              <button
                onClick={() => setShowGrantModal(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-teal-600/20 text-teal-300 border border-teal-500/30 text-xs font-medium hover:bg-teal-600/40 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Grant New Clinician Access</span>
              </button>
            </div>

            {grants.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800/80">
                <Lock className="w-6 h-6 text-slate-500 mx-auto mb-2" />
                No clinicians currently have access to your data. Your health records are completely private to your account.
              </div>
            ) : (
              <div className="space-y-3">
                {grants.map((g) => (
                  <div
                    key={g.id}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">{g.clinician_name || 'Clinician'}</span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase border ${
                          g.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {g.is_active ? 'Active Grant' : 'Revoked'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">
                        Scope: {g.access_scope}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Granted: {new Date(g.granted_at || g.created_at).toLocaleDateString()}
                        {g.revoked_at && ` • Revoked: ${new Date(g.revoked_at).toLocaleDateString()}`}
                      </p>
                    </div>

                    {g.is_active && (
                      <button
                        onClick={() => handleRevokeGrant(g.id)}
                        className="px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-xs font-medium cursor-pointer self-start sm:self-auto"
                      >
                        Revoke Access
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Stored Data Categories & Role Access Matrix */}
          {dashboard && (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Stored Data Categories & Access Governance Matrix</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Full transparency into what is stored, who can see it, and how retention is governed.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Data Type</th>
                      <th className="py-2.5 px-3">Provenance</th>
                      <th className="py-2.5 px-3">Accessible By</th>
                      <th className="py-2.5 px-3">Retention Policy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {dashboard.stored_categories.map((cat, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-semibold text-white">{cat.category_name}</td>
                        <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">{cat.data_type}</td>
                        <td className="py-2.5 px-3 text-teal-300 font-medium">{cat.provenance}</td>
                        <td className="py-2.5 px-3 text-slate-200">
                          {cat.accessible_by.includes('User only') ? (
                            <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                              <Lock className="w-3 h-3" />
                              <span>{cat.accessible_by}</span>
                            </span>
                          ) : (
                            cat.accessible_by
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">{cat.retention}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 3: Privacy Audit Log */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Privacy & Consent Audit Trail</span>
              </h2>
              <span className="text-xs text-slate-400">Immutable governance log</span>
            </div>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No audit events logged yet.</p>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <span className="font-semibold text-white font-mono uppercase text-[11px] px-2 py-0.5 rounded bg-slate-800">
                        {log.action}
                      </span>
                      {log.details && (
                        <span className="text-slate-400 ml-2">
                          {JSON.stringify(log.details)}
                        </span>
                      )}
                    </div>
                    <span className="text-slate-500 font-mono text-[11px] shrink-0">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Irreversible Account Deletion */}
          <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-4">
            <div className="flex items-center space-x-2 text-rose-300">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <h2 className="text-base font-bold text-white">Permanently Delete Account & Observations</h2>
            </div>
            <p className="text-xs text-rose-200/90 leading-relaxed max-w-3xl">
              Permanently purges your user profile, longitudinal observations, check-in history, journal reflections, clinician access grants, and Digital Twin baseline. This operation is immediate and irreversible.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md cursor-pointer"
            >
              Initiate Account Deletion
            </button>
          </div>
        </>
      )}

      {/* Grant Clinician Access Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-teal-400" />
                <span>Grant Clinician Access</span>
              </h3>
              <button onClick={() => setShowGrantModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGrantAccess} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Clinician Email</label>
                <input
                  type="email"
                  required
                  placeholder="clinician@clinic.org"
                  value={clinicianEmail}
                  onChange={(e) => setClinicianEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Permitted Access Scope</label>
                <select
                  value={grantScope}
                  onChange={(e) => setGrantScope(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="longitudinal_observations, twin_insights">Longitudinal Observations & Twin Insights</option>
                  <option value="all_except_journal">All Data Except Private Emotion Journal</option>
                  <option value="emergency_read_only">Emergency Read-Only Review</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Private emotion journal entries remain inaccessible to clinicians unless shared individually.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={granting}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {granting ? 'Authorizing...' : 'Authorize Clinician'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-rose-400 flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <span>Confirm Permanent Deletion</span>
              </h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                This action is irreversible. All observations, check-in history, journal reflections, and your user account will be permanently destroyed.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Enter Your Password</label>
                <input
                  type="password"
                  required
                  placeholder="Account password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Type <span className="font-mono text-rose-400 font-bold">PERMANENTLY DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  required
                  placeholder="PERMANENTLY DELETE"
                  value={deletePhrase}
                  onChange={(e) => setDeletePhrase(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting || deletePhrase !== 'PERMANENTLY DELETE'}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {deleting ? 'Erasing Records...' : 'Permanently Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
