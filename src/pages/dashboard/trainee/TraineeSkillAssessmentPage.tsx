import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, PlayCircle, XCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { DataColumn, DataTable } from '../../../components/ui/DataTable';
import { ModalDrawer } from '../../../components/ui/ModalDrawer';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { WorkspaceFilterBar } from '../../../components/ui/WorkspaceFilterBar';
import { useAuth } from '../../../context/AuthContext';
import { formatDateTime } from '../../../lib/formatters';
import { isAssessmentPastDeadline } from '../../../services/competencyEngine';
import { databaseService } from '../../../services/databaseService';
import {
  AssessmentAttemptRecord,
  AssessmentQuestionRecord,
  AssessmentRecord,
  QuestionSubmissionFeedback,
} from '../../../types/competency';

export function TraineeSkillAssessmentPage() {
  const { currentUser } = useAuth();
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [attempts, setAttempts] = useState<AssessmentAttemptRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Active diagnostic runner state
  const [activeAssessment, setActiveAssessment] = useState<AssessmentRecord | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestionRecord[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [runnerError, setRunnerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    tone: 'success' | 'info' | 'error';
    title: string;
    description: string;
  } | null>(null);

  const [resultSummary, setResultSummary] = useState<{
    assessment: AssessmentRecord;
    attempt: AssessmentAttemptRecord;
    feedback: QuestionSubmissionFeedback[];
  } | null>(null);

  const loadData = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const [allAssessments, myAttempts] = await Promise.all([
        databaseService.listAssessments({ publishedOnly: true }),
        databaseService.listAssessmentAttempts({ traineeId: currentUser.id }),
      ]);
      setAssessments(allAssessments.filter((a) => a.assessment_type === 'Diagnostic Baseline'));
      setAttempts(myAttempts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load diagnostic assessments.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.id]);

  const filteredAssessments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assessments.filter(
      (a) =>
        !q ||
        a.code.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.domain.toLowerCase().includes(q)
    );
  }, [assessments, search]);

  const handleOpenAssessment = async (assessment: AssessmentRecord) => {
    if (isAssessmentPastDeadline(assessment.due_at)) {
      setError(`The deadline for "${assessment.title}" has already passed.`);
      return;
    }
    setActiveAssessment(assessment);
    setAnswers({});
    setRunnerError(null);
    setLoadingQuestions(true);
    try {
      const qRows = await databaseService.listAssessmentQuestions(assessment.id, false);
      setQuestions(qRows);
    } catch (err) {
      setRunnerError(err instanceof Error ? err.message : 'Unable to load assessment questions.');
      setQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleSubmitAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !activeAssessment) return;

    if (questions.length === 0) {
      setRunnerError('This diagnostic assessment currently has zero published questions.');
      return;
    }

    const unansweredCount = questions.filter((q) => !(answers[q.id] ?? '').trim()).length;
    if (unansweredCount > 0) {
      setRunnerError(`Please answer all remaining ${unansweredCount} question(s) before submitting.`);
      return;
    }

    setRunnerError(null);
    setSubmitting(true);
    try {
      const { attempt, questionFeedback } = await databaseService.submitAssessmentAttempt({
        assessmentId: activeAssessment.id,
        answers,
      });
      const submittedFor = activeAssessment;
      setAttempts((prev) => [attempt, ...prev]);
      setActiveAssessment(null);
      setResultSummary({
        assessment: submittedFor,
        attempt,
        feedback: questionFeedback,
      });

      if (attempt.status === 'evaluated') {
        setSubmitFeedback({
          tone: 'success',
          title: 'Diagnostic Baseline Evaluated',
          description: `Score: ${attempt.score_percent}% · Achieved Proficiency: Level ${attempt.achieved_level}. Your Skill Gap Report has been updated.`,
        });
      } else {
        setSubmitFeedback({
          tone: 'info',
          title: 'Diagnostic Responses Submitted',
          description:
            'Your responses have been recorded and queued for Trainer rubric evaluation.',
        });
      }
    } catch (err) {
      setRunnerError(err instanceof Error ? err.message : 'Unable to submit diagnostic.');
    } finally {
      setSubmitting(false);
    }
  };

  const latestAttemptByAssessment = useMemo(() => {
    const map = new Map<string, AssessmentAttemptRecord>();
    for (const att of attempts) {
      if (!map.has(att.assessment_id)) {
        map.set(att.assessment_id, att);
      }
    }
    return map;
  }, [attempts]);

  const columns: DataColumn<AssessmentRecord>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => <span className="font-mono text-xs text-[#0F766E]">{row.code}</span>,
    },
    {
      key: 'title',
      header: 'Diagnostic Assessment',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{row.domain}</p>
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Duration / Pass',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs tabular-nums">
          {row.duration_minutes}m · {row.passing_score_percent}%
        </span>
      ),
    },
    {
      key: 'deadline',
      header: 'Deadline',
      render: (row) => {
        if (!row.due_at) return <span className="text-xs text-slate-500">No fixed deadline</span>;
        const closed = isAssessmentPastDeadline(row.due_at);
        return (
          <div className="text-xs">
            <span className={`font-mono ${closed ? 'text-red-700 font-semibold' : 'text-slate-700'}`}>
              {formatDateTime(row.due_at)}
            </span>
            {closed && <span className="block text-red-700 font-medium">Closed</span>}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Latest Attempt',
      render: (row) => {
        const latest = latestAttemptByAssessment.get(row.id);
        if (!latest) return <span className="text-xs text-slate-500">Not Attempted</span>;
        if (latest.status === 'evaluated') {
          return (
            <span className="text-xs font-semibold text-[#0F766E] tabular-nums">
              {latest.score_percent}% · L{latest.achieved_level}
            </span>
          );
        }
        return <span className="text-xs font-medium text-amber-700">Awaiting Review</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => {
        const closed = isAssessmentPastDeadline(row.due_at);
        return (
          <Button
            variant="primary"
            size="sm"
            disabled={closed}
            onClick={() => handleOpenAssessment(row)}
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>
              {closed
                ? 'Deadline Passed'
                : latestAttemptByAssessment.has(row.id)
                ? 'Retake'
                : 'Start Diagnostic'}
            </span>
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">Skill Assessment</h1>
        <p className="text-sm text-slate-600 mt-1">
          Stage 02 diagnostic baseline evaluations to establish verified proficiency prior to training.
        </p>
      </div>

      {error && <StatusBanner tone="error" title="Query Error" description={error} />}
      {submitFeedback && (
        <StatusBanner
          tone={submitFeedback.tone}
          title={submitFeedback.title}
          description={submitFeedback.description}
        />
      )}

      <WorkspaceFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search published diagnostic assessments..."
      />

      <DataTable
        columns={columns}
        rows={filteredAssessments}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No published diagnostic assessments found"
        emptyDescription="Diagnostic Baseline assessments published by Approved Trainers or Admins in `assessments` appear here automatically."
      />

      <ModalDrawer
        isOpen={Boolean(activeAssessment)}
        onClose={() => setActiveAssessment(null)}
        title={activeAssessment?.title ?? 'Diagnostic Assessment'}
        subtitle={
          activeAssessment
            ? `${activeAssessment.code} · ${activeAssessment.duration_minutes} mins · Passing ${activeAssessment.passing_score_percent}%`
            : undefined
        }
      >
        {activeAssessment && (
          <form onSubmit={handleSubmitAttempt} className="space-y-5">
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md p-3">
              {activeAssessment.instructions}
            </p>

            {runnerError && (
              <StatusBanner tone="error" title="Submission Check" description={runnerError} />
            )}

            {loadingQuestions ? (
              <p className="text-sm text-slate-500">Loading questionnaire items...</p>
            ) : questions.length === 0 ? (
              <StatusBanner
                tone="warning"
                title="No Questions Authored Yet"
                description="This assessment currently has 0 questions in `assessment_questions`. Submission is disabled until an Approved Trainer adds at least one question."
              />
            ) : (
              <div className="space-y-5">
                {questions.map((q, index) => (
                  <div key={q.id} className="border border-slate-200 rounded-md p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {index + 1}. {q.question_text}
                      </p>
                      <span className="font-mono text-xs text-slate-500 shrink-0 tabular-nums">
                        {q.max_marks} pts
                      </span>
                    </div>

                    {q.question_type === 'Multiple Choice' && q.options.length > 0 ? (
                      <div className="space-y-2">
                        {q.options.map((opt) => (
                          <label
                            key={opt}
                            className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer"
                          >
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              value={opt}
                              checked={answers[q.id] === opt}
                              onChange={(e) =>
                                setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                              }
                              className="h-4 w-4 text-[#0B1F3A] border-slate-300"
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        rows={3}
                        value={answers[q.id] ?? ''}
                        onChange={(e) =>
                          setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        placeholder="Enter structured operational response..."
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Attempt timestamp: {formatDateTime(new Date().toISOString())}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setActiveAssessment(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submitting || loadingQuestions || questions.length === 0}
                >
                  {submitting ? 'Submitting...' : 'Submit Assessment'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </ModalDrawer>

      <ModalDrawer
        isOpen={Boolean(resultSummary)}
        onClose={() => setResultSummary(null)}
        title={`Submission Summary: ${resultSummary?.assessment.code ?? ''}`}
        subtitle={resultSummary?.assessment.title}
      >
        {resultSummary && (
          <div className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-slate-500">Status</p>
                <p className="font-semibold text-[#0B1F3A] capitalize mt-0.5">
                  {resultSummary.attempt.status === 'evaluated'
                    ? resultSummary.attempt.passed
                      ? 'Verified Pass'
                      : 'Needs Follow-Up'
                    : 'Awaiting Review'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Score / Benchmark</p>
                <p className="font-mono font-semibold text-slate-900 mt-0.5 tabular-nums">
                  {resultSummary.attempt.score_percent !== null
                    ? `${resultSummary.attempt.score_percent}% / ${resultSummary.assessment.passing_score_percent}%`
                    : `Pending / ${resultSummary.assessment.passing_score_percent}%`}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Proficiency Level</p>
                <p className="font-mono font-semibold text-[#0F766E] mt-0.5 tabular-nums">
                  {resultSummary.attempt.achieved_level !== null
                    ? `Level ${resultSummary.attempt.achieved_level}`
                    : 'Pending'}
                </p>
              </div>
            </div>

            {resultSummary.feedback.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-900">
                  Per-Question Feedback Breakdown
                </h3>
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
                  {resultSummary.feedback.map((item, idx) => (
                    <div key={item.questionId} className="p-3.5 space-y-1.5 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-slate-900">
                          {idx + 1}. {item.questionText}
                        </p>
                        {item.isCorrect !== null && (
                          <span
                            className={`inline-flex items-center gap-1 font-mono font-semibold shrink-0 ${
                              item.isCorrect ? 'text-[#0F766E]' : 'text-red-700'
                            }`}
                          >
                            {item.isCorrect ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {item.earnedMarks}/{item.maxMarks} pts
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600">
                        <strong className="text-slate-800">Your Answer:</strong>{' '}
                        {item.selectedAnswer || '—'}
                      </p>
                      {item.correctOption !== null ? (
                        <p className="text-slate-600">
                          <strong className="text-slate-800">Verified Key:</strong>{' '}
                          {item.correctOption}
                        </p>
                      ) : (
                        <p className="text-amber-700 font-medium">
                          Submitted for Trainer rubric evaluation ({item.maxMarks} max pts)
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="primary" size="sm" onClick={() => setResultSummary(null)}>
                Close Summary
              </Button>
            </div>
          </div>
        )}
      </ModalDrawer>
    </div>
  );
}
