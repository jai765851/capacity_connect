import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { useAuth } from '../../../context/AuthContext';
import { formatShortDate } from '../../../lib/formatters';
import { databaseService } from '../../../services/databaseService';
import { EnrollmentRecord, TrainerAssignmentRecord } from '../../../types/competency';

export function TrainerTraineesPage() {
  const { currentUser } = useAuth();
  const [assignments, setAssignments] = useState<TrainerAssignmentRecord[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  useEffect(() => {
    if (!currentUser) return;
    setIsLoading(true);
    Promise.all([
      databaseService.listTrainerAssignments(currentUser.id),
      databaseService.listEnrollments(),
    ])
      .then(([assignRows, enrollRows]) => {
        setAssignments(assignRows);
        setEnrollments(enrollRows);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load assigned cohorts and trainees.');
      })
      .finally(() => setIsLoading(false));
  }, [currentUser?.id]);

  const filteredEnrollments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrollments.filter((row) => {
      const matchesStatus = statusFilter === 'All' || row.status === statusFilter;
      const matchesSearch =
        !q ||
        (row.trainee?.full_name ?? '').toLowerCase().includes(q) ||
        (row.trainee?.department ?? '').toLowerCase().includes(q) ||
        (row.course?.code ?? '').toLowerCase().includes(q) ||
        (row.trainer_assignment?.cohort_code ?? '').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [enrollments, search, statusFilter]);

  const handleUpdateTraineeProgress = async (
    row: EnrollmentRecord,
    nextPercent: number
  ) => {
    const nextStatus = nextPercent >= 100 ? 'completed' : 'in_progress';
    try {
      await databaseService.updateEnrollmentProgress(row.id, nextPercent, nextStatus);
      setEnrollments((prev) =>
        prev.map((e) =>
          e.id === row.id ? { ...e, progress_percent: nextPercent, status: nextStatus } : e
        )
      );
      setNotice(
        `Updated progress to ${nextPercent}% for ${row.trainee?.full_name ?? 'trainee'}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update trainee progress.');
    }
  };

  const columns: DataColumn<EnrollmentRecord>[] = [
    {
      key: 'trainee',
      header: 'Trainee',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.trainee?.full_name ?? 'Trainee'}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {row.trainee?.designation ?? ''} · {row.trainee?.department ?? ''}
          </p>
        </div>
      ),
    },
    {
      key: 'course',
      header: 'Course & Cohort',
      render: (row) => (
        <div>
          <span className="font-mono text-xs text-[#0F766E]">{row.course?.code ?? '—'}</span>
          <p className="text-xs text-slate-700">{row.course?.title ?? 'Course'}</p>
          <p className="font-mono text-[11px] text-slate-500 mt-0.5">
            Cohort: {row.trainer_assignment?.cohort_code ?? '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Milestone Progress',
      render: (row) => (
        <select
          aria-label={`Milestone progress for ${row.trainee?.full_name}`}
          value={row.progress_percent}
          disabled={row.status === 'withdrawn'}
          onChange={(e) => handleUpdateTraineeProgress(row, Number(e.target.value))}
          className="min-h-[34px] rounded-md border border-slate-300 bg-white px-2.5 text-xs font-mono tabular-nums"
        >
          <option value={0}>0% — Assigned</option>
          <option value={25}>25%</option>
          <option value={50}>50%</option>
          <option value={75}>75%</option>
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
            row.status === 'completed' ? 'text-[#0F766E]' : 'text-[#0B1F3A]'
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
      key: 'assess',
      header: 'Competency Evaluation',
      align: 'right',
      render: (row) => (
        <Link
          to={`/dashboard/trainer/performance?traineeId=${row.trainee_id}`}
          className="text-xs font-semibold text-[#0F766E] hover:text-[#0B1F3A] whitespace-nowrap"
        >
          Evaluate / Reassess →
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">My Trainees</h1>
        <p className="text-sm text-slate-600 mt-1">
          Inspect cohorts assigned to you by Administration and manage trainee training milestones.
        </p>
      </div>

      {error && <StatusBanner tone="error" title="Query Error" description={error} />}
      {notice && <StatusBanner tone="success" title="Progress Saved" description={notice} />}

      {assignments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {assignments.map((assign) => (
            <Card key={assign.id} className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-semibold text-[#0F766E]">{assign.cohort_code}</span>
                <span className="capitalize text-slate-500">{assign.status}</span>
              </div>
              <p className="font-display text-sm font-semibold text-[#0B1F3A]">
                {assign.course?.code} — {assign.course?.title}
              </p>
              <p className="text-xs text-slate-500">{assign.department || 'All Departments'}</p>
            </Card>
          ))}
        </div>
      )}

      <WorkspaceFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search assigned trainees, departments, or cohort code..."
        rightSlot={
          <select
            aria-label="Filter by enrolment status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
          >
            <option value="All">All Statuses</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        }
      />

      <DataTable
        columns={columns}
        rows={filteredEnrollments}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No cohort trainees assigned yet"
        emptyDescription="Trainees enrolled in cohorts linked to your `trainer_assignments` appear here automatically."
      />
    </div>
  );
}
