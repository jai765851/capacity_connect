import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { TextField } from '../../../components/ui/FormField';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { useAuth } from '../../../context/AuthContext';
import { authService } from '../../../services/authService';
import { databaseService } from '../../../services/databaseService';

export function TraineeSettingsPage() {
  const { currentUser, refreshProfile } = useAuth();
  const [emailAlerts, setEmailAlerts] = useState(
    currentUser?.notificationPrefs.email_alerts ?? true
  );
  const [assessmentReminders, setAssessmentReminders] = useState(
    currentUser?.notificationPrefs.assessment_reminders ?? true
  );
  const [digestSummary, setDigestSummary] = useState(
    currentUser?.notificationPrefs.digest_summary ?? false
  );

  const [newPassword, setNewPassword] = useState('');
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [updatingPw, setUpdatingPw] = useState(false);
  const [status, setStatus] = useState<{
    tone: 'success' | 'error';
    title: string;
    description: string;
  } | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    setEmailAlerts(currentUser.notificationPrefs.email_alerts);
    setAssessmentReminders(currentUser.notificationPrefs.assessment_reminders);
    setDigestSummary(currentUser.notificationPrefs.digest_summary);
  }, [currentUser]);

  const handleSavePrefs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSavingPrefs(true);
    try {
      await databaseService.updateOwnProfile(currentUser.id, {
        notification_prefs: {
          email_alerts: emailAlerts,
          assessment_reminders: assessmentReminders,
          digest_summary: digestSummary,
        },
      });
      await refreshProfile();
      setStatus({
        tone: 'success',
        title: 'Notification Preferences Saved',
        description: 'Your preferences have been saved to your profile in PostgreSQL.',
      });
    } catch (err) {
      setStatus({
        tone: 'error',
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Unable to save preferences.',
      });
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!currentUser) return;
    setEmailAlerts(true);
    setAssessmentReminders(true);
    setDigestSummary(false);
    try {
      await databaseService.updateOwnProfile(currentUser.id, {
        notification_prefs: {
          email_alerts: true,
          assessment_reminders: true,
          digest_summary: false,
        },
      });
      await refreshProfile();
      setStatus({
        tone: 'success',
        title: 'Defaults Restored',
        description: 'Notification preferences restored to institutional defaults.',
      });
    } catch (err) {
      setStatus({
        tone: 'error',
        title: 'Reset Failed',
        description: err instanceof Error ? err.message : 'Unable to reset preferences.',
      });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setStatus({
        tone: 'error',
        title: 'Validation Error',
        description: 'New password must be at least 8 characters.',
      });
      return;
    }
    setUpdatingPw(true);
    const res = await authService.updatePassword(newPassword);
    setUpdatingPw(false);
    setStatus({
      tone: res.ok ? 'success' : 'error',
      title: res.ok ? 'Password Updated' : 'Password Update Failed',
      description: res.message,
    });
    if (res.ok) setNewPassword('');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Settings</h1>
        <p className="text-sm text-slate-600 mt-1">
          Configure persistent workspace notifications and manage your account password.
        </p>
      </div>

      {status && (
        <StatusBanner tone={status.tone} title={status.title} description={status.description} />
      )}

      <Card className="p-6 space-y-6">
        <form onSubmit={handleSavePrefs} className="space-y-5">
          <div>
            <h2 className="font-display text-base font-semibold text-[#0B1F3A]">
              Notification Preferences
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Saved directly in `profiles.notification_prefs`.
            </p>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4 text-sm">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0B1F3A] focus:ring-[#0F766E]"
              />
              <div>
                <span className="font-medium text-slate-900">Training Assignment Alerts</span>
                <p className="text-xs text-slate-500">
                  Receive updates when a skill gap triggers a newly assigned course.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={assessmentReminders}
                onChange={(e) => setAssessmentReminders(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0B1F3A] focus:ring-[#0F766E]"
              />
              <div>
                <span className="font-medium text-slate-900">
                  Assessment &amp; Reassessment Windows
                </span>
                <p className="text-xs text-slate-500">
                  Receive reminders prior to diagnostic or post-training evaluation deadlines.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={digestSummary}
                onChange={(e) => setDigestSummary(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0B1F3A] focus:ring-[#0F766E]"
              />
              <div>
                <span className="font-medium text-slate-900">Weekly Progress Summary</span>
                <p className="text-xs text-slate-500">
                  Receive a structured digest of open training milestones.
                </p>
              </div>
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={() => setConfirmResetOpen(true)}>
              Reset to Defaults
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={savingPrefs}>
              {savingPrefs ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-display text-base font-semibold text-[#0B1F3A]">
            Update Account Password
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Applies immediately to your Supabase Auth credentials.
          </p>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <TextField
            htmlFor="settings-new-pw"
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 8 characters"
          />
          <div className="flex justify-end">
            <Button type="submit" variant="outline" size="sm" disabled={updatingPw}>
              {updatingPw ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </Card>

      <ConfirmDialog
        isOpen={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={handleResetDefaults}
        title="Reset notification preferences?"
        description="Restore notification preferences to institutional defaults in PostgreSQL?"
        confirmLabel="Reset Defaults"
      />
    </div>
  );
}
