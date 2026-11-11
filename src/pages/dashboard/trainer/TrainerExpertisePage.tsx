import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { SelectField, TextField } from '../../../components/ui/FormField';
import { ModalDrawer } from '../../../components/ui/ModalDrawer';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { useAuth } from '../../../context/AuthContext';
import { databaseService } from '../../../services/databaseService';
import {
  CompetencyRecord,
  PROGRAMME_DOMAINS,
  ProgrammeDomain,
  TrainerExpertiseRecord,
} from '../../../types/competency';

export function TrainerExpertisePage() {
  const { currentUser } = useAuth();
  const [entries, setEntries] = useState<TrainerExpertiseRecord[]>([]);
  const [competencies, setCompetencies] = useState<CompetencyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TrainerExpertiseRecord | null>(null);

  const [competencyId, setCompetencyId] = useState<string>('');
  const [domain, setDomain] = useState<ProgrammeDomain>('Public Finance & Audit');
  const [specialization, setSpecialization] = useState('');
  const [credential, setCredential] = useState('');
  const [yearsExperience, setYearsExperience] = useState(5);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    setIsLoading(true);
    Promise.all([
      databaseService.listTrainerExpertise(currentUser.id),
      databaseService.listCompetencies(),
    ])
      .then(([rows, compRows]) => {
        setEntries(rows);
        setCompetencies(compRows);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to fetch trainer expertise.');
      })
      .finally(() => setIsLoading(false));
  }, [currentUser?.id]);

  const handleSelectCompetency = (id: string) => {
    setCompetencyId(id);
    const match = competencies.find((c) => c.id === id);
    if (match && PROGRAMME_DOMAINS.includes(match.domain as ProgrammeDomain)) {
      setDomain(match.domain as ProgrammeDomain);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!specialization.trim() || !credential.trim()) {
      setFormError('Specialization and academic/professional credential are required.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const inserted = await databaseService.addTrainerExpertise({
        trainer_id: currentUser.id,
        competency_id: competencyId || null,
        domain,
        specialization: specialization.trim(),
        credential: credential.trim(),
        years_experience: Math.max(0, Number(yearsExperience)),
      });
      setEntries((prev) => [inserted, ...prev]);
      setCompetencyId('');
      setSpecialization('');
      setCredential('');
      setYearsExperience(5);
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save expertise.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row: TrainerExpertiseRecord) => {
    try {
      await databaseService.deleteTrainerExpertise(row.id);
      setEntries((prev) => prev.filter((item) => item.id !== row.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove expertise.');
    }
  };

  const columns: DataColumn<TrainerExpertiseRecord>[] = [
    {
      key: 'domain',
      header: 'Domain & Mapped Competency',
      render: (row) => (
        <div>
          <span className="font-mono text-xs text-[#0F766E]">{row.domain}</span>
          {row.competency && (
            <p className="font-mono text-[11px] text-slate-600 mt-0.5">
              {row.competency.code} — {row.competency.title}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'spec',
      header: 'Specialization',
      render: (row) => <span className="font-medium text-slate-900">{row.specialization}</span>,
    },
    {
      key: 'cred',
      header: 'Credential / Accreditation',
      render: (row) => <span className="text-slate-600">{row.credential}</span>,
    },
    {
      key: 'years',
      header: 'Years',
      align: 'right',
      render: (row) => <span className="font-mono tabular-nums">{row.years_experience} yrs</span>,
    },
    {
      key: 'verified',
      header: 'Admin Verification',
      render: (row) => (
        <span
          className={`text-xs font-semibold ${
            row.verified_by_admin ? 'text-[#0F766E]' : 'text-amber-700'
          }`}
        >
          {row.verified_by_admin ? 'Verified' : 'Pending Review'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          onClick={() => setDeleteTarget(row)}
          className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Remove</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Expertise</h1>
          <p className="text-sm text-slate-600 mt-1">
            Submit competency and domain qualifications to `trainer_expertise` for Administrator
            verification and trainee gap matching.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>Add Expertise Entry</span>
        </Button>
      </div>

      {error && <StatusBanner tone="error" title="Database Error" description={error} />}

      <DataTable
        columns={columns}
        rows={entries}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No trainer expertise records added"
        emptyDescription="Add your domain and competency credentials so Administrators can verify them and match trainees with skill gaps to your training cohorts."
        emptyAction={
          <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>
            Add Domain Expertise
          </Button>
        }
      />

      <ModalDrawer
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Domain Expertise"
        subtitle="Persists directly to `trainer_expertise`"
      >
        <form onSubmit={handleAdd} noValidate className="space-y-4">
          {formError && <p className="text-xs text-red-700 font-medium">{formError}</p>}

          <SelectField
            htmlFor="exp-competency"
            label="Mapped Institutional Competency (Optional)"
            value={competencyId}
            onChange={(e) => handleSelectCompetency(e.target.value)}
            helperText="Linking a specific competency enables priority matching when verified by Administration."
          >
            <option value="">-- Domain-Wide Accreditation --</option>
            {competencies.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {comp.code} — {comp.title}
              </option>
            ))}
          </SelectField>

          <SelectField
            htmlFor="exp-domain"
            label="Competency Domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value as ProgrammeDomain)}
          >
            {PROGRAMME_DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </SelectField>

          <TextField
            htmlFor="exp-spec"
            label="Primary Specialization"
            required
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder="e.g. Expenditure Audit & GFR Control"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              htmlFor="exp-cred"
              label="Credential / Certification"
              required
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              placeholder="e.g. CISSP / Certified Public Auditor"
            />
            <TextField
              htmlFor="exp-years"
              label="Years of Practice"
              type="number"
              min={0}
              max={60}
              value={String(yearsExperience)}
              onChange={(e) => setYearsExperience(Number(e.target.value))}
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Expertise'}
            </Button>
          </div>
        </form>
      </ModalDrawer>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
        }}
        title="Remove expertise entry?"
        description={`Delete "${deleteTarget?.specialization}" from your trainer credentials?`}
        confirmLabel="Remove"
        tone="danger"
      />
    </div>
  );
}
