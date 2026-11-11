import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { useAuth } from '../../../context/AuthContext';
import { formatShortDate } from '../../../lib/formatters';
import { databaseService } from '../../../services/databaseService';
import { EnrollmentRecord } from '../../../types/competency';

export function TraineeEnrolmentsPage() {
  const { currentUser } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [withdrawTarget, setWithdrawTarget] = useState<EnrollmentRecord | null>(null);

  const loadEnrollments = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const rows = await databaseService.listEnrollments({ traineeId: currentUser.id });
      setEnrollments(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch enrolments.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEnrollments();
  }, [currentUser?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrollments.filter((row) => {
      const matchesStatus = statusFilter === 'All' || row.status === statusFilter;
      const matchesSearch =
        !q ||
        (row.course?.code ?? '').toLowerCase().includes(q) ||
        (row.course?.title ?? '').toLowerCase().includes(q) ||
        row.assignment_reason.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [enrollments, search, statusFilter]);

  const handleProgressUpdate = async (row: EnrollmentRecord, nextPercent: number) => {
    const nextStatus = nextPercent >= 100 ? 'completed' : 'in_progress';
    try {
      await databaseService.updateEnrollmentProgress(row.id, nextPercent, nextStatus);
      setEnrollments((prev) =>
        prev.map((e) =>
          e.id === row.id
            ? {
                ...e,
                progress_percent: nextPercent,
                status: nextStatus,
                completed_at: nextStatus === 'completed' ? new Date().toISOString() : e.completed_at,
              }
            : e
        )
      );
      setNotice(`Progress updated to ${nextPercent}% for ${row.course?.code ?? 'course'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update progress.');
    }
  };

  const handleWithdraw = async (row: EnrollmentRecord) => {
    try {
      await databaseService.updateEnrollmentProgress(row.id, row.progress_percent, 'withdrawn');
      setEnrollments((prev) =>
        prev.map((e) => (e.id === row.id ? { ...e, status: 'withdrawn' } : e))
      );
      setNotice(`Withdrawn from ${row.course?.code ?? 'course'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to withdraw.');
    }
  };

  const columns: DataColumn<EnrollmentRecord>[] = [
    {
      key: 'course',
      header: 'Training Course',
      render: (row) => (
        <div>
          <span className="font-mono text-xs text-[#0F766E]">{row.course?.code ?? '—'}</span>
          <p className="font-medium text-slate-900">{row.course?.title ?? 'Course'}</p>
          <p className="text-xs text-slate-500 mt-0.5">{row.assignment_reason}</p>
        </div>
      ),
    },
    {
      key: 'cohort',
      header: 'Cohort / Trainer',
      render: (row) =>
        row.trainer_assignment ? (
          <div className="text-xs">
            <p className="font-mono text-slate-800">{row.trainer_assignment.cohort_code}</p>
            <p className="text-slate-500">{row.trainer_assignment.trainer?.full_name ?? 'Assigned Trainer'}</p>
          </div>
        ) : (
          <span className="text-xs text-slate-500">Self-Enrolled</span>
        ),
    },
    {
      key: 'progress',
      header: 'Milestone Progress',
      render: (row) =>
        row.status === 'withdrawn' ? (
          <span className="text-xs text-slate-400">Withdrawn</span>
        ) : (
          <select
            aria-label={`Progress for ${row.course?.code}`}
            value={row.progress_percent}
            onChange={(e) => handleProgressUpdate(row, Number(e.target.value))}
            className="min-h-[34px] rounded-md border border-slate-300 bg-white px-2.5 text-xs font-mono tabular-nums text-slate-800"
          >
            <option value={0}>0% — Assigned</option>
            <option value={25}>25% — Started</option>
            <option value={50}>50% — Halfway</option>
            <option value={75}>75% — Applied Review</option>
            <option value={100}>100% — Completed</option>
          </select>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={`text-xs font-semibold capitalize ${
            row.status === 'completed'
              ? 'text-[#0F766E]'
              : row.status === 'withdrawn'
              ? 'text-slate-400'
              : 'text-[#0B1F3A]'
          }`}
        >
          {row.status.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Enrolled',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">{formatShortDate(row.enrolled_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => {
        if (row.status === 'withdrawn') {
          return <span className="text-xs text-slate-400">—</span>;
        }
        return (
          <div className="inline-flex flex-wrap items-center justify-end gap-2.5">
            <Link
              to="/dashboard/trainee/learning-resources"
              className="text-xs font-medium text-[#0B1F3A] hover:text-[#0F766E]"
            >
              Materials
            </Link>
            <Link
              to="/dashboard/trainee/assessments"
              className="text-xs font-medium text-[#0B1F3A] hover:text-[#0F766E]"
            >
              Assessments
            </Link>
            <Link
              to="/dashboard/trainee/feedback"
              className="text-xs font-medium text-[#0B1F3A] hover:text-[#0F766E]"
            >
              Feedback
            </Link>
            {row.status === 'completed' ? (
              <Link
                to="/dashboard/trainee/certificates"
                className="text-xs font-semibold text-[#0F766E] hover:text-[#0B1F3A]"
              >
                Certificate
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setWithdrawTarget(row)}
                className="text-xs font-medium text-red-700 hover:text-red-900 cursor-pointer"
              >
                Withdraw
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Enrolments</h1>
        <p className="text-sm text-slate-600 mt-1">
          Stage 04 targeted course assignments, cohort placements, and completion milestones.
        </p>
      </div>

      {error && <StatusBanner tone="error" title="Database Error" description={error} />}
      {notice && <StatusBanner tone="success" title="Enrolment Updated" description={notice} />}

      <WorkspaceFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search enrolments by course code or assignment reason..."
        rightSlot={
          <select
            aria-label="Filter enrolments by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
          >
            <option value="All">All Statuses</option>
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
        emptyTitle="No course enrolments recorded"
        emptyDescription="Enrol in a recommended programme from Skill Gap Report or Training Courses, or await cohort assignment by an Administrator."
      />

      <ConfirmDialog
        isOpen={Boolean(withdrawTarget)}
        onClose={() => setWithdrawTarget(null)}
        onConfirm={() => {
          if (withdrawTarget) handleWithdraw(withdrawTarget);
        }}
        title="Withdraw from training course?"
        description={`Mark enrolment in "${withdrawTarget?.course?.title}" as withdrawn?`}
        confirmLabel="Withdraw"
        tone="danger"
      />
    </div>
  );
}
