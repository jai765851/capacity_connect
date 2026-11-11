import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  EnrollmentRecord,
  QuestionSubmissionFeedback,
} from '../../../types/competency';

export function TraineeAssessmentsPage() {
  const { currentUser } = useAuth();
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [attempts, setAttempts] = useState<AssessmentAttemptRecord[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');

  // Assessment runner
  const [activeAssessment, setActiveAssessment] = useState<AssessmentRecord | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestionRecord[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [runnerError, setRunnerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);

  const [resultSummary, setResultSummary] = useState<{
    assessment: AssessmentRecord;
    attempt: AssessmentAttemptRecord;
    feedback: QuestionSubmissionFeedback[];
  } | null>(null);

  const loadData = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const [allAssessments, myAttempts, myEnrollments] = await Promise.all([
        databaseService.listAssessments({ publishedOnly: true }),
        databaseService.listAssessmentAttempts({ traineeId: currentUser.id }),
        databaseService.listEnrollments({ traineeId: currentUser.id }),
      ]);
      setAssessments(
        allAssessments.filter((a) => a.assessment_type !== 'Diagnostic Baseline')
      );
      setAttempts(myAttempts);
      setEnrollments(myEnrollments);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch assessments.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.id]);

  const activeEnrolledCourseIds = useMemo(
    () =>
      new Set(
        enrollments.filter((e) => e.status !== 'withdrawn').map((e) => e.course_id)
      ),
    [enrollments]
  );

  const filteredAssessments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assessments.filter((a) => {
      const matchesType = typeFilter === 'All' || a.assessment_type === typeFilter;
      const matchesSearch =
        !q ||
        a.code.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.domain.toLowerCase().includes(q) ||
        (a.course?.code ?? '').toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [assessments, search, typeFilter]);

  const handleOpenAssessment = async (assessment: AssessmentRecord) => {
    if (isAssessmentPastDeadline(assessment.due_at)) {
      setError(`The submission deadline for "${assessment.title}" has already passed.`);
      return;
    }
    if (
      assessment.assessment_type === 'Course Assessment' &&
      assessment.course_id &&
      !activeEnrolledCourseIds.has(assessment.course_id)
    ) {
      setError(
        `Enrol in course ${assessment.course?.code ?? ''} first before attempting this Course Assessment.`
      );
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
      setRunnerError(err instanceof Error ? err.message : 'Unable to load questionnaire items.');
      setQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleSubmitAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !activeAssessment) return;

    if (questions.length === 0) {
      setRunnerError('This assessment has 0 published questions and cannot be submitted yet.');
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
      setSubmitNotice(
        attempt.status === 'evaluated'
          ? `Assessment graded automatically: ${attempt.score_percent}% (Level ${attempt.achieved_level}).`
          : 'Submission saved and queued for Trainer rubric evaluation.'
      );
    } catch (err) {
      setRunnerError(err instanceof Error ? err.message : 'Failed to submit assessment attempt.');
    } finally {
      setSubmitting(false);
    }
  };

  const availableColumns: DataColumn<AssessmentRecord>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => <span className="font-mono text-xs text-[#0F766E]">{row.code}</span>,
    },
    {
      key: 'title',
      header: 'Assessment Title',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {row.assessment_type} · {row.domain}
            {row.course ? ` · ${row.course.code}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'pass',
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
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (row) => {
        const closed = isAssessmentPastDeadline(row.due_at);
        const missingEnrollment =
          row.assessment_type === 'Course Assessment' &&
          Boolean(row.course_id) &&
          !activeEnrolledCourseIds.has(row.course_id!);

        if (closed) {
          return (
            <Button variant="outline" size="sm" disabled>
              Deadline Passed
            </Button>
          );
        }

        if (missingEnrollment) {
          return (
            <Link
              to="/dashboard/trainee/training-courses"
              className="text-xs font-semibold text-[#0F766E] hover:text-[#0B1F3A] whitespace-nowrap"
            >
              Enrol to Attempt →
            </Link>
          );
        }

        return (
          <Button variant="primary" size="sm" onClick={() => handleOpenAssessment(row)}>
            <PlayCircle className="w-3.5 h-3.5" />
            <span>Attempt</span>
          </Button>
        );
      },
    },
  ];

  const attemptColumns: DataColumn<AssessmentAttemptRecord>[] = [
    {
      key: 'assessment',
      header: 'Assessment',
      render: (row) => (
        <div>
          <span className="font-mono text-xs text-[#0F766E]">{row.assessment?.code ?? '—'}</span>
          <p className="font-medium text-slate-900">{row.assessment?.title ?? 'Assessment'}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Stage Type',
      render: (row) => (
        <span className="text-xs text-slate-600">{row.assessment?.assessment_type ?? '—'}</span>
      ),
    },
    {
      key: 'score',
      header: 'Score / Level',
      align: 'right',
      render: (row) =>
        row.status === 'evaluated' ? (
          <span className="font-mono text-xs font-semibold tabular-nums">
            {row.score_percent}% · L{row.achieved_level}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Pending</span>
        ),
    },
    {
      key: 'outcome',
      header: 'Outcome',
      render: (row) => {
        if (row.status !== 'evaluated') {
          return <span className="text-xs font-medium text-amber-700">Awaiting Evaluation</span>;
        }
        return (
          <span
            className={`text-xs font-semibold ${row.passed ? 'text-[#0F766E]' : 'text-red-700'}`}
          >
            {row.passed ? 'Verified Pass' : 'Follow-Up Required'}
          </span>
        );
      },
    },
    {
      key: 'notes',
      header: 'Evaluator Notes',
      render: (row) => <span className="text-xs text-slate-600">{row.evaluator_notes || '—'}</span>,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
          Assessments &amp; Reassessment History
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Stage 05 post-training course verifications, reassessments, and full evaluation ledger.
        </p>
      </div>

      {error && <StatusBanner tone="error" title="Assessment Error" description={error} />}
      {submitNotice && (
        <StatusBanner tone="success" title="Submission Recorded" description={submitNotice} />
      )}

      <div className="space-y-4">
        <WorkspaceFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search course assessments & reassessments..."
          rightSlot={
            <select
              aria-label="Filter by assessment type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
            >
              <option value="All">All Verification Types</option>
              <option value="Course Assessment">Course Assessment</option>
              <option value="Reassessment Verification">Reassessment Verification</option>
            </select>
          }
        />

        <DataTable
          columns={availableColumns}
          rows={filteredAssessments}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyTitle="No course or reassessment evaluations published yet"
          emptyDescription="Course Assessments and Reassessment Verifications created by approved Trainers appear here."
        />
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-[#0B1F3A]">
          Recorded Assessment Attempts
        </h2>
        <DataTable
          columns={attemptColumns}
          rows={attempts}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          emptyTitle="No submitted attempts yet"
          emptyDescription="Completed diagnostic baselines, course assessments, and reassessments appear here with evaluator remarks."
        />
      </div>

      <ModalDrawer
        isOpen={Boolean(activeAssessment)}
        onClose={() => setActiveAssessment(null)}
        title={activeAssessment?.title ?? 'Assessment'}
        subtitle={
          activeAssessment
            ? `${activeAssessment.code} · ${activeAssessment.assessment_type} · Passing ${activeAssessment.passing_score_percent}%`
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
                description="No questions are attached to this assessment yet. Submission is disabled until an Approved Trainer publishes assessment questions."
              />
            ) : (
              <div className="space-y-4">
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
                              name={`asmt-q-${q.id}`}
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
                        placeholder="Enter structured response..."
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                {formatDateTime(new Date().toISOString())}
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
                  {submitting ? 'Submitting...' : 'Submit Attempt'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </ModalDrawer>

      <ModalDrawer
        isOpen={Boolean(resultSummary)}
        onClose={() => setResultSummary(null)}
        title={`Assessment Result: ${resultSummary?.assessment.code ?? ''}`}
        subtitle={resultSummary?.assessment.title}
      >
        {resultSummary && (
          <div className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-slate-500">Outcome</p>
                <p
                  className={`font-semibold mt-0.5 ${
                    resultSummary.attempt.status === 'evaluated'
                      ? resultSummary.attempt.passed
                        ? 'text-[#0F766E]'
                        : 'text-red-700'
                      : 'text-amber-700'
                  }`}
                >
                  {resultSummary.attempt.status === 'evaluated'
                    ? resultSummary.attempt.passed
                      ? 'Verified Pass'
                      : 'Follow-Up Required'
                    : 'Awaiting Review'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Score / Pass Mark</p>
                <p className="font-mono font-semibold text-slate-900 mt-0.5 tabular-nums">
                  {resultSummary.attempt.score_percent !== null
                    ? `${resultSummary.attempt.score_percent}% / ${resultSummary.assessment.passing_score_percent}%`
                    : `Pending / ${resultSummary.assessment.passing_score_percent}%`}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Achieved Level</p>
                <p className="font-mono font-semibold text-[#0B1F3A] mt-0.5 tabular-nums">
                  {resultSummary.attempt.achieved_level !== null
                    ? `Level ${resultSummary.attempt.achieved_level}`
                    : 'Pending'}
                </p>
              </div>
            </div>

            {resultSummary.feedback.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-900">
                  Question-by-Question Evaluation
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
                        <strong className="text-slate-800">Submitted Choice:</strong>{' '}
                        {item.selectedAnswer || '—'}
                      </p>
                      {item.correctOption !== null ? (
                        <p className="text-slate-600">
                          <strong className="text-slate-800">Correct Answer:</strong>{' '}
                          {item.correctOption}
                        </p>
                      ) : (
                        <p className="text-amber-700 font-medium">
                          Submitted for Trainer evaluation ({item.maxMarks} max pts)
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              {resultSummary.attempt.passed && resultSummary.assessment.course_id ? (
                <Link
                  to="/dashboard/trainee/certificates"
                  className="text-xs font-semibold text-[#0F766E] hover:text-[#0B1F3A]"
                >
                  Check Completion Certificate Eligibility →
                </Link>
              ) : (
                <span />
              )}
              <Button variant="primary" size="sm" onClick={() => setResultSummary(null)}>
                Close Result
              </Button>
            </div>
          </div>
        )}
      </ModalDrawer>
    </div>
  );
}
