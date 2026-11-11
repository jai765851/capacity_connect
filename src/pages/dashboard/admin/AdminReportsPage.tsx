import React, { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { CompetencyProgressBar } from '../../../components/competency/CompetencyProgressBar';
import { formatShortDate } from '../../../lib/formatters';
import { computeCompetencyGapReport } from '../../../services/competencyEngine';
import { databaseService } from '../../../services/databaseService';
import {
  AssessmentAttemptRecord,
  CertificateRecord,
  CompetencyRecord,
  CourseRecord,
  EnrollmentRecord,
  FeedbackRecord,
  JobRoleRecord,
  ProfileRecord,
  ProgressHistoryRecord,
  RoleRequirementRecord,
} from '../../../types/competency';

interface ReportExportRow {
  id: string;
  code: string;
  title: string;
  stageScope: string;
  sourceTables: string;
  recordCount: number;
  exportType: 'personnel' | 'enrolments' | 'assessments' | 'certificates' | 'skill_gaps';
}

interface DepartmentSummaryRow {
  department: string;
  trainees: number;
  enrolments: number;
  completedCourses: number;
  evaluatedAttempts: number;
  passedAttempts: number;
  verifiedCertificates: number;
}

interface AdminTraineeGapLedgerRow {
  key: string;
  traineeName: string;
  department: string;
  jobRoleLabel: string;
  competencyCode: string;
  competencyTitle: string;
  requiredScore: number;
  previousScore: number | null;
  currentScore: number | null;
  gapDelta: number;
  improvementPoints: number | null;
  gapClosurePercent: number | null;
  measuredSource: string;
  assessedByName: string | null;
  recordedDate: string | null;
}

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsvFile(filename: string, headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>): void {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function AdminReportsPage() {
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [competencies, setCompetencies] = useState<CompetencyRecord[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRoleRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [attempts, setAttempts] = useState<AssessmentAttemptRecord[]>([]);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [feedbackRows, setFeedbackRows] = useState<FeedbackRecord[]>([]);
  const [roleRequirements, setRoleRequirements] = useState<RoleRequirementRecord[]>([]);
  const [progressHistory, setProgressHistory] = useState<ProgressHistoryRecord[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      databaseService.listAllProfiles(),
      databaseService.listCompetencies(),
      databaseService.listJobRoles(),
      databaseService.listAllCourses(),
      databaseService.listEnrollments(),
      databaseService.listAssessmentAttempts(),
      databaseService.listCertificates(),
      databaseService.listFeedback(),
      databaseService.listRoleRequirements(),
      databaseService.listProgressHistory(),
    ])
      .then(([p, comp, jr, c, enr, att, cert, fb, reqs, ph]) => {
        setProfiles(p);
        setCompetencies(comp);
        setJobRoles(jr);
        setCourses(c);
        setEnrollments(enr);
        setAttempts(att);
        setCertificates(cert);
        setFeedbackRows(fb);
        setRoleRequirements(reqs);
        setProgressHistory(ph);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to aggregate reporting metrics.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const departments = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach((p) => {
      if (p.department.trim()) set.add(p.department.trim());
    });
    jobRoles.forEach((r) => {
      if (r.department.trim()) set.add(r.department.trim());
    });
    return Array.from(set).sort();
  }, [profiles, jobRoles]);

  const scopedData = useMemo(() => {
    const matchDept = (dept?: string | null) =>
      departmentFilter === 'All Departments' || (dept ?? '').trim() === departmentFilter;

    const scopedProfiles = profiles.filter((p) => matchDept(p.department));
    const scopedTraineeIds = new Set(scopedProfiles.map((p) => p.id));

    const scopedEnrollments = enrollments.filter(
      (e) => departmentFilter === 'All Departments' || scopedTraineeIds.has(e.trainee_id)
    );
    const scopedAttempts = attempts.filter(
      (a) => departmentFilter === 'All Departments' || scopedTraineeIds.has(a.trainee_id)
    );
    const scopedCertificates = certificates.filter(
      (c) => departmentFilter === 'All Departments' || scopedTraineeIds.has(c.trainee_id)
    );

    return {
      scopedProfiles,
      scopedEnrollments,
      scopedAttempts,
      scopedCertificates,
    };
  }, [profiles, enrollments, attempts, certificates, departmentFilter]);

  const departmentSummaries: DepartmentSummaryRow[] = useMemo(() => {
    const deptNames =
      departmentFilter === 'All Departments'
        ? departments
        : departments.filter((d) => d === departmentFilter);

    return deptNames.map((dept) => {
      const deptTrainees = profiles.filter(
        (p) => p.role === 'trainee' && p.department.trim() === dept
      );
      const ids = new Set(deptTrainees.map((t) => t.id));
      const deptEnr = enrollments.filter((e) => ids.has(e.trainee_id) && e.status !== 'withdrawn');
      const deptAtt = attempts.filter((a) => ids.has(a.trainee_id) && a.status === 'evaluated');
      const deptCerts = certificates.filter((c) => ids.has(c.trainee_id) && c.status === 'verified');

      return {
        department: dept,
        trainees: deptTrainees.length,
        enrolments: deptEnr.length,
        completedCourses: deptEnr.filter((e) => e.status === 'completed').length,
        evaluatedAttempts: deptAtt.length,
        passedAttempts: deptAtt.filter((a) => a.passed).length,
        verifiedCertificates: deptCerts.length,
      };
    });
  }, [departments, departmentFilter, profiles, enrollments, attempts, certificates]);

  const gapLedgerRows: AdminTraineeGapLedgerRow[] = useMemo(() => {
    const trainees = scopedData.scopedProfiles.filter(
      (p) => p.role === 'trainee' && p.job_role_id
    );
    const items: AdminTraineeGapLedgerRow[] = [];

    for (const trainee of trainees) {
      const roleReqs = roleRequirements.filter((r) => r.job_role_id === trainee.job_role_id);
      if (roleReqs.length === 0) continue;

      const traineeHistory = progressHistory.filter((ph) => ph.trainee_id === trainee.id);
      const { rows } = computeCompetencyGapReport({
        requirements: roleReqs,
        progressHistory: traineeHistory,
        courses,
      });

      for (const row of rows) {
        items.push({
          key: `${trainee.id}-${row.competencyId}`,
          traineeName: trainee.full_name,
          department: trainee.department || 'Unassigned',
          jobRoleLabel: trainee.job_role ? `${trainee.job_role.code} — ${trainee.job_role.title}` : 'Assigned Role',
          competencyCode: row.competencyCode,
          competencyTitle: row.competencyTitle,
          requiredScore: row.requiredScore,
          previousScore: row.previousScore,
          currentScore: row.currentScore,
          gapDelta: row.gapDelta,
          improvementPoints: row.improvementPoints,
          gapClosurePercent: row.gapClosurePercent,
          measuredSource: row.measuredSource,
          assessedByName: row.assessedByName,
          recordedDate: row.lastAssessedAt ? formatShortDate(row.lastAssessedAt) : null,
        });
      }
    }

    return items;
  }, [scopedData.scopedProfiles, roleRequirements, progressHistory, courses]);

  const reportDefinitions: ReportExportRow[] = useMemo(() => {
    const templates: ReportExportRow[] = [
      {
        id: 'rep-01',
        code: 'RPT-USR-01',
        title: 'Departmental Personnel & Job Role Roster',
        stageScope: 'Stages 01–03',
        sourceTables: 'profiles, job_roles',
        recordCount: scopedData.scopedProfiles.length,
        exportType: 'personnel',
      },
      {
        id: 'rep-02',
        code: 'RPT-TRN-02',
        title: 'Training Enrolment & Completion Ledger',
        stageScope: 'Stage 04',
        sourceTables: 'enrollments, courses, trainer_assignments',
        recordCount: scopedData.scopedEnrollments.length,
        exportType: 'enrolments',
      },
      {
        id: 'rep-03',
        code: 'RPT-ASM-03',
        title: 'Assessment Attempts & Proficiency Evaluation Ledger',
        stageScope: 'Stages 02 & 05',
        sourceTables: 'assessment_attempts, assessments',
        recordCount: scopedData.scopedAttempts.length,
        exportType: 'assessments',
      },
      {
        id: 'rep-04',
        code: 'RPT-CRT-04',
        title: 'Verified Certificates Register',
        stageScope: 'Stage 05',
        sourceTables: 'certificates, courses, profiles',
        recordCount: scopedData.scopedCertificates.length,
        exportType: 'certificates',
      },
      {
        id: 'rep-05',
        code: 'RPT-GAP-05',
        title: 'Skill Gap & Competency Improvement Ledger',
        stageScope: 'Stages 01–05',
        sourceTables: 'role_requirements, progress_history, job_roles',
        recordCount: gapLedgerRows.length,
        exportType: 'skill_gaps',
      },
    ];

    const q = search.trim().toLowerCase();
    return templates.filter(
      (r) =>
        !q ||
        r.code.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.sourceTables.toLowerCase().includes(q)
    );
  }, [scopedData, gapLedgerRows.length, search]);

  const handleExport = (report: ReportExportRow) => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (report.exportType === 'personnel') {
      downloadCsvFile(
        `capacity-connect-personnel-${stamp}.csv`,
        ['Full Name', 'Email', 'Role', 'Approval Status', 'Account Status', 'Department', 'Designation', 'Assigned Job Role', 'Created Date'],
        scopedData.scopedProfiles.map((p) => [
          p.full_name,
          p.email,
          p.role,
          p.approval_status,
          p.account_status,
          p.department,
          p.designation,
          p.job_role ? `${p.job_role.code} — ${p.job_role.title}` : '',
          formatShortDate(p.created_at),
        ])
      );
    } else if (report.exportType === 'enrolments') {
      downloadCsvFile(
        `capacity-connect-enrolments-${stamp}.csv`,
        ['Trainee', 'Department', 'Course Code', 'Course Title', 'Competency', 'Cohort', 'Progress (%)', 'Status', 'Enrolled Date'],
        scopedData.scopedEnrollments.map((e) => [
          e.trainee?.full_name ?? '',
          e.trainee?.department ?? '',
          e.course?.code ?? '',
          e.course?.title ?? '',
          e.competency?.code ?? '',
          e.trainer_assignment?.cohort_code ?? '',
          e.progress_percent,
          e.status,
          formatShortDate(e.enrolled_at),
        ])
      );
    } else if (report.exportType === 'assessments') {
      downloadCsvFile(
        `capacity-connect-assessments-${stamp}.csv`,
        ['Assessment Code', 'Assessment Title', 'Stage', 'Trainee', 'Department', 'Status', 'Score (%)', 'Achieved Level', 'Passed', 'Submitted Date'],
        scopedData.scopedAttempts.map((a) => [
          a.assessment?.code ?? '',
          a.assessment?.title ?? '',
          a.assessment?.assessment_type ?? '',
          a.trainee?.full_name ?? '',
          a.trainee?.department ?? '',
          a.status,
          a.score_percent ?? '',
          a.achieved_level ?? '',
          a.passed === null ? '' : a.passed ? 'Yes' : 'No',
          formatShortDate(a.submitted_at ?? a.started_at),
        ])
      );
    } else if (report.exportType === 'skill_gaps') {
      downloadCsvFile(
        `capacity-connect-skill-gaps-${stamp}.csv`,
        ['Trainee', 'Department', 'Job Role', 'Competency Code', 'Competency Title', 'Required Score', 'Previous Score', 'Current Score', 'Skill Gap', 'Improvement (pts)', 'Gap Closure (%)', 'Source', 'Assessor', 'Recorded Date'],
        gapLedgerRows.map((g) => [
          g.traineeName,
          g.department,
          g.jobRoleLabel,
          g.competencyCode,
          g.competencyTitle,
          g.requiredScore,
          g.previousScore ?? '',
          g.currentScore ?? '',
          g.gapDelta,
          g.improvementPoints ?? '',
          g.gapClosurePercent ?? '',
          g.measuredSource,
          g.assessedByName ?? '',
          g.recordedDate ?? '',
        ])
      );
    } else {
      downloadCsvFile(
        `capacity-connect-certificates-${stamp}.csv`,
        ['Certificate Code', 'Trainee', 'Department', 'Course Code', 'Course Title', 'Verified By', 'Status', 'Issued Date'],
        scopedData.scopedCertificates.map((c) => [
          c.certificate_code,
          c.trainee?.full_name ?? '',
          c.trainee?.department ?? '',
          c.course?.code ?? '',
          c.course?.title ?? '',
          c.verifier?.full_name ?? '',
          c.status,
          formatShortDate(c.issued_at),
        ])
      );
    }
    setNotice(
      `Exported ${report.recordCount} live PostgreSQL record(s) from "${report.title}".`
    );
  };

  const reportColumns: DataColumn<ReportExportRow>[] = [
    {
      key: 'code',
      header: 'Report Code',
      render: (row) => <span className="font-mono text-xs text-[#0F766E]">{row.code}</span>,
    },
    {
      key: 'title',
      header: 'Report Specification',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.title}</p>
          <p className="font-mono text-xs text-slate-500 mt-0.5">{row.sourceTables}</p>
        </div>
      ),
    },
    {
      key: 'scope',
      header: 'Lifecycle Scope',
      render: (row) => <span className="text-xs text-slate-700">{row.stageScope}</span>,
    },
    {
      key: 'count',
      header: 'Live Records',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
          {row.recordCount}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'CSV Export',
      align: 'right',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading || row.recordCount === 0}
          onClick={() => handleExport(row)}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </Button>
      ),
    },
  ];

  const deptColumns: DataColumn<DepartmentSummaryRow>[] = [
    {
      key: 'dept',
      header: 'Department',
      render: (row) => <span className="font-medium text-slate-900">{row.department}</span>,
    },
    {
      key: 'trainees',
      header: 'Trainees',
      align: 'right',
      render: (row) => <span className="font-mono tabular-nums">{row.trainees}</span>,
    },
    {
      key: 'enrolments',
      header: 'Active Enrolments',
      align: 'right',
      render: (row) => <span className="font-mono tabular-nums">{row.enrolments}</span>,
    },
    {
      key: 'completed',
      header: 'Completed Courses',
      align: 'right',
      render: (row) => <span className="font-mono tabular-nums text-[#0F766E]">{row.completedCourses}</span>,
    },
    {
      key: 'eval',
      header: 'Passed / Evaluated',
      align: 'right',
      render: (row) => (
        <span className="font-mono tabular-nums">
          {row.passedAttempts} / {row.evaluatedAttempts}
        </span>
      ),
    },
    {
      key: 'certs',
      header: 'Certificates',
      align: 'right',
      render: (row) => <span className="font-mono tabular-nums">{row.verifiedCertificates}</span>,
    },
  ];

  const gapColumns: DataColumn<AdminTraineeGapLedgerRow>[] = [
    {
      key: 'trainee',
      header: 'Trainee & Job Role',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.traineeName}</p>
          <p className="text-xs text-slate-500">
            {row.department} · {row.jobRoleLabel}
          </p>
        </div>
      ),
    },
    {
      key: 'competency',
      header: 'Competency',
      render: (row) => (
        <div>
          <span className="font-mono text-xs text-[#0F766E]">{row.competencyCode}</span>
          <p className="text-xs text-slate-800">{row.competencyTitle}</p>
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Score vs. Required (0–100)',
      render: (row) => (
        <CompetencyProgressBar
          currentScore={row.currentScore}
          requiredScore={row.requiredScore}
          previousScore={row.previousScore}
          compact
        />
      ),
    },
    {
      key: 'gap',
      header: 'Skill Gap',
      align: 'right',
      render: (row) => (
        <span
          className={`font-mono text-xs font-semibold tabular-nums ${
            row.currentScore === null
              ? 'text-slate-500'
              : row.gapDelta === 0
              ? 'text-[#0F766E]'
              : row.gapDelta <= 15
              ? 'text-amber-700'
              : 'text-red-700'
          }`}
        >
          {row.currentScore === null ? 'Pending' : `${row.gapDelta} pts`}
        </span>
      ),
    },
    {
      key: 'improvement',
      header: 'Reassessment Delta',
      align: 'right',
      render: (row) =>
        row.improvementPoints !== null ? (
          <div className="font-mono text-xs tabular-nums">
            <span className={row.improvementPoints >= 0 ? 'font-semibold text-[#0F766E]' : 'text-red-700'}>
              {row.improvementPoints > 0 ? `+${row.improvementPoints}` : row.improvementPoints} pts
            </span>
            {row.gapClosurePercent !== null && (
              <span className="block text-[11px] text-slate-500">{row.gapClosurePercent}% gap closed</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400">Baseline only</span>
        ),
    },
  ];

  const activeEnrolmentsCount = scopedData.scopedEnrollments.filter(
    (e) => e.status !== 'withdrawn'
  ).length;
  const completedCount = scopedData.scopedEnrollments.filter(
    (e) => e.status === 'completed'
  ).length;
  const evaluatedCount = scopedData.scopedAttempts.filter(
    (a) => a.status === 'evaluated'
  ).length;
  const passedCount = scopedData.scopedAttempts.filter(
    (a) => a.status === 'evaluated' && a.passed
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Reports</h1>
        <p className="text-sm text-slate-600 mt-1">
          Live institutional readiness metrics and downloadable CSV exports aggregated directly from
          PostgreSQL.
        </p>
      </div>

      {error && <StatusBanner tone="error" title="Reporting Query Error" description={error} />}
      {notice && <StatusBanner tone="success" title="CSV Generated" description={notice} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Personnel in Scope</p>
          <p className="font-display text-2xl font-bold text-[#0B1F3A] mt-1 tabular-nums">
            {isLoading ? '—' : scopedData.scopedProfiles.length}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {isLoading ? '' : `${competencies.length} competencies · ${courses.length} courses`}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Course Completion</p>
          <p className="font-display text-2xl font-bold text-[#0F766E] mt-1 tabular-nums">
            {isLoading
              ? '—'
              : activeEnrolmentsCount > 0
              ? `${Math.round((completedCount / activeEnrolmentsCount) * 100)}%`
              : '0%'}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {isLoading ? '' : `${completedCount} of ${activeEnrolmentsCount} active enrolments`}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Assessment Benchmark Pass</p>
          <p className="font-display text-2xl font-bold text-[#0B1F3A] mt-1 tabular-nums">
            {isLoading
              ? '—'
              : evaluatedCount > 0
              ? `${Math.round((passedCount / evaluatedCount) * 100)}%`
              : '0%'}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {isLoading ? '' : `${passedCount} of ${evaluatedCount} evaluated`}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Certificates &amp; Feedback</p>
          <p className="font-display text-2xl font-bold text-[#0B1F3A] mt-1 tabular-nums">
            {isLoading
              ? '—'
              : `${scopedData.scopedCertificates.filter((c) => c.status === 'verified').length} / ${feedbackRows.length}`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Verified certs / feedback entries</p>
        </Card>
      </div>

      <WorkspaceFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search exportable report registers..."
        rightSlot={
          <select
            aria-label="Filter report scope by department"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
          >
            <option value="All Departments">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        }
      />

      <DataTable
        columns={reportColumns}
        rows={reportDefinitions}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No report templates match your search"
        emptyDescription="Clear the search field to inspect all live export registers."
      />

      <div className="space-y-3">
        <h2 className="font-display text-base font-semibold text-[#0B1F3A]">
          Trainee Competency Gap &amp; Reassessment Ledger
        </h2>
        <DataTable
          columns={gapColumns}
          rows={gapLedgerRows}
          rowKey={(row) => row.key}
          isLoading={isLoading}
          emptyTitle="No mapped trainee skill gaps computed yet"
          emptyDescription="Assign Job Roles with Role Requirements to Trainees and record baseline or reassessment scores to track live competency improvements."
        />
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-base font-semibold text-[#0B1F3A]">
          Departmental Capacity Summary
        </h2>
        <DataTable
          columns={deptColumns}
          rows={departmentSummaries}
          rowKey={(row) => row.department}
          isLoading={isLoading}
          emptyTitle="No departmental profile records yet"
          emptyDescription="Once users register or are provisioned with department designations, summaries calculate automatically here."
        />
      </div>
    </div>
  );
}
