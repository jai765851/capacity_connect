import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { SelectField, TextField, TextareaField } from '../../../components/ui/FormField';
import { ModalDrawer } from '../../../components/ui/ModalDrawer';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { useAuth } from '../../../context/AuthContext';
import { formatDateTime } from '../../../lib/formatters';
import { databaseService } from '../../../services/databaseService';
import {
  AssessmentRecord,
  AssessmentType,
  CompetencyRecord,
  CourseRecord,
  PROGRAMME_DOMAINS,
  ProgrammeDomain,
} from '../../../types/competency';

function toLocalDateTimeInput(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function TrainerCreateAssessmentPage() {
  const { currentUser } = useAuth();
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [competencies, setCompetencies] = useState<CompetencyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState<ProgrammeDomain>('Public Finance & Audit');
  const [assessmentType, setAssessmentType] = useState<AssessmentType>('Diagnostic Baseline');
  const [courseId, setCourseId] = useState('');
  const [competencyId, setCompetencyId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [passingScorePercent, setPassingScorePercent] = useState(75);
  const [dueAtInput, setDueAtInput] = useState('');
  const [instructions, setInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AssessmentRecord | null>(null);

  const [editTarget, setEditTarget] = useState<AssessmentRecord | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDuration, setEditDuration] = useState(45);
  const [editPassing, setEditPassing] = useState(75);
  const [editDueAt, setEditDueAt] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editPublished, setEditPublished] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      databaseService.listAssessments(),
      databaseService.listAllCourses(),
      databaseService.listCompetencies(),
    ])
      .then(([asmtRows, courseRows, compRows]) => {
        setAssessments(asmtRows);
        setCourses(courseRows);
        setCompetencies(compRows);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load assessments.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (code.trim().length < 3 || title.trim().length < 4 || instructions.trim().length < 10) {
      setError('Assessment code (>= 3 chars), title (>= 4 chars), and instructions (>= 10 chars) are required.');
      return;
    }

    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const dueIso = dueAtInput ? new Date(dueAtInput).toISOString() : null;
      const inserted = await databaseService.createAssessment({
        code: code.trim().toUpperCase(),
        title: title.trim(),
        domain,
        assessment_type: assessmentType,
        course_id: courseId || null,
        competency_id: competencyId || null,
        duration_minutes: Math.max(5, Math.min(240, Number(durationMinutes))),
        passing_score_percent: Math.min(100, Math.max(1, Number(passingScorePercent))),
        due_at: dueIso,
        instructions: instructions.trim(),
        created_by: currentUser.id,
        is_published: true,
      });
      setAssessments((prev) => [inserted, ...prev]);
      setCode('');
      setTitle('');
      setDueAtInput('');
      setInstructions('');
      setNotice(
        `Created assessment "${inserted.code}". Use Questions → on the row below to add MCQ or rubric items.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDrawer = (row: AssessmentRecord) => {
    setEditTarget(row);
    setEditTitle(row.title);
    setEditDuration(row.duration_minutes);
    setEditPassing(row.passing_score_percent);
    setEditDueAt(toLocalDateTimeInput(row.due_at));
    setEditInstructions(row.instructions);
    setEditPublished(row.is_published);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || editTitle.trim().length < 4 || editInstructions.trim().length < 10) {
      setError('Provide a valid assessment title and instructions.');
      return;
    }
    setSavingEdit(true);
    setError(null);
    try {
      const updated = await databaseService.updateAssessment(editTarget.id, {
        title: editTitle.trim(),
        duration_minutes: Math.max(5, Math.min(240, Number(editDuration))),
        passing_score_percent: Math.min(100, Math.max(1, Number(editPassing))),
        due_at: editDueAt ? new Date(editDueAt).toISOString() : null,
        instructions: editInstructions.trim(),
        is_published: editPublished,
      });
      setAssessments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setNotice(`Updated settings for "${updated.code}".`);
      setEditTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update assessment.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (row: AssessmentRecord) => {
    try {
      await databaseService.deleteAssessment(row.id);
      setAssessments((prev) => prev.filter((item) => item.id !== row.id));
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
      header: 'Assessment Title',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {row.assessment_type} · {row.domain}
          </p>
        </div>
      ),
    },
    {
      key: 'target',
      header: 'Mapped Competency / Course',
      render: (row) => (
        <div className="text-xs text-slate-600">
          <p>{row.competency ? `${row.competency.code}` : 'Unmapped Competency'}</p>
          <p className="text-slate-400">{row.course ? `${row.course.code}` : 'General'}</p>
        </div>
      ),
    },
    {
      key: 'due',
      header: 'Deadline',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">
          {row.due_at ? formatDateTime(row.due_at) : 'No Deadline'}
        </span>
      ),
    },
    {
      key: 'pass',
      header: 'Duration / Pass',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs tabular-nums">
          {row.duration_minutes}m · {row.passing_score_percent}%
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center gap-3">
          <Link
            to={`/dashboard/trainer/questionnaires?assessmentId=${row.id}`}
            className="text-xs font-semibold text-[#0F766E] hover:text-[#0B1F3A] whitespace-nowrap"
          >
            Questions →
          </Link>
          {row.created_by === currentUser?.id && (
            <>
              <button
                type="button"
                onClick={() => openEditDrawer(row)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0B1F3A] hover:text-[#0F766E] cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(row)}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Create Assessment</h1>
        <p className="text-sm text-slate-600 mt-1">
          Configure Diagnostic Baselines, Course Tests, deadlines, and passing benchmarks mapped to
          competencies.
        </p>
      </div>

      {error && <StatusBanner tone="error" title="Assessment Error" description={error} />}
      {notice && <StatusBanner tone="success" title="Assessment Saved" description={notice} />}

      <Card className="p-6 max-w-3xl">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              htmlFor="asmt-code"
              label="Assessment Code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. DIAG-FIN-01"
            />
            <SelectField
              htmlFor="asmt-type"
              label="Assessment Stage Type"
              value={assessmentType}
              onChange={(e) => setAssessmentType(e.target.value as AssessmentType)}
            >
              <option value="Diagnostic Baseline">Diagnostic Baseline (Stage 02)</option>
              <option value="Course Assessment">Course Assessment (Stage 04)</option>
              <option value="Reassessment Verification">Reassessment Verification (Stage 05)</option>
            </SelectField>
          </div>

          <TextField
            htmlFor="asmt-title"
            label="Assessment Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Budget Variance & GFR Compliance Diagnostic"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              htmlFor="asmt-comp"
              label="Target Competency (For Skill Gap Auto-Update)"
              value={competencyId}
              onChange={(e) => setCompetencyId(e.target.value)}
            >
              <option value="">-- Optional Competency Mapping --</option>
              {competencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </SelectField>

            <SelectField
              htmlFor="asmt-course"
              label="Linked Course (Required for Enrolled Course Assessments)"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">-- Standalone / Diagnostic --</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SelectField
              htmlFor="asmt-domain"
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
            <TextField
              htmlFor="asmt-duration"
              label="Duration (Minutes)"
              type="number"
              min={5}
              max={240}
              value={String(durationMinutes)}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            />
            <TextField
              htmlFor="asmt-pass"
              label="Passing Mark (%)"
              type="number"
              min={1}
              max={100}
              value={String(passingScorePercent)}
              onChange={(e) => setPassingScorePercent(Number(e.target.value))}
            />
            <TextField
              htmlFor="asmt-due"
              label="Submission Deadline"
              type="datetime-local"
              value={dueAtInput}
              onChange={(e) => setDueAtInput(e.target.value)}
            />
          </div>

          <TextareaField
            htmlFor="asmt-inst"
            label="Candidate Instructions"
            required
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Outline assessment format, reference rules, and verification criteria..."
          />

          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="md" disabled={submitting}>
              {submitting ? 'Publishing...' : 'Publish Assessment'}
            </Button>
          </div>
        </form>
      </Card>

      <DataTable
        columns={columns}
        rows={assessments}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No assessments published yet"
        emptyDescription="Assessments created above are stored in PostgreSQL `assessments`."
      />

      <ModalDrawer
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={`Edit Assessment: ${editTarget?.code ?? ''}`}
        subtitle={editTarget?.assessment_type}
      >
        {editTarget && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <TextField
              htmlFor="edit-asmt-title"
              label="Assessment Title"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <TextField
                htmlFor="edit-asmt-dur"
                label="Duration (Min)"
                type="number"
                min={5}
                max={240}
                value={String(editDuration)}
                onChange={(e) => setEditDuration(Number(e.target.value))}
              />
              <TextField
                htmlFor="edit-asmt-pass"
                label="Passing Mark (%)"
                type="number"
                min={1}
                max={100}
                value={String(editPassing)}
                onChange={(e) => setEditPassing(Number(e.target.value))}
              />
              <TextField
                htmlFor="edit-asmt-due"
                label="Submission Deadline"
                type="datetime-local"
                value={editDueAt}
                onChange={(e) => setEditDueAt(e.target.value)}
              />
            </div>
            <TextareaField
              htmlFor="edit-asmt-inst"
              label="Instructions"
              required
              rows={3}
              value={editInstructions}
              onChange={(e) => setEditInstructions(e.target.value)}
            />
            <label className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={editPublished}
                onChange={(e) => setEditPublished(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#0F766E]"
              />
              <span>Published for Trainee attempts</span>
            </label>
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={savingEdit}>
                {savingEdit ? 'Saving...' : 'Save Assessment'}
              </Button>
            </div>
          </form>
        )}
      </ModalDrawer>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
        }}
        title="Delete assessment?"
        description={`Remove "${deleteTarget?.title}" and its questions from PostgreSQL?`}
        confirmLabel="Remove"
        tone="danger"
      />
    </div>
  );
}
