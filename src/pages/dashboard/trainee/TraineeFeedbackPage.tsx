import React, { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { SelectField, TextField, TextareaField } from '../../../components/ui/FormField';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { useAuth } from '../../../context/AuthContext';
import { formatShortDate } from '../../../lib/formatters';
import { databaseService } from '../../../services/databaseService';
import { CourseRecord, FeedbackCategory, FeedbackRecord } from '../../../types/competency';

export function TraineeFeedbackPage() {
  const { currentUser } = useAuth();
  const [submissions, setSubmissions] = useState<FeedbackRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<FeedbackCategory>('Course Content');
  const [courseId, setCourseId] = useState('');
  const [subject, setSubject] = useState('');
  const [comments, setComments] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeedbackRecord | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    setIsLoading(true);
    Promise.all([
      databaseService.listFeedback(currentUser.id),
      databaseService.listPublishedCourses(),
      databaseService.listEnrollments({ traineeId: currentUser.id }),
    ])
      .then(([fbRows, courseRows, enrollmentRows]) => {
        setSubmissions(fbRows);
        setCourses(courseRows);
        setEnrolledCourseIds(
          new Set(enrollmentRows.filter((e) => e.status !== 'withdrawn').map((e) => e.course_id))
        );
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load feedback history.');
      })
      .finally(() => setIsLoading(false));
  }, [currentUser?.id]);

  const { enrolledCourses, otherCourses } = useMemo(() => {
    const enrolled: CourseRecord[] = [];
    const others: CourseRecord[] = [];
    for (const c of courses) {
      if (enrolledCourseIds.has(c.id)) {
        enrolled.push(c);
      } else {
        others.push(c);
      }
    }
    return { enrolledCourses: enrolled, otherCourses: others };
  }, [courses, enrolledCourseIds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (subject.trim().length < 3 || comments.trim().length < 10) {
      setFormError('Enter a subject (minimum 3 characters) and at least 10 characters of feedback.');
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      const inserted = await databaseService.createFeedback({
        user_id: currentUser.id,
        course_id: courseId || null,
        category,
        subject: subject.trim(),
        comments: comments.trim(),
      });
      setSubmissions((prev) => [inserted, ...prev]);
      setSubject('');
      setComments('');
      setCourseId('');
      setStatusMessage('Feedback saved to PostgreSQL table `feedback` for administrative review.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (row: FeedbackRecord) => {
    try {
      await databaseService.deleteFeedback(row.id);
      setSubmissions((prev) => prev.filter((item) => item.id !== row.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove feedback.');
    }
  };

  const columns: DataColumn<FeedbackRecord>[] = [
    {
      key: 'category',
      header: 'Category',
      render: (row) => (
        <div>
          <span className="font-mono text-xs text-[#0F766E]">{row.category}</span>
          {row.course && <p className="text-xs text-slate-500 mt-0.5">{row.course.code}</p>}
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.subject}</p>
          <p className="text-xs text-slate-500 mt-0.5">{row.comments}</p>
        </div>
      ),
    },
    {
      key: 'submitted',
      header: 'Submitted',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">{formatShortDate(row.created_at)}</span>
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
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Feedback</h1>
        <p className="text-sm text-slate-600 mt-1">
          Submit course, assessment clarity, or portal delivery observations to administration.
        </p>
      </div>

      {error && <StatusBanner tone="error" title="Database Error" description={error} />}
      {statusMessage && (
        <StatusBanner tone="success" title="Feedback Recorded" description={statusMessage} />
      )}

      <Card className="p-6 max-w-3xl">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {formError && <p className="text-xs text-red-700 font-medium">{formError}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              htmlFor="fb-cat"
              label="Feedback Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
            >
              <option value="Course Content">Course Content</option>
              <option value="Assessment Clarity">Assessment Clarity</option>
              <option value="Trainer Delivery">Trainer Delivery</option>
              <option value="Portal Experience">Portal Experience</option>
            </SelectField>
            <SelectField
              htmlFor="fb-course"
              label="Related Course (Optional)"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">-- General / No Specific Course --</option>
              {enrolledCourses.length > 0 && (
                <optgroup label="My Enrolled Courses">
                  {enrolledCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </optgroup>
              )}
              {otherCourses.length > 0 && (
                <optgroup label={enrolledCourses.length > 0 ? 'Other Published Courses' : 'Published Courses'}>
                  {otherCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </optgroup>
              )}
            </SelectField>
          </div>

          <TextField
            htmlFor="fb-subject"
            label="Subject"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief topic summary"
          />

          <TextareaField
            htmlFor="fb-comments"
            label="Detailed Observations"
            required
            rows={4}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Share constructive course, rubric, or workflow observations..."
          />

          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="md" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
        </form>
      </Card>

      <DataTable
        columns={columns}
        rows={submissions}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No feedback records submitted"
        emptyDescription="Submitted feedback entries appear here once saved to `feedback`."
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleRemove(deleteTarget);
        }}
        title="Delete feedback submission?"
        description={`Remove "${deleteTarget?.subject}" from your feedback history?`}
        confirmLabel="Remove"
        tone="danger"
      />
    </div>
  );
}
