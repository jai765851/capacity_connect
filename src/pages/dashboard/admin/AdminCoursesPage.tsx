import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plus, SlidersHorizontal, Trash2, Users } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { SelectField, TextField, TextareaField } from '../../../components/ui/FormField';
import { ModalDrawer } from '../../../components/ui/ModalDrawer';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { useAuth } from '../../../context/AuthContext';
import { formatShortDate } from '../../../lib/formatters';
import { databaseService } from '../../../services/databaseService';
import {
  CompetencyRecord,
  CourseApprovalStatus,
  CourseRecord,
  CourseTargetLevel,
  DeliveryMode,
  PROGRAMME_DOMAINS,
  ProfileRecord,
  ProgrammeDomain,
  TrainerAssignmentRecord,
} from '../../../types/competency';

export function AdminCoursesPage() {
  const { currentUser } = useAuth();
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [assignments, setAssignments] = useState<TrainerAssignmentRecord[]>([]);
  const [trainers, setTrainers] = useState<ProfileRecord[]>([]);
  const [competencies, setCompetencies] = useState<CompetencyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<'all' | CourseApprovalStatus>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CourseRecord | null>(null);
  const [deleteAssignmentTarget, setDeleteAssignmentTarget] =
    useState<TrainerAssignmentRecord | null>(null);

  // Govern / inspect course drawer
  const [governTarget, setGovernTarget] = useState<CourseRecord | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [governing, setGoverning] = useState(false);

  // Create course state
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState<ProgrammeDomain>('Public Finance & Audit');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('Blended');
  const [targetLevel, setTargetLevel] = useState<CourseTargetLevel>('Intermediate');
  const [durationHours, setDurationHours] = useState(20);
  const [summary, setSummary] = useState('');
  const [objectivesText, setObjectivesText] = useState('');
  const [selectedCompIds, setSelectedCompIds] = useState<string[]>([]);
  const [creatingCourse, setCreatingCourse] = useState(false);

  // Assign trainer state
  const [assignCourseId, setAssignCourseId] = useState('');
  const [assignTrainerId, setAssignTrainerId] = useState('');
  const [cohortCode, setCohortCode] = useState('');
  const [cohortDept, setCohortDept] = useState('');
  const [assigningTrainer, setAssigningTrainer] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [courseRows, assignRows, profileRows, compRows] = await Promise.all([
        databaseService.listAllCourses(),
        databaseService.listTrainerAssignments(),
        databaseService.listAllProfiles(),
        databaseService.listCompetencies(),
      ]);
      const approvedTrainers = profileRows.filter(
        (p) => p.role === 'trainer' && p.approval_status === 'approved'
      );
      setCourses(courseRows);
      setAssignments(assignRows);
      setTrainers(approvedTrainers);
      setCompetencies(compRows);
      if (courseRows.length > 0 && !assignCourseId) setAssignCourseId(courseRows[0].id);
      if (approvedTrainers.length > 0 && !assignTrainerId) {
        setAssignTrainerId(approvedTrainers[0].id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load courses.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      const status = c.approval_status ?? 'approved';
      const matchesApproval = approvalFilter === 'all' || status === approvalFilter;
      const matchesSearch =
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.domain.toLowerCase().includes(q);
      return matchesApproval && matchesSearch;
    });
  }, [courses, search, approvalFilter]);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!code.trim() || !title.trim() || summary.trim().length < 15) {
      setError('Provide course code, title, and a summary of at least 15 characters.');
      return;
    }

    const parsedObjectives = objectivesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    setCreatingCourse(true);
    setError(null);
    try {
      await databaseService.createCourse({
        code: code.trim().toUpperCase(),
        title: title.trim(),
        domain,
        delivery_mode: deliveryMode,
        target_level: targetLevel,
        duration_hours: Math.max(1, Number(durationHours)),
        summary: summary.trim(),
        learning_objectives: parsedObjectives,
        prerequisites: 'None',
        assessment_method: 'Post-training reassessment evaluation',
        lead_department: 'Central Administration',
        created_by: currentUser.id,
        is_published: true,
        approval_status: 'approved',
        competencyIds: selectedCompIds,
      });
      setCode('');
      setTitle('');
      setSummary('');
      setObjectivesText('');
      setSelectedCompIds([]);
      setCreateOpen(false);
      setNotice('Approved course published to PostgreSQL `courses`.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create course.');
    } finally {
      setCreatingCourse(false);
    }
  };

  const openGovernDrawer = (course: CourseRecord) => {
    setGovernTarget(course);
    setApprovalNotes(course.approval_notes ?? '');
  };

  const handleGovernanceDecision = async (
    nextStatus: CourseApprovalStatus,
    nextPublished: boolean
  ) => {
    if (!currentUser || !governTarget) return;
    if (nextStatus === 'rejected' && approvalNotes.trim().length < 5) {
      setError('Enter revision guidance in Approval Notes before rejecting a course submission.');
      return;
    }
    setGoverning(true);
    setError(null);
    try {
      await databaseService.adminUpdateCourseApproval(governTarget.id, {
        approval_status: nextStatus,
        approval_notes: approvalNotes.trim(),
        is_published: nextPublished,
        approved_by: currentUser.id,
      });
      setNotice(
        `Course ${governTarget.code} updated to ${nextStatus} (${nextPublished ? 'Published' : 'Draft'}).`
      );
      setGovernTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update course approval status.');
    } finally {
      setGoverning(false);
    }
  };

  const handleAssignTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !assignCourseId || !assignTrainerId || !cohortCode.trim()) {
      setError('Select course, approved trainer, and cohort code.');
      return;
    }
    setAssigningTrainer(true);
    setError(null);
    try {
      await databaseService.createTrainerAssignment({
        course_id: assignCourseId,
        trainer_id: assignTrainerId,
        cohort_code: cohortCode.trim().toUpperCase(),
        department: cohortDept.trim(),
        assigned_by: currentUser.id,
      });
      setCohortCode('');
      setCohortDept('');
      setAssignModalOpen(false);
      setNotice('Assigned trainer cohort saved in `trainer_assignments`.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to assign trainer.');
    } finally {
      setAssigningTrainer(false);
    }
  };

  const handleAssignmentStatusChange = async (
    assignment: TrainerAssignmentRecord,
    nextStatus: 'active' | 'completed' | 'archived'
  ) => {
    try {
      await databaseService.updateTrainerAssignmentStatus(assignment.id, nextStatus);
      setAssignments((prev) =>
        prev.map((a) => (a.id === assignment.id ? { ...a, status: nextStatus } : a))
      );
      setNotice(`Cohort ${assignment.cohort_code} marked as ${nextStatus}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update cohort status.');
    }
  };

  const handleDeleteAssignment = async (assignment: TrainerAssignmentRecord) => {
    try {
      await databaseService.deleteTrainerAssignment(assignment.id);
      setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
      setNotice(`Deleted cohort assignment ${assignment.cohort_code}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete cohort assignment.');
    }
  };

  const handleDeleteCourse = async (course: CourseRecord) => {
    try {
      await databaseService.deleteCourse(course.id);
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete course.');
    }
  };

  const courseColumns: DataColumn<CourseRecord>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => <span className="font-mono text-xs text-[#0F766E]">{row.code}</span>,
    },
    {
      key: 'title',
      header: 'Course Title',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.title}</p>
          <p className="text-xs text-slate-500">
            {row.domain}
            {(row.learning_objectives?.length ?? 0) > 0
              ? ` · ${row.learning_objectives?.length} objectives`
              : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'approval',
      header: 'Approval & Visibility',
      render: (row) => {
        const status = row.approval_status ?? 'approved';
        return (
          <div className="text-xs">
            <span
              className={`font-semibold capitalize ${
                status === 'approved'
                  ? 'text-[#0F766E]'
                  : status === 'pending'
                  ? 'text-amber-700'
                  : 'text-red-700'
              }`}
            >
              {status}
            </span>
            <span className="block text-slate-500">
              {row.is_published ? 'Published' : 'Draft / Hidden'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'mode',
      header: 'Delivery / Duration',
      render: (row) => (
        <span className="text-xs text-slate-600 tabular-nums">
          {row.delivery_mode} · {row.duration_hours}h
        </span>
      ),
    },
    {
      key: 'cohorts',
      header: 'Assigned Cohorts',
      render: (row) => {
        const linked = assignments.filter((a) => a.course_id === row.id);
        return linked.length > 0 ? (
          <div className="text-xs text-slate-700">
            {linked.map((a) => `${a.cohort_code} (${a.trainer?.full_name ?? 'Trainer'})`).join(', ')}
          </div>
        ) : (
          <span className="text-xs text-slate-400">Unassigned</span>
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
            onClick={() => openGovernDrawer(row)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#0B1F3A] hover:text-[#0F766E] cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Govern</span>
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

  const assignmentColumns: DataColumn<TrainerAssignmentRecord>[] = [
    {
      key: 'cohort',
      header: 'Cohort Code',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-[#0B1F3A]">{row.cohort_code}</span>
      ),
    },
    {
      key: 'course',
      header: 'Course',
      render: (row) => (
        <div className="text-xs">
          <span className="font-mono text-[#0F766E]">{row.course?.code ?? '—'}</span>
          <p className="font-medium text-slate-900">{row.course?.title ?? 'Course'}</p>
        </div>
      ),
    },
    {
      key: 'trainer',
      header: 'Assigned Trainer',
      render: (row) => (
        <div className="text-xs">
          <p className="font-medium text-slate-900">{row.trainer?.full_name ?? 'Trainer'}</p>
          <p className="text-slate-500">{row.department || row.trainer?.department || '—'}</p>
        </div>
      ),
    },
    {
      key: 'assigned_at',
      header: 'Assigned Date',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">{formatShortDate(row.assigned_at)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Cohort Status',
      render: (row) => (
        <select
          aria-label={`Status for cohort ${row.cohort_code}`}
          value={row.status}
          onChange={(e) =>
            handleAssignmentStatusChange(
              row,
              e.target.value as 'active' | 'completed' | 'archived'
            )
          }
          className="min-h-[34px] rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800"
        >
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          onClick={() => setDeleteAssignmentTarget(row)}
          className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Remove</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
            Courses &amp; Cohort Assignments
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Approve Trainer-submitted courses, govern catalogue publishing, and manage cohort
            assignments (`trainer_assignments`).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="md" onClick={() => setAssignModalOpen(true)}>
            <Users className="w-4 h-4" />
            <span>Assign Trainer Cohort</span>
          </Button>
          <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>Add Course</span>
          </Button>
        </div>
      </div>

      {error && <StatusBanner tone="error" title="Course Governance Error" description={error} />}
      {notice && <StatusBanner tone="success" title="Updated" description={notice} />}

      <WorkspaceFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search courses by code, title, or domain..."
        rightSlot={
          <select
            aria-label="Filter courses by approval status"
            value={approvalFilter}
            onChange={(e) => setApprovalFilter(e.target.value as 'all' | CourseApprovalStatus)}
            className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
          >
            <option value="all">All Approval States</option>
            <option value="pending">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected / Revision</option>
          </select>
        }
      />

      <DataTable
        columns={courseColumns}
        rows={filtered}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No courses match current filters"
        emptyDescription="Create courses above, adjust the approval filter, or run seed migration 004_seed_initial_catalog.sql."
      />

      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-[#0B1F3A]">
          Trainer Cohort Assignments (`trainer_assignments`)
        </h2>
        <DataTable
          columns={assignmentColumns}
          rows={assignments}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyTitle="No cohort assignments configured yet"
          emptyDescription="Use Assign Trainer Cohort above to bind an approved Trainer to a specific course cohort."
        />
      </div>

      {/* Inspect & Govern Course Approval Modal */}
      <ModalDrawer
        isOpen={Boolean(governTarget)}
        onClose={() => setGovernTarget(null)}
        title={`Govern Course: ${governTarget?.code ?? ''}`}
        subtitle={governTarget?.title}
      >
        {governTarget && (
          <div className="space-y-4 text-sm">
            <div className="rounded-md bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-1.5">
              <p>
                <strong className="text-slate-900">Domain:</strong> {governTarget.domain} ·{' '}
                <strong className="text-slate-900">Level:</strong> {governTarget.target_level} ·{' '}
                <strong className="text-slate-900">Duration:</strong> {governTarget.duration_hours}h
              </p>
              <p>
                <strong className="text-slate-900">Current State:</strong>{' '}
                <span className="capitalize">{governTarget.approval_status ?? 'approved'}</span> (
                {governTarget.is_published ? 'Published' : 'Hidden Draft'})
              </p>
              <p className="text-slate-700 leading-relaxed pt-1">{governTarget.summary}</p>
            </div>

            {(governTarget.learning_objectives?.length ?? 0) > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-900">Learning Objectives</h3>
                <ul className="mt-1 list-disc pl-4 space-y-1 text-xs text-slate-600">
                  {governTarget.learning_objectives?.map((obj, idx) => (
                    <li key={`${governTarget.id}-gov-obj-${idx}`}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}

            {(governTarget.course_competencies?.length ?? 0) > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-900">Mapped Competencies</h3>
                <ul className="mt-1 space-y-1 text-xs text-slate-600">
                  {governTarget.course_competencies?.map((link) => (
                    <li key={link.id}>
                      • {link.competency?.code} — {link.competency?.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <TextareaField
              htmlFor="adm-gov-notes"
              label="Administrator Approval / Revision Notes"
              rows={3}
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Provide sign-off notes or syllabus revision guidance for the course author..."
            />

            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={governing}
                onClick={() => handleGovernanceDecision('rejected', false)}
              >
                Reject / Request Revision
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={governing}
                onClick={() => handleGovernanceDecision('approved', false)}
              >
                Approve Draft
              </Button>
              <Button
                variant="teal"
                size="sm"
                disabled={governing}
                onClick={() => handleGovernanceDecision('approved', true)}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{governing ? 'Saving...' : 'Approve & Publish'}</span>
              </Button>
            </div>
          </div>
        )}
      </ModalDrawer>

      {/* Create Course Modal */}
      <ModalDrawer
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Publish Training Course"
        subtitle="Persists pre-approved course to `courses` and `course_competencies`"
      >
        <form onSubmit={handleCreateCourse} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TextField
              htmlFor="adm-c-code"
              label="Code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CC-FIN-205"
            />
            <SelectField
              htmlFor="adm-c-domain"
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
          </div>
          <TextField
            htmlFor="adm-c-title"
            label="Title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="grid grid-cols-3 gap-3">
            <SelectField
              htmlFor="adm-c-mode"
              label="Mode"
              value={deliveryMode}
              onChange={(e) => setDeliveryMode(e.target.value as DeliveryMode)}
            >
              <option value="Blended">Blended</option>
              <option value="Instructor-Led">Instructor-Led</option>
              <option value="Applied Workshop">Applied Workshop</option>
            </SelectField>
            <SelectField
              htmlFor="adm-c-level"
              label="Level"
              value={targetLevel}
              onChange={(e) => setTargetLevel(e.target.value as CourseTargetLevel)}
            >
              <option value="Foundation">Foundation</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </SelectField>
            <TextField
              htmlFor="adm-c-hrs"
              label="Hours"
              type="number"
              min={1}
              value={String(durationHours)}
              onChange={(e) => setDurationHours(Number(e.target.value))}
            />
          </div>
          <TextareaField
            htmlFor="adm-c-sum"
            label="Summary"
            required
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
          <TextareaField
            htmlFor="adm-c-obj"
            label="Learning Objectives (One per line)"
            rows={3}
            value={objectivesText}
            onChange={(e) => setObjectivesText(e.target.value)}
            placeholder="e.g. Evaluate procurement compliance exceptions against statutory benchmarks"
          />
          {competencies.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-800">Link Addressed Competencies</p>
              <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto border border-slate-200 p-2.5 rounded-md bg-slate-50">
                {competencies.map((comp) => (
                  <label key={comp.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCompIds.includes(comp.id)}
                      onChange={() =>
                        setSelectedCompIds((prev) =>
                          prev.includes(comp.id)
                            ? prev.filter((x) => x !== comp.id)
                            : [...prev, comp.id]
                        )
                      }
                    />
                    <span>
                      {comp.code} — {comp.title}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={creatingCourse}>
              {creatingCourse ? 'Publishing...' : 'Publish Course'}
            </Button>
          </div>
        </form>
      </ModalDrawer>

      {/* Assign Trainer Cohort Modal */}
      <ModalDrawer
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Assign Approved Trainer to Course Cohort"
        subtitle="Persists to `trainer_assignments`"
      >
        <form onSubmit={handleAssignTrainer} className="space-y-4">
          <SelectField
            htmlFor="ta-course"
            label="Course"
            value={assignCourseId}
            onChange={(e) => setAssignCourseId(e.target.value)}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </SelectField>
          <SelectField
            htmlFor="ta-trainer"
            label="Approved Trainer"
            value={assignTrainerId}
            onChange={(e) => setAssignTrainerId(e.target.value)}
          >
            {trainers.length === 0 ? (
              <option value="">No approved trainers yet</option>
            ) : (
              trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.department || 'Faculty'})
                </option>
              ))
            )}
          </SelectField>
          <div className="grid grid-cols-2 gap-4">
            <TextField
              htmlFor="ta-cohort"
              label="Cohort Code"
              required
              value={cohortCode}
              onChange={(e) => setCohortCode(e.target.value)}
              placeholder="e.g. COHORT-2026-Q1"
            />
            <TextField
              htmlFor="ta-dept"
              label="Target Department"
              value={cohortDept}
              onChange={(e) => setCohortDept(e.target.value)}
              placeholder="e.g. Finance Directorate"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="teal"
              size="sm"
              disabled={assigningTrainer || trainers.length === 0}
            >
              {assigningTrainer ? 'Assigning...' : 'Assign Cohort'}
            </Button>
          </div>
        </form>
      </ModalDrawer>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleDeleteCourse(deleteTarget);
        }}
        title="Delete course?"
        description={`Delete "${deleteTarget?.code} — ${deleteTarget?.title}"?`}
        confirmLabel="Delete Course"
        tone="danger"
      />

      <ConfirmDialog
        isOpen={Boolean(deleteAssignmentTarget)}
        onClose={() => setDeleteAssignmentTarget(null)}
        onConfirm={() => {
          if (deleteAssignmentTarget) handleDeleteAssignment(deleteAssignmentTarget);
        }}
        title="Remove cohort assignment?"
        description={`Remove cohort "${deleteAssignmentTarget?.cohort_code}" (${deleteAssignmentTarget?.trainer?.full_name ?? 'Trainer'})?`}
        confirmLabel="Remove Cohort"
        tone="danger"
      />
    </div>
  );
}
