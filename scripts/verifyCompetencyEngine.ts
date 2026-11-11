import assert from 'node:assert/strict';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import {
  calculateSkillGap,
  classifyGapStatus,
  computeCompetencyGapReport,
  computeCourseCertificateEligibility,
  isAssessmentPastDeadline,
  matchCoursesForCompetency,
  scoreToProficiencyLevel,
} from '../src/services/competencyEngine';
import { validateStorageUploadFile } from '../src/lib/uploadValidation';
import {
  AssessmentAttemptRecord,
  AssessmentRecord,
  CertificateRecord,
  CompetencyRecord,
  CourseRecord,
  EnrollmentRecord,
  ProgressHistoryRecord,
  PublicTrainerDirectoryItem,
  RoleRequirementRecord,
  TrainerAssignmentRecord,
} from '../src/types/competency';

function runEngineUnitAssertions() {
  // 1. Exact prompt formula assertions: Skill Gap = max(0, Required - Current)
  assert.equal(calculateSkillGap(80, 60), 20, 'Java gap should be 80 - 60 = 20');
  assert.equal(calculateSkillGap(75, 40), 35, 'SQL gap should be 75 - 40 = 35');
  assert.equal(calculateSkillGap(70, 65), 5, 'Problem Solving gap should be 70 - 65 = 5');
  assert.equal(calculateSkillGap(80, 90), 0, 'Exceeded score must clamp skill gap to 0');

  assert.equal(classifyGapStatus(80, 60), 'Critical Gap');
  assert.equal(classifyGapStatus(75, 40), 'Critical Gap');
  assert.equal(classifyGapStatus(70, 65), 'Minor Gap');
  assert.equal(classifyGapStatus(80, 80), 'Met / Exceeded');
  assert.equal(classifyGapStatus(80, null), 'Assessment Pending');

  const now = new Date().toISOString();
  const compJava: CompetencyRecord = {
    id: 'comp-java',
    code: 'COMP-JAVA-01',
    title: 'Java Service Architecture',
    domain: 'Digital Infrastructure',
    description: 'Enterprise Java backend design',
    max_level: 5,
    created_by: null,
    created_at: now,
    updated_at: now,
  };
  const compSql: CompetencyRecord = {
    id: 'comp-sql',
    code: 'COMP-SQL-02',
    title: 'SQL & Relational Querying',
    domain: 'Digital Infrastructure',
    description: 'PostgreSQL performance and schema discipline',
    max_level: 5,
    created_by: null,
    created_at: now,
    updated_at: now,
  };
  const compPs: CompetencyRecord = {
    id: 'comp-ps',
    code: 'COMP-PS-03',
    title: 'Analytical Problem Solving',
    domain: 'Policy & Programme Evaluation',
    description: 'Structured root-cause diagnosis',
    max_level: 5,
    created_by: null,
    created_at: now,
    updated_at: now,
  };

  // Steps 1 & 2: Organisational Role Requirements
  const requirements: RoleRequirementRecord[] = [
    {
      id: 'req-java',
      job_role_id: 'role-eng-1',
      competency_id: compJava.id,
      required_score: 80,
      required_level: scoreToProficiencyLevel(80),
      priority: 'core',
      created_at: now,
      competency: compJava,
    },
    {
      id: 'req-sql',
      job_role_id: 'role-eng-1',
      competency_id: compSql.id,
      required_score: 75,
      required_level: scoreToProficiencyLevel(75),
      priority: 'core',
      created_at: now,
      competency: compSql,
    },
    {
      id: 'req-ps',
      job_role_id: 'role-eng-1',
      competency_id: compPs.id,
      required_score: 70,
      required_level: scoreToProficiencyLevel(70),
      priority: 'supporting',
      created_at: now,
      competency: compPs,
    },
  ];

  // Steps 5 & 6: Courses & Verified vs Unverified Trainers
  const courses: CourseRecord[] = [
    {
      id: 'course-sql-direct',
      code: 'TRN-SQL-201',
      title: 'Applied PostgreSQL & Query Governance',
      domain: 'Digital Infrastructure',
      delivery_mode: 'Applied Workshop',
      target_level: 'Intermediate',
      duration_hours: 18,
      summary: 'Relational optimization and audit indexing.',
      prerequisites: 'Basic SQL',
      assessment_method: 'Practical Rubric',
      lead_department: 'Systems Engineering',
      created_by: null,
      is_published: true,
      created_at: now,
      updated_at: now,
      course_competencies: [
        {
          id: 'cc-1',
          course_id: 'course-sql-direct',
          competency_id: compSql.id,
          target_level_gain: 2,
          competency: compSql,
        },
      ],
    },
    {
      id: 'course-infra-domain',
      code: 'TRN-INF-101',
      title: 'Core Digital Systems Workshop',
      domain: 'Digital Infrastructure',
      delivery_mode: 'Blended',
      target_level: 'Foundation',
      duration_hours: 12,
      summary: 'General digital infrastructure engineering.',
      prerequisites: 'None',
      assessment_method: 'Written Quiz',
      lead_department: 'Systems Engineering',
      created_by: null,
      is_published: true,
      created_at: now,
      updated_at: now,
      course_competencies: [],
    },
  ];

  const trainers: PublicTrainerDirectoryItem[] = [
    {
      id: 'trainer-unverified',
      full_name: 'Unverified Candidate',
      department: 'Digital Infrastructure',
      designation: 'Visiting Lecturer',
      office_location: 'Remote',
      expertise: [
        {
          competency_id: compSql.id,
          domain: 'Digital Infrastructure',
          specialization: 'Database Internals',
          credential: 'Pending Credential',
          years_experience: 15,
          verified_by_admin: false,
        },
      ],
    },
    {
      id: 'trainer-domain-verified',
      full_name: 'Dr. Kavita Rao',
      department: 'Digital Infrastructure',
      designation: 'Principal Systems Architect',
      office_location: 'Block B',
      expertise: [
        {
          competency_id: null,
          domain: 'Digital Infrastructure',
          specialization: 'Enterprise Backend Systems',
          credential: 'Senior Enterprise Architect',
          years_experience: 9,
          verified_by_admin: true,
        },
      ],
    },
    {
      id: 'trainer-sql-verified',
      full_name: 'Arvind Menon',
      department: 'Digital Infrastructure',
      designation: 'Lead Database Engineer',
      office_location: 'Block A',
      expertise: [
        {
          competency_id: compSql.id,
          domain: 'Digital Infrastructure',
          specialization: 'PostgreSQL Query Tuning',
          credential: 'Certified PostgreSQL Professional',
          years_experience: 11,
          verified_by_admin: true,
        },
      ],
    },
  ];

  const activeAssignments: TrainerAssignmentRecord[] = [
    {
      id: 'assign-sql-01',
      trainer_id: 'trainer-sql-verified',
      course_id: 'course-sql-direct',
      cohort_code: 'COH-SQL-2026',
      department: 'Digital Infrastructure',
      assigned_by: null,
      status: 'active',
      assigned_at: now,
    },
  ];

  // Step 3 & 4: Baseline Assessment History
  const baselineHistory: ProgressHistoryRecord[] = [
    {
      id: 'ph-java-base',
      trainee_id: 'trainee-1',
      competency_id: compJava.id,
      skill_code: compJava.code,
      skill_name: compJava.title,
      domain: compJava.domain,
      stage: 'skill_assessment',
      recorded_score: 60,
      recorded_level: 3,
      target_score: 80,
      target_level: 4,
      assessed_by: 'trainer-domain-verified',
      notes: 'Baseline evaluation',
      source_attempt_id: null,
      recorded_at: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'ph-sql-base',
      trainee_id: 'trainee-1',
      competency_id: compSql.id,
      skill_code: compSql.code,
      skill_name: compSql.title,
      domain: compSql.domain,
      stage: 'skill_assessment',
      recorded_score: 40,
      recorded_level: 2,
      target_score: 75,
      target_level: 4,
      assessed_by: 'trainer-sql-verified',
      notes: 'Baseline evaluation',
      source_attempt_id: null,
      recorded_at: '2026-10-01T10:05:00.000Z',
    },
    {
      id: 'ph-ps-base',
      trainee_id: 'trainee-1',
      competency_id: compPs.id,
      skill_code: compPs.code,
      skill_name: compPs.title,
      domain: compPs.domain,
      stage: 'skill_assessment',
      recorded_score: 65,
      recorded_level: 3,
      target_score: 70,
      target_level: 3,
      assessed_by: 'trainer-domain-verified',
      notes: 'Baseline evaluation',
      source_attempt_id: null,
      recorded_at: '2026-10-01T10:10:00.000Z',
    },
  ];

  const baselineReport = computeCompetencyGapReport({
    requirements,
    progressHistory: baselineHistory,
    courses,
    trainers,
    activeAssignments,
  });

  const javaBaselineRow = baselineReport.rows.find((r) => r.competencyId === compJava.id)!;
  const sqlBaselineRow = baselineReport.rows.find((r) => r.competencyId === compSql.id)!;
  const psBaselineRow = baselineReport.rows.find((r) => r.competencyId === compPs.id)!;

  assert.equal(javaBaselineRow.gapDelta, 20);
  assert.equal(sqlBaselineRow.gapDelta, 35);
  assert.equal(psBaselineRow.gapDelta, 5);
  assert.equal(sqlBaselineRow.improvementPoints, null, 'Baseline only must not compute improvement delta');

  // Verify Course & Verified Trainer Matching discipline
  assert.equal(sqlBaselineRow.recommendedCourses[0].code, 'TRN-SQL-201');
  assert.equal(sqlBaselineRow.recommendedCourses[0].matchReason, 'Direct Competency Match');
  assert.equal(sqlBaselineRow.recommendedCourses[0].activeAssignmentId, 'assign-sql-01');
  assert.equal(
    sqlBaselineRow.matchedTrainers.some((t) => t.trainerId === 'trainer-unverified'),
    false,
    'Unverified trainer credentials must never match'
  );
  assert.equal(
    sqlBaselineRow.matchedTrainers[0].trainerId,
    'trainer-sql-verified',
    'Competency-verified trainer must rank first for SQL'
  );

  // Steps 8, 9, 10: Post-Training Reassessment -> Compare Previous vs New Scores
  const postTrainingHistory: ProgressHistoryRecord[] = [
    ...baselineHistory,
    {
      id: 'ph-sql-reassess',
      trainee_id: 'trainee-1',
      competency_id: compSql.id,
      skill_code: compSql.code,
      skill_name: compSql.title,
      domain: compSql.domain,
      stage: 'reassessment',
      recorded_score: 78,
      recorded_level: 4,
      target_score: 75,
      target_level: 4,
      assessed_by: 'trainer-sql-verified',
      notes: 'Post-training reassessment passed',
      source_attempt_id: null,
      recorded_at: '2026-10-15T14:00:00.000Z',
    },
    {
      id: 'ph-java-reassess',
      trainee_id: 'trainee-1',
      competency_id: compJava.id,
      skill_code: compJava.code,
      skill_name: compJava.title,
      domain: compJava.domain,
      stage: 'reassessment',
      recorded_score: 82,
      recorded_level: 4,
      target_score: 80,
      target_level: 4,
      assessed_by: 'trainer-domain-verified',
      notes: 'Post-training reassessment passed',
      source_attempt_id: null,
      recorded_at: '2026-10-15T14:10:00.000Z',
    },
  ];

  const finalReport = computeCompetencyGapReport({
    requirements,
    progressHistory: postTrainingHistory,
    courses,
    trainers,
    activeAssignments,
  });

  const sqlFinalRow = finalReport.rows.find((r) => r.competencyId === compSql.id)!;
  const javaFinalRow = finalReport.rows.find((r) => r.competencyId === compJava.id)!;

  assert.equal(sqlFinalRow.previousScore, 40);
  assert.equal(sqlFinalRow.currentScore, 78);
  assert.equal(sqlFinalRow.gapDelta, 0);
  assert.equal(sqlFinalRow.previousGap, 35);
  assert.equal(sqlFinalRow.improvementPoints, 38);
  assert.equal(sqlFinalRow.gapReducedPoints, 35);
  assert.equal(sqlFinalRow.gapClosurePercent, 100);
  assert.equal(sqlFinalRow.status, 'Met / Exceeded');

  assert.equal(javaFinalRow.previousScore, 60);
  assert.equal(javaFinalRow.currentScore, 82);
  assert.equal(javaFinalRow.improvementPoints, 22);
  assert.equal(javaFinalRow.gapDelta, 0);

  assert.equal(finalReport.summary.reassessedCount, 2);
  assert.equal(finalReport.summary.averageImprovementPoints, 30);
  assert.equal(finalReport.summary.metCount, 2);
  assert.equal(finalReport.summary.openGapCount, 1);

  // Course approval & publication gating
  const governedCourses: CourseRecord[] = [
    ...courses,
    {
      ...courses[0],
      id: 'course-pending',
      code: 'TRN-SQL-PEND',
      approval_status: 'pending',
      is_published: true,
    },
    {
      ...courses[0],
      id: 'course-rejected',
      code: 'TRN-SQL-REJ',
      approval_status: 'rejected',
      is_published: true,
    },
    {
      ...courses[0],
      id: 'course-unpublished',
      code: 'TRN-SQL-DRAFT',
      approval_status: 'approved',
      is_published: false,
    },
  ];
  const recommendedFiltered = matchCoursesForCompetency({
    competencyId: compSql.id,
    domain: 'Digital Infrastructure',
    courses: governedCourses,
    trainers,
    activeAssignments,
  });
  assert.equal(
    recommendedFiltered.some((c) => c.code === 'TRN-SQL-PEND'),
    false,
    'Pending trainer courses must not be recommended'
  );
  assert.equal(
    recommendedFiltered.some((c) => c.code === 'TRN-SQL-REJ'),
    false,
    'Rejected courses must not be recommended'
  );
  assert.equal(
    recommendedFiltered.some((c) => c.code === 'TRN-SQL-DRAFT'),
    false,
    'Unpublished draft courses must not be recommended'
  );

  // Assessment deadline checks
  const refNow = new Date('2026-10-10T12:00:00.000Z');
  assert.equal(isAssessmentPastDeadline(null, refNow), false);
  assert.equal(isAssessmentPastDeadline('2026-10-15T12:00:00.000Z', refNow), false);
  assert.equal(isAssessmentPastDeadline('2026-10-01T12:00:00.000Z', refNow), true);

  // Course completion certificate eligibility rules
  const sampleAssessments: AssessmentRecord[] = [
    {
      id: 'asmt-1',
      code: 'ASM-SQL-1',
      title: 'SQL Mastery Verification',
      domain: 'Digital Infrastructure',
      assessment_type: 'Course Assessment',
      course_id: 'course-eligible',
      competency_id: compSql.id,
      duration_minutes: 30,
      passing_score_percent: 70,
      due_at: null,
      instructions: 'Answer all items',
      created_by: null,
      is_published: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'asmt-blocked',
      code: 'ASM-PS-1',
      title: 'Problem Solving Verification',
      domain: 'Policy & Programme Evaluation',
      assessment_type: 'Course Assessment',
      course_id: 'course-unpassed',
      competency_id: compPs.id,
      duration_minutes: 30,
      passing_score_percent: 70,
      due_at: null,
      instructions: 'Answer all items',
      created_by: null,
      is_published: true,
      created_at: now,
      updated_at: now,
    },
  ];
  const sampleEnrollments: EnrollmentRecord[] = [
    {
      id: 'enr-eligible',
      trainee_id: 'trainee-1',
      course_id: 'course-eligible',
      trainer_assignment_id: null,
      mapped_competency_id: compSql.id,
      assignment_reason: 'Gap remediation',
      progress_percent: 100,
      status: 'completed',
      assigned_by: null,
      enrolled_at: now,
      completed_at: now,
      course: {
        id: 'course-eligible',
        code: 'TRN-ELIG',
        title: 'Eligible Course',
        domain: 'Digital Infrastructure',
        delivery_mode: 'Blended',
        duration_hours: 12,
      },
    },
    {
      id: 'enr-inprogress',
      trainee_id: 'trainee-1',
      course_id: 'course-inprog',
      trainer_assignment_id: null,
      mapped_competency_id: compJava.id,
      assignment_reason: 'Gap remediation',
      progress_percent: 75,
      status: 'in_progress',
      assigned_by: null,
      enrolled_at: now,
      completed_at: null,
      course: {
        id: 'course-inprog',
        code: 'TRN-INP',
        title: 'In Progress Course',
        domain: 'Digital Infrastructure',
        delivery_mode: 'Blended',
        duration_hours: 10,
      },
    },
    {
      id: 'enr-unpassed',
      trainee_id: 'trainee-1',
      course_id: 'course-unpassed',
      trainer_assignment_id: null,
      mapped_competency_id: compPs.id,
      assignment_reason: 'Gap remediation',
      progress_percent: 100,
      status: 'completed',
      assigned_by: null,
      enrolled_at: now,
      completed_at: now,
      course: {
        id: 'course-unpassed',
        code: 'TRN-UNP',
        title: 'Completed Unpassed Course',
        domain: 'Policy & Programme Evaluation',
        delivery_mode: 'Blended',
        duration_hours: 8,
      },
    },
    {
      id: 'enr-issued',
      trainee_id: 'trainee-1',
      course_id: 'course-issued',
      trainer_assignment_id: null,
      mapped_competency_id: null,
      assignment_reason: 'Completed',
      progress_percent: 100,
      status: 'completed',
      assigned_by: null,
      enrolled_at: now,
      completed_at: now,
      course: {
        id: 'course-issued',
        code: 'TRN-ISS',
        title: 'Already Certified Course',
        domain: 'Public Finance & Audit',
        delivery_mode: 'Blended',
        duration_hours: 6,
      },
    },
  ];
  const sampleAttempts: AssessmentAttemptRecord[] = [
    {
      id: 'att-pass',
      assessment_id: 'asmt-1',
      trainee_id: 'trainee-1',
      competency_id: compSql.id,
      answers: {},
      score_percent: 85,
      achieved_level: 4,
      passed: true,
      evaluated_by: null,
      evaluator_notes: 'Passed',
      status: 'evaluated',
      started_at: now,
      submitted_at: now,
      evaluated_at: now,
    },
    {
      id: 'att-fail',
      assessment_id: 'asmt-blocked',
      trainee_id: 'trainee-1',
      competency_id: compPs.id,
      answers: {},
      score_percent: 45,
      achieved_level: 2,
      passed: false,
      evaluated_by: null,
      evaluator_notes: 'Needs review',
      status: 'evaluated',
      started_at: now,
      submitted_at: now,
      evaluated_at: now,
    },
  ];
  const sampleCertificates: CertificateRecord[] = [
    {
      id: 'cert-1',
      certificate_code: 'CERT-2026-ISS001',
      trainee_id: 'trainee-1',
      course_id: 'course-issued',
      assessment_attempt_id: null,
      verified_by: null,
      status: 'verified',
      storage_path: null,
      issued_at: now,
    },
  ];

  const eligResults = computeCourseCertificateEligibility({
    enrollments: sampleEnrollments,
    assessments: sampleAssessments,
    attempts: sampleAttempts,
    certificates: sampleCertificates,
  });
  assert.equal(eligResults[0].courseId, 'course-eligible', 'Claim-ready courses sort first');
  assert.equal(eligResults[0].eligibleForClaim, true);
  assert.equal(eligResults[0].blockingReason, null);

  const issuedItem = eligResults.find((e) => e.courseId === 'course-issued')!;
  assert.equal(issuedItem.eligibleForClaim, false);
  assert.equal(issuedItem.alreadyIssuedCertificate?.certificate_code, 'CERT-2026-ISS001');

  const inProgressItem = eligResults.find((e) => e.courseId === 'course-inprog')!;
  assert.equal(inProgressItem.eligibleForClaim, false);
  assert.match(inProgressItem.blockingReason ?? '', /100%/);

  const unpassedItem = eligResults.find((e) => e.courseId === 'course-unpassed')!;
  assert.equal(unpassedItem.eligibleForClaim, false);
  assert.match(unpassedItem.blockingReason ?? '', /0\/1 passed/);

  // Storage upload validation checks
  assert.equal(
    validateStorageUploadFile({ name: 'session1.mp4', size: 50 * 1024 * 1024, type: 'video/mp4' }, 'Video Lecture').valid,
    true
  );
  assert.equal(
    validateStorageUploadFile({ name: 'oversized.mp4', size: 105 * 1024 * 1024, type: 'video/mp4' }, 'Video Lecture').valid,
    false
  );
  assert.equal(
    validateStorageUploadFile({ name: 'malware.exe', size: 1024, type: 'application/octet-stream' }, 'Video Lecture').valid,
    false
  );
  assert.equal(
    validateStorageUploadFile({ name: 'deck.pptx', size: 5 * 1024 * 1024, type: 'application/vnd.ms-powerpoint' }, 'Slide Deck').valid,
    true
  );
  assert.equal(
    validateStorageUploadFile({ name: 'cert.pdf', size: 2 * 1024 * 1024, type: 'application/pdf' }, 'certificate').valid,
    true
  );
  assert.equal(
    validateStorageUploadFile({ name: 'cert.png', size: 12 * 1024 * 1024, type: 'image/png' }, 'certificate').valid,
    false
  );
  assert.equal(
    validateStorageUploadFile({ name: 'empty.pdf', size: 0, type: 'application/pdf' }, 'Reference Manual').valid,
    false
  );

  console.log('UNIT_ENGINE_PASS: All 10-step competency mapping, gap math, workflow gating & upload validation assertions passed.');
}

async function runLiveSupabaseCheckIfConfigured() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.log(
      'LIVE_SUPABASE_SKIPPED: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is absent; configure .env and apply migrations 001-006 to run live database integration test.'
    );
    return;
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify schema readiness for migration 005 & 006 columns
  const { error: schema005Error } = await adminClient
    .from('role_requirements')
    .select('id, required_score')
    .limit(1);
  if (schema005Error) {
    console.log(
      `LIVE_SUPABASE_SCHEMA_PENDING: Migration 005 required on remote DB (${schema005Error.message}).`
    );
    return;
  }

  const { error: phError } = await adminClient
    .from('progress_history')
    .select('id, recorded_score, assessed_by')
    .limit(1);
  assert.equal(phError, null, `Expected progress_history 005 columns: ${phError?.message}`);

  const { error: schema006CourseErr } = await adminClient
    .from('courses')
    .select('id, learning_objectives, approval_status')
    .limit(1);
  if (schema006CourseErr) {
    console.log(
      `LIVE_SUPABASE_SCHEMA_PENDING: Migration 006 required on remote DB (${schema006CourseErr.message}).`
    );
    return;
  }

  const { error: schema006AsmtErr } = await adminClient
    .from('assessments')
    .select('id, due_at')
    .limit(1);
  assert.equal(schema006AsmtErr, null, `Expected assessments.due_at column: ${schema006AsmtErr?.message}`);

  // Run non-destructive read check across public_trainer_directory and role_requirements
  const { error: viewError } = await adminClient
    .from('public_trainer_directory')
    .select('id, full_name, expertise')
    .limit(5);
  assert.equal(viewError, null, `Expected public_trainer_directory view ready: ${viewError?.message}`);

  console.log('LIVE_SUPABASE_SCHEMA_PASS: Migrations 005 & 006 columns and views verified against live Supabase.');
}

async function main() {
  runEngineUnitAssertions();
  await runLiveSupabaseCheckIfConfigured();
}

main().catch((err) => {
  console.error('VERIFICATION_FAILED:', err);
  process.exit(1);
});
