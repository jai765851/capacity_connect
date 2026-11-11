import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { SelectField, TextField, TextareaField } from '../../../components/ui/FormField';
import { ModalDrawer } from '../../../components/ui/ModalDrawer';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { useAuth } from '../../../context/AuthContext';
import { formatShortDate } from '../../../lib/formatters';
import {
  clampScore,
  levelToBenchmarkScore,
  normalizeProgressScore,
  scoreToProficiencyLevel,
} from '../../../services/competencyEngine';
import { databaseService } from '../../../services/databaseService';
import {
  CompetencyRecord,
  PROGRAMME_DOMAINS,
  ProgrammeDomain,
  ProgressHistoryRecord,
} from '../../../types/competency';

export function TraineeSkillsPage() {
  const { currentUser } = useAuth();
  const [entries, setEntries] = useState<ProgressHistoryRecord[]>([]);
  const [competencies, setCompetencies] = useState<CompetencyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProgressHistoryRecord | null>(null);

  const [selectedCompetencyId, setSelectedCompetencyId] = useState<string>('');
  const [skillCode, setSkillCode] = useState('');
  const [skillName, setSkillName] = useState('');
  const [domain, setDomain] = useState<ProgrammeDomain>('Public Finance & Audit');
  const [proficiencyLevel, setProficiencyLevel] = useState<number>(2);
  const [evidenceNote, setEvidenceNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const [historyRows, compRows] = await Promise.all([
        databaseService.listProgressHistory(currentUser.id),
        databaseService.listCompetencies(),
      ]);
      setEntries(historyRows);
      setCompetencies(compRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load skills ledger.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.id]);

  const handleSelectCompetency = (compId: string) => {
    setSelectedCompetencyId(compId);
    const match = competencies.find((c) => c.id === compId);
    if (match) {
      setSkillCode(match.code);
      setSkillName(match.title);
      if (PROGRAMME_DOMAINS.includes(match.domain as ProgrammeDomain)) {
        setDomain(match.domain as ProgrammeDomain);
      }
    }
  };

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((item) => {
      const matchesDomain = domainFilter === 'All' || item.domain === domainFilter;
      const matchesSearch =
        !q ||
        item.skill_name.toLowerCase().includes(q) ||
        item.skill_code.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q);
      return matchesDomain && matchesSearch;
    });
  }, [entries, search, domainFilter]);

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!skillCode.trim() || !skillName.trim()) {
      setFormError('Select a competency or provide both a Skill Code and Skill Title.');
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      const level = proficiencyLevel;
      const inserted = await databaseService.addProgressEntry({
        trainee_id: currentUser.id,
        competency_id: selectedCompetencyId || null,
        skill_code: skillCode.trim().toUpperCase(),
        skill_name: skillName.trim(),
        domain,
        stage: 'self_declaration',
        recorded_level: level,
        recorded_score: levelToBenchmarkScore(level),
        notes: evidenceNote.trim() || 'Self-declared competency baseline',
      });
      setEntries((prev) => [inserted, ...prev]);
      setSelectedCompetencyId('');
      setSkillCode('');
      setSkillName('');
      setEvidenceNote('');
      setProficiencyLevel(2);
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save skill entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async (entry: ProgressHistoryRecord) => {
    try {
      await databaseService.deleteProgressEntry(entry.id);
      setEntries((prev) => prev.filter((item) => item.id !== entry.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete entry.');
    }
  };

  const columns: DataColumn<ProgressHistoryRecord>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => <span className="font-mono text-xs text-[#0F766E]">{row.skill_code || '—'}</span>,
    },
    {
      key: 'name',
      header: 'Competency / Skill',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.skill_name}</p>
          {row.notes && <p className="text-xs text-slate-500 mt-0.5">{row.notes}</p>}
        </div>
      ),
    },
    {
      key: 'domain',
      header: 'Domain',
      render: (row) => <span className="text-slate-600">{row.domain}</span>,
    },
    {
      key: 'stage',
      header: 'Source & Assessor',
      render: (row) => (
        <div>
          <span className="text-xs font-medium text-slate-700">{row.stage}</span>
          {row.assessor?.full_name && (
            <p className="text-[11px] text-slate-500 mt-0.5">Assessor: {row.assessor.full_name}</p>
          )}
        </div>
      ),
    },
    {
      key: 'level',
      header: 'Score / Level',
      align: 'right',
      render: (row) => {
        const score = clampScore(normalizeProgressScore(row));
        return (
          <div className="font-mono tabular-nums text-right">
            <span className="font-semibold text-[#0B1F3A]">{score}/100</span>
            <span className="block text-[11px] text-slate-500">
              L{row.recorded_level || scoreToProficiencyLevel(score)}
            </span>
          </div>
        );
      },
    },
    {
      key: 'recorded',
      header: 'Recorded',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">{formatShortDate(row.recorded_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) =>
        row.stage === 'self_declaration' ? (
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove</span>
          </button>
        ) : (
          <span className="text-xs text-slate-400">Verified</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">My Skills</h1>
          <p className="text-sm text-slate-600 mt-1">
            View assessed competency records and submit baseline skill declarations in PostgreSQL.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>Declare Baseline Skill</span>
        </Button>
      </div>

      {error && <StatusBanner tone="error" title="Database Error" description={error} />}

      <WorkspaceFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by skill code, competency title, or notes..."
        rightSlot={
          <select
            aria-label="Filter by competency domain"
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
          >
            <option value="All">All Domains</option>
            {PROGRAMME_DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        }
      />

      <DataTable
        columns={columns}
        rows={filteredEntries}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No skill history entries recorded"
        emptyDescription="Record a baseline skill declaration above or complete an Assessment to populate your verified competency progression history."
        emptyAction={
          <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>
            Declare First Skill
          </Button>
        }
      />

      <ModalDrawer
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Declare Baseline Skill"
        subtitle="Saved directly to PostgreSQL table `progress_history`"
      >
        <form onSubmit={handleAddSkill} noValidate className="space-y-4">
          {formError && <p className="text-xs text-red-700 font-medium">{formError}</p>}

          <SelectField
            htmlFor="skill-comp-select"
            label="Institutional Competency (Recommended)"
            value={selectedCompetencyId}
            onChange={(e) => handleSelectCompetency(e.target.value)}
            helperText="Selecting from institutional competencies enables direct Stage 03 Skill Gap matching."
          >
            <option value="">-- Custom / Unmapped Skill --</option>
            {competencies.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {comp.code} — {comp.title} ({comp.domain})
              </option>
            ))}
          </SelectField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              htmlFor="skill-code"
              label="Skill Code"
              required
              value={skillCode}
              onChange={(e) => setSkillCode(e.target.value)}
              placeholder="e.g. COMP-FIN-01"
            />
            <SelectField
              htmlFor="skill-level"
              label="Current Proficiency (1–5)"
              value={String(proficiencyLevel)}
              onChange={(e) => setProficiencyLevel(Number(e.target.value))}
            >
              <option value="1">Level 1 — Foundational Awareness</option>
              <option value="2">Level 2 — Guided Execution</option>
              <option value="3">Level 3 — Independent Operational</option>
              <option value="4">Level 4 — Senior Review</option>
              <option value="5">Level 5 — Institutional Mastery</option>
            </SelectField>
          </div>

          <TextField
            htmlFor="skill-name"
            label="Competency Title"
            required
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            placeholder="e.g. Budget Variance & GFR Compliance"
          />

          <SelectField
            htmlFor="skill-domain"
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

          <TextareaField
            htmlFor="skill-note"
            label="Operational Evidence / Context"
            rows={3}
            value={evidenceNote}
            onChange={(e) => setEvidenceNote(e.target.value)}
            placeholder="Prior role experience, project work, or supervisory verification context..."
          />

          <div className="pt-2 flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Skill Entry'}
            </Button>
          </div>
        </form>
      </ModalDrawer>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleDeleteEntry(deleteTarget);
        }}
        title="Remove self-declared skill entry?"
        description={`Delete "${deleteTarget?.skill_name}" from your progress history?`}
        confirmLabel="Remove"
        tone="danger"
      />
    </div>
  );
}
