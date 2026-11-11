import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Edit3, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { SelectField, TextField, TextareaField } from '../../../components/ui/FormField';
import { ModalDrawer } from '../../../components/ui/ModalDrawer';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { formatDateTime } from '../../../lib/formatters';
import { isAssessmentPastDeadline } from '../../../services/competencyEngine';
import { databaseService } from '../../../services/databaseService';
import {
  AssessmentAttemptRecord,
  AssessmentRecord,
  AssessmentType,
} from '../../../types/competency';

function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function AdminAssessmentsPage() {
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [attempts, setAttempts] = useState<AssessmentAttemptRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'All' | AssessmentType>('All');
  const [inspectAssessment, setInspectAssessment] = useState<AssessmentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssessmentRecord | null>(null);

  // Edit assessment drawer state
  const [editTarget, setEditTarget] = useState<AssessmentRecord | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDuration, setEditDuration] = useState(30);
  const [editPassing, setEditPassing] = useState(70);
  const [editDueAt, setEditDueAt] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editPublished, setEditPublished] = useState<'published' | 'draft'>('published');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [assessmentRows, attemptRows] = await Promise.all([
        databaseService.listAssessments(),
        databaseService.listAssessmentAttempts(),
      ]);
      setAssessments(assessmentRows);
      setAttempts(attemptRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch assessments audit ledger.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assessments.filter((a) => {
      const matchStage = stageFilter === 'All' || a.assessment_type === stageFilter;
      const matchQuery =
        !q ||
        a.code.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.domain.toLowerCase().includes(q) ||
        (a.course?.code ?? '').toLowerCase().includes(q) ||
        (a.competency?.code ?? '').toLowerCase().includes(q);
      return matchStage && matchQuery;
    });
  }, [assessments, search, stageFilter]);

  const inspectedAttempts = useMemo(() => {
    if (!inspectAssessment) return [];
    return attempts.filter((att) => att.assessment_id === inspectAssessment.id);
  }, [attempts, inspectAssessment]);

  const openEditDrawer = (row: AssessmentRecord) => {
    setEditTarget(row);
    setEditTitle(row.title);
    setEditDuration(row.duration_minutes);
    setEditPassing(row.passing_score_percent);
    setEditDueAt(toDatetimeLocalValue(row.due_at));
    setEditInstructions(row.instructions);
    setEditPublished(row.is_published ? 'published' : 'draft');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !editTitle.trim()) {
      setError('Assessment title is required.');
      return;
    }
    setSavingEdit(true);
    setError(null);
    try {
      const dueIso = editDueAt ? new Date(editDueAt).toISOString() : null;
      await databaseService.updateAssessment(editTarget.id, {
        title: editTitle.trim(),
        duration_minutes: Math.max(5, Number(editDuration)),
        passing_score_percent: Math.min(100, Math.max(1, Number(editPassing))),
        due_at: dueIso,
        instructions: editInstructions.trim(),
        is_published: editPublished === 'published',
      });
      setNotice(`Updated settings for assessment "${editTarget.code}".`);
      setEditTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update assessment settings.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteAssessment = async (row: AssessmentRecord) => {
    try {
      await databaseService.deleteAssessment(row.id);
      setAssessments((prev) => prev.filter((a) => a.id !== row.id));
      setNotice(`Deleted assessment specification "${row.code}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete assessment.');
    }
  };

  const columns: DataColumn<AssessmentRecord>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => <span className="font-mono text-xs text-[#0F766E]">{row.code}</span>,
    },
    {
      key: 'title',
      header: 'Assessment Specification',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {row.course ? `Course: ${row.course.code}` : 'Cross-Course'}
            {row.competency ? ` · Competency: ${row.competency.code}` : ''}
            {!row.is_published ? ' · Unpublished Draft' : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'domain',
      header: 'Domain / Stage',
      render: (row) => (
        <div className="text-xs">
          <p className="text-slate-800">{row.assessment_type}</p>
          <p className="text-slate-500">{row.domain}</p>
        </div>
      ),
    },
    {
      key: 'threshold',
      header: 'Duration / Pass',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs text-slate-700 tabular-nums">
          {row.duration_minutes}m · {row.passing_score_percent}%
        </span>
      ),
    },
    {
      key: 'deadline',
      header: 'Deadline',
      render: (row) => {
        if (!row.due_at) return <span className="text-xs text-slate-400">Open</span>;
        const closed = isAssessmentPastDeadline(row.due_at);
        return (
          <span className={`font-mono text-xs ${closed ? 'text-red-700 font-semibold' : 'text-slate-600'}`}>
            {formatDateTime(row.due_at)}
            {closed ? ' (Closed)' : ''}
          </span>
        );
      },
    },
    {
      key: 'attempts',
      header: 'Submissions',
      align: 'right',
      render: (row) => {
        const linked = attempts.filter((att) => att.assessment_id === row.id);
        const pending = linked.filter((att) => att.status !== 'evaluated').length;
        return (
          <div className="text-xs tabular-nums">
            <span className="font-semibold text-slate-900">{linked.length}</span>
            {pending > 0 && (
              <span className="block text-amber-700 font-medium">{pending} awaiting review</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center gap-3">
          <button
            type="button"
            onClick={() => openEditDrawer(row)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#0B1F3A] hover:text-[#0F766E] cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={() => setInspectAssessment(row)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#0B1F3A] hover:text-[#0F766E] cursor-pointer"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Attempts</span>
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Assessments</h1>
        <p className="text-sm text-slate-600 mt-1">
          Organisation-wide audit of diagnostic baselines, course evaluations, and Stage 05
          reassessment attempts.
        </p>
      </div>

      {error && <StatusBanner tone="error" title="Assessment Audit Error" description={error} />}
      {notice && <StatusBanner tone="success" title="Updated" description={notice} />}

      <WorkspaceFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search assessments by code, title, course, or domain..."
        rightSlot={
          <select
            aria-label="Filter assessments by stage"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as 'All' | AssessmentType)}
            className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
          >
            <option value="All">All Evaluation Stages</option>
            <option value="Diagnostic Baseline">Diagnostic Baseline</option>
            <option value="Course Assessment">Course Assessment</option>
            <option value="Reassessment Verification">Reassessment Verification</option>
          </select>
        }
      />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No assessment specifications stored"
        emptyDescription="Approved Trainers create assessments in the Trainer portal, or seed instruments via SQL migration 004."
      />

      {/* Edit Assessment Settings Drawer */}
      <ModalDrawer
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={`Edit Assessment: ${editTarget?.code ?? ''}`}
        subtitle="Update deadline, passing score, instructions, or visibility"
      >
        {editTarget && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <TextField
              htmlFor="adm-asmt-title"
              label="Assessment Title"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <TextField
                htmlFor="adm-asmt-dur"
                label="Duration (Minutes)"
                type="number"
                min={5}
                value={String(editDuration)}
                onChange={(e) => setEditDuration(Number(e.target.value))}
              />
              <TextField
                htmlFor="adm-asmt-pass"
                label="Passing Score (%)"
                type="number"
                min={1}
                max={100}
                value={String(editPassing)}
                onChange={(e) => setEditPassing(Number(e.target.value))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                htmlFor="adm-asmt-due"
                label="Submission Deadline (Optional)"
                type="datetime-local"
                value={editDueAt}
                onChange={(e) => setEditDueAt(e.target.value)}
              />
              <SelectField
                htmlFor="adm-asmt-pub"
                label="Visibility"
                value={editPublished}
                onChange={(e) => setEditPublished(e.target.value as 'published' | 'draft')}
              >
                <option value="published">Published (Visible to Trainees)</option>
                <option value="draft">Draft (Hidden)</option>
              </SelectField>
            </div>
            <TextareaField
              htmlFor="adm-asmt-inst"
              label="Candidate Instructions"
              rows={3}
              value={editInstructions}
              onChange={(e) => setEditInstructions(e.target.value)}
            />
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={savingEdit}>
                {savingEdit ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        )}
      </ModalDrawer>

      {/* Candidate Attempts Drawer */}
      <ModalDrawer
        isOpen={Boolean(inspectAssessment)}
        onClose={() => setInspectAssessment(null)}
        title={`Attempts: ${inspectAssessment?.code ?? ''}`}
        subtitle={inspectAssessment?.title}
      >
        {inspectAssessment && (
          <div className="space-y-4">
            <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1">
              <p>
                <strong className="text-slate-900">Stage:</strong> {inspectAssessment.assessment_type}
                {' · '}
                <strong className="text-slate-900">Pass Score:</strong>{' '}
                {inspectAssessment.passing_score_percent}%
                {inspectAssessment.due_at
                  ? ` · Deadline: ${formatDateTime(inspectAssessment.due_at)}`
                  : ''}
              </p>
              <p>{inspectAssessment.instructions}</p>
            </div>

            {inspectedAttempts.length === 0 ? (
              <p className="text-sm text-slate-600 py-4 text-center">
                No trainee attempts submitted for this assessment yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
                {inspectedAttempts.map((att) => (
                  <div key={att.id} className="p-3.5 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">
                        {att.trainee?.full_name ?? 'Trainee'}
                      </span>
                      <span className="font-mono text-slate-500">
                        {formatDateTime(att.submitted_at ?? att.started_at)}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      {att.trainee?.department || '—'} · Status:{' '}
                      <strong className="capitalize">{att.status}</strong>
                      {att.score_percent !== null && (
                        <>
                          {' · '}Score: <strong className="font-mono">{att.score_percent}%</strong> (L
                          {att.achieved_level ?? '—'} ·{' '}
                          <span className={att.passed ? 'text-[#0F766E]' : 'text-red-700'}>
                            {att.passed ? 'Passed' : 'Did Not Meet'}
                          </span>
                          )
                        </>
                      )}
                    </p>
                    {att.evaluator_notes && (
                      <p className="text-slate-500 italic">{att.evaluator_notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setInspectAssessment(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </ModalDrawer>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleDeleteAssessment(deleteTarget);
        }}
        title="Delete assessment instrument?"
        description={`Delete "${deleteTarget?.code} — ${deleteTarget?.title}" and its associated question items?`}
        confirmLabel="Delete Assessment"
        tone="danger"
      />
    </div>
  );
}
