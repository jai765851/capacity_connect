import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckSquare, ClipboardCheck } from 'lucide-react';
import { CompetencyImprovementSection } from '../../../components/competency/CompetencyImprovementSection';
import { CompetencyProgressBar } from '../../../components/competency/CompetencyProgressBar';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { SelectField, TextField, TextareaField } from '../../../components/ui/FormField';
import { ModalDrawer } from '../../../components/ui/ModalDrawer';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { useAuth } from '../../../context/AuthContext';
import { formatDateTime } from '../../../lib/formatters';
import {
  clampScore,
  computeCompetencyGapReport,
  scoreToProficiencyLevel,
} from '../../../services/competencyEngine';
import { databaseService, deriveSkillLevelFromScore } from '../../../services/databaseService';
import {
  AssessmentAttemptRecord,
  AssessmentQuestionRecord,
  CourseRecord,
  JobRoleRecord,
  ProfileRecord,
  ProgressHistoryRecord,
  PublicTrainerDirectoryItem,
  RoleRequirementRecord,
  TrainerAssignmentRecord,
} from '../../../types/competency';

export function TrainerPerformancePage() {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const queryTraineeId = searchParams.get('traineeId') ?? '';

  const [activeTab, setActiveTab] = useState<'competency' | 'attempts'>('competency');

  // Shared metadata
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Authorised Competency Assessment state (Steps 3, 4, 8, 9, 10)
  const [trainees, setTrainees] = useState<ProfileRecord[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRoleRecord[]>([]);
  const [roleRequirements, setRoleRequirements] = useState<RoleRequirementRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [verifiedTrainers, setVerifiedTrainers] = useState<PublicTrainerDirectoryItem[]>([]);
  const [activeAssignments, setActiveAssignments] = useState<TrainerAssignmentRecord[]>([]);

  const [selectedTraineeId, setSelectedTraineeId] = useState<string>(queryTraineeId);
  const [overrideRoleId, setOverrideRoleId] = useState<string>('');
  const [traineeHistory, setTraineeHistory] = useState<ProgressHistoryRecord[]>([]);
  const [loadingTraineeHistory, setLoadingTraineeHistory] = useState(false);

  const [assessmentStage, setAssessmentStage] = useState<'skill_assessment' | 'reassessment'>(
    'skill_assessment'
  );
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [savingScores, setSavingScores] = useState(false);

  // Assessment Attempts Review Queue state
  const [attempts, setAttempts] = useState<AssessmentAttemptRecord[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [evalTarget, setEvalTarget] = useState<AssessmentAttemptRecord | null>(null);
  const [evalQuestions, setEvalQuestions] = useState<AssessmentQuestionRecord[]>([]);
  const [scorePercent, setScorePercent] = useState<number>(80);
  const [achievedLevel, setAchievedLevel] = useState<number>(4);
  const [passed, setPassed] = useState<boolean>(true);
  const [evaluatorNotes, setEvaluatorNotes] = useState('');
  const [issueCert, setIssueCert] = useState<boolean>(false);
  const [evaluating, setEvaluating] = useState(false);

  const loadWorkspaceData = async () => {
    setIsLoading(true);
    try {
      const [
        traineeRows,
        roleRows,
        reqRows,
        courseRows,
        trainerRows,
        assignmentRows,
        attemptRows,
      ] = await Promise.all([
        databaseService.listTraineesWithRoles(),
        databaseService.listJobRoles(),
        databaseService.listRoleRequirements(),
        databaseService.listPublishedCourses(),
        databaseService.listVerifiedTrainersForMatching(),
        databaseService.listActiveTrainerAssignments(),
        databaseService.listAssessmentAttempts(),
      ]);

      setTrainees(traineeRows);
      setJobRoles(roleRows);
      setRoleRequirements(reqRows);
      setCourses(courseRows);
      setVerifiedTrainers(trainerRows);
      setActiveAssignments(assignmentRows);
      setAttempts(attemptRows);

      if (queryTraineeId && traineeRows.some((t) => t.id === queryTraineeId)) {
        setSelectedTraineeId(queryTraineeId);
      } else if (!selectedTraineeId && traineeRows.length > 0) {
        setSelectedTraineeId(traineeRows[0].id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load trainer assessment workspace.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  const selectedTrainee = useMemo(
    () => trainees.find((t) => t.id === selectedTraineeId) ?? null,
    [trainees, selectedTraineeId]
  );

  useEffect(() => {
    if (selectedTrainee?.job_role_id) {
      setOverrideRoleId(selectedTrainee.job_role_id);
    } else if (jobRoles.length > 0 && !overrideRoleId) {
      setOverrideRoleId(jobRoles[0].id);
    }
  }, [selectedTrainee?.id, selectedTrainee?.job_role_id, jobRoles]);

  const loadSelectedTraineeHistory = async (traineeId: string) => {
    if (!traineeId) {
      setTraineeHistory([]);
      return;
    }
    setLoadingTraineeHistory(true);
    try {
      const historyRows = await databaseService.listProgressHistory(traineeId);
      setTraineeHistory(historyRows);
      setScoreInputs({});
      setNoteInputs({});
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load trainee competency history.');
    } finally {
      setLoadingTraineeHistory(false);
    }
  };

  useEffect(() => {
    if (selectedTraineeId) {
      loadSelectedTraineeHistory(selectedTraineeId);
    }
  }, [selectedTraineeId]);

  const effectiveRoleId = selectedTrainee?.job_role_id || overrideRoleId;

  const activeRequirements = useMemo(
    () => roleRequirements.filter((r) => r.job_role_id === effectiveRoleId),
    [roleRequirements, effectiveRoleId]
  );

  const computedReport = useMemo(() => {
    return computeCompetencyGapReport({
      requirements: activeRequirements,
      progressHistory: traineeHistory,
      courses,
      trainers: verifiedTrainers,
      activeAssignments,
    });
  }, [activeRequirements, traineeHistory, courses, verifiedTrainers, activeAssignments]);

  // Suggest reassessment stage automatically if the trainee already has baseline assessments
  useEffect(() => {
    const hasBaselines = computedReport.rows.some((r) => r.baselineScore !== null);
    setAssessmentStage(hasBaselines ? 'reassessment' : 'skill_assessment');
  }, [selectedTraineeId, traineeHistory.length]);

  const handleSaveAuthorisedScores = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedTrainee) return;

    const entriesToRecord: Array<{
      competencyId: string;
      skillCode: string;
      skillName: string;
      domain: string;
      recordedScore: number;
      targetScore: number | null;
      notes: string;
    }> = [];

    for (const row of computedReport.rows) {
      const rawVal = (scoreInputs[row.competencyId] ?? '').trim();
      if (rawVal === '') continue;
      const numeric = Number(rawVal);
      if (Number.isNaN(numeric)) {
        setError(`Enter a valid numeric score (0–100) for ${row.competencyCode}.`);
        return;
      }
      entriesToRecord.push({
        competencyId: row.competencyId,
        skillCode: row.competencyCode,
        skillName: row.competencyTitle,
        domain: row.domain,
        recordedScore: clampScore(numeric),
        targetScore: row.requiredScore,
        notes: noteInputs[row.competencyId] ?? '',
      });
    }

    if (entriesToRecord.length === 0) {
      setError('Enter at least one competency score (0–100) before saving.');
      return;
    }

    setSavingScores(true);
    setError(null);
    setNotice(null);
    try {
      await databaseService.recordTrainerCompetencyAssessment({
        traineeId: selectedTrainee.id,
        trainerId: currentUser.id,
        stage: assessmentStage,
        entries: entriesToRecord,
      });

      const stageName =
        assessmentStage === 'reassessment'
          ? 'Post-Training Reassessment'
          : 'Authorised Baseline Assessment';

      setNotice(
        `${stageName} recorded for ${selectedTrainee.full_name} across ${entriesToRecord.length} competenc${
          entriesToRecord.length === 1 ? 'y' : 'ies'
        }. Skill gaps and improvement metrics recalculated below.`
      );
      await loadSelectedTraineeHistory(selectedTrainee.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save trainer competency assessment.');
    } finally {
      setSavingScores(false);
    }
  };

  // Review queue filtering
  const filteredAttempts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attempts.filter((att) => {
      const matchesStatus = statusFilter === 'All' || att.status === statusFilter;
      const matchesSearch =
        !q ||
        (att.trainee?.full_name ?? '').toLowerCase().includes(q) ||
        (att.assessment?.code ?? '').toLowerCase().includes(q) ||
        (att.assessment?.title ?? '').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [attempts, search, statusFilter]);

  const openEvaluateDrawer = async (attempt: AssessmentAttemptRecord) => {
    setEvalTarget(attempt);
    const initialScore = attempt.score_percent ?? 80;
    setScorePercent(initialScore);
    setAchievedLevel(attempt.achieved_level ?? deriveSkillLevelFromScore(initialScore));
    setPassed(
      attempt.passed ?? initialScore >= (attempt.assessment?.passing_score_percent ?? 75)
    );
    setEvaluatorNotes(attempt.evaluator_notes ?? '');
    setIssueCert(
      attempt.assessment?.assessment_type === 'Reassessment Verification' &&
        Boolean(attempt.assessment?.course_id)
    );

    try {
      const qRows = await databaseService.listAssessmentQuestions(attempt.assessment_id);
      setEvalQuestions(qRows);
    } catch {
      setEvalQuestions([]);
    }
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !evalTarget) return;
    setEvaluating(true);
    try {
      await databaseService.evaluateAssessmentAttempt({
        attempt: evalTarget,
        evaluatorId: currentUser.id,
        scorePercent,
        achievedLevel,
        passed,
        evaluatorNotes: evaluatorNotes.trim(),
        issueCertificate: issueCert,
      });
      setNotice(
        `Evaluated attempt for ${evalTarget.trainee?.full_name ?? 'trainee'} (${scorePercent}/100 · L${achievedLevel}).`
      );
      setEvalTarget(null);
      await loadWorkspaceData();
      if (evalTarget.trainee_id === selectedTraineeId) {
        await loadSelectedTraineeHistory(selectedTraineeId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save evaluation.');
    } finally {
      setEvaluating(false);
    }
  };

  const attemptColumns: DataColumn<AssessmentAttemptRecord>[] = [
    {
      key: 'trainee',
      header: 'Trainee',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.trainee?.full_name ?? 'Trainee'}</p>
          <p className="text-xs text-slate-500">{row.trainee?.department ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'assessment',
      header: 'Assessment',
      render: (row) => (
        <div>
          <span className="font-mono text-xs text-[#0F766E]">{row.assessment?.code ?? '—'}</span>
          <p className="text-sm text-slate-800">{row.assessment?.title ?? 'Assessment'}</p>
          <p className="text-xs text-slate-500">{row.assessment?.assessment_type ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Review Status',
      render: (row) => (
        <span
          className={`text-xs font-semibold capitalize ${
            row.status === 'evaluated' ? 'text-[#0F766E]' : 'text-amber-700'
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: 'score',
      header: 'Score / Level',
      align: 'right',
      render: (row) =>
        row.status === 'evaluated' ? (
          <span className="font-mono text-xs font-semibold tabular-nums">
            {row.score_percent}/100 · L{row.achieved_level}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Pending</span>
        ),
    },
    {
      key: 'submitted',
      header: 'Submitted',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">
          {formatDateTime(row.submitted_at ?? row.started_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Evaluation',
      align: 'right',
      render: (row) => (
        <Button variant="outline" size="sm" onClick={() => openEvaluateDrawer(row)}>
          <CheckSquare className="w-3.5 h-3.5" />
          <span>{row.status === 'evaluated' ? 'Update Grade' : 'Evaluate'}</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
            Competency Evaluation &amp; Performance
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Record authorised baseline &amp; reassessment scores, inspect skill-gap trajectories,
            and evaluate submitted trainee attempts.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md self-start">
          <button
            type="button"
            onClick={() => setActiveTab('competency')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'competency' ? 'bg-white text-[#0B1F3A] shadow-xs' : 'text-slate-600'
            }`}
          >
            Authorised Competency Evaluation
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attempts')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'attempts' ? 'bg-white text-[#0B1F3A] shadow-xs' : 'text-slate-600'
            }`}
          >
            Submitted Attempt Queue ({attempts.filter((a) => a.status === 'submitted').length})
          </button>
        </div>
      </div>

      {error && <StatusBanner tone="error" title="Evaluation Error" description={error} />}
      {notice && <StatusBanner tone="success" title="Evaluation Saved" description={notice} />}

      {activeTab === 'competency' ? (
        <div className="space-y-6">
          {/* Trainee & Assessment Stage Selector */}
          <Card className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SelectField
                htmlFor="eval-trainee-select"
                label="Select Trainee"
                value={selectedTraineeId}
                onChange={(e) => setSelectedTraineeId(e.target.value)}
                disabled={isLoading || trainees.length === 0}
                helperText={
                  selectedTrainee
                    ? `${selectedTrainee.department || 'Unassigned Dept'} · ${
                        selectedTrainee.designation || 'Personnel'
                      }`
                    : 'No active trainee profiles available'
                }
              >
                {trainees.length === 0 ? (
                  <option value="">No trainees registered</option>
                ) : (
                  trainees.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.job_role ? t.job_role.code : 'No Role'})
                    </option>
                  ))
                )}
              </SelectField>

              <SelectField
                htmlFor="eval-role-select"
                label="Job Role Competency Benchmark"
                value={effectiveRoleId}
                onChange={(e) => setOverrideRoleId(e.target.value)}
                disabled={Boolean(selectedTrainee?.job_role_id) || jobRoles.length === 0}
                helperText={
                  selectedTrainee?.job_role_id
                    ? 'Bound to trainee profile Job Role'
                    : 'Trainee has no assigned Job Role — previewing selected role requirements'
                }
              >
                {jobRoles.map((jr) => (
                  <option key={jr.id} value={jr.id}>
                    {jr.code} — {jr.title}
                  </option>
                ))}
              </SelectField>

              <SelectField
                htmlFor="eval-stage-select"
                label="Assessment Stage"
                value={assessmentStage}
                onChange={(e) =>
                  setAssessmentStage(e.target.value as 'skill_assessment' | 'reassessment')
                }
                helperText={
                  assessmentStage === 'reassessment'
                    ? 'Updates current score and computes Before → After improvement'
                    : 'Establishes verified diagnostic baseline score'
                }
              >
                <option value="skill_assessment">03. Baseline Competency Assessment</option>
                <option value="reassessment">08. Post-Training Reassessment</option>
              </SelectField>
            </div>

            {selectedTrainee && (
              <form onSubmit={handleSaveAuthorisedScores} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                  <div>
                    <h2 className="font-display text-base font-semibold text-[#0B1F3A]">
                      Role Competencies &amp; Authorised Scoring (0–100)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Formula: Skill Gap = max(0, Required Score - Current Score). Blank rows are
                      not altered.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                    <span className="text-slate-600">
                      Readiness:{' '}
                      <strong className="text-[#0B1F3A]">
                        {computedReport.summary.readinessPercent}%
                      </strong>
                    </span>
                    <span className="text-slate-600">
                      Open Gaps:{' '}
                      <strong className="text-[#0F766E]">
                        {computedReport.summary.openGapCount}/{computedReport.summary.totalRequired}
                      </strong>
                    </span>
                  </div>
                </div>

                {loadingTraineeHistory ? (
                  <p className="text-sm text-slate-500 py-4">Loading trainee competency records...</p>
                ) : computedReport.rows.length === 0 ? (
                  <StatusBanner
                    tone="warning"
                    title="No Role Requirements Defined"
                    description="No competencies have been mapped to this Job Role yet. Administration must define requirements under Job Roles."
                  />
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-md">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                          <th className="px-4 py-3">Competency</th>
                          <th className="px-4 py-3 text-right">Required</th>
                          <th className="px-4 py-3 text-right">Current Score</th>
                          <th className="px-4 py-3 text-right">Current Gap</th>
                          <th className="px-4 py-3 min-w-[140px]">Progress Bar</th>
                          <th className="px-4 py-3 w-28">New Score (0–100)</th>
                          <th className="px-4 py-3 min-w-[180px]">Evaluation Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {computedReport.rows.map((row) => {
                          const entered = scoreInputs[row.competencyId] ?? '';
                          const previewScore =
                            entered.trim() !== '' && !Number.isNaN(Number(entered))
                              ? clampScore(Number(entered))
                              : null;

                          return (
                            <tr key={row.competencyId} className="align-top hover:bg-slate-50/70">
                              <td className="px-4 py-3">
                                <span className="font-mono text-[#0F766E]">
                                  {row.competencyCode}
                                </span>
                                <p className="font-medium text-slate-900 mt-0.5">
                                  {row.competencyTitle}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {row.domain} · {row.priority}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-800 whitespace-nowrap">
                                {row.requiredScore}/100
                                <span className="block text-[11px] text-slate-400">
                                  L{row.requiredLevel}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                                <span className="font-semibold text-[#0B1F3A]">
                                  {row.currentScore === null ? '—' : `${row.currentScore}/100`}
                                </span>
                                <span className="block text-[11px] text-slate-400">
                                  {row.measuredSource}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap">
                                <span
                                  className={`font-semibold ${
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
                              </td>
                              <td className="px-4 py-3">
                                <CompetencyProgressBar
                                  currentScore={row.currentScore}
                                  requiredScore={row.requiredScore}
                                  previousScore={row.previousScore}
                                  compact
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  aria-label={`Score for ${row.competencyCode}`}
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={entered}
                                  onChange={(e) =>
                                    setScoreInputs((prev) => ({
                                      ...prev,
                                      [row.competencyId]: e.target.value,
                                    }))
                                  }
                                  placeholder="0–100"
                                  className="w-24 min-h-[36px] rounded-md border border-slate-300 bg-white px-2.5 text-xs font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                                />
                                {previewScore !== null && (
                                  <span className="block text-[10px] font-mono text-slate-500 mt-1 tabular-nums">
                                    L{scoreToProficiencyLevel(previewScore)} · New gap{' '}
                                    {Math.max(0, row.requiredScore - previewScore)}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  aria-label={`Notes for ${row.competencyCode}`}
                                  type="text"
                                  value={noteInputs[row.competencyId] ?? ''}
                                  onChange={(e) =>
                                    setNoteInputs((prev) => ({
                                      ...prev,
                                      [row.competencyId]: e.target.value,
                                    }))
                                  }
                                  placeholder="Assessment evidence or remarks..."
                                  className="w-full min-h-[36px] rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {computedReport.rows.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <p className="text-xs text-slate-500">
                      Authorised scores persist to `progress_history` with your trainer evaluator ID
                      and compute matched remediation courses &amp; verified trainers.
                    </p>
                    <Button type="submit" variant="primary" size="md" disabled={savingScores}>
                      <ClipboardCheck className="w-4 h-4" />
                      <span>
                        {savingScores
                          ? 'Recording Scores...'
                          : assessmentStage === 'reassessment'
                          ? 'Save Post-Training Reassessment'
                          : 'Save Baseline Assessment'}
                      </span>
                    </Button>
                  </div>
                )}
              </form>
            )}
          </Card>

          {/* Matched Training & Verified Faculty Recommendations for Open Gaps */}
          {selectedTrainee && computedReport.rows.some((r) => r.gapDelta > 0) && (
            <Card className="p-6 space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-[#0B1F3A]">
                  Recommended Training &amp; Verified Trainer Matching
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Automatically identifies published courses and Admin-verified trainers matching open
                  skill gaps for {selectedTrainee.full_name}.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {computedReport.rows
                  .filter((r) => r.gapDelta > 0)
                  .map((row) => (
                    <div
                      key={row.competencyId}
                      className="border border-slate-200 rounded-md p-4 space-y-2.5 bg-slate-50/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-xs text-[#0F766E]">
                            {row.competencyCode}
                          </span>
                          <p className="text-sm font-semibold text-slate-900">
                            {row.competencyTitle}
                          </p>
                        </div>
                        <span className="font-mono text-xs font-semibold text-red-700 tabular-nums shrink-0">
                          Gap: {row.gapDelta} pts
                        </span>
                      </div>

                      <div className="text-xs space-y-1.5 border-t border-slate-200 pt-2">
                        <p className="font-semibold text-slate-700">Suitable Courses:</p>
                        {row.recommendedCourses.length === 0 ? (
                          <p className="text-slate-500">No published course mapped yet.</p>
                        ) : (
                          row.recommendedCourses.slice(0, 2).map((course) => (
                            <p key={course.id} className="text-slate-700">
                              <span className="font-mono text-[#0B1F3A]">{course.code}</span> —{' '}
                              {course.title}{' '}
                              <span className="text-slate-500">({course.matchReason})</span>
                            </p>
                          ))
                        )}
                      </div>

                      <div className="text-xs space-y-1 border-t border-slate-200 pt-2">
                        <p className="font-semibold text-slate-700">Matched Verified Trainers:</p>
                        {row.matchedTrainers.length === 0 ? (
                          <p className="text-slate-500">
                            No Admin-verified trainer expertise mapped for {row.domain}.
                          </p>
                        ) : (
                          row.matchedTrainers.slice(0, 3).map((trainer) => (
                            <p key={trainer.trainerId} className="text-slate-700">
                              <span className="font-medium text-[#0B1F3A]">{trainer.fullName}</span>{' '}
                              · {trainer.specialization} ({trainer.credential},{' '}
                              {trainer.yearsExperience}y · {trainer.matchType})
                            </p>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          {/* Before vs After Competency Improvement Report */}
          {selectedTrainee && (
            <CompetencyImprovementSection
              rows={computedReport.rows}
              title={`Reassessment Improvement Report — ${selectedTrainee.full_name}`}
              subtitle="Compares chronological prior scores against new post-training reassessments."
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <WorkspaceFilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by trainee name or assessment code..."
            rightSlot={
              <select
                aria-label="Filter by review status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
              >
                <option value="All">All Attempts</option>
                <option value="submitted">Awaiting Evaluation</option>
                <option value="evaluated">Evaluated</option>
              </select>
            }
          />

          <DataTable
            columns={attemptColumns}
            rows={filteredAttempts}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            emptyTitle="No trainee submissions available"
            emptyDescription="Submitted attempts for assessments you created or cohorts assigned to you appear here for evaluation."
          />
        </div>
      )}

      <ModalDrawer
        isOpen={Boolean(evalTarget)}
        onClose={() => setEvalTarget(null)}
        title={`Evaluate: ${evalTarget?.trainee?.full_name ?? 'Trainee'}`}
        subtitle={
          evalTarget
            ? `${evalTarget.assessment?.code} · ${evalTarget.assessment?.assessment_type}`
            : undefined
        }
      >
        {evalTarget && (
          <form onSubmit={handleSaveEvaluation} className="space-y-4">
            {evalQuestions.length > 0 && (
              <div className="space-y-2.5 max-h-60 overflow-y-auto border border-slate-200 rounded-md p-3 bg-slate-50">
                <p className="text-xs font-semibold text-slate-800">Submitted Responses</p>
                {evalQuestions.map((q, idx) => {
                  const traineeAnswer = (evalTarget.answers[q.id] ?? '').trim();
                  const expectedAnswer = (q.correct_option ?? '').trim();
                  const hasKey = Boolean(expectedAnswer);
                  const isMatch = hasKey && traineeAnswer === expectedAnswer;
                  return (
                    <div
                      key={q.id}
                      className="text-xs border-t border-slate-200 pt-2.5 first:border-t-0 first:pt-0 space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-slate-900">
                          {idx + 1}. {q.question_text}
                        </p>
                        <span className="font-mono text-[11px] text-slate-500 shrink-0 tabular-nums">
                          Max {q.max_marks}m
                        </span>
                      </div>
                      <p className="text-slate-700">
                        Response: <span className="font-medium">{traineeAnswer || 'No answer entered'}</span>
                      </p>
                      {hasKey && (
                        <p className="text-slate-600">
                          Answer Key: <span className="font-mono">{expectedAnswer}</span>{' '}
                          <span
                            className={`font-semibold ml-1 ${
                              isMatch ? 'text-[#0F766E]' : 'text-red-700'
                            }`}
                          >
                            ({isMatch ? 'Match' : 'Mismatch'})
                          </span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <TextField
                htmlFor="eval-score"
                label="Score (0–100)"
                type="number"
                min={0}
                max={100}
                value={String(scorePercent)}
                onChange={(e) => {
                  const val = Math.min(100, Math.max(0, Number(e.target.value)));
                  setScorePercent(val);
                  setAchievedLevel(deriveSkillLevelFromScore(val));
                  setPassed(val >= (evalTarget.assessment?.passing_score_percent ?? 75));
                }}
              />
              <SelectField
                htmlFor="eval-level"
                label="Verified Level"
                value={String(achievedLevel)}
                onChange={(e) => setAchievedLevel(Number(e.target.value))}
              >
                <option value="1">Level 1</option>
                <option value="2">Level 2</option>
                <option value="3">Level 3</option>
                <option value="4">Level 4</option>
                <option value="5">Level 5</option>
              </SelectField>
              <SelectField
                htmlFor="eval-pass"
                label="Outcome"
                value={passed ? 'pass' : 'fail'}
                onChange={(e) => setPassed(e.target.value === 'pass')}
              >
                <option value="pass">Passed / Benchmark Met</option>
                <option value="fail">Needs Remediation</option>
              </SelectField>
            </div>

            <TextareaField
              htmlFor="eval-notes"
              label="Evaluator Verification Remarks"
              rows={3}
              value={evaluatorNotes}
              onChange={(e) => setEvaluatorNotes(e.target.value)}
              placeholder="Document competency strengths, audit remarks, or follow-up requirements..."
            />

            {passed && evalTarget.assessment?.course_id && (
              <label className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={issueCert}
                  onChange={(e) => setIssueCert(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#0F766E]"
                />
                <span>Issue verified completion certificate upon saving</span>
              </label>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEvalTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={evaluating}>
                {evaluating ? 'Saving Evaluation...' : 'Record Evaluation'}
              </Button>
            </div>
          </form>
        )}
      </ModalDrawer>
    </div>
  );
}
