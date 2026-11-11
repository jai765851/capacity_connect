import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, UserPlus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { SelectField, TextField } from '../../../components/ui/FormField';
import { ModalDrawer } from '../../../components/ui/ModalDrawer';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { useAuth } from '../../../context/AuthContext';
import { formatShortDate } from '../../../lib/formatters';
import { databaseService } from '../../../services/databaseService';
import { AccountStatus, ApprovalStatus, UserRole } from '../../../types/auth';
import { JobRoleRecord, ProfileRecord } from '../../../types/competency';

export function AdminUserManagementPage() {
  const { currentUser } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRoleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Create User Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('trainee');
  const [newDept, setNewDept] = useState('');
  const [newDesig, setNewDesig] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit User Modal
  const [editTarget, setEditTarget] = useState<ProfileRecord | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('trainee');
  const [editApproval, setEditApproval] = useState<ApprovalStatus>('approved');
  const [editAccountStatus, setEditAccountStatus] = useState<AccountStatus>('active');
  const [editJobRoleId, setEditJobRoleId] = useState<string>('');
  const [editDepartment, setEditDepartment] = useState<string>('');
  const [editDesignation, setEditDesignation] = useState<string>('');
  const [confirmSaveEdit, setConfirmSaveEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [profileRows, roleRows] = await Promise.all([
        databaseService.listAllProfiles(),
        databaseService.listJobRoles(),
      ]);
      setProfiles(profileRows);
      setJobRoles(roleRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch user directory.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => {
      const matchesRole = roleFilter === 'All' || p.role === roleFilter;
      const matchesStatus = statusFilter === 'All' || p.account_status === statusFilter;
      const matchesSearch =
        !q ||
        p.full_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q) ||
        p.designation.toLowerCase().includes(q);
      return matchesRole && matchesStatus && matchesSearch;
    });
  }, [profiles, search, roleFilter, statusFilter]);

  const handleProvisionUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || newPassword.length < 8) {
      setError('Full name, valid email, and password (minimum 8 chars) are required.');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const result = await databaseService.adminProvisionUser({
        fullName: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
        department: newDept.trim(),
        designation: newDesig.trim(),
      });
      setNotice(
        `${result.message} Account ready for ${result.user.email} (${result.user.role}).`
      );
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewDept('');
      setNewDesig('');
      setCreateOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to provision account.');
    } finally {
      setCreating(false);
    }
  };

  const openEditDrawer = (profile: ProfileRecord) => {
    setEditTarget(profile);
    setEditRole(profile.role);
    setEditApproval(profile.approval_status);
    setEditAccountStatus(profile.account_status);
    setEditJobRoleId(profile.job_role_id ?? '');
    setEditDepartment(profile.department);
    setEditDesignation(profile.designation);
  };

  const handleApplyEdit = async () => {
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      await databaseService.adminUpdateUserProfile(editTarget.id, {
        role: editRole,
        approval_status: editApproval,
        account_status: editAccountStatus,
        job_role_id: editJobRoleId || null,
        department: editDepartment.trim(),
        designation: editDesignation.trim(),
      });
      setNotice(`Updated governance record for ${editTarget.full_name}.`);
      setEditTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user record.');
    } finally {
      setSavingEdit(false);
    }
  };

  const columns: DataColumn<ProfileRecord>[] = [
    {
      key: 'user',
      header: 'User Identity',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">
            {row.full_name}
            {row.id === currentUser?.id && (
              <span className="ml-1.5 text-xs font-mono text-[#0F766E]">(You)</span>
            )}
          </p>
          <p className="font-mono text-xs text-slate-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'dept',
      header: 'Department / Role',
      render: (row) => (
        <div className="text-xs">
          <p className="text-slate-800">{row.department || '—'}</p>
          <p className="text-slate-500">
            {row.job_role ? `${row.job_role.code} — ${row.job_role.title}` : row.designation || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'RBAC Role',
      render: (row) => (
        <span className="text-xs font-semibold capitalize text-[#0B1F3A]">{row.role}</span>
      ),
    },
    {
      key: 'status',
      header: 'Account / Approval',
      render: (row) => (
        <div className="text-xs">
          <p
            className={`font-semibold capitalize ${
              row.account_status === 'active' ? 'text-[#0F766E]' : 'text-red-700'
            }`}
          >
            {row.account_status}
          </p>
          {row.role === 'trainer' && (
            <p className="text-slate-500 capitalize">Trainer: {row.approval_status}</p>
          )}
        </div>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">{formatShortDate(row.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Governance',
      align: 'right',
      render: (row) => (
        <Button variant="outline" size="sm" onClick={() => openEditDrawer(row)}>
          <Edit3 className="w-3.5 h-3.5" />
          <span>Manage</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">User Management</h1>
          <p className="text-sm text-slate-600 mt-1">
            Provision verified accounts via server Auth Admin SDK and manage role assignments.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
          <UserPlus className="w-4 h-4" />
          <span>Provision User / Admin</span>
        </Button>
      </div>

      {error && <StatusBanner tone="error" title="Governance Error" description={error} />}
      {notice && <StatusBanner tone="success" title="Governance Updated" description={notice} />}

      <WorkspaceFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search accounts by name, email, or department..."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
            >
              <option value="All">All Roles</option>
              <option value="trainee">Trainee</option>
              <option value="trainer">Trainer</option>
              <option value="admin">Admin</option>
            </select>
            <select
              aria-label="Filter by account status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
            >
              <option value="All">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        }
      />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No user profiles found"
        emptyDescription="User records from PostgreSQL `profiles` appear here."
      />

      {/* Provision New Account Modal */}
      <ModalDrawer
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Provision Organisational Account"
        subtitle="Uses server-side Admin Auth provisioning (`POST /api/admin/create-user`)"
      >
        <form onSubmit={handleProvisionUser} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              htmlFor="prov-name"
              label="Full Name"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Suresh Nair"
            />
            <TextField
              htmlFor="prov-email"
              label="Official Email"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="name@organisation.gov.in"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              htmlFor="prov-role"
              label="Assign RBAC Role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
            >
              <option value="trainee">Trainee (Active)</option>
              <option value="trainer">Trainer (Pre-Approved)</option>
              <option value="admin">Admin (Portal Governance)</option>
            </SelectField>
            <TextField
              htmlFor="prov-pw"
              label="Initial Password"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              htmlFor="prov-dept"
              label="Department"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              placeholder="Department name"
            />
            <TextField
              htmlFor="prov-desig"
              label="Designation"
              value={newDesig}
              onChange={(e) => setNewDesig(e.target.value)}
              placeholder="Official designation"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={creating}>
              {creating ? 'Provisioning...' : 'Create Account'}
            </Button>
          </div>
        </form>
      </ModalDrawer>

      {/* Edit User Modal */}
      <ModalDrawer
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={`Manage Account: ${editTarget?.full_name ?? ''}`}
        subtitle={editTarget?.email}
      >
        {editTarget && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SelectField
                htmlFor="edit-role"
                label="RBAC Role"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
              >
                <option value="trainee">Trainee</option>
                <option value="trainer">Trainer</option>
                <option value="admin">Admin</option>
              </SelectField>
              <SelectField
                htmlFor="edit-approval"
                label="Trainer Approval"
                value={editApproval}
                onChange={(e) => setEditApproval(e.target.value as ApprovalStatus)}
              >
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </SelectField>
              <SelectField
                htmlFor="edit-status"
                label="Account Status"
                value={editAccountStatus}
                onChange={(e) => setEditAccountStatus(e.target.value as AccountStatus)}
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </SelectField>
            </div>

            <SelectField
              htmlFor="edit-jobrole"
              label="Assigned Job Role Benchmark"
              value={editJobRoleId}
              onChange={(e) => setEditJobRoleId(e.target.value)}
            >
              <option value="">-- Unassigned --</option>
              {jobRoles.map((jr) => (
                <option key={jr.id} value={jr.id}>
                  {jr.code} — {jr.title}
                </option>
              ))}
            </SelectField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                htmlFor="edit-dept"
                label="Department"
                value={editDepartment}
                onChange={(e) => setEditDepartment(e.target.value)}
              />
              <TextField
                htmlFor="edit-desig"
                label="Designation"
                value={editDesignation}
                onChange={(e) => setEditDesignation(e.target.value)}
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={savingEdit}
                onClick={() => setConfirmSaveEdit(true)}
              >
                {savingEdit ? 'Saving...' : 'Apply Changes'}
              </Button>
            </div>
          </div>
        )}
      </ModalDrawer>

      <ConfirmDialog
        isOpen={confirmSaveEdit}
        onClose={() => setConfirmSaveEdit(false)}
        onConfirm={handleApplyEdit}
        title="Confirm account governance update?"
        description={`Apply updated RBAC role, approval status, or job role mapping for ${editTarget?.email}?`}
        confirmLabel="Confirm Update"
      />
    </div>
  );
}
