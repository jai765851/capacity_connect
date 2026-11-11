import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { SelectField, TextField, TextareaField } from '../../../components/ui/FormField';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { useAuth } from '../../../context/AuthContext';
import { databaseService } from '../../../services/databaseService';
import {
  CompetencyRecord,
  CourseApprovalStatus,
  CourseTargetLevel,
  DeliveryMode,
  PROGRAMME_DOMAINS,
  ProgrammeDomain,
} from '../../../types/competency';

export function TrainerCreateCoursePage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editCourseId = searchParams.get('courseId') ?? '';
  const isEditing = Boolean(editCourseId);

  const [competencies, setCompetencies] = useState<CompetencyRecord[]>([]);
  const [selectedCompIds, setSelectedCompIds] = useState<string[]>([]);
  const [loadingCourse, setLoadingCourse] = useState(isEditing);
  const [approvalStatus, setApprovalStatus] = useState<CourseApprovalStatus | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');

  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState<ProgrammeDomain>('Public Finance & Audit');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('Blended');
  const [targetLevel, setTargetLevel] = useState<CourseTargetLevel>('Intermediate');
  const [durationHours, setDurationHours] = useState(16);
  const [summary, setSummary] = useState('');
  const [learningObjectives, setLearningObjectives] = useState<string[]>(['']);
  const [prerequisites, setPrerequisites] = useState('');
  const [assessmentMethod, setAssessmentMethod] = useState('');
  const [leadDepartment, setLeadDepartment] = useState(currentUser?.department ?? '');
  const [isPublished, setIsPublished] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    databaseService
      .listCompetencies()
      .then(setCompetencies)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!editCourseId) return;
    setLoadingCourse(true);
    databaseService
      .getCourseById(editCourseId)
      .then((course) => {
        if (!course) {
          setApiError('Requested course was not found or you do not have permission to edit it.');
          return;
        }
        setCode(course.code);
        setTitle(course.title);
        setDomain(course.domain as ProgrammeDomain);
        setDeliveryMode(course.delivery_mode);
        setTargetLevel(course.target_level);
        setDurationHours(course.duration_hours);
        setSummary(course.summary);
        setLearningObjectives(
          Array.isArray(course.learning_objectives) && course.learning_objectives.length > 0
            ? course.learning_objectives
            : ['']
        );
        setPrerequisites(course.prerequisites);
        setAssessmentMethod(course.assessment_method);
        setLeadDepartment(course.lead_department);
        setIsPublished(course.is_published);
        setApprovalStatus(course.approval_status ?? null);
        setApprovalNotes(course.approval_notes ?? '');
        setSelectedCompIds(
          (course.course_competencies ?? []).map((link) => link.competency_id)
        );
        setApiError(null);
      })
      .catch((err) => {
        setApiError(err instanceof Error ? err.message : 'Unable to load course for editing.');
      })
      .finally(() => setLoadingCourse(false));
  }, [editCourseId]);

  const toggleCompetency = (id: string) => {
    setSelectedCompIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleObjectiveChange = (idx: number, val: string) => {
    setLearningObjectives((prev) => prev.map((item, i) => (i === idx ? val : item)));
  };

  const handleAddObjective = () => {
    setLearningObjectives((prev) => [...prev, '']);
  };

  const handleRemoveObjective = (idx: number) => {
    setLearningObjectives((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  };

  const cleanObjectives = learningObjectives.map((item) => item.trim()).filter(Boolean);

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (code.trim().length < 3) nextErrors.code = 'Course code must be at least 3 characters.';
    if (title.trim().length < 5) nextErrors.title = 'Course title must be at least 5 characters.';
    if (summary.trim().length < 20) {
      nextErrors.summary = 'Provide a curriculum summary of at least 20 characters.';
    }
    if (durationHours < 1 || durationHours > 200 || Number.isNaN(Number(durationHours))) {
      nextErrors.durationHours = 'Duration must be between 1 and 200 hours.';
    }
    if (cleanObjectives.length === 0 || cleanObjectives.some((o) => o.length < 6)) {
      nextErrors.objectives =
        'Provide at least one measurable learning objective (minimum 6 characters each).';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setConfirmOpen(true);
  };

  const saveCourse = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    setApiError(null);
    try {
      if (isEditing && editCourseId) {
        await databaseService.updateCourse(editCourseId, {
          title: title.trim(),
          domain,
          delivery_mode: deliveryMode,
          target_level: targetLevel,
          duration_hours: Math.max(1, Math.min(200, Number(durationHours))),
          summary: summary.trim(),
          learning_objectives: cleanObjectives,
          prerequisites: prerequisites.trim() || 'None',
          assessment_method: assessmentMethod.trim() || 'Post-training reassessment verification',
          lead_department: leadDepartment.trim() || currentUser.department || 'Faculty Wing',
          is_published: isPublished,
          competencyIds: selectedCompIds,
        });
      } else {
        await databaseService.createCourse({
          code: code.trim().toUpperCase(),
          title: title.trim(),
          domain,
          delivery_mode: deliveryMode,
          target_level: targetLevel,
          duration_hours: Math.max(1, Math.min(200, Number(durationHours))),
          summary: summary.trim(),
          learning_objectives: cleanObjectives,
          prerequisites: prerequisites.trim() || 'None',
          assessment_method: assessmentMethod.trim() || 'Post-training reassessment verification',
          lead_department: leadDepartment.trim() || currentUser.department || 'Faculty Wing',
          created_by: currentUser.id,
          is_published: isPublished,
          competencyIds: selectedCompIds,
        });
      }
      navigate('/dashboard/trainer/courses');
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : `Unable to ${isEditing ? 'update' : 'create'} course.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
            {isEditing ? 'Edit Course Curriculum' : 'Create Course'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {isEditing
              ? 'Update syllabus metadata, learning objectives, and competency mappings.'
              : 'Author a competency-mapped course with structured learning objectives for Admin review.'}
          </p>
        </div>
        <Link
          to="/dashboard/trainer/courses"
          className="text-xs font-semibold text-[#0B1F3A] hover:text-[#0F766E] whitespace-nowrap pt-1"
        >
          ← Back to My Courses
        </Link>
      </div>

      {approvalStatus === 'rejected' && (
        <StatusBanner
          tone="warning"
          title="Revision Requested by Administrator"
          description={
            approvalNotes
              ? `Admin notes: "${approvalNotes}". Saving updates resubmits this course for Admin review.`
              : 'Saving revisions will resubmit this course into Pending Admin Approval status.'
          }
        />
      )}

      {!isEditing && (
        <StatusBanner
          tone="info"
          title="Curriculum Governance Rule"
          description="New courses authored by Trainers enter Pending Admin Approval when workflow migration 006 is active and appear in the Trainee catalogue once approved and published."
        />
      )}

      {apiError && <StatusBanner tone="error" title="Save Failed" description={apiError} />}

      <Card className="p-6">
        {loadingCourse ? (
          <p className="text-sm text-slate-500">Loading course specification...</p>
        ) : (
          <form onSubmit={handleValidate} noValidate className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                htmlFor="cc-code"
                label="Course Code"
                required
                disabled={isEditing}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                error={errors.code}
                placeholder="e.g. CC-FIN-240"
                helperText={isEditing ? 'Course code cannot be altered after creation.' : undefined}
              />
              <SelectField
                htmlFor="cc-domain"
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
            </div>

            <TextField
              htmlFor="cc-title"
              label="Course Title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={errors.title}
              placeholder="e.g. Departmental Expenditure Sanctions & GFR Controls"
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SelectField
                htmlFor="cc-mode"
                label="Delivery Mode"
                value={deliveryMode}
                onChange={(e) => setDeliveryMode(e.target.value as DeliveryMode)}
              >
                <option value="Blended">Blended</option>
                <option value="Instructor-Led">Instructor-Led</option>
                <option value="Applied Workshop">Applied Workshop</option>
              </SelectField>
              <SelectField
                htmlFor="cc-level"
                label="Target Level"
                value={targetLevel}
                onChange={(e) => setTargetLevel(e.target.value as CourseTargetLevel)}
              >
                <option value="Foundation">Foundation</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </SelectField>
              <TextField
                htmlFor="cc-hours"
                label="Duration (Hours)"
                type="number"
                min={1}
                max={200}
                value={String(durationHours)}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                error={errors.durationHours}
              />
            </div>

            <TextareaField
              htmlFor="cc-summary"
              label="Curriculum Summary"
              required
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              error={errors.summary}
              placeholder="Describe operational competencies covered, applied workshops, and audit criteria..."
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-slate-800">
                  Learning Objectives <span className="text-red-600">*</span>
                </label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddObjective}>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Objective</span>
                </Button>
              </div>
              <div className="space-y-2">
                {learningObjectives.map((obj, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400 w-5 text-right shrink-0">
                      {idx + 1}.
                    </span>
                    <input
                      aria-label={`Learning objective ${idx + 1}`}
                      type="text"
                      value={obj}
                      onChange={(e) => handleObjectiveChange(idx, e.target.value)}
                      placeholder="e.g. Audit GFR Rule 21 compliance across departmental sanction orders"
                      className="flex-1 min-h-[38px] rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                    />
                    {learningObjectives.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveObjective(idx)}
                        aria-label={`Remove objective ${idx + 1}`}
                        className="p-2 text-red-700 hover:text-red-900 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {errors.objectives && <p className="text-xs text-red-600">{errors.objectives}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                htmlFor="cc-prereq"
                label="Prerequisites"
                value={prerequisites}
                onChange={(e) => setPrerequisites(e.target.value)}
                placeholder="e.g. Baseline Level 2"
              />
              <TextField
                htmlFor="cc-dept"
                label="Lead Department"
                value={leadDepartment}
                onChange={(e) => setLeadDepartment(e.target.value)}
              />
            </div>

            <TextField
              htmlFor="cc-method"
              label="Reassessment Method"
              value={assessmentMethod}
              onChange={(e) => setAssessmentMethod(e.target.value)}
              placeholder="e.g. Practical voucher audit & viva evaluation"
            />

            <label className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#0F766E]"
              />
              <span>Request publication upon Administrator approval</span>
            </label>

            {competencies.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium text-slate-800">
                  Map Institutional Competencies Addressed
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-slate-200 rounded-md p-3 bg-slate-50 max-h-48 overflow-y-auto">
                  {competencies.map((comp) => (
                    <label
                      key={comp.id}
                      className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCompIds.includes(comp.id)}
                        onChange={() => toggleCompetency(comp.id)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0B1F3A]"
                      />
                      <span>
                        <span className="font-mono text-[#0F766E]">{comp.code}</span> — {comp.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <Link
                to="/dashboard/trainer/courses"
                className="inline-flex items-center justify-center min-h-[42px] px-4 text-sm font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>
              <Button type="submit" variant="primary" size="md" disabled={submitting}>
                {submitting
                  ? 'Saving Course...'
                  : isEditing
                  ? 'Save Course Changes'
                  : 'Submit Course'}
              </Button>
            </div>
          </form>
        )}
      </Card>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={saveCourse}
        title={isEditing ? 'Save curriculum changes?' : 'Submit training course?'}
        description={
          isEditing
            ? `Update "${code.trim().toUpperCase()} — ${title.trim()}" and ${cleanObjectives.length} learning objective(s) in PostgreSQL?`
            : `Submit "${code.trim().toUpperCase()} — ${title.trim()}" with ${cleanObjectives.length} learning objective(s) to PostgreSQL?`
        }
        confirmLabel={isEditing ? 'Save Changes' : 'Submit Course'}
      />
    </div>
  );
}
