import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { SelectField, TextField } from '../../../components/ui/FormField';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { useAuth } from '../../../context/AuthContext';
import { databaseService } from '../../../services/databaseService';
import { JobRoleRecord } from '../../../types/competency';

export function TraineeProfilePage() {
  const { currentUser, refreshProfile } = useAuth();

  const [jobRoles, setJobRoles] = useState<JobRoleRecord[]>([]);
  const [fullName, setFullName] = useState(currentUser?.fullName ?? '');
  const [department, setDepartment] = useState(currentUser?.department ?? '');
  const [designation, setDesignation] = useState(currentUser?.designation ?? '');
  const [officeLocation, setOfficeLocation] = useState(currentUser?.officeLocation ?? '');
  const [phoneExtension, setPhoneExtension] = useState(currentUser?.phoneExtension ?? '');
  const [jobRoleId, setJobRoleId] = useState<string>(currentUser?.jobRoleId ?? '');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
    setJobRoleId(currentUser.jobRoleId ?? '');
  }, [currentUser]);

  useEffect(() => {
    databaseService
      .listJobRoles()
      .then(setJobRoles)
      .catch(() => {});
  }, []);

  const handleValidateAndPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!fullName.trim()) nextErrors.fullName = 'Full name is required.';
    if (!department.trim()) nextErrors.department = 'Department is required.';
    if (!designation.trim()) nextErrors.designation = 'Designation is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setConfirmSaveOpen(true);
  };

  const applyProfileSave = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      await databaseService.updateOwnProfile(currentUser.id, {
        full_name: fullName.trim(),
        department: department.trim(),
        designation: designation.trim(),
        office_location: officeLocation.trim(),
        phone_extension: phoneExtension.trim(),
        job_role_id: jobRoleId || null,
      });
      await refreshProfile();
      setStatus({
        tone: 'success',
        title: 'Profile Saved to Database',
        description:
          'Your institutional details and job role assignment have been saved in PostgreSQL.',
      });
    } catch (err) {
      setStatus({
        tone: 'error',
        title: 'Profile Update Failed',
        description: err instanceof Error ? err.message : 'Unable to save profile changes.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Profile</h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage your institutional identity, department, and assigned Job Role framework.
        </p>
      </div>

      {status && (
        <StatusBanner
          tone={status.tone}
          title={status.title}
          description={status.description}
        />
      )}

      <Card className="p-6 space-y-6">
        <div className="pb-4 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Verified Account Email</p>
            <p className="font-mono text-xs text-slate-900 mt-1">{currentUser?.email}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Assigned Role</p>
            <p className="font-medium text-[#0F766E] mt-0.5">Trainee (Active)</p>
          </div>
        </div>

        <form onSubmit={handleValidateAndPrompt} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              htmlFor="trainee-fullname"
              label="Full Name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={errors.fullName}
            />
            <TextField
              htmlFor="trainee-designation"
              label="Designation"
              required
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              error={errors.designation}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              htmlFor="trainee-department"
              label="Department"
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              error={errors.department}
            />
            <SelectField
              htmlFor="trainee-jobrole"
              label="Organisational Job Role Baseline"
              value={jobRoleId}
              onChange={(e) => setJobRoleId(e.target.value)}
              helperText="Links required competency benchmarks for your Skill Gap Report."
            >
              <option value="">-- Select Organisational Job Role --</option>
              {jobRoles.map((jr) => (
                <option key={jr.id} value={jr.id}>
                  {jr.code} — {jr.title} ({jr.department})
                </option>
              ))}
            </SelectField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              htmlFor="trainee-location"
              label="Office Location"
              value={officeLocation}
              onChange={(e) => setOfficeLocation(e.target.value)}
            />
            <TextField
              htmlFor="trainee-phone"
              label="Internal Office Extension"
              value={phoneExtension}
              onChange={(e) => setPhoneExtension(e.target.value)}
              placeholder="Optional extension number"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <Button type="submit" variant="primary" size="md" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Profile Changes'}
            </Button>
          </div>
        </form>
      </Card>

      <ConfirmDialog
        isOpen={confirmSaveOpen}
        onClose={() => setConfirmSaveOpen(false)}
        onConfirm={applyProfileSave}
        title="Save profile changes?"
        description="Update your institutional profile and Job Role mapping in PostgreSQL?"
        confirmLabel="Save Changes"
      />
    </div>
  );
}
