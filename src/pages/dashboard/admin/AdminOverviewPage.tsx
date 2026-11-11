import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { formatShortDate } from '../../../lib/formatters';
import { databaseService } from '../../../services/databaseService';
import { NotificationRecord } from '../../../types/competency';

const GOVERNANCE_SECTIONS = [
  {
    code: '01',
    title: 'User Management & Provisioning',
    description: 'Create verified Trainee, Trainer, or Admin accounts and assign Job Roles.',
    label: 'Open User Management',
    path: '/dashboard/admin/users',
  },
  {
    code: '02',
    title: 'Trainer Accreditation & Approval',
    description: 'Verify Trainer credentials and transition pending faculty applications.',
    label: 'Open Trainer Approval',
    path: '/dashboard/admin/trainer-approval',
  },
  {
    code: '03',
    title: 'Competency & Job Role Frameworks',
    description: 'Define institutional competencies and role-required proficiency benchmarks.',
    label: 'Open Competency Management',
    path: '/dashboard/admin/competencies',
  },
  {
    code: '04',
    title: 'Courses & Trainer Cohort Assignments',
    description: 'Govern published curricula and assign approved Trainers to delivery cohorts.',
    label: 'Open Courses',
    path: '/dashboard/admin/courses',
  },
  {
    code: '05',
    title: 'Reports, Certificates & Announcements',
    description: 'Export readiness metrics, verify certificates, and manage portal notices.',
    label: 'Open Reports',
    path: '/dashboard/admin/reports',
  },
];

export function AdminOverviewPage() {
  const [counts, setCounts] = useState({
    users: 0,
    pendingTrainers: 0,
    competencies: 0,
    jobRoles: 0,
    courses: 0,
    enrollments: 0,
    assessments: 0,
    certificates: 0,
  });
  const [recentNotices, setRecentNotices] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      databaseService.listAllProfiles(),
      databaseService.listCompetencies(),
      databaseService.listJobRoles(),
      databaseService.listAllCourses(),
      databaseService.listEnrollments(),
      databaseService.listAssessments(),
      databaseService.listCertificates(),
      databaseService.listNotifications(),
    ])
      .then(([profiles, comps, roles, courses, enrollments, assessments, certs, notices]) => {
        setCounts({
          users: profiles.length,
          pendingTrainers: profiles.filter(
            (p) => p.role === 'trainer' && p.approval_status === 'pending'
          ).length,
          competencies: comps.length,
          jobRoles: roles.length,
          courses: courses.length,
          enrollments: enrollments.filter((e) => e.status !== 'withdrawn').length,
          assessments: assessments.length,
          certificates: certs.filter((c) => c.status === 'verified').length,
        });
        setRecentNotices(notices.slice(0, 5));
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to fetch portal counts.');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Admin Dashboard</h1>
        <p className="text-sm text-slate-600 mt-1">
          Live PostgreSQL oversight across accounts, trainer approvals, competency standards, and enrolments.
        </p>
      </div>

      {error && <StatusBanner tone="error" title="Database Query Error" description={error} />}

      {counts.pendingTrainers > 0 && (
        <StatusBanner
          tone="warning"
          title={`${counts.pendingTrainers} Trainer Application(s) Awaiting Approval`}
          description="Review submitted faculty credentials and approve or decline pending Trainer accounts."
          action={
            <Link
              to="/dashboard/admin/trainer-approval"
              className="inline-flex items-center justify-center min-h-[38px] px-4 py-1.5 text-xs font-semibold rounded-md bg-[#0B1F3A] text-white hover:bg-[#122E53] whitespace-nowrap"
            >
              Review Applications
            </Link>
          }
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Registered Accounts</p>
          <p className="font-display text-2xl font-bold text-[#0B1F3A] mt-1 tabular-nums">
            {loading ? '—' : counts.users}
          </p>
          <p className="text-xs text-amber-700 mt-1 tabular-nums">
            {loading ? '' : `${counts.pendingTrainers} pending trainers`}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Competencies &amp; Job Roles</p>
          <p className="font-display text-2xl font-bold text-[#0B1F3A] mt-1 tabular-nums">
            {loading ? '—' : `${counts.competencies} / ${counts.jobRoles}`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Framework entities</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Courses &amp; Enrolments</p>
          <p className="font-display text-2xl font-bold text-[#0F766E] mt-1 tabular-nums">
            {loading ? '—' : `${counts.courses} / ${counts.enrollments}`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Active delivery records</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Assessments &amp; Certificates</p>
          <p className="font-display text-2xl font-bold text-[#0B1F3A] mt-1 tabular-nums">
            {loading ? '—' : `${counts.assessments} / ${counts.certificates}`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Verification records</p>
        </Card>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 className="font-display text-sm font-semibold text-[#0B1F3A]">
            Portal Governance &amp; Master Administration
          </h2>
          <span className="text-xs text-slate-500">RBAC Scope: Admin</span>
        </div>
        <div className="divide-y divide-slate-200">
          {GOVERNANCE_SECTIONS.map((sec) => (
            <div
              key={sec.code}
              className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-medium text-[#0F766E]">{sec.code}</span>
                  <span className="font-display text-sm font-semibold text-slate-900">
                    {sec.title}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{sec.description}</p>
              </div>
              <Link
                to={sec.path}
                className="inline-flex items-center justify-center min-h-[38px] px-4 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-[#0B1F3A] hover:bg-slate-50 whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                {sec.label}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {recentNotices.length > 0 && (
        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-[#0B1F3A]">
              Recent Inquiries &amp; Announcements
            </h2>
            <Link
              to="/dashboard/admin/announcements"
              className="text-xs font-semibold text-[#0F766E] hover:text-[#0B1F3A]"
            >
              Manage All →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentNotices.map((n) => (
              <div key={n.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-[#0F766E]">{n.audience}</span>
                  <span>·</span>
                  <span className="font-mono">{formatShortDate(n.created_at)}</span>
                </div>
                <p className="text-sm font-medium text-slate-900 mt-0.5">{n.title}</p>
                <p className="text-xs text-slate-600 mt-0.5">{n.body}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
