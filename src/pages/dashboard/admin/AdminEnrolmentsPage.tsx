import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, UserPlus, XCircle } from 'lucide-react';
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
import {
  CompetencyRecord,
  CourseRecord,
  EnrollmentRecord,
  ProfileRecord,
  TrainerAssignmentRecord,
} from '../../../types/competency';

export function AdminEnrolmentsPage() {
  const { currentUser } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [trainees, setTrainees] = useState<ProfileRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [assignments, setAssignments] = useState<TrainerAssignmentRecord[]>([]);
  const [competencies, setCompetencies] = useState<CompetencyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'assigned' | 'in_progress' | 'completed' | 'withdrawn'
  >('all');

  // Assign modal state
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedTraineeId, setSelectedTraineeId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [selectedCompetencyId, setSelectedCompetencyId] = useState('');
  const [assignmentReason, setAssignmentReason] = useState('Skill gap remediation');
  const [assigning, setAssigning] = useState(false);

  // Update progress modal state
  const [editTarget, setEditTarget] = useState<EnrollmentRecord | null>(null);
  const [editProgress, setEditProgress] = useState(0);
  const [editStatus, setEditStatus] = useState<EnrollmentRecord['status']>('in_progress');
  const [editAssignmentId, setEditAssignmentId] = useState('');
  const [updatingProgress, setUpdatingProgress] = useState(false);

  // Withdraw confirm state
  const [withdrawTarget, setWithdrawTarget] = useState<EnrollmentRecord | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [enrollRows, profileRows, courseRows, assignRows, compRows] = await Promise.all([
        databaseService.listEnrollments(),
        databaseService.listAllProfiles(),
        databaseService.listAllCourses(),
        databaseService.listTrainerAssignments(),
        databaseService.listCompetencies(),
      ]);
      const activeTrainees = profileRows.filter(
        (p) => p.role === 'trainee' && p.account_status === 'active'
      );
      setEnrollments(enrollRows);
      setTrainees(activeTrainees);
      setCourses(courseRows);
      setAssignments(assignRows);
      setCompetencies(compRows);
      if (activeTrainees.length > 0 && !selectedTraineeId) {
        setSelectedTraineeId(activeTrainees[0].id);
      }
      if (courseRows.length > 0 && !selectedCourseId) {
        setSelectedCourseId(courseRows[0].id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load training enrolments.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCourseAssignments = useMemo(() => {
    return assignments.filter(
      (a) => a.course_id === selectedCourseId && a.status === 'active'
    );
  }, [assignments, selectedCourseId]);

  const editCourseAssignments = useMemo(() => {
    if (!editTarget) return [];
    return assignments.filter((a) => a.course_id === editTarget.course_id);
  }, [assignments, editTarget]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrollments.filter((row) => {
      const matchStatus = statusFilter === 'all' || row.status === statusFilter;
      const matchQuery =
        !q ||
        (row.trainee?.full_name ?? '').toLowerCase().includes(q) ||
        (row.trainee?.department ?? '').toLowerCase().includes(q) ||
        (row.course?.title ?? '').toLowerCase().includes(q) ||
        (row.course?.code ?? '').toLowerCase().includes(q) ||
        row.assignment_reason.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [enrollments, search, statusFilter]);

  const handleAssignTrainee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedTraineeId || !selectedCourseId) {
      setError('Select both a Trainee and a Course.');
      return;
    }
    setAssigning(true);
    setError(null);
    try {
      await databaseService.enrollInCourse({
        trainee_id: selectedTraineeId,
        course_id: selectedCourseId,
        trainer_assignment_id: selectedAssignmentId || null,
        mapped_competency_id: selectedCompetencyId || null,
        assignment_reason: assignmentReason.trim() || 'Administrative training assignment',
        assigned_by: currentUser.id,
        status: 'assigned',
      });
      setAssignOpen(false);
      setSelectedAssignmentId('');
      setSelectedCompetencyId('');
      setAssignmentReason('Skill gap remediation');
      setNotice('Trainee assigned to training course in PostgreSQL `enrollments`.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to assign trainee.');
    } finally {
      setAssigning(false);
    }
  };

  const openEditProgress = (row: EnrollmentRecord) => {
    setEditTarget(row);
    setEditProgress(row.progress_percent);
    setEditStatus(row.status);
    setEditAssignmentId(row.trainer_assignment_id ?? '');
  };

  const handleUpdateProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setUpdatingProgress(true);
    setError(null);
    try {
      const clampedProgress = Math.max(0, Math.min(100, Number(editProgress)));
      await databaseService.updateEnrollmentProgress(
        editTarget.id,
        clampedProgress,
        editStatus,
        editAssignmentId || null
      );
      setNotice(`Updated enrolment milestone for ${editTarget.trainee?.full_name ?? 'Trainee'}.`);
      setEditTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update enrolment progress.');
    } finally {
      setUpdatingProgress(false);
    }
  };

  const handleWithdraw = async (row: EnrollmentRecord) => {
    try {
      await databaseService.updateEnrollmentProgress(row.id, row.progress_percent, 'withdrawn');
      setNotice(`Withdrew enrolment for ${row.trainee?.full_name ?? 'Trainee'}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to withdraw enrolment.');
    }
  };

  const columns: DataColumn<EnrollmentRecord>[] = [
    {
      key: 'trainee',
      header: 'Trainee',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.trainee?.full_name ?? 'Trainee'}</p>
          <p className="text-xs text-slate-500">
            {row.trainee?.department || '—'} · {row.trainee?.email || ''}
          </p>
        </div>
      ),
    },
    {
      key: 'course',
      header: 'Course & Competency',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">
            <span className="font-mono text-xs text-[#0F766E] mr-1.5">
              {row.course?.code ?? '—'}
            </span>
            {row.course?.title ?? 'Course'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {row.competency ? `${row.competency.code} — ${row.competency.title}` : row.assignment_reason}
          </p>
        </div>
      ),
    },
    {
      key: 'trainer',
      header: 'Cohort / Trainer',
      render: (row) =>
        row.trainer_assignment ? (
          <div className="text-xs">
            <p className="font-mono font-medium text-[#0B1F3A]">
              {row.trainer_assignment.cohort_code}
            </p>
            <p className="text-slate-500">
              {row.trainer_assignment.trainer?.full_name ?? 'Assigned Trainer'}
            </p>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Self / Cohort Unassigned</span>
        ),
    },
    {
      key: 'progress',
      header: 'Progress & Status',
      render: (row) => (
        <div className="text-xs">
          <p className="font-mono font-semibold text-slate-800 tabular-nums">
            {row.progress_percent}%
          </p>
          <p
            className={`capitalize font-medium ${
              row.status === 'completed'
                ? 'text-[#0F766E]'
                : row.status === 'withdrawn'
                ? 'text-red-700'
                : 'text-slate-600'
            }`}
          >
            {row.status.replace('_', ' ')}
          </p>
        </div>
      ),
    },
    {
      key: 'enrolled',
      header: 'Enrolled',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">{formatShortDate(row.enrolled_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center gap-3">
          <button
            type="button"
            onClick={() => openEditProgress(row)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#0B1F3A] hover:text-[#0F766E] cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Update</span>
          </button>
          {row.status !== 'withdrawn' && (
            <button
              type="button"
              onClick={() => setWithdrawTarget(row)}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900 cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Withdraw</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Enrolments</h1>
          <p className="text-sm text-slate-600 mt-1">
            Govern trainee course assignments, trainer cohort allocation, and completion milestones.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setAssignOpen(true)}>
          <UserPlus className="w-4 h-4" />
          <span>Assign Trainee</span>
        </Button>
      </div>

      {error && <StatusBanner tone="error" title="Enrolment Error" description={error} />}
      {notice && <StatusBanner tone="success" title="Enrolment Updated" description={notice} />}

      <WorkspaceFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search enrolments by trainee, department, course, or reason..."
        rightSlot={
          <select
            aria-label="Filter enrolments by status"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as 'all' | 'assigned' | 'in_progress' | 'completed' | 'withdrawn'
              )
            }
            className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        }
      />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No training enrolments recorded"
        emptyDescription="Assign a trainee above or wait for trainees to enrol from their Skill Gap Report."
      />

      {/* Assign Trainee Modal */}
      <ModalDrawer
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign Trainee to Training Course"
        subtitle="Creates a record in PostgreSQL `enrollments`"
      >
        <form onSubmit={handleAssignTrainee} className="space-y-4">
          <SelectField
            htmlFor="enr-trainee"
            label="Active Trainee"
            value={selectedTraineeId}
            onChange={(e) => setSelectedTraineeId(e.target.value)}
          >
            {trainees.length === 0 ? (
              <option value="">No active trainees found</option>
            ) : (
              trainees.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.department || t.email})
                </option>
              ))
            )}
          </SelectField>

          <SelectField
            htmlFor="enr-course"
            label="Target Course"
            value={selectedCourseId}
            onChange={(e) => {
              setSelectedCourseId(e.target.value);
              setSelectedAssignmentId('');
            }}
          >
            {courses.length === 0 ? (
              <option value="">No courses published</option>
            ) : (
              courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))
            )}
          </SelectField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              htmlFor="enr-cohort"
              label="Trainer Cohort (Optional)"
              value={selectedAssignmentId}
              onChange={(e) => setSelectedAssignmentId(e.target.value)}
            >
              <option value="">No specific cohort</option>
              {filteredCourseAssignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.cohort_code} — {a.trainer?.full_name ?? 'Trainer'}
                </option>
              ))}
            </SelectField>

            <SelectField
              htmlFor="enr-comp"
              label="Target Competency (Optional)"
              value={selectedCompetencyId}
              onChange={(e) => setSelectedCompetencyId(e.target.value)}
            >
              <option value="">General course enrolment</option>
              {competencies.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.code} — {comp.title}
                </option>
              ))}
            </SelectField>
          </div>

          <TextField
            htmlFor="enr-reason"
            label="Assignment Basis"
            required
            value={assignmentReason}
            onChange={(e) => setAssignmentReason(e.target.value)}
            placeholder="e.g. Mandatory gap closure for Q2 audit readiness"
          />

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={assigning || trainees.length === 0 || courses.length === 0}
            >
              {assigning ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          </div>
        </form>
      </ModalDrawer>

      {/* Update Enrolment Milestone Modal */}
      <ModalDrawer
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Update Enrolment Status"
        subtitle={
          editTarget
            ? `${editTarget.trainee?.full_name ?? 'Trainee'} · ${editTarget.course?.code ?? ''}`
            : ''
        }
      >
        {editTarget && (
          <form onSubmit={handleUpdateProgress} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <TextField
                htmlFor="upd-pct"
                label="Progress (%)"
                type="number"
                min={0}
                max={100}
                value={String(editProgress)}
                onChange={(e) => setEditProgress(Number(e.target.value))}
              />
              <SelectField
                htmlFor="upd-status"
                label="Status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as EnrollmentRecord['status'])}
              >
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="withdrawn">Withdrawn</option>
              </SelectField>
            </div>

            <SelectField
              htmlFor="upd-cohort"
              label="Assigned Trainer Cohort"
              value={editAssignmentId}
              onChange={(e) => setEditAssignmentId(e.target.value)}
            >
              <option value="">-- Self-Enrolled / Unassigned Cohort --</option>
              {editCourseAssignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.cohort_code} — {a.trainer?.full_name ?? 'Trainer'} ({a.status})
                </option>
              ))}
            </SelectField>

            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={updatingProgress}>
                {updatingProgress ? 'Saving...' : 'Save Milestone'}
              </Button>
            </div>
          </form>
        )}
      </ModalDrawer>

      <ConfirmDialog
        isOpen={Boolean(withdrawTarget)}
        onClose={() => setWithdrawTarget(null)}
        onConfirm={() => {
          if (withdrawTarget) handleWithdraw(withdrawTarget);
        }}
        title="Withdraw training enrolment?"
        description={`Mark "${withdrawTarget?.course?.code ?? ''} — ${withdrawTarget?.course?.title ?? ''}" as withdrawn for ${withdrawTarget?.trainee?.full_name ?? 'this trainee'}?`}
        confirmLabel="Withdraw Enrolment"
        tone="danger"
      />
    </div>
  );
}
