import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { TextField } from '../../../components/ui/FormField';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import {
  fetchServerHealthStatus,
  getAppIntegrationConfig,
  ServerHealthStatus,
} from '../../../config/env';
import { authService } from '../../../services/authService';
import { API_ENDPOINTS_CONTRACT, POSTGRES_TABLES_BLUEPRINT } from '../../../services/backendSchema';

export function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'integration' | 'architecture'>('integration');
  const [health, setHealth] = useState<ServerHealthStatus | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(true);

  // Admin password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [updatingPw, setUpdatingPw] = useState(false);

  const clientConfig = getAppIntegrationConfig();

  const refreshHealth = async () => {
    setCheckingHealth(true);
    const data = await fetchServerHealthStatus();
    setHealth(data);
    setCheckingHealth(false);
  };

  useEffect(() => {
    refreshHealth();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Confirmation password does not match.');
      return;
    }

    setUpdatingPw(true);
    const res = await authService.updatePassword(newPassword);
    setUpdatingPw(false);
    if (!res.ok) {
      setPwError(res.message);
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    setPwSuccess(res.message);
  };

  const readinessChecks = [
    {
      label: 'Browser Supabase Client (`VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY`)',
      ready: clientConfig.isSupabaseConfigured,
    },
    {
      label: 'Server Service Role SDK (`SUPABASE_SERVICE_ROLE_KEY`)',
      ready: health?.supabaseAdminConfigured ?? false,
    },
    {
      label: 'Initial Admin Bootstrap Secret (`ADMIN_BOOTSTRAP_SECRET`)',
      ready: health?.bootstrapConfigured ?? false,
    },
    {
      label: 'PostgreSQL Core Schema Initialized (`001`–`004` migrations)',
      ready: health?.databaseSchemaReady ?? false,
    },
    {
      label: 'Competency Scoring & Gap Engine Migration (`005_competency_scoring_engine.sql`)',
      ready: health?.competencyScoringEngineReady ?? false,
    },
    {
      label: 'Training & Learning Workflows Migration (`006_training_learning_workflows.sql`)',
      ready: health?.trainingWorkflowSchemaReady ?? false,
    },
    {
      label: 'At Least One Active Admin Account Present',
      ready: health?.hasAdminAccount ?? false,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Settings</h1>
          <p className="text-sm text-slate-600 mt-1">
            Inspect live Supabase configuration readiness, manage credentials, and review the
            database schema.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md self-start">
          <button
            type="button"
            onClick={() => setActiveTab('integration')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'integration' ? 'bg-white text-[#0B1F3A] shadow-xs' : 'text-slate-600'
            }`}
          >
            System &amp; Security
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('architecture')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'architecture' ? 'bg-white text-[#0B1F3A] shadow-xs' : 'text-slate-600'
            }`}
          >
            Database &amp; RBAC Schema
          </button>
        </div>
      </div>

      {activeTab === 'integration' ? (
        <div className="space-y-6 max-w-3xl">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-semibold text-[#0B1F3A]">
                  Supabase &amp; Backend Configuration Status
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live boolean diagnostics from `/api/health` (no secret values exposed).
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={refreshHealth} disabled={checkingHealth}>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{checkingHealth ? 'Checking...' : 'Refresh'}</span>
              </Button>
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
              {readinessChecks.map((item) => (
                <div
                  key={item.label}
                  className="px-4 py-3 flex items-center justify-between gap-4 text-xs"
                >
                  <span className="text-slate-800">{item.label}</span>
                  <span
                    className={`font-mono font-semibold shrink-0 ${
                      checkingHealth
                        ? 'text-slate-400'
                        : item.ready
                        ? 'text-[#0F766E]'
                        : 'text-amber-700'
                    }`}
                  >
                    {checkingHealth ? 'Checking...' : item.ready ? 'Ready' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[#0B1F3A]">
                Update Administrator Password
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Updates your authenticated Supabase Auth credentials immediately.
              </p>
            </div>

            {pwError && <StatusBanner tone="error" title="Password Update Failed" description={pwError} />}
            {pwSuccess && <StatusBanner tone="success" title="Password Updated" description={pwSuccess} />}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextField
                  htmlFor="adm-pw-new"
                  label="New Password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                />
                <TextField
                  htmlFor="adm-pw-conf"
                  label="Confirm New Password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="md" disabled={updatingPw}>
                  {updatingPw ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h2 className="font-display text-sm font-semibold text-[#0B1F3A]">
                PostgreSQL Tables &amp; Row Level Security Policies (17 Tables)
              </h2>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                  <th className="px-4 py-3">Table</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Key Columns</th>
                  <th className="px-4 py-3">RLS Policy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                {POSTGRES_TABLES_BLUEPRINT.map((table) => (
                  <tr key={table.tableName}>
                    <td className="px-4 py-3 font-mono font-semibold text-[#0B1F3A] whitespace-nowrap">
                      {table.tableName}
                    </td>
                    <td className="px-4 py-3 text-[#0F766E] font-medium whitespace-nowrap">
                      {table.stageOwner}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {table.keyColumns.join(', ')}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{table.rlsPolicySummary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h2 className="font-display text-sm font-semibold text-[#0B1F3A]">
                Backend Server Endpoints (`server.ts`)
              </h2>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Path</th>
                  <th className="px-4 py-3">Allowed Roles</th>
                  <th className="px-4 py-3">Responsibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                {API_ENDPOINTS_CONTRACT.map((ep) => (
                  <tr key={ep.path}>
                    <td className="px-4 py-3 font-mono font-semibold text-[#0F766E]">
                      {ep.method}
                    </td>
                    <td className="px-4 py-3 font-mono text-[#0B1F3A] whitespace-nowrap">
                      {ep.path}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{ep.allowedRoles.join(' · ')}</td>
                    <td className="px-4 py-3 text-slate-600">{ep.responsibility}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
