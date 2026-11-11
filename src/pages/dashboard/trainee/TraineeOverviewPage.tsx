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

const WORKFLOW_ROWS = [
  {
    stage: '01',
    title: 'My Skills & Required Baseline',
    description: 'Link your organisational Job Role and record competency levels.',
    actionLabel: 'Open My Skills',
    path: '/dashboard/trainee/skills',
  },
  {
    stage: '02',
    title: 'Skill Assessment',
    description: 'Complete diagnostic baseline evaluations authored for your domain.',
    actionLabel: 'Open Skill Assessment',
    path: '/dashboard/trainee/skill-assessment',
  },
  {
    stage: '03',
    title: 'Skill Gap Report',
    description: 'Inspect measured deficits comparing role requirements against verified scores.',
    actionLabel: 'View Skill Gap Report',
    path: '/dashboard/trainee/skill-gap-report',
  },
  {
    stage: '04',
    title: 'Training Courses & Enrolments',
    description: 'Enrol in targeted programmes, track progress, and download materials.',
    actionLabel: 'Browse Training Courses',
    path: '/dashboard/trainee/training-courses',
  },
  {
    stage: '05',
    title: 'Assessments & Certificates',
    description: 'Undergo post-training reassessment and verify earned certificates.',
    actionLabel: 'Open Assessments',
    path: '/dashboard/trainee/assessments',
  },
];

export function TraineeOverviewPage() {
  const { currentUser } = useAuth();
  const [counts, setCounts] = useState({
    skills: 0,
    enrollments: 0,
    attempts: 0,
    certificates: 0,
    readinessPercent: null as number | null,
    openGapCount: null as number | null,
    avgImprovement: null as number | null,
  });
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [progress, enrollments, attempts, certificates, notices, roleReqs, courses] =
        await Promise.all([
          databaseService.listProgressHistory(currentUser.id),
          databaseService.listEnrollments({ traineeId: currentUser.id }),
          databaseService.listAssessmentAttempts({ traineeId: currentUser.id }),
          databaseService.listCertificates(currentUser.id),
          databaseService.listNotifications(),
          currentUser.jobRoleId
            ? databaseService.listRoleRequirements(currentUser.jobRoleId)
            : Promise.resolve([]),
          currentUser.jobRoleId ? databaseService.listPublishedCourses() : Promise.resolve([]),
        ]);

      let readinessPercent: number | null = null;
      let openGapCount: number | null = null;
      let avgImprovement: number | null = null;

      if (roleReqs.length > 0) {
        const report = databaseService.computeCompetencyReport({
          requirements: roleReqs,
          progressHistory: progress,
          courses,
        });
        readinessPercent = report.summary.readinessPercent;
        openGapCount = report.summary.openGapCount;
        avgImprovement = report.summary.averageImprovementPoints;
      }

      setCounts({
        skills: progress.length,
        enrollments: enrollments.filter((e) => e.status !== 'withdrawn').length,
        attempts: attempts.length,
        certificates: certificates.filter((c) => c.status === 'verified').length,
        readinessPercent,
        openGapCount,
        avgImprovement,
      });
      setNotifications(notices);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard summary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [currentUser?.id, currentUser?.jobRoleId]);

  const handleMarkRead = async (notificationId: string) => {
    try {
      await databaseService.markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    } catch {
      // Non-critical update failure
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Trainee Dashboard</h1>
        <p className="text-sm text-slate-600 mt-1">
          {currentUser?.fullName} · {currentUser?.designation || 'Personnel'} ·{' '}
          {currentUser?.department || 'Organisational Unit'}
        </p>
      </div>

      {error && <StatusBanner tone="error" title="Database Query Error" description={error} />}

      {!currentUser?.jobRoleId && (
        <StatusBanner
          tone="warning"
          title="Assign Your Organisational Job Role"
          description="Select your official Job Role under Profile to enable automated Stage 03 Skill Gap Analysis against published role competency requirements."
          action={
            <Link
              to="/dashboard/trainee/profile"
              className="inline-flex items-center justify-center min-h-[38px] px-4 py-1.5 text-xs font-semibold rounded-md bg-[#0B1F3A] text-white hover:bg-[#122E53] whitespace-nowrap"
            >
              Set Job Role in Profile
            </Link>
          }
        />
      )}

      {/* Real Database Record Counts & Role Readiness */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Role Readiness</p>
          <p className="font-display text-2xl font-bold text-[#0F766E] mt-1 tabular-nums">
            {loading
              ? '—'
              : counts.readinessPercent !== null
              ? `${counts.readinessPercent}%`
              : `${counts.skills} entries`}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {counts.openGapCount !== null
              ? `${counts.openGapCount} open competency gaps`
              : 'Bind Job Role to compute'}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Assessment Attempts</p>
          <p className="font-display text-2xl font-bold text-[#0B1F3A] mt-1 tabular-nums">
            {loading ? '—' : counts.attempts}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {counts.avgImprovement !== null
              ? `Avg reassessment ${counts.avgImprovement >= 0 ? '+' : ''}${counts.avgImprovement} pts`
              : `${counts.skills} competency records`}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Active Enrolments</p>
          <p className="font-display text-2xl font-bold text-[#0F766E] mt-1 tabular-nums">
            {loading ? '—' : counts.enrollments}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Verified Certificates</p>
          <p className="font-display text-2xl font-bold text-[#0B1F3A] mt-1 tabular-nums">
            {loading ? '—' : counts.certificates}
          </p>
        </Card>
      </div>

      {/* 5-Stage Lifecycle Navigator */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 className="font-display text-sm font-semibold text-[#0B1F3A]">
            Competency Development Workflow
          </h2>
          <span className="text-xs text-slate-500">5-Stage Progression</span>
        </div>
        <div className="divide-y divide-slate-200">
          {WORKFLOW_ROWS.map((row) => (
            <div
              key={row.stage}
              className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-medium text-[#0F766E]">
                    Stage {row.stage}
                  </span>
                  <span className="font-display text-sm font-semibold text-slate-900">
                    {row.title}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{row.description}</p>
              </div>
              <Link
                to={row.path}
                className="inline-flex items-center justify-center min-h-[38px] px-4 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-[#0B1F3A] hover:bg-slate-50 whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                {row.actionLabel}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Role-Scoped Announcements & Notifications */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#0F766E]" />
            <h2 className="font-display text-base font-semibold text-[#0B1F3A]">
              Announcements &amp; Notices
            </h2>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            {notifications.length} items
          </span>
        </div>

        {notifications.length === 0 ? (
          <p className="text-sm text-slate-500">No announcements or alerts published yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`font-semibold ${
                        item.priority === 'Important' ? 'text-amber-700' : 'text-[#0F766E]'
                      }`}
                    >
                      {item.priority}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="text-slate-500">{item.audience}</span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="font-mono text-slate-500">{formatShortDate(item.created_at)}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.body}</p>
                </div>

                {item.recipient_id === currentUser?.id && !item.is_read && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMarkRead(item.id)}
                  >
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
