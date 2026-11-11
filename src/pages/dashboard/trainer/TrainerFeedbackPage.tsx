import React, { useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { ModalDrawer } from '../../../components/ui/ModalDrawer';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { useAuth } from '../../../context/AuthContext';
import { formatDateTime, formatShortDate } from '../../../lib/formatters';
import { databaseService } from '../../../services/databaseService';
import {
  CourseRecord,
  FeedbackCategory,
  FeedbackRecord,
  TrainerAssignmentRecord,
} from '../../../types/competency';

export function TrainerFeedbackPage() {
  const { currentUser } = useAuth();
  const [feedbackRows, setFeedbackRows] = useState<FeedbackRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [assignments, setAssignments] = useState<TrainerAssignmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [courseFilter, setCourseFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [inspectTarget, setInspectTarget] = useState<FeedbackRecord | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    setIsLoading(true);
    Promise.all([
      databaseService.listAllCourses(),
      databaseService.listTrainerAssignments(currentUser.id),
      databaseService.listFeedback(),
    ])
      .then(([courseRows, assignmentRows, fbRows]) => {
        setCourses(courseRows);
        setAssignments(assignmentRows);
        setFeedbackRows(fbRows);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load trainee course feedback.');
      })
      .finally(() => setIsLoading(false));
  }, [currentUser?.id]);

  const trainerCourseIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of courses) {
      if (c.created_by === currentUser?.id) ids.add(c.id);
    }
    for (const a of assignments) {
      ids.add(a.course_id);
    }
    return ids;
  }, [courses, assignments, currentUser?.id]);

  const trainerCourses = useMemo(
    () => courses.filter((c) => trainerCourseIds.has(c.id)),
    [courses, trainerCourseIds]
  );

  const scopedFeedback = useMemo(() => {
    const q = search.trim().toLowerCase();
    return feedbackRows.filter((row) => {
      if (!row.course_id || !trainerCourseIds.has(row.course_id)) return false;
      const matchesCourse = courseFilter === 'All' || row.course_id === courseFilter;
      const matchesCat = categoryFilter === 'All' || row.category === categoryFilter;
      const matchesSearch =
        !q ||
        row.subject.toLowerCase().includes(q) ||
        row.comments.toLowerCase().includes(q) ||
        (row.author?.full_name ?? '').toLowerCase().includes(q) ||
        (row.course?.code ?? '').toLowerCase().includes(q) ||
        (row.course?.title ?? '').toLowerCase().includes(q);
      return matchesCourse && matchesCat && matchesSearch;
    });
  }, [feedbackRows, trainerCourseIds, courseFilter, categoryFilter, search]);

  const columns: DataColumn<FeedbackRecord>[] = [
    {
      key: 'trainee',
      header: 'Trainee',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.author?.full_name ?? 'Enrolled Trainee'}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {row.author?.department || 'Participant'}
          </p>
        </div>
      ),
    },
    {
      key: 'course',
      header: 'Course',
      render: (row) => (
        <div>
          <span className="font-mono text-xs text-[#0F766E]">{row.course?.code ?? '—'}</span>
          <p className="text-xs text-slate-700 mt-0.5">{row.course?.title ?? 'Course'}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => <span className="text-xs font-medium text-slate-700">{row.category}</span>,
    },
    {
      key: 'subject',
      header: 'Feedback Summary',
      render: (row) => (
        <div className="max-w-sm">
          <p className="font-medium text-slate-900 truncate">{row.subject}</p>
          <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{row.comments}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Submitted',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">{formatShortDate(row.created_at)}</span>
      ),
    },
    {
      key: 'inspect',
      header: 'Details',
      align: 'right',
      render: (row) => (
        <Button variant="outline" size="sm" onClick={() => setInspectTarget(row)}>
          <Eye className="w-3.5 h-3.5" />
          <span>Read</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Trainee Course Feedback</h1>
        <p className="text-sm text-slate-600 mt-1">
          Review learner feedback submitted for courses you authored or cohort sessions assigned to
          you.
        </p>
      </div>

      {error && <StatusBanner tone="error" title="Feedback Query Error" description={error} />}

      <WorkspaceFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by subject, comments, trainee name, or course..."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by trainer course"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
            >
              <option value="All">All My Courses ({trainerCourses.length})</option>
              {trainerCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as FeedbackCategory | 'All')}
              className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
            >
              <option value="All">All Categories</option>
              <option value="Course Content">Course Content</option>
              <option value="Assessment Clarity">Assessment Clarity</option>
              <option value="Trainer Delivery">Trainer Delivery</option>
              <option value="Portal Experience">Portal Experience</option>
            </select>
          </div>
        }
      />

      <DataTable
        columns={columns}
        rows={scopedFeedback}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No course feedback received yet"
        emptyDescription="Trainee feedback submitted for courses you authored or deliver appears here automatically."
      />

      <ModalDrawer
        isOpen={Boolean(inspectTarget)}
        onClose={() => setInspectTarget(null)}
        title={inspectTarget?.subject ?? 'Feedback Details'}
        subtitle={
          inspectTarget
            ? `${inspectTarget.course?.code ?? 'Course'} · ${inspectTarget.category}`
            : undefined
        }
      >
        {inspectTarget && (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-b border-slate-200 pb-4">
              <div>
                <dt className="text-slate-500">Trainee</dt>
                <dd className="font-medium text-slate-900 mt-0.5">
                  {inspectTarget.author?.full_name ?? 'Enrolled Trainee'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Department / Designation</dt>
                <dd className="font-medium text-slate-900 mt-0.5">
                  {[inspectTarget.author?.department, inspectTarget.author?.designation]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Course</dt>
                <dd className="font-medium text-slate-900 mt-0.5">
                  {inspectTarget.course
                    ? `${inspectTarget.course.code} — ${inspectTarget.course.title}`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Submitted At</dt>
                <dd className="font-mono text-slate-800 mt-0.5">
                  {formatDateTime(inspectTarget.created_at)}
                </dd>
              </div>
            </dl>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-700">Detailed Observations</p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-md p-4">
                {inspectTarget.comments}
              </p>
            </div>
          </div>
        )}
      </ModalDrawer>
    </div>
  );
}
