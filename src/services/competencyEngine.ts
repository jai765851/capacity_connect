import {
  AssessmentAttemptRecord,
  AssessmentRecord,
  CertificateRecord,
  CompetencyAnalysisSummary,
  CourseCertificateEligibility,
  CourseRecord,
  EnrollmentRecord,
  MatchedCourseRecommendation,
  MatchedTrainerProfile,
  ProgressHistoryRecord,
  PublicTrainerDirectoryItem,
  RoleRequirementRecord,
  SkillGapComputedRow,
  TrainerAssignmentRecord,
} from '../types/competency';

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function scoreToProficiencyLevel(scorePercent: number): number {
  const s = clampScore(scorePercent);
  if (s >= 90) return 5;
  if (s >= 75) return 4;
  if (s >= 60) return 3;
  if (s >= 40) return 2;
  return 1;
}

export function levelToBenchmarkScore(level: number): number {
  switch (level) {
    case 5:
      return 90;
    case 4:
      return 80;
    case 3:
      return 70;
    case 2:
      return 55;
    default:
      return 40;
  }
}

export function normalizeRequiredScore(req: RoleRequirementRecord): number {
  if (typeof req.required_score === 'number' && Number.isFinite(req.required_score)) {
    return clampScore(req.required_score);
  }
  return levelToBenchmarkScore(req.required_level);
}

export function normalizeProgressScore(entry: ProgressHistoryRecord): number {
  if (typeof entry.recorded_score === 'number' && Number.isFinite(entry.recorded_score)) {
    return clampScore(entry.recorded_score);
  }
  switch (entry.recorded_level) {
    case 5:
      return 92;
    case 4:
      return 80;
    case 3:
      return 65;
    case 2:
      return 50;
    default:
      return 35;
  }
}

/**
 * Authoritative SIH26075 Formula:
 * Skill Gap = max(0, Required Competency Level - Current Competency Level)
 */
export function calculateSkillGap(requiredScore: number, currentScore: number): number {
  return Math.max(0, clampScore(requiredScore) - clampScore(currentScore));
}

export function classifyGapStatus(
  requiredScore: number,
  currentScore: number | null
): SkillGapComputedRow['status'] {
  if (currentScore === null) return 'Assessment Pending';
  const gap = calculateSkillGap(requiredScore, currentScore);
  if (gap === 0) return 'Met / Exceeded';
  if (gap <= 15) return 'Minor Gap';
  return 'Critical Gap';
}

export function matchVerifiedTrainersForCompetency(params: {
  competencyId: string;
  domain: string;
  trainers: PublicTrainerDirectoryItem[];
  activeAssignments?: TrainerAssignmentRecord[];
  courseId?: string;
}): MatchedTrainerProfile[] {
  const { competencyId, domain, trainers, activeAssignments = [], courseId } = params;
  const normalizedDomain = domain.trim().toLowerCase();

  const matches: Array<MatchedTrainerProfile & { rank: number }> = [];

  for (const trainer of trainers) {
    // Step 6: Only expertise explicitly verified by Admin qualifies for matching
    const verifiedExpertise = (trainer.expertise ?? []).filter(
      (exp) => exp.verified_by_admin === true
    );
    if (verifiedExpertise.length === 0) continue;

    let bestRank = 0;
    let bestExp: (typeof verifiedExpertise)[number] | null = null;

    for (const exp of verifiedExpertise) {
      const exactComp = exp.competency_id === competencyId;
      const domainMatch = exp.domain.trim().toLowerCase() === normalizedDomain;
      const rank = exactComp ? 2 : domainMatch ? 1 : 0;
      if (
        rank > bestRank ||
        (rank > 0 && rank === bestRank && exp.years_experience > (bestExp?.years_experience ?? -1))
      ) {
        bestRank = rank;
        bestExp = exp;
      }
    }

    if (!bestExp || bestRank === 0) continue;

    const cohortAssign = courseId
      ? activeAssignments.find(
          (a) => a.status === 'active' && a.trainer_id === trainer.id && a.course_id === courseId
        )
      : undefined;

    matches.push({
      rank: bestRank,
      trainerId: trainer.id,
      fullName: trainer.full_name,
      department: trainer.department,
      designation: trainer.designation,
      matchType: bestRank === 2 ? 'Competency Verified' : 'Domain Verified',
      specialization: bestExp.specialization,
      credential: bestExp.credential,
      yearsExperience: bestExp.years_experience,
      activeAssignmentId: cohortAssign?.id ?? null,
      cohortCode: cohortAssign?.cohort_code ?? null,
    });
  }

  return matches
    .sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      const aCohort = a.activeAssignmentId ? 1 : 0;
      const bCohort = b.activeAssignmentId ? 1 : 0;
      if (bCohort !== aCohort) return bCohort - aCohort;
      if (b.yearsExperience !== a.yearsExperience) return b.yearsExperience - a.yearsExperience;
      return a.fullName.localeCompare(b.fullName);
    })
    .map(({ rank: _rank, ...rest }) => rest);
}

export function matchCoursesForCompetency(params: {
  competencyId: string;
  domain: string;
  courses: CourseRecord[];
  trainers?: PublicTrainerDirectoryItem[];
  activeAssignments?: TrainerAssignmentRecord[];
}): MatchedCourseRecommendation[] {
  const { competencyId, domain, courses, trainers = [], activeAssignments = [] } = params;
  const normalizedDomain = domain.trim().toLowerCase();

  const direct: MatchedCourseRecommendation[] = [];
  const byDomain: MatchedCourseRecommendation[] = [];

  for (const course of courses) {
    if (course.is_published === false) continue;
    if (course.approval_status && course.approval_status !== 'approved') continue;

    const isDirect = (course.course_competencies ?? []).some(
      (link) => link.competency_id === competencyId
    );
    const isDomainMatch = course.domain.trim().toLowerCase() === normalizedDomain;

    if (!isDirect && !isDomainMatch) continue;

    const courseAssigns = activeAssignments.filter(
      (a) => a.status === 'active' && a.course_id === course.id
    );
    const courseTrainers = matchVerifiedTrainersForCompetency({
      competencyId,
      domain: course.domain,
      trainers,
      activeAssignments,
      courseId: course.id,
    });

    // Prefer an assignment whose trainer is verified, otherwise first active assignment
    const preferredAssign =
      courseAssigns.find((a) => courseTrainers.some((t) => t.trainerId === a.trainer_id)) ??
      courseAssigns[0];

    const recommendation: MatchedCourseRecommendation = {
      id: course.id,
      code: course.code,
      title: course.title,
      domain: course.domain,
      durationHours: course.duration_hours,
      deliveryMode: course.delivery_mode,
      matchReason: isDirect ? 'Direct Competency Match' : 'Domain Curriculum Match',
      activeAssignmentId: preferredAssign?.id ?? null,
      cohortCode: preferredAssign?.cohort_code ?? null,
      matchedTrainers: courseTrainers,
    };

    if (isDirect) {
      direct.push(recommendation);
    } else {
      byDomain.push(recommendation);
    }
  }

  return [...direct, ...byDomain];
}

export function computeCompetencyGapReport(params: {
  requirements: RoleRequirementRecord[];
  progressHistory: ProgressHistoryRecord[];
  courses: CourseRecord[];
  trainers?: PublicTrainerDirectoryItem[];
  activeAssignments?: TrainerAssignmentRecord[];
}): { rows: SkillGapComputedRow[]; summary: CompetencyAnalysisSummary } {
  const {
    requirements,
    progressHistory,
    courses,
    trainers = [],
    activeAssignments = [],
  } = params;

  // Sort chronologically oldest -> newest so baseline vs reassessment transitions are exact
  const sortedHistory = [...progressHistory].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const rows: SkillGapComputedRow[] = requirements.map((req) => {
    const compId = req.competency_id;
    const compCode = req.competency?.code ?? 'COMP';
    const compTitle = req.competency?.title ?? 'Role Competency';
    const compDomain = req.competency?.domain ?? 'General Governance';
    const requiredScore = normalizeRequiredScore(req);

    const relevant = sortedHistory.filter(
      (entry) => entry.competency_id === compId || entry.skill_code === compCode
    );

    const declarations = relevant.filter((e) => e.stage === 'self_declaration');
    const formalAssessments = relevant.filter(
      (e) => e.stage === 'skill_assessment' || e.stage === 'reassessment'
    );
    const baselineAssessments = formalAssessments.filter((e) => e.stage === 'skill_assessment');
    const reassessments = formalAssessments.filter((e) => e.stage === 'reassessment');

    let latestEntry: ProgressHistoryRecord | null = null;
    let previousEntry: ProgressHistoryRecord | null = null;
    let baselineEntry: ProgressHistoryRecord | null = null;
    let measuredSource: SkillGapComputedRow['measuredSource'] = 'Unassessed';

    if (formalAssessments.length > 0) {
      latestEntry = formalAssessments[formalAssessments.length - 1];
      measuredSource =
        latestEntry.stage === 'reassessment' ? 'Reassessment' : 'Evaluated Assessment';

      baselineEntry = baselineAssessments[0] ?? formalAssessments[0];

      if (formalAssessments.length >= 2) {
        previousEntry = formalAssessments[formalAssessments.length - 2];
      }
    } else if (declarations.length > 0) {
      latestEntry = declarations[declarations.length - 1];
      measuredSource = 'Self-Declaration';
    }

    const currentScore = latestEntry ? normalizeProgressScore(latestEntry) : null;
    const measuredLevel = latestEntry
      ? latestEntry.recorded_level ?? scoreToProficiencyLevel(currentScore ?? 0)
      : null;

    const baselineScore = baselineEntry ? normalizeProgressScore(baselineEntry) : null;
    const previousScore = previousEntry ? normalizeProgressScore(previousEntry) : null;
    const latestReassessment =
      reassessments.length > 0 ? reassessments[reassessments.length - 1] : null;
    const reassessmentScore = latestReassessment
      ? normalizeProgressScore(latestReassessment)
      : null;

    const gapDelta =
      currentScore === null ? requiredScore : calculateSkillGap(requiredScore, currentScore);

    const previousGap =
      previousScore !== null ? calculateSkillGap(requiredScore, previousScore) : null;

    const improvementPoints =
      currentScore !== null && previousScore !== null ? currentScore - previousScore : null;

    const gapReducedPoints =
      previousGap !== null ? previousGap - gapDelta : null;

    let gapClosurePercent: number | null = null;
    if (previousGap !== null && gapReducedPoints !== null) {
      if (previousGap > 0) {
        gapClosurePercent = Math.max(0, Math.min(100, Math.round((gapReducedPoints / previousGap) * 100)));
      } else {
        gapClosurePercent = gapDelta === 0 ? 100 : 0;
      }
    }

    const status = classifyGapStatus(requiredScore, currentScore);

    const matchedTrainers = matchVerifiedTrainersForCompetency({
      competencyId: compId,
      domain: compDomain,
      trainers,
      activeAssignments,
    });

    const recommendedCourses = matchCoursesForCompetency({
      competencyId: compId,
      domain: compDomain,
      courses,
      trainers,
      activeAssignments,
    });

    return {
      competencyId: compId,
      competencyCode: compCode,
      competencyTitle: compTitle,
      domain: compDomain,
      priority: req.priority,
      requiredLevel: req.required_level,
      requiredScore,
      measuredLevel,
      currentScore,
      baselineScore,
      previousScore,
      reassessmentScore,
      measuredSource,
      gapDelta,
      previousGap,
      improvementPoints,
      gapReducedPoints,
      gapClosurePercent,
      status,
      lastAssessedAt: latestEntry?.recorded_at ?? null,
      assessedByName: latestEntry?.assessor?.full_name ?? null,
      recommendedCourses,
      matchedTrainers,
    };
  });

  const totalRequired = rows.length;
  const assessedRows = rows.filter((r) => r.currentScore !== null);
  const metCount = rows.filter((r) => r.status === 'Met / Exceeded').length;
  const openGapCount = rows.filter(
    (r) => r.status === 'Minor Gap' || r.status === 'Critical Gap'
  ).length;

  const totalReqScore = rows.reduce((acc, r) => acc + r.requiredScore, 0);
  const cappedAttained = rows.reduce(
    (acc, r) => acc + Math.min(r.currentScore ?? 0, r.requiredScore),
    0
  );

  const reassessedRows = rows.filter((r) => r.improvementPoints !== null);

  const summary: CompetencyAnalysisSummary = {
    totalRequired,
    assessedCount: assessedRows.length,
    metCount,
    openGapCount,
    averageRequiredScore: totalRequired > 0 ? Math.round(totalReqScore / totalRequired) : 0,
    averageCurrentScore:
      assessedRows.length > 0
        ? Math.round(
            assessedRows.reduce((acc, r) => acc + (r.currentScore ?? 0), 0) / assessedRows.length
          )
        : null,
    averageGapPoints:
      assessedRows.length > 0
        ? Math.round(assessedRows.reduce((acc, r) => acc + r.gapDelta, 0) / assessedRows.length)
        : 0,
    readinessPercent: totalReqScore > 0 ? Math.round((cappedAttained / totalReqScore) * 100) : 0,
    reassessedCount: reassessedRows.length,
    averageImprovementPoints:
      reassessedRows.length > 0
        ? Math.round(
            reassessedRows.reduce((acc, r) => acc + (r.improvementPoints ?? 0), 0) /
              reassessedRows.length
          )
        : null,
  };

  return { rows, summary };
}

export function isAssessmentPastDeadline(
  dueAt?: string | null,
  referenceDate: Date = new Date()
): boolean {
  if (!dueAt) return false;
  const dueMs = new Date(dueAt).getTime();
  if (Number.isNaN(dueMs)) return false;
  return dueMs < referenceDate.getTime();
}

export function computeCourseCertificateEligibility(params: {
  enrollments: EnrollmentRecord[];
  assessments: AssessmentRecord[];
  attempts: AssessmentAttemptRecord[];
  certificates: CertificateRecord[];
}): CourseCertificateEligibility[] {
  const { enrollments, assessments, attempts, certificates } = params;

  const activeEnrollments = enrollments.filter((e) => e.status !== 'withdrawn');

  const items: CourseCertificateEligibility[] = activeEnrollments.map((enrollment) => {
    const courseAssessments = assessments.filter(
      (a) => a.course_id === enrollment.course_id && a.is_published
    );
    const passedAssessmentIds = new Set(
      attempts
        .filter((att) => att.status === 'evaluated' && att.passed === true)
        .map((att) => att.assessment_id)
    );
    const passedAssessmentsCount = courseAssessments.filter((a) =>
      passedAssessmentIds.has(a.id)
    ).length;

    const courseCompleted =
      enrollment.status === 'completed' || Number(enrollment.progress_percent ?? 0) >= 100;

    const alreadyIssuedCertificate =
      certificates.find(
        (c) => c.course_id === enrollment.course_id && c.status === 'verified'
      ) ?? null;

    const allAssessmentsPassed = passedAssessmentsCount >= courseAssessments.length;
    const eligibleForClaim = !alreadyIssuedCertificate && courseCompleted && allAssessmentsPassed;

    let blockingReason: string | null = null;
    if (!alreadyIssuedCertificate) {
      if (!courseCompleted) {
        blockingReason = 'Complete 100% of course progress to unlock certificate claim.';
      } else if (!allAssessmentsPassed) {
        blockingReason = `Pass all ${courseAssessments.length} linked course assessment(s) (${passedAssessmentsCount}/${courseAssessments.length} passed).`;
      }
    }

    return {
      enrollmentId: enrollment.id,
      courseId: enrollment.course_id,
      courseCode: enrollment.course?.code ?? 'COURSE',
      courseTitle: enrollment.course?.title ?? 'Training Course',
      courseDomain: enrollment.course?.domain ?? 'General Governance',
      progressPercent: enrollment.progress_percent,
      enrollmentStatus: enrollment.status,
      courseCompleted,
      requiredAssessmentsCount: courseAssessments.length,
      passedAssessmentsCount,
      eligibleForClaim,
      alreadyIssuedCertificate,
      blockingReason,
    };
  });

  return items.sort((a, b) => {
    const rank = (item: CourseCertificateEligibility) =>
      item.eligibleForClaim ? 0 : item.alreadyIssuedCertificate ? 1 : 2;
    return rank(a) - rank(b);
  });
}
