import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { useAuth } from '../../../context/AuthContext';
import { databaseService } from '../../../services/databaseService';
import { CourseRecord, PROGRAMME_DOMAINS } from '../../../types/competency';

export function TrainerCoursesPage() {
  const { currentUser } = useAuth();
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('All');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'mine'>('all');
  const [deleteTarget, setDeleteTarget] = useState<CourseRecord | null>(null);

  useEffect(() => {
    setIsLoading(true);
    databaseService
      .listAllCourses()
      .then((rows) => {
        setCourses(rows);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load courses.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesOwner = ownershipFilter === 'all' || course.created_by === currentUser?.id;
      const matchesDomain = domainFilter === 'All' || course.domain === domainFilter;
      const matchesSearch =
        !q ||
        course.code.toLowerCase().includes(q) ||
        course.title.toLowerCase().includes(q) ||
        course.domain.toLowerCase().includes(q);
      return matchesOwner && matchesDomain && matchesSearch;
    });
  }, [courses, search, domainFilter, ownershipFilter, currentUser?.id]);

  const handleTogglePublished = async (course: CourseRecord) => {
    try {
      await databaseService.updateCoursePublished(course.id, !course.is_published);
      setCourses((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, is_published: !c.is_published } : c))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to toggle publication status.');
    }
  };

  const handleDelete = async (course: CourseRecord) => {
    try {
      await databaseService.deleteCourse(course.id);
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete course.');
    }
  };

  const columns: DataColumn<CourseRecord>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => <span className="font-mono text-xs text-[#0F766E]">{row.code}</span>,
    },
    {
      key: 'title',
      header: 'Course Title',
      render: (row) => {
        const objCount = Array.isArray(row.learning_objectives)
          ? row.learning_objectives.filter(Boolean).length
          : 0;
        return (
          <div>
            <p className="font-medium text-slate-900">{row.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {row.domain} · {objCount} objective{objCount === 1 ? '' : 's'}
            </p>
            {row.approval_status === 'rejected' && row.approval_notes && (
              <p className="text-xs text-red-700 mt-1">
                Admin review: {row.approval_notes}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'mode',
      header: 'Delivery / Hours',
      render: (row) => (
        <span className="text-xs text-slate-600 tabular-nums">
          {row.delivery_mode} · {row.duration_hours}h
        </span>
      ),
    },
    {
      key: 'approval',
      header: 'Governance',
      render: (row) => {
        const status = row.approval_status ?? 'approved';
        const tone =
          status === 'approved'
            ? 'text-[#0F766E]'
            : status === 'rejected'
            ? 'text-red-700'
            : 'text-amber-700';
        const label =
          status === 'approved'
            ? 'Approved'
            : status === 'rejected'
            ? 'Revision Needed'
            : 'Pending Approval';
        return (
          <div className="space-y-0.5">
            <span className={`block text-xs font-semibold ${tone}`}>{label}</span>
            {row.created_by === currentUser?.id ? (
              <button
                type="button"
                onClick={() => handleTogglePublished(row)}
                className={`text-xs cursor-pointer ${
                  row.is_published ? 'text-slate-600 underline' : 'text-amber-700 underline'
                }`}
              >
                {row.is_published ? 'Published (Toggle)' : 'Draft (Toggle)'}
              </button>
            ) : (
              <span className="text-xs text-slate-500">
                {row.is_published ? 'Published' : 'Draft'}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) =>
        row.created_by === currentUser?.id ? (
          <div className="inline-flex items-center gap-3">
            <Link
              to={`/dashboard/trainer/create-course?courseId=${row.id}`}
              className="text-xs font-semibold text-[#0B1F3A] hover:text-[#0F766E]"
            >
              Edit
            </Link>
            <button
              type="button"
              onClick={() => setDeleteTarget(row)}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Catalogue</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">My Courses</h1>
          <p className="text-sm text-slate-600 mt-1">
            Inspect accredited curriculum modules and manage courses you have authored.
          </p>
        </div>
        <Link
          to="/dashboard/trainer/create-course"
          className="inline-flex items-center justify-center gap-2 min-h-[42px] px-5 py-2.5 text-sm font-medium rounded-md bg-[#0B1F3A] text-white hover:bg-[#122E53] whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Course</span>
        </Link>
      </div>

      {error && <StatusBanner tone="error" title="Database Error" description={error} />}

      <WorkspaceFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search courses by code, title, or domain..."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by ownership"
              value={ownershipFilter}
              onChange={(e) => setOwnershipFilter(e.target.value as 'all' | 'mine')}
              className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
            >
              <option value="all">All Catalogue Courses</option>
              <option value="mine">Authored by Me</option>
            </select>
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
          </div>
        }
      />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No courses found"
        emptyDescription="Create a new course using Create Course to publish modules into PostgreSQL."
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
        }}
        title="Delete course?"
        description={`Delete "${deleteTarget?.code} — ${deleteTarget?.title}" from PostgreSQL? Associated materials and enrolments will also be removed.`}
        confirmLabel="Delete Course"
        tone="danger"
      />
    </div>
  );
}
