import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { useAuth } from '../../../context/AuthContext';
import { formatShortDate } from '../../../lib/formatters';
import { databaseService } from '../../../services/databaseService';
import { ProfileRecord, TrainerExpertiseRecord } from '../../../types/competency';

interface TrainerWithExpertise {
  profile: ProfileRecord;
  expertise: TrainerExpertiseRecord[];
}

export function AdminTrainerApprovalPage() {
  const { currentUser } = useAuth();
  const [rows, setRows] = useState<TrainerWithExpertise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [confirmAction, setConfirmAction] = useState<{
    trainer: ProfileRecord;
    decision: 'approved' | 'rejected';
  } | null>(null);

  const loadTrainers = async () => {
    setIsLoading(true);
    try {
      const [allProfiles, allExpertise] = await Promise.all([
        databaseService.listAllProfiles(),
        databaseService.listTrainerExpertise(),
      ]);

      const trainerProfiles = allProfiles.filter((p) => p.role === 'trainer');
      const combined: TrainerWithExpertise[] = trainerProfiles.map((profile) => ({
        profile,
        expertise: allExpertise.filter((e) => e.trainer_id === profile.id),
      }));
      setRows(combined);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch trainer applications.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTrainers();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((item) => {
      const matchesStatus =
        statusFilter === 'All' || item.profile.approval_status === statusFilter;
      const matchesSearch =
        !q ||
        item.profile.full_name.toLowerCase().includes(q) ||
        item.profile.email.toLowerCase().includes(q) ||
        item.profile.department.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [rows, search, statusFilter]);

  const handleDecision = async (trainer: ProfileRecord, decision: 'approved' | 'rejected') => {
    try {
      await databaseService.adminUpdateUserProfile(trainer.id, {
        approval_status: decision,
      });

      if (decision === 'approved') {
        const expRows = rows.find((r) => r.profile.id === trainer.id)?.expertise ?? [];
        await Promise.all(
          expRows
            .filter((e) => !e.verified_by_admin)
            .map((e) => databaseService.verifyTrainerExpertise(e.id, true))
        );
      }

      if (currentUser) {
        await databaseService.createNotification({
          recipient_id: trainer.id,
          audience: 'User',
          priority: 'Important',
          title:
            decision === 'approved'
              ? 'Trainer Accreditation Approved'
              : 'Trainer Application Declined',
          body:
            decision === 'approved'
              ? 'Your Trainer profile has been approved by Administration. Course authoring and assessment workflows are now unlocked.'
              : 'Your Trainer application was declined by Administration. Contact support for clarification.',
          created_by: currentUser.id,
        });
      }

      setNotice(`Trainer "${trainer.full_name}" marked as ${decision}.`);
      await loadTrainers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process trainer approval.');
    }
  };

  const handleToggleExpertiseVerify = async (exp: TrainerExpertiseRecord) => {
    try {
      await databaseService.verifyTrainerExpertise(exp.id, !exp.verified_by_admin);
      setRows((prev) =>
        prev.map((item) => ({
          ...item,
          expertise: item.expertise.map((e) =>
            e.id === exp.id ? { ...e, verified_by_admin: !e.verified_by_admin } : e
          ),
        }))
      );
      setNotice(
        `${exp.verified_by_admin ? 'Revoked verification for' : 'Verified'} "${exp.specialization}".`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update expertise verification.');
    }
  };

  const columns: DataColumn<TrainerWithExpertise>[] = [
    {
      key: 'trainer',
      header: 'Applicant',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.profile.full_name}</p>
          <p className="font-mono text-xs text-slate-500">{row.profile.email}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {row.profile.designation} · {row.profile.department}
          </p>
        </div>
      ),
    },
    {
      key: 'expertise',
      header: 'Expertise Credentials & Verification',
      render: (row) =>
        row.expertise.length > 0 ? (
          <div className="space-y-1.5 text-xs">
            {row.expertise.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-slate-700">
                <span>
                  <span className="font-semibold">
                    {e.competency ? `[${e.competency.code}] ` : ''}
                    {e.domain}:
                  </span>{' '}
                  {e.specialization} ({e.credential}, {e.years_experience}y)
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleExpertiseVerify(e)}
                  className={`font-mono text-[11px] font-semibold cursor-pointer ${
                    e.verified_by_admin
                      ? 'text-[#0F766E] hover:text-amber-700'
                      : 'text-amber-700 underline hover:text-[#0F766E]'
                  }`}
                >
                  {e.verified_by_admin ? 'Verified' : 'Verify Now'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-400">No credentials entered yet</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={`text-xs font-semibold capitalize ${
            row.profile.approval_status === 'approved'
              ? 'text-[#0F766E]'
              : row.profile.approval_status === 'rejected'
              ? 'text-red-700'
              : 'text-amber-700'
          }`}
        >
          {row.profile.approval_status}
        </span>
      ),
    },
    {
      key: 'applied',
      header: 'Registered',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">
          {formatShortDate(row.profile.created_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Decision',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center gap-2">
          {row.profile.approval_status !== 'approved' && (
            <Button
              variant="teal"
              size="sm"
              onClick={() =>
                setConfirmAction({ trainer: row.profile, decision: 'approved' })
              }
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approve</span>
            </Button>
          )}
          {row.profile.approval_status !== 'rejected' && (
            <Button
              variant="danger"
              size="sm"
              onClick={() =>
                setConfirmAction({ trainer: row.profile, decision: 'rejected' })
              }
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Reject</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Trainer Approval</h1>
        <p className="text-sm text-slate-600 mt-1">
          Verify self-registered Trainer credentials before unlocking curriculum authoring and cohort grading.
        </p>
      </div>

      {error && <StatusBanner tone="error" title="Database Error" description={error} />}
      {notice && <StatusBanner tone="success" title="Approval Processed" description={notice} />}

      <WorkspaceFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search trainer applicants by name or department..."
        rightSlot={
          <select
            aria-label="Filter by approval status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
          >
            <option value="pending">Pending Applications</option>
            <option value="approved">Approved Trainers</option>
            <option value="rejected">Rejected Applications</option>
            <option value="All">All Trainers</option>
          </select>
        }
      />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.profile.id}
        isLoading={isLoading}
        emptyTitle="No trainer records matching filter"
        emptyDescription="Self-registered Trainer applications and verified faculty appear here."
      />

      <ConfirmDialog
        isOpen={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) {
            handleDecision(confirmAction.trainer, confirmAction.decision);
          }
        }}
        title={
          confirmAction?.decision === 'approved'
            ? 'Approve Trainer Accreditation?'
            : 'Decline Trainer Application?'
        }
        description={
          confirmAction?.decision === 'approved'
            ? `Approve ${confirmAction?.trainer.full_name} and verify their expertise entries so they appear in the public Trainers directory and can author courses?`
            : `Mark ${confirmAction?.trainer.full_name} as rejected? They will not be able to publish courses or evaluate trainees.`
        }
        confirmLabel={confirmAction?.decision === 'approved' ? 'Approve Trainer' : 'Reject'}
        tone={confirmAction?.decision === 'rejected' ? 'danger' : 'primary'}
      />
    </div>
  );
}
