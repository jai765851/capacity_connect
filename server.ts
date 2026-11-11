import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim() || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
const ADMIN_BOOTSTRAP_SECRET = process.env.ADMIN_BOOTSTRAP_SECRET?.trim() || '';

function getAdminClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function clampScoreServer(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function scoreToLevelServer(scorePercent: number): number {
  const s = clampScoreServer(scorePercent);
  if (s >= 90) return 5;
  if (s >= 75) return 4;
  if (s >= 60) return 3;
  if (s >= 40) return 2;
  return 1;
}

function isMissingColumnError(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err?.message) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('schema cache'));
}

async function requireActiveAuthProfile(
  req: Request,
  res: Response,
  supabaseAdmin: SupabaseClient
): Promise<{
  id: string;
  role: 'trainee' | 'trainer' | 'admin';
  approval_status: string;
  account_status: string;
  full_name: string;
} | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer authorization token.' });
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
    return null;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, approval_status, account_status, full_name')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    res.status(403).json({ error: 'Authenticated user profile could not be verified.' });
    return null;
  }

  if (profile.account_status !== 'active') {
    res.status(403).json({ error: 'Account is suspended and cannot submit requests.' });
    return null;
  }

  return profile as {
    id: string;
    role: 'trainee' | 'trainer' | 'admin';
    approval_status: string;
    account_status: string;
    full_name: string;
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health & Configuration Readiness (booleans only, never exposes secret values)
  app.get('/api/health', async (_req: Request, res: Response) => {
    const supabaseAdmin = getAdminClient();
    let hasAdminAccount: boolean | null = null;
    let databaseSchemaReady = false;
    let competencyScoringEngineReady = false;
    let trainingWorkflowSchemaReady = false;

    if (supabaseAdmin) {
      const [
        profilesCheck,
        competenciesCheck,
        jobRolesCheck,
        coursesCoreCheck,
        enrollmentsCheck,
        trainerViewCheck,
        reqScoreCheck,
        progressScoreCheck,
        courses006Check,
        assessments006Check,
      ] = await Promise.all([
        supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
        supabaseAdmin.from('competencies').select('id').limit(1),
        supabaseAdmin.from('job_roles').select('id').limit(1),
        supabaseAdmin.from('courses').select('id').limit(1),
        supabaseAdmin.from('enrollments').select('id').limit(1),
        supabaseAdmin.from('public_trainer_directory').select('id').limit(1),
        supabaseAdmin.from('role_requirements').select('required_score').limit(1),
        supabaseAdmin.from('progress_history').select('recorded_score, assessed_by').limit(1),
        supabaseAdmin.from('courses').select('learning_objectives, approval_status').limit(1),
        supabaseAdmin.from('assessments').select('due_at').limit(1),
      ]);

      if (
        !profilesCheck.error &&
        !competenciesCheck.error &&
        !jobRolesCheck.error &&
        !coursesCoreCheck.error &&
        !enrollmentsCheck.error &&
        !trainerViewCheck.error
      ) {
        databaseSchemaReady = true;
        hasAdminAccount = (profilesCheck.count ?? 0) > 0;
      }
      if (databaseSchemaReady && !reqScoreCheck.error && !progressScoreCheck.error) {
        competencyScoringEngineReady = true;
      }
      if (databaseSchemaReady && !courses006Check.error && !assessments006Check.error) {
        trainingWorkflowSchemaReady = true;
      }
    }

    res.json({
      status: 'ok',
      supabaseClientConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
      supabaseAdminConfigured: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
      bootstrapConfigured: Boolean(ADMIN_BOOTSTRAP_SECRET),
      databaseSchemaReady,
      competencyScoringEngineReady,
      trainingWorkflowSchemaReady,
      hasAdminAccount,
    });
  });

  // One-Time First Admin Bootstrap Endpoint (requires ADMIN_BOOTSTRAP_SECRET + zero existing admins)
  app.post('/api/admin/bootstrap', async (req: Request, res: Response) => {
    const supabaseAdmin = getAdminClient();
    if (!supabaseAdmin) {
      res.status(503).json({
        error:
          'Server-side Supabase credentials (VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) are not configured.',
      });
      return;
    }

    if (!ADMIN_BOOTSTRAP_SECRET) {
      res.status(503).json({
        error: 'ADMIN_BOOTSTRAP_SECRET is not configured on the server.',
      });
      return;
    }

    const { bootstrapSecret, email, password, fullName, department, designation } = req.body ?? {};
    if (
      typeof bootstrapSecret !== 'string' ||
      !safeEqual(bootstrapSecret.trim(), ADMIN_BOOTSTRAP_SECRET)
    ) {
      res.status(403).json({ error: 'Invalid bootstrap secret.' });
      return;
    }

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof fullName !== 'string' ||
      password.length < 8
    ) {
      res.status(400).json({
        error: 'Valid fullName, email, and password (minimum 8 characters) are required.',
      });
      return;
    }

    const { count, error: countError } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin');

    if (countError) {
      res.status(500).json({ error: `Failed to verify existing admins: ${countError.message}` });
      return;
    }

    if ((count ?? 0) > 0) {
      res.status(409).json({
        error:
          'An administrator account already exists. Additional admins must be created by an authenticated Admin via User Management.',
      });
      return;
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        department: typeof department === 'string' ? department.trim() : 'Administration',
        designation: typeof designation === 'string' ? designation.trim() : 'System Administrator',
        requested_role: 'trainee',
      },
    });

    if (createError || !created.user) {
      res.status(400).json({ error: createError?.message ?? 'Failed to create admin user.' });
      return;
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: created.user.id,
          email: email.trim(),
          full_name: fullName.trim(),
          role: 'admin',
          approval_status: 'approved',
          account_status: 'active',
          department: typeof department === 'string' ? department.trim() : 'Administration',
          designation: typeof designation === 'string' ? designation.trim() : 'System Administrator',
        },
        { onConflict: 'id' }
      );

    if (updateError) {
      res.status(500).json({ error: `User created in Auth, but profile role assignment failed: ${updateError.message}` });
      return;
    }

    res.status(201).json({
      message: 'Initial administrator account created and activated.',
      userId: created.user.id,
      email: email.trim(),
    });
  });

  // Authenticated Admin-Only Provisioning (creates Trainee, Trainer, or Admin accounts)
  app.post('/api/admin/create-user', async (req: Request, res: Response) => {
    const supabaseAdmin = getAdminClient();
    if (!supabaseAdmin) {
      res.status(503).json({
        error: 'Server-side Supabase credentials are not configured.',
      });
      return;
    }

    const callerProfile = await requireActiveAuthProfile(req, res, supabaseAdmin);
    if (!callerProfile) return;

    if (callerProfile.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden: active Admin role required.' });
      return;
    }

    const { email, password, fullName, role, department, designation } = req.body ?? {};
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof fullName !== 'string' ||
      !['trainee', 'trainer', 'admin'].includes(role) ||
      password.length < 8
    ) {
      res.status(400).json({
        error: 'Provide valid fullName, email, password (>= 8 chars), and role (trainee | trainer | admin).',
      });
      return;
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        department: typeof department === 'string' ? department.trim() : '',
        designation: typeof designation === 'string' ? designation.trim() : '',
        requested_role: 'trainee',
      },
    });

    if (createError || !created.user) {
      res.status(400).json({ error: createError?.message ?? 'Failed to provision user.' });
      return;
    }

    const { error: upsertError } = await supabaseAdmin.from('profiles').upsert(
      {
        id: created.user.id,
        email: email.trim(),
        full_name: fullName.trim(),
        role,
        approval_status: 'approved',
        account_status: 'active',
        department: typeof department === 'string' ? department.trim() : '',
        designation: typeof designation === 'string' ? designation.trim() : '',
      },
      { onConflict: 'id' }
    );

    if (upsertError) {
      res.status(500).json({ error: `Failed to assign profile role: ${upsertError.message}` });
      return;
    }

    res.status(201).json({
      message: `${role} account provisioned successfully.`,
      user: {
        id: created.user.id,
        email: email.trim(),
        fullName: fullName.trim(),
        role,
      },
    });
  });

  // Authoritative Trainee Assessment Submission & Server-Side MCQ Grading
  app.post('/api/assessments/submit', async (req: Request, res: Response) => {
    const supabaseAdmin = getAdminClient();
    if (!supabaseAdmin) {
      res.status(503).json({
        error: 'Server-side Supabase credentials are not configured.',
      });
      return;
    }

    const traineeProfile = await requireActiveAuthProfile(req, res, supabaseAdmin);
    if (!traineeProfile) return;

    if (traineeProfile.role !== 'trainee') {
      res.status(403).json({ error: 'Only trainee accounts may submit assessment attempts.' });
      return;
    }

    const { assessmentId, answers } = req.body ?? {};
    if (
      typeof assessmentId !== 'string' ||
      !assessmentId.trim() ||
      !answers ||
      typeof answers !== 'object' ||
      Array.isArray(answers)
    ) {
      res.status(400).json({ error: 'Valid assessmentId and answers map are required.' });
      return;
    }

    const cleanAnswers: Record<string, string> = {};
    for (const [key, val] of Object.entries(answers as Record<string, unknown>)) {
      if (typeof val === 'string') {
        cleanAnswers[key] = val;
      } else if (val !== null && val !== undefined) {
        cleanAnswers[key] = String(val);
      }
    }

    const { data: assessment, error: assmtErr } = await supabaseAdmin
      .from('assessments')
      .select('*, competency:competencies(id, code, title)')
      .eq('id', assessmentId.trim())
      .maybeSingle();

    if (assmtErr || !assessment) {
      res.status(404).json({ error: assmtErr?.message ?? 'Assessment not found.' });
      return;
    }

    if (!assessment.is_published) {
      res.status(403).json({ error: 'This assessment is currently unpublished and cannot be attempted.' });
      return;
    }

    if (assessment.due_at) {
      const dueMs = new Date(assessment.due_at as string).getTime();
      if (!Number.isNaN(dueMs) && dueMs < Date.now()) {
        res.status(400).json({ error: 'The submission deadline for this assessment has passed.' });
        return;
      }
    }

    if (assessment.course_id && assessment.assessment_type !== 'Diagnostic Baseline') {
      const { data: activeEnrollment, error: enrollErr } = await supabaseAdmin
        .from('enrollments')
        .select('id, status')
        .eq('trainee_id', traineeProfile.id)
        .eq('course_id', assessment.course_id)
        .neq('status', 'withdrawn')
        .maybeSingle();

      if (enrollErr) {
        res.status(500).json({ error: `Unable to verify course enrolment: ${enrollErr.message}` });
        return;
      }
      if (!activeEnrollment) {
        res.status(403).json({
          error: 'Active enrolment in the linked course is required before attempting this assessment.',
        });
        return;
      }
    }

    const { data: questions, error: qErr } = await supabaseAdmin
      .from('assessment_questions')
      .select('*')
      .eq('assessment_id', assessment.id)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (qErr) {
      res.status(500).json({ error: `Failed to load assessment questions: ${qErr.message}` });
      return;
    }

    const questionRows = (questions ?? []) as Array<{
      id: string;
      question_text: string;
      question_type: string;
      correct_option: string | null;
      max_marks: number;
    }>;

    if (questionRows.length === 0) {
      res.status(400).json({ error: 'No questions have been published for this assessment yet.' });
      return;
    }

    const autoGradable = questionRows.every(
      (q) =>
        q.question_type === 'Multiple Choice' &&
        typeof q.correct_option === 'string' &&
        q.correct_option.trim().length > 0
    );

    let scorePercent: number | null = null;
    let achievedLevel: number | null = null;
    let passed: boolean | null = null;
    let status: 'submitted' | 'evaluated' = 'submitted';

    const questionFeedback: Array<{
      questionId: string;
      questionText: string;
      selectedAnswer: string;
      correctOption: string | null;
      isCorrect: boolean | null;
      earnedMarks: number;
      maxMarks: number;
    }> = [];

    if (autoGradable) {
      let earnedMarks = 0;
      let totalMarks = 0;
      for (const q of questionRows) {
        const maxMarks = Number(q.max_marks || 0);
        totalMarks += maxMarks;
        const selected = (cleanAnswers[q.id] ?? '').trim();
        const correct = (q.correct_option ?? '').trim();
        const isCorrect = selected === correct;
        const earned = isCorrect ? maxMarks : 0;
        earnedMarks += earned;
        questionFeedback.push({
          questionId: q.id,
          questionText: q.question_text,
          selectedAnswer: selected,
          correctOption: correct,
          isCorrect,
          earnedMarks: earned,
          maxMarks,
        });
      }

      scorePercent = totalMarks > 0 ? clampScoreServer((earnedMarks / totalMarks) * 100) : 0;
      achievedLevel = scoreToLevelServer(scorePercent);
      passed = scorePercent >= Number(assessment.passing_score_percent || 70);
      status = 'evaluated';
    } else {
      for (const q of questionRows) {
        questionFeedback.push({
          questionId: q.id,
          questionText: q.question_text,
          selectedAnswer: (cleanAnswers[q.id] ?? '').trim(),
          correctOption: null,
          isCorrect: null,
          earnedMarks: 0,
          maxMarks: Number(q.max_marks || 0),
        });
      }
    }

    const nowIso = new Date().toISOString();
    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('assessment_attempts')
      .insert({
        assessment_id: assessment.id,
        trainee_id: traineeProfile.id,
        competency_id: assessment.competency_id ?? null,
        answers: cleanAnswers,
        score_percent: scorePercent,
        achieved_level: achievedLevel,
        passed,
        status,
        submitted_at: nowIso,
        evaluated_at: autoGradable ? nowIso : null,
        evaluator_notes: autoGradable
          ? 'Automated objective scoring completed on submission.'
          : '',
      })
      .select(
        '*, assessment:assessments(id, code, title, domain, assessment_type, passing_score_percent, course_id, competency_id), competency:competencies(id, code, title)'
      )
      .single();

    if (attemptError || !attempt) {
      res.status(500).json({ error: attemptError?.message ?? 'Failed to record assessment attempt.' });
      return;
    }

    if (autoGradable && achievedLevel !== null && scorePercent !== null) {
      const stage =
        assessment.assessment_type === 'Reassessment Verification'
          ? 'reassessment'
          : 'skill_assessment';
      const baseHistoryRow = {
        trainee_id: traineeProfile.id,
        competency_id: assessment.competency_id ?? null,
        skill_code: assessment.competency?.code ?? assessment.code,
        skill_name: assessment.competency?.title ?? assessment.title,
        domain: assessment.domain,
        stage,
        recorded_level: achievedLevel,
        target_level: scoreToLevelServer(Number(assessment.passing_score_percent || 70)),
        notes: `${assessment.assessment_type} (${scorePercent}% score · ${passed ? 'Benchmark Met' : 'Needs Remediation'})`,
        source_attempt_id: attempt.id,
      };

      const { error: phError } = await supabaseAdmin.from('progress_history').insert({
        ...baseHistoryRow,
        recorded_score: scorePercent,
        target_score: assessment.passing_score_percent,
      });

      if (phError && isMissingColumnError(phError)) {
        await supabaseAdmin.from('progress_history').insert(baseHistoryRow);
      }

      try {
        await supabaseAdmin.from('notifications').insert({
          recipient_id: traineeProfile.id,
          audience: 'User',
          priority: passed ? 'Standard' : 'Important',
          title: `Assessment Evaluated: ${assessment.code}`,
          body: `${assessment.title} scored ${scorePercent}% (${passed ? 'Benchmark met' : 'Below passing benchmark'}).`,
          created_by: traineeProfile.id,
        });
      } catch {
        // Non-blocking notification failure
      }
    }

    res.status(201).json({
      attempt,
      questionFeedback,
    });
  });

  // Authoritative Trainee Completion Certificate Claim (verifies 100% progress + passed course assessments)
  app.post('/api/certificates/claim', async (req: Request, res: Response) => {
    const supabaseAdmin = getAdminClient();
    if (!supabaseAdmin) {
      res.status(503).json({
        error: 'Server-side Supabase credentials are not configured.',
      });
      return;
    }

    const traineeProfile = await requireActiveAuthProfile(req, res, supabaseAdmin);
    if (!traineeProfile) return;

    if (traineeProfile.role !== 'trainee') {
      res.status(403).json({ error: 'Only trainees can claim completion certificates.' });
      return;
    }

    const { courseId } = req.body ?? {};
    if (typeof courseId !== 'string' || !courseId.trim()) {
      res.status(400).json({ error: 'Valid courseId is required.' });
      return;
    }

    const cleanCourseId = courseId.trim();

    const { data: existingCert, error: existingErr } = await supabaseAdmin
      .from('certificates')
      .select(
        `
        *,
        trainee:profiles!certificates_trainee_id_fkey(id, full_name, email, department, designation),
        course:courses(id, code, title, domain, duration_hours),
        verifier:profiles!certificates_verified_by_fkey(id, full_name)
      `
      )
      .eq('trainee_id', traineeProfile.id)
      .eq('course_id', cleanCourseId)
      .eq('status', 'verified')
      .maybeSingle();

    if (existingErr) {
      res.status(500).json({ error: `Unable to check existing certificates: ${existingErr.message}` });
      return;
    }

    if (existingCert) {
      res.status(200).json({ certificate: existingCert, alreadyIssued: true });
      return;
    }

    const { data: enrollment, error: enrollErr } = await supabaseAdmin
      .from('enrollments')
      .select('id, status, progress_percent')
      .eq('trainee_id', traineeProfile.id)
      .eq('course_id', cleanCourseId)
      .neq('status', 'withdrawn')
      .maybeSingle();

    if (enrollErr) {
      res.status(500).json({ error: `Unable to verify course enrolment: ${enrollErr.message}` });
      return;
    }

    if (!enrollment) {
      res.status(403).json({ error: 'Active enrolment in this course is required before claiming a certificate.' });
      return;
    }

    const courseCompleted =
      enrollment.status === 'completed' || Number(enrollment.progress_percent ?? 0) >= 100;
    if (!courseCompleted) {
      res.status(400).json({
        error: 'Complete 100% of course progress before claiming your completion certificate.',
      });
      return;
    }

    const { data: linkedAssessments, error: linkedAssmtErr } = await supabaseAdmin
      .from('assessments')
      .select('id, code, title')
      .eq('course_id', cleanCourseId)
      .eq('is_published', true);

    if (linkedAssmtErr) {
      res.status(500).json({ error: `Unable to verify course assessments: ${linkedAssmtErr.message}` });
      return;
    }

    let latestPassedAttemptId: string | null = null;
    if (linkedAssessments && linkedAssessments.length > 0) {
      const assessmentIds = linkedAssessments.map((a) => a.id);
      const { data: passedAttempts, error: passedErr } = await supabaseAdmin
        .from('assessment_attempts')
        .select('id, assessment_id, evaluated_at')
        .eq('trainee_id', traineeProfile.id)
        .eq('status', 'evaluated')
        .eq('passed', true)
        .in('assessment_id', assessmentIds)
        .order('evaluated_at', { ascending: false });

      if (passedErr) {
        res.status(500).json({ error: `Unable to verify passed attempts: ${passedErr.message}` });
        return;
      }

      const passedSet = new Set((passedAttempts ?? []).map((p) => p.assessment_id));
      const allPassed = assessmentIds.every((id) => passedSet.has(id));
      if (!allPassed) {
        res.status(400).json({
          error: `Pass all ${assessmentIds.length} published course assessment(s) before claiming your completion certificate.`,
        });
        return;
      }

      latestPassedAttemptId = passedAttempts?.[0]?.id ?? null;
    }

    const certificateCode = `CERT-${new Date().getFullYear()}-${crypto
      .randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;

    const { data: createdCert, error: insertErr } = await supabaseAdmin
      .from('certificates')
      .insert({
        certificate_code: certificateCode,
        trainee_id: traineeProfile.id,
        course_id: cleanCourseId,
        assessment_attempt_id: latestPassedAttemptId,
        verified_by: null,
        status: 'verified',
        storage_path: null,
      })
      .select(
        `
        *,
        trainee:profiles!certificates_trainee_id_fkey(id, full_name, email, department, designation),
        course:courses(id, code, title, domain, duration_hours),
        verifier:profiles!certificates_verified_by_fkey(id, full_name)
      `
      )
      .single();

    if (insertErr || !createdCert) {
      res.status(500).json({ error: insertErr?.message ?? 'Failed to generate certificate record.' });
      return;
    }

    try {
      await supabaseAdmin.from('notifications').insert({
        recipient_id: traineeProfile.id,
        audience: 'User',
        priority: 'Important',
        title: `Completion Certificate Issued: ${certificateCode}`,
        body: 'Your verified course completion certificate is ready under Certificates.',
        created_by: traineeProfile.id,
      });
    } catch {
      // Non-blocking notification failure
    }

    res.status(201).json({ certificate: createdCert, alreadyIssued: false });
  });

  // Public Contact Inquiry Endpoint -> stores alert for Admins in notifications
  app.post('/api/contact', async (req: Request, res: Response) => {
    const supabaseAdmin = getAdminClient();
    if (!supabaseAdmin) {
      res.status(503).json({
        error: 'Database service is not yet configured to persist contact inquiries.',
      });
      return;
    }

    const { fullName, email, organisation, inquiryType, message } = req.body ?? {};
    if (
      typeof fullName !== 'string' ||
      typeof email !== 'string' ||
      typeof organisation !== 'string' ||
      typeof message !== 'string' ||
      !fullName.trim() ||
      !email.trim() ||
      message.trim().length < 15
    ) {
      res.status(400).json({ error: 'Complete all required contact fields.' });
      return;
    }

    const { error } = await supabaseAdmin.from('notifications').insert({
      audience: 'Admins Only',
      priority: 'Important',
      title: `Contact Inquiry: ${inquiryType || 'General'} — ${organisation.trim()}`,
      body: `From ${fullName.trim()} (${email.trim()}, ${organisation.trim()}): ${message.trim()}`,
    });

    if (error) {
      res.status(500).json({ error: `Failed to record inquiry: ${error.message}` });
      return;
    }

    res.status(201).json({ message: 'Inquiry recorded for administrative review.' });
  });

  // Vite dev middleware or static dist serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CAPACITY CONNECT server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
