import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { SelectField, TextField, TextareaField } from '../../../components/ui/FormField';
import { ModalDrawer } from '../../../components/ui/ModalDrawer';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { useAuth } from '../../../context/AuthContext';
import { databaseService } from '../../../services/databaseService';
import { CompetencyRecord, PROGRAMME_DOMAINS, ProgrammeDomain } from '../../../types/competency';

export function AdminCompetencyManagementPage() {
  const { currentUser } = useAuth();
  const [competencies, setCompetencies] = useState<CompetencyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CompetencyRecord | null>(null);

  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState<ProgrammeDomain>('Public Finance & Audit');
  const [description, setDescription] = useState('');
  const [maxLevel, setMaxLevel] = useState<number>(5);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    databaseService
      .listCompetencies()
      .then((rows) => {
        setCompetencies(rows);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load competencies.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return competencies.filter((c) => {
      const matchesDomain = domainFilter === 'All' || c.domain === domainFilter;
      const matchesSearch =
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q);
      return matchesDomain && matchesSearch;
    });
  }, [competencies, search, domainFilter]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!code.trim() || !title.trim()) {
      setFormError('Competency code and title are required.');
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      const inserted = await databaseService.createCompetency({
        code: code.trim().toUpperCase(),
        title: title.trim(),
        domain,
        description: description.trim(),
        max_level: Math.min(5, Math.max(1, Number(maxLevel))),
        created_by: currentUser.id,
      });
      setCompetencies((prev) => [...prev, inserted]);
      setCode('');
      setTitle('');
      setDescription('');
      setMaxLevel(5);
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create competency.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row: CompetencyRecord) => {
    try {
      await databaseService.deleteCompetency(row.id);
      setCompetencies((prev) => prev.filter((c) => c.id !== row.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete competency.');
    }
  };

  const columns: DataColumn<CompetencyRecord>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => <span className="font-mono text-xs text-[#0F766E]">{row.code}</span>,
    },
    {
      key: 'title',
      header: 'Competency Title',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.title}</p>
          {row.description && <p className="text-xs text-slate-500 mt-0.5">{row.description}</p>}
        </div>
      ),
    },
    {
      key: 'domain',
      header: 'Domain',
      render: (row) => <span className="text-slate-600">{row.domain}</span>,
    },
    {
      key: 'max',
      header: 'Max Scale',
      align: 'right',
      render: (row) => <span className="font-mono tabular-nums">L{row.max_level}</span>,
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
          <span>Delete</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
            Competency Management
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Define institutional competency taxonomies in PostgreSQL `competencies`.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>Add Competency Standard</span>
        </Button>
      </div>

      {error && <StatusBanner tone="error" title="Database Error" description={error} />}

      <WorkspaceFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search competency codes or titles..."
        rightSlot={
          <select
            aria-label="Filter by domain"
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
        rows={filtered}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No competency standards defined"
        emptyDescription="Add competency standards or execute seed migration 004_seed_initial_catalog.sql."
        emptyAction={
          <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>
            Create First Competency
          </Button>
        }
      />

      <ModalDrawer
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Competency Standard"
        subtitle="Persists directly to `competencies`"
      >
        <form onSubmit={handleAdd} noValidate className="space-y-4">
          {formError && <p className="text-xs text-red-700 font-medium">{formError}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              htmlFor="comp-code"
              label="Competency Code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. COMP-FIN-02"
            />
            <SelectField
              htmlFor="comp-max"
              label="Max Proficiency Scale"
              value={String(maxLevel)}
              onChange={(e) => setMaxLevel(Number(e.target.value))}
            >
              <option value="3">Scale 1–3</option>
              <option value="4">Scale 1–4</option>
              <option value="5">Scale 1–5 (Standard)</option>
            </SelectField>
          </div>

          <TextField
            htmlFor="comp-title"
            label="Competency Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Treasury Voucher Audit Governance"
          />

          <SelectField
            htmlFor="comp-domain"
            label="Domain"
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
            htmlFor="comp-desc"
            label="Operational Benchmark Criteria"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Define demonstrable outputs required to pass this competency..."
          />

          <div className="pt-2 flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Competency'}
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
        title="Delete competency standard?"
        description={`Delete "${deleteTarget?.code} — ${deleteTarget?.title}"? Role requirement mappings linked to this competency will also be removed.`}
        confirmLabel="Delete"
        tone="danger"
      />
    </div>
  );
}
