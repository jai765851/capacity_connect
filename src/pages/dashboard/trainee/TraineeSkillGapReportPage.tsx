import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { CompetencyImprovementSection } from '../../../components/competency/CompetencyImprovementSection';
import { CompetencyProgressBar } from '../../../components/competency/CompetencyProgressBar';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { useAuth } from '../../../context/AuthContext';
import { databaseService } from '../../../services/databaseService';
import {
  CompetencyAnalysisSummary,
  JobRoleRecord,
  MatchedCourseRecommendation,
  SkillGapComputedRow,
} from '../../../types/competency';

const EMPTY_SUMMARY: CompetencyAnalysisSummary = {
  totalRequired: 0,
  assessedCount: 0,
  metCount: 0,
  openGapCount: 0,
  averageRequiredScore: 0,
  averageCurrentScore: null,
  averageGapPoints: 0,
  readinessPercent: 0,
  reassessedCount: 0,
  averageImprovementPoints: null,
};

export function TraineeSkillGapReportPage() {
  const { currentUser } = useAuth();
  const [jobRoles, setJobRoles] = useState<JobRoleRecord[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(currentUser?.jobRoleId ?? '');
  const [gapRows, setGapRows] = useState<SkillGapComputedRow[]>([]);
  const [summary, setSummary] = useState<CompetencyAnalysisSummary>(EMPTY_SUMMARY);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolNotice, setEnrolNotice] = useState<string | null>(null);
  const [enrollingKey, setEnrollingKey] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  useEffect(() => {
    if (currentUser?.jobRoleId && !selectedRoleId) {
      setSelectedRoleId(currentUser.jobRoleId);
    }
  }, [currentUser?.jobRoleId]);

  useEffect(() => {
    databaseService
      .listJobRoles()
      .then((roles) => {
        setJobRoles(roles);
        if (!currentUser?.jobRoleId && roles.length > 0 && !selectedRoleId) {
          setSelectedRoleId(roles[0].id);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to fetch job roles.');
      });
  }, []);

  useEffect(() => {
    if (!currentUser || !selectedRoleId) {
      setIsLoading(false);
      setGapRows([]);
      setSummary(EMPTY_SUMMARY);
      return;
    }

    let active = true;
    setIsLoading(true);
    Promise.all([
      databaseService.listRoleRequirements(selectedRoleId),
      databaseService.listProgressHistory(currentUser.id),
      databaseService.listPublishedCourses(),
      databaseService.listVerifiedTrainersForMatching(),
      databaseService.listActiveTrainerAssignments(),
      databaseService.listEnrollments({ traineeId: currentUser.id }),
    ])
      .then(([reqs, progress, courses, trainers, activeAssignments, enrollments]) => {
        if (!active) return;
        const computed = databaseService.computeCompetencyReport({
          requirements: reqs,
          progressHistory: progress,
          courses,
          trainers,
          activeAssignments,
        });
        setGapRows(computed.rows);
        setSummary(computed.summary);
        setEnrolledCourseIds(
          new Set(enrollments.filter((e) => e.status !== 'withdrawn').map((e) => e.course_id))
        );
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to compute skill gap.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser?.id, selectedRoleId]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return gapRows.filter((row) => {
      const matchesStatus = statusFilter === 'All' || row.status === statusFilter;
      const matchesSearch =
        !q ||
        row.competencyCode.toLowerCase().includes(q) ||
        row.competencyTitle.toLowerCase().includes(q) ||
        row.domain.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [gapRows, search, statusFilter]);

  const handleAssignRecommendedCourse = async (
    course: MatchedCourseRecommendation,
    competencyId: string,
    competencyCode: string,
    gapDelta: number
  ) => {
    if (!currentUser) return;
    setEnrollingKey(`${competencyId}-${course.id}`);
    setError(null);
    try {
      await databaseService.enrollInCourse({
        trainee_id: currentUser.id,
        course_id: course.id,
        trainer_assignment_id: course.activeAssignmentId,
        mapped_competency_id: competencyId,
        assignment_reason: `Skill Gap Remediation (${competencyCode} gap: ${gapDelta} pts)`,
        status: 'in_progress',
      });
      setEnrolledCourseIds((prev) => new Set([...prev, course.id]));
      setEnrolNotice(
        `Enrolled in ${course.code} — ${course.title}${
          course.cohortCode ? ` (Cohort ${course.cohortCode})` : ''
        } for competency gap closure.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enrol in recommended course.');
    } finally {
      setEnrollingKey(null);
    }
  };

  const columns: DataColumn<SkillGapComputedRow>[] = [
    {
      key: 'title',
      header: 'Competency Requirement',
      render: (row) => (
        <div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-[#0F766E]">{row.competencyCode}</span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="capitalize text-slate-500">{row.priority}</span>
          </div>
          <p className="font-medium text-slate-900 mt-0.5">{row.competencyTitle}</p>
          <p className="text-xs text-slate-500">{row.domain}</p>
        </div>
      ),
    },
    {
      key: 'required',
      header: 'Required',
      align: 'right',
      render: (row) => (
        <div className="text-right font-mono tabular-nums">
          <p className="font-semibold text-slate-900">{row.requiredScore}/100</p>
          <p className="text-[11px] text-slate-500">Level {row.requiredLevel}</p>
        </div>
      ),
    },
    {
      key: 'measured',
      header: 'Current Score',
      align: 'right',
      render: (row) => (
        <div className="text-right font-mono tabular-nums">
          <p className="font-semibold text-[#0B1F3A]">
            {row.currentScore === null ? '—' : `${row.currentScore}/100`}
          </p>
          <p className="text-[11px] text-slate-500 font-sans">
            {row.measuredSource}
            {row.assessedByName ? ` · ${row.assessedByName}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'delta',
      header: 'Skill Gap',
      align: 'right',
      render: (row) => (
        <span
          className={`font-mono tabular-nums font-semibold ${
            row.currentScore === null
              ? 'text-slate-500'
              : row.gapDelta === 0
              ? 'text-[#0F766E]'
              : row.gapDelta <= 15
              ? 'text-amber-700'
              : 'text-red-700'
          }`}
        >
          {row.currentScore === null ? 'Pending' : row.gapDelta > 0 ? `${row.gapDelta} pts` : '0 pts'}
        </span>
      ),
    },
    {
      key: 'progress',
      header: 'Benchmark Progress',
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
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={`text-xs font-semibold whitespace-nowrap ${
            row.status === 'Critical Gap'
              ? 'text-red-700'
              : row.status === 'Minor Gap' || row.status === 'Assessment Pending'
              ? 'text-amber-700'
              : 'text-[#0F766E]'
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: 'recommendation',
      header: 'Recommended Training & Verified Faculty',
      render: (row) => {
        if (row.gapDelta === 0 && row.currentScore !== null) {
          return <span className="text-xs font-medium text-[#0F766E]">Benchmark Met</span>;
        }
        const topCourse = row.recommendedCourses[0];
        const facultyNames =
          topCourse && topCourse.matchedTrainers.length > 0
            ? topCourse.matchedTrainers.slice(0, 2)
            : row.matchedTrainers.slice(0, 2);

        return (
          <div className="space-y-1.5 min-w-[200px]">
            {!topCourse ? (
              <p className="text-xs text-slate-500">No published course mapped yet</p>
            ) : enrolledCourseIds.has(topCourse.id) ? (
              <div className="space-y-0.5">
                <Link
                  to="/dashboard/trainee/enrolments"
                  className="text-xs font-semibold text-[#0F766E] hover:text-[#0B1F3A] inline-flex items-center gap-1"
                >
                  <span>Enrolled ({topCourse.code})</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
                <p className="text-[11px] text-slate-500">{topCourse.title}</p>
              </div>
            ) : (
              <div className="space-y-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={enrollingKey === `${row.competencyId}-${topCourse.id}`}
                  onClick={() =>
                    handleAssignRecommendedCourse(
                      topCourse,
                      row.competencyId,
                      row.competencyCode,
                      row.gapDelta
                    )
                  }
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>
                    {enrollingKey === `${row.competencyId}-${topCourse.id}`
                      ? 'Enrolling...'
                      : `Enrol ${topCourse.code}`}
                  </span>
                </Button>
                <p className="text-[11px] text-slate-600 leading-snug">
                  {topCourse.title} ({topCourse.matchReason})
                </p>
              </div>
            )}

            {facultyNames.length > 0 && (
              <div className="text-[11px] text-slate-500 pt-0.5">
                <span className="font-medium text-slate-700">Verified Trainer: </span>
                {facultyNames.map((t) => `${t.fullName} (${t.credential})`).join(', ')}
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Skill Gap Report</h1>
          <p className="text-sm text-slate-600 mt-1">
            Computes live competency deficits using Skill Gap = max(0, Required Score - Current
            Score), matches courses &amp; verified trainers, and tracks post-training improvement.
          </p>
        </div>

        <Link
          to="/dashboard/trainee/assessments"
          className="inline-flex items-center justify-center min-h-[38px] px-4 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-[#0B1F3A] hover:bg-slate-50 whitespace-nowrap self-start"
        >
          Go to Post-Training Reassessments →
        </Link>
      </div>

      {error && <StatusBanner tone="error" title="Computation Error" description={error} />}
      {enrolNotice && <StatusBanner tone="success" title="Course Enrolled" description={enrolNotice} />}

      {!currentUser?.jobRoleId && (
        <StatusBanner
          tone="info"
          title="Select a Job Role for Your Profile"
          description="You can inspect role benchmarks below, or permanently bind your organisational Job Role under Profile."
        />
      )}

      {/* Quantitative Engine KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Role Benchmark Readiness</p>
          <p className="font-display text-2xl font-bold text-[#0F766E] mt-1 tabular-nums">
            {isLoading ? '—' : `${summary.readinessPercent}%`}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {isLoading ? '' : `${summary.metCount} of ${summary.totalRequired} targets met`}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Assessed Competencies</p>
          <p className="font-display text-2xl font-bold text-[#0B1F3A] mt-1 tabular-nums">
            {isLoading ? '—' : `${summary.assessedCount}/${summary.totalRequired}`}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {summary.averageCurrentScore !== null
              ? `Avg score ${summary.averageCurrentScore}/100`
              : 'Awaiting baseline'}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Open Skill Gaps</p>
          <p className="font-display text-2xl font-bold text-[#0B1F3A] mt-1 tabular-nums">
            {isLoading ? '—' : summary.openGapCount}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {isLoading ? '' : `Avg gap ${summary.averageGapPoints} pts`}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-slate-500">Reassessment Improvement</p>
          <p className="font-display text-2xl font-bold text-[#0F766E] mt-1 tabular-nums">
            {isLoading
              ? '—'
              : summary.averageImprovementPoints !== null
              ? `${summary.averageImprovementPoints >= 0 ? '+' : ''}${summary.averageImprovementPoints} pts`
              : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {isLoading ? '' : `${summary.reassessedCount} competencies reassessed`}
          </p>
        </Card>
      </div>

      <WorkspaceFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search competency code or domain..."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Job Role Benchmark"
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
            >
              <option value="">-- Select Role Benchmark --</option>
              {jobRoles.map((jr) => (
                <option key={jr.id} value={jr.id}>
                  {jr.code} — {jr.title}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by gap classification"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
            >
              <option value="All">All Classifications</option>
              <option value="Critical Gap">Critical Gap</option>
              <option value="Minor Gap">Minor Gap</option>
              <option value="Assessment Pending">Assessment Pending</option>
              <option value="Met / Exceeded">Met / Exceeded</option>
            </select>
          </div>
        }
      />

      <DataTable
        columns={columns}
        rows={filteredRows}
        rowKey={(row) => row.competencyId}
        isLoading={isLoading}
        emptyTitle="No competency requirements defined for this Job Role"
        emptyDescription="Administrators map competencies and target scores (0–100) to Job Roles in `role_requirements`."
      />

      <CompetencyImprovementSection rows={gapRows} />
    </div>
  );
}
