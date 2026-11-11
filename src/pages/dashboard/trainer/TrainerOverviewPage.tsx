import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { useAuth } from '../../../context/AuthContext';
import { formatShortDate } from '../../../lib/formatters';
import { databaseService } from '../../../services/databaseService';
import { NotificationRecord } from '../../../types/competency';

const TRAINER_WORKFLOW = [
  {
    step: '01',
    title: 'Accreditation & Domain Expertise',
    description: 'Maintain your institutional profile and verified subject-matter credentials.',
    label: 'Manage Expertise',
    path: '/dashboard/trainer/expertise',
  },
  {
    step: '02',
    title: 'Course Creation & Resource Upload',
    description: 'Author targeted training courses and upload encrypted study files to Supabase Storage.',
    label: 'Upload Materials',
    path: '/dashboard/trainer/upload-materials',
  },
  {
    step: '03',
    title: 'Assessments & Questionnaires',
    description: 'Configure diagnostic baselines, course tests, and reassessment items.',
    label: 'Create Assessment',
    path: '/dashboard/trainer/create-assessment',
  },
  {
    step: '04',
    title: 'Cohort Oversight & Evaluation',
    description: 'Review submitted attempts, assign proficiency levels, and issue completion certificates.',
    label: 'Open Performance',
    path: '/dashboard/trainer/performance',
  },
  {
    step: '05',
    title: 'Course Feedback Review',
    description: 'Inspect learner feedback on curriculum clarity, assessments, and training delivery.',
    label: 'Read Feedback',
    path: '/dashboard/trainer/feedback',
  },
];

export function TrainerOverviewPage() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    expertise: 0,
    assignments: 0,
    courses: 0,
    pendingReviews: 0,
  });
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);

    const load = async () => {
      try {
        const [expertiseRows, notices] = await Promise.all([
          databaseService.listTrainerExpertise(currentUser.id),
          databaseService.listNotifications(),
        ]);

        let assignmentCount = 0;
        let myCourseCount = 0;
        let pendingReviewsCount = 0;

        if (currentUser.approvalStatus === 'approved') {
          const [assignments, allCourses, attempts] = await Promise.all([
            databaseService.listTrainerAssignments(currentUser.id),
            databaseService.listAllCourses(),
            databaseService.listAssessmentAttempts(),
          ]);
          assignmentCount = assignments.length;
          myCourseCount = allCourses.filter((c) => c.created_by === currentUser.id).length;
          pendingReviewsCount = attempts.filter((a) => a.status === 'submitted').length;
        }

        setStats({
          expertise: expertiseRows.length,
          assignments: assignmentCount,
          courses: myCourseCount,
          pendingReviews: pendingReviewsCount,
        });
        setNotifications(notices);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load trainer workspace overview.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [currentUser?.id, currentUser?.approvalStatus]);

  const handleMarkRead = async (notificationId: string) => {
    try {
      await databaseService.markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    } catch {
      // Non-critical update
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Trainer Dashboard</h1>
        <p className="text-sm text-slate-600 mt-1">
          {currentUser?.fullName} · {currentUser?.designation || 'Faculty'} ·{' '}
          {currentUser?.department || 'Curriculum Wing'}
        </p>
      </div>

      {currentUser?.approvalStatus === 'pending' && (
        <StatusBanner
          tone="warning"
          title="Trainer Account Pending Administrator Approval"
          description="Self-registered Trainer profiles start in Pending state. Submit your credentials under Expertise so an Administrator can verify and activate your course authoring and evaluation permissions."
          action={
            <Link
              to="/dashboard/trainer/expertise"
              className="inline-flex items-center justify-center min-h-[38px] px-4 py-1.5 text-xs font-semibold rounded-md bg-[#0B1F3A] text-white hover:bg-[#122E53] whitespace-nowrap"
            >
              Add Expertise
            </Link>
          }
        />
      )}

      {error && <StatusBanner tone="error" title="Query Error" description={error} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Approval Status</p>
          <p
            className={`font-display text-lg font-bold mt-1.5 capitalize ${
              currentUser?.approvalStatus === 'approved' ? 'text-[#0F766E]' : 'text-amber-700'
            }`}
          >
            {currentUser?.approvalStatus ?? 'pending'}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Expertise Entries</p>
          <p className="font-display text-2xl font-bold text-[#0B1F3A] mt-1 tabular-nums">
            {loading ? '—' : stats.expertise}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Assigned Cohorts / Courses</p>
          <p className="font-display text-2xl font-bold text-[#0B1F3A] mt-1 tabular-nums">
            {loading ? '—' : `${stats.assignments} / ${stats.courses}`}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Submissions Awaiting Review</p>
          <p className="font-display text-2xl font-bold text-[#0F766E] mt-1 tabular-nums">
            {loading ? '—' : stats.pendingReviews}
          </p>
        </Card>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 className="font-display text-sm font-semibold text-[#0B1F3A]">
            Trainer Delivery &amp; Assessment Operations
          </h2>
          <span className="text-xs text-slate-500">Role-Scoped Workflows</span>
        </div>
        <div className="divide-y divide-slate-200">
          {TRAINER_WORKFLOW.map((item) => (
            <div
              key={item.step}
              className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-medium text-[#0F766E]">
                    Area {item.step}
                  </span>
                  <span className="font-display text-sm font-semibold text-slate-900">
                    {item.title}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{item.description}</p>
              </div>
              <Link
                to={item.path}
                className="inline-flex items-center justify-center min-h-[38px] px-4 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-[#0B1F3A] hover:bg-slate-50 whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                {item.label}
              </Link>
            </div>
          ))}
        </div>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#0F766E]" />
            <h2 className="font-display text-base font-semibold text-[#0B1F3A]">
              Faculty Notices &amp; Announcements
            </h2>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">{notifications.length} items</span>
        </div>

        {notifications.length === 0 ? (
          <p className="text-sm text-slate-500">No announcements published for trainers yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-[#0F766E]">{item.priority}</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono text-slate-500">{formatShortDate(item.created_at)}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-600">{item.body}</p>
                </div>
                {item.recipient_id === currentUser?.id && !item.is_read && (
                  <Button variant="outline" size="sm" onClick={() => handleMarkRead(item.id)}>
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark Read</span>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
