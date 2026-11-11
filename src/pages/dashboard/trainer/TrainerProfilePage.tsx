import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { TextField } from '../../../components/ui/FormField';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { useAuth } from '../../../context/AuthContext';
import { databaseService } from '../../../services/databaseService';

export function TrainerProfilePage() {
  const { currentUser, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState(currentUser?.fullName ?? '');
  const [department, setDepartment] = useState(currentUser?.department ?? '');
  const [designation, setDesignation] = useState(currentUser?.designation ?? '');
  const [officeLocation, setOfficeLocation] = useState(currentUser?.officeLocation ?? '');
  const [phoneExtension, setPhoneExtension] = useState(currentUser?.phoneExtension ?? '');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    tone: 'success' | 'error';
    title: string;
    description: string;
  } | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    setFullName(currentUser.fullName);
    setDepartment(currentUser.department);
    setDesignation(currentUser.designation);
    setOfficeLocation(currentUser.officeLocation);
    setPhoneExtension(currentUser.phoneExtension);
  }, [currentUser]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!fullName.trim()) nextErrors.fullName = 'Full name is required.';
    if (!department.trim()) nextErrors.department = 'Department is required.';
    if (!designation.trim()) nextErrors.designation = 'Designation is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setConfirmOpen(true);
  };

  const applySave = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      await databaseService.updateOwnProfile(currentUser.id, {
        full_name: fullName.trim(),
        department: department.trim(),
        designation: designation.trim(),
        office_location: officeLocation.trim(),
        phone_extension: phoneExtension.trim(),
      });
      await refreshProfile();
      setStatus({
        tone: 'success',
        title: 'Trainer Profile Saved',
        description: 'Your faculty profile details have been updated in PostgreSQL `profiles`.',
      });
    } catch (err) {
      setStatus({
        tone: 'error',
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Unable to save trainer profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Trainer Profile</h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage your faculty designation, department, and institutional contact attributes.
        </p>
      </div>

      {status && (
        <StatusBanner tone={status.tone} title={status.title} description={status.description} />
      )}

      <Card className="p-6 space-y-6">
        <div className="pb-4 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Account Email</p>
            <p className="font-mono text-xs text-slate-900 mt-1">{currentUser?.email}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Assigned Role</p>
            <p className="font-medium text-[#0F766E] mt-0.5">Trainer</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Approval Status</p>
            <p
              className={`font-semibold mt-0.5 capitalize ${
                currentUser?.approvalStatus === 'approved' ? 'text-[#0F766E]' : 'text-amber-700'
              }`}
            >
              {currentUser?.approvalStatus}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              htmlFor="trn-name"
              label="Full Name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={errors.fullName}
            />
            <TextField
              htmlFor="trn-desig"
              label="Faculty Title / Designation"
              required
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              error={errors.designation}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              htmlFor="trn-dept"
              label="Department"
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              error={errors.department}
            />
            <TextField
              htmlFor="trn-loc"
              label="Primary Campus / Office"
              value={officeLocation}
              onChange={(e) => setOfficeLocation(e.target.value)}
            />
          </div>

          <TextField
            htmlFor="trn-ext"
            label="Internal Extension"
            value={phoneExtension}
            onChange={(e) => setPhoneExtension(e.target.value)}
            placeholder="Optional extension"
          />

          <div className="pt-2 flex justify-end">
            <Button type="submit" variant="primary" size="md" disabled={saving}>
              {saving ? 'Saving...' : 'Save Trainer Profile'}
            </Button>
          </div>
        </form>
      </Card>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={applySave}
        title="Save trainer profile updates?"
        description="Update your faculty profile record in PostgreSQL?"
        confirmLabel="Save Changes"
      />
    </div>
  );
}
