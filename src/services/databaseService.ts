import { getAppIntegrationConfig } from '../config/env';
import { requireSupabaseClient, supabase } from '../lib/supabaseClient';
import { ApprovalStatus, AccountStatus, NotificationPreferences, UserRole } from '../types/auth';
import {
  AssessmentAttemptRecord,
  AssessmentQuestionRecord,
  AssessmentRecord,
  AssessmentType,
  CertificateRecord,
  CompetencyAnalysisSummary,
  CompetencyRecord,
  CourseApprovalStatus,
  CourseTargetLevel,
  DeliveryMode,
  EnrollmentRecord,
  FeedbackCategory,
  FeedbackRecord,
  InquiryCategory,
  JobRoleRecord,
  LearningMaterialType,
  LearningResourceRecord,
  NotificationAudience,
  NotificationRecord,
  ProfileRecord,
  ProgressHistoryRecord,
  ProgressStage,
  PublicTrainerDirectoryItem,
  QuestionSubmissionFeedback,
  QuestionType,
  RoleRequirementRecord,
  CourseRecord,
  TrainerAssignmentRecord,
  TrainerExpertiseRecord,
  SkillGapComputedRow,
} from '../types/competency';
import { authService } from './authService';
import {
  clampScore,
  computeCompetencyGapReport,
  levelToBenchmarkScore,
  scoreToProficiencyLevel,
} from './competencyEngine';
import { storageService, validateStorageUploadFile } from './storageService';

export function deriveSkillLevelFromScore(scorePercent: number): number {
  return scoreToProficiencyLevel(scorePercent);
}

function isMissingSchemaError(err: { message?: string } | null | undefined): boolean {
  if (!err?.message) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('column') ||
    msg.includes('relationship') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist')
  );
}

export const databaseService = {
  isConnected(): boolean {
    return getAppIntegrationConfig().isSupabaseConfigured && Boolean(supabase);
  },

  // --- PUBLIC CATALOGUE & TRAINER DIRECTORY ---
  async listPublishedCourses(): Promise<CourseRecord[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('courses')
      .select(
        `
        *,
        course_competencies (
          id,
          course_id,
          competency_id,
          target_level_gain,
          competency:competencies (*)
        )
      `
      )
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingSchemaError(error)) {
        throw new Error(
          'PostgreSQL portal schema is not initialized yet. Execute SQL migrations 001–006 in your Supabase SQL Editor.'
        );
      }
      throw new Error(error.message);
    }
    return ((data ?? []) as CourseRecord[]).filter(
      (course) => !course.approval_status || course.approval_status === 'approved'
    );
  },

  async listAllCourses(): Promise<CourseRecord[]> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('courses')
      .select(
        `
        *,
        course_competencies (
          id,
          course_id,
          competency_id,
          target_level_gain,
          competency:competencies (*)
        )
      `
      )
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as CourseRecord[];
  },

  async listPublicTrainers(): Promise<PublicTrainerDirectoryItem[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('public_trainer_directory')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) {
      if (isMissingSchemaError(error)) {
        throw new Error(
          'PostgreSQL trainer directory view is not initialized yet. Execute SQL migrations 001–006 in your Supabase SQL Editor.'
        );
      }
      throw new Error(error.message);
    }
    return (data ?? []) as PublicTrainerDirectoryItem[];
  },

  async submitContactInquiry(payload: {
    fullName: string;
    email: string;
    organisation: string;
    inquiryType: InquiryCategory;
    message: string;
  }): Promise<string> {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as { message?: string; error?: string };
    if (!response.ok) {
      throw new Error(body.error ?? 'Failed to submit inquiry.');
    }
    return body.message ?? 'Inquiry recorded for administrative review.';
  },

  // --- PROFILES ---
  async updateOwnProfile(
    userId: string,
    updates: {
      full_name?: string;
      department?: string;
      designation?: string;
      office_location?: string;
      phone_extension?: string;
      job_role_id?: string | null;
      notification_prefs?: NotificationPreferences;
    }
  ): Promise<ProfileRecord> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as ProfileRecord;
  },

  async listAllProfiles(): Promise<ProfileRecord[]> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('profiles')
      .select('*, job_role:job_roles(id, code, title)')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as ProfileRecord[];
  },

  async listTraineesWithRoles(): Promise<ProfileRecord[]> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('profiles')
      .select('*, job_role:job_roles(id, code, title)')
      .eq('role', 'trainee')
      .eq('account_status', 'active')
      .order('full_name', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as ProfileRecord[];
  },

  async adminUpdateUserProfile(
    userId: string,
    updates: {
      role?: UserRole;
      approval_status?: ApprovalStatus;
      account_status?: AccountStatus;
      department?: string;
      designation?: string;
      job_role_id?: string | null;
    }
  ): Promise<ProfileRecord> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('*, job_role:job_roles(id, code, title)')
      .single();

    if (error) throw new Error(error.message);
    return data as ProfileRecord;
  },

  async adminProvisionUser(payload: {
    fullName: string;
    email: string;
    password: string;
    role: UserRole;
    department: string;
    designation: string;
  }): Promise<{ message: string; user: { id: string; email: string; fullName: string; role: UserRole } }> {
    const token = await authService.getCurrentSessionAccessToken();
    if (!token) {
      throw new Error('Active administrator authentication token is required.');
    }
    const response = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as {
      message?: string;
      error?: string;
      user?: { id: string; email: string; fullName: string; role: UserRole };
    };
    if (!response.ok || !data.user) {
      throw new Error(data.error ?? 'Failed to provision account.');
    }
    return {
      message: data.message ?? 'Account provisioned.',
      user: data.user,
    };
  },

  async bootstrapInitialAdmin(payload: {
    bootstrapSecret: string;
    fullName: string;
    email: string;
    password: string;
    department: string;
    designation: string;
  }): Promise<{ message: string; userId: string; email: string }> {
    const response = await fetch('/api/admin/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as {
      message?: string;
      error?: string;
      userId?: string;
      email?: string;
    };
    if (!response.ok || !data.userId) {
      throw new Error(data.error ?? 'Failed to bootstrap administrator.');
    }
    return {
      message: data.message ?? 'Administrator account initialized.',
      userId: data.userId,
      email: data.email ?? payload.email,
    };
  },

  // --- COMPETENCIES ---
  async listCompetencies(): Promise<CompetencyRecord[]> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('competencies')
      .select('*')
      .order('code', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as CompetencyRecord[];
  },

  async createCompetency(input: {
    code: string;
    title: string;
    domain: string;
    description: string;
    max_level: number;
    created_by: string;
  }): Promise<CompetencyRecord> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('competencies')
      .insert(input)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as CompetencyRecord;
  },

  async deleteCompetency(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('competencies').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // --- JOB ROLES & ROLE REQUIREMENTS ---
  async listJobRoles(): Promise<JobRoleRecord[]> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('job_roles')
      .select('*')
      .order('code', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as JobRoleRecord[];
  },

  async createJobRole(input: {
    code: string;
    title: string;
    department: string;
    grade_level: string;
    description: string;
    created_by: string;
  }): Promise<JobRoleRecord> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('job_roles')
      .insert(input)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as JobRoleRecord;
  },

  async deleteJobRole(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('job_roles').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listRoleRequirements(jobRoleId?: string): Promise<RoleRequirementRecord[]> {
    const client = requireSupabaseClient();
    let query = client
      .from('role_requirements')
      .select('*, competency:competencies(*), job_role:job_roles(*)')
      .order('created_at', { ascending: true });

    if (jobRoleId) {
      query = query.eq('job_role_id', jobRoleId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as RoleRequirementRecord[];
  },

  async upsertRoleRequirement(input: {
    job_role_id: string;
    competency_id: string;
    required_score?: number;
    required_level?: number;
    priority: 'core' | 'supporting';
  }): Promise<RoleRequirementRecord> {
    const client = requireSupabaseClient();
    const normalizedScore =
      typeof input.required_score === 'number'
        ? clampScore(input.required_score)
        : levelToBenchmarkScore(input.required_level ?? 3);
    const derivedLevel =
      typeof input.required_score === 'number'
        ? scoreToProficiencyLevel(normalizedScore)
        : (input.required_level ?? scoreToProficiencyLevel(normalizedScore));

    const { data, error } = await client
      .from('role_requirements')
      .upsert(
        {
          job_role_id: input.job_role_id,
          competency_id: input.competency_id,
          required_level: derivedLevel,
          required_score: normalizedScore,
          priority: input.priority,
        },
        { onConflict: 'job_role_id,competency_id' }
      )
      .select('*, competency:competencies(*), job_role:job_roles(*)')
      .single();

    if (error && isMissingSchemaError(error)) {
      const { data: legacyData, error: legacyErr } = await client
        .from('role_requirements')
        .upsert(
          {
            job_role_id: input.job_role_id,
            competency_id: input.competency_id,
            required_level: derivedLevel,
            priority: input.priority,
          },
          { onConflict: 'job_role_id,competency_id' }
        )
        .select('*, competency:competencies(*), job_role:job_roles(*)')
        .single();
      if (legacyErr) throw new Error(legacyErr.message);
      return legacyData as RoleRequirementRecord;
    }

    if (error) throw new Error(error.message);
    return data as RoleRequirementRecord;
  },

  async deleteRoleRequirement(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('role_requirements').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // --- TRAINER EXPERTISE & FACULTY MATCHING ---
  async listTrainerExpertise(trainerId?: string): Promise<TrainerExpertiseRecord[]> {
    const client = requireSupabaseClient();
    let query = client
      .from('trainer_expertise')
      .select('*, competency:competencies(id, code, title)')
      .order('created_at', { ascending: false });
    if (trainerId) {
      query = query.eq('trainer_id', trainerId);
    }
    const { data, error } = await query;
    if (error && isMissingSchemaError(error)) {
      let legacyQuery = client
        .from('trainer_expertise')
        .select('*')
        .order('created_at', { ascending: false });
      if (trainerId) {
        legacyQuery = legacyQuery.eq('trainer_id', trainerId);
      }
      const { data: legacyData, error: legacyErr } = await legacyQuery;
      if (legacyErr) throw new Error(legacyErr.message);
      return (legacyData ?? []) as TrainerExpertiseRecord[];
    }
    if (error) throw new Error(error.message);
    return (data ?? []) as TrainerExpertiseRecord[];
  },

  async listVerifiedTrainersForMatching(): Promise<PublicTrainerDirectoryItem[]> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('public_trainer_directory')
      .select('*')
      .order('full_name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as PublicTrainerDirectoryItem[];
  },

  async addTrainerExpertise(input: {
    trainer_id: string;
    competency_id?: string | null;
    domain: string;
    specialization: string;
    credential: string;
    years_experience: number;
  }): Promise<TrainerExpertiseRecord> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('trainer_expertise')
      .insert({
        trainer_id: input.trainer_id,
        competency_id: input.competency_id || null,
        domain: input.domain,
        specialization: input.specialization,
        credential: input.credential,
        years_experience: input.years_experience,
      })
      .select('*, competency:competencies(id, code, title)')
      .single();

    if (error && isMissingSchemaError(error)) {
      const { data: legacyData, error: legacyErr } = await client
        .from('trainer_expertise')
        .insert({
          trainer_id: input.trainer_id,
          domain: input.domain,
          specialization: input.specialization,
          credential: input.credential,
          years_experience: input.years_experience,
        })
        .select('*')
        .single();
      if (legacyErr) throw new Error(legacyErr.message);
      return legacyData as TrainerExpertiseRecord;
    }

    if (error) throw new Error(error.message);
    return data as TrainerExpertiseRecord;
  },

  async verifyTrainerExpertise(id: string, verified: boolean): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client
      .from('trainer_expertise')
      .update({ verified_by_admin: verified })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async deleteTrainerExpertise(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('trainer_expertise').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // --- COURSES & COURSE COMPETENCIES ---
  async getCourseById(courseId: string): Promise<CourseRecord | null> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('courses')
      .select(
        `
        *,
        course_competencies (
          id,
          course_id,
          competency_id,
          target_level_gain,
          competency:competencies (*)
        )
      `
      )
      .eq('id', courseId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return (data ?? null) as CourseRecord | null;
  },

  async createCourse(input: {
    code: string;
    title: string;
    domain: string;
    delivery_mode: DeliveryMode;
    target_level: CourseTargetLevel;
    duration_hours: number;
    summary: string;
    learning_objectives?: string[];
    prerequisites: string;
    assessment_method: string;
    lead_department: string;
    created_by: string;
    is_published?: boolean;
    approval_status?: CourseApprovalStatus;
    competencyIds?: string[];
  }): Promise<CourseRecord> {
    const client = requireSupabaseClient();
    const { competencyIds = [], learning_objectives, approval_status, ...basePayload } = input;

    const fullInsert: Record<string, unknown> = {
      ...basePayload,
      is_published: basePayload.is_published ?? true,
    };
    if (learning_objectives !== undefined) {
      fullInsert.learning_objectives = learning_objectives;
    }
    if (approval_status !== undefined) {
      fullInsert.approval_status = approval_status;
    }

    let { data, error } = await client.from('courses').insert(fullInsert).select('*').single();

    if (error && isMissingSchemaError(error)) {
      const legacyRetry = await client
        .from('courses')
        .insert({
          ...basePayload,
          is_published: basePayload.is_published ?? true,
        })
        .select('*')
        .single();
      data = legacyRetry.data;
      error = legacyRetry.error;
    }

    if (error) throw new Error(error.message);
    const createdCourse = data as CourseRecord;

    if (competencyIds.length > 0) {
      const links = competencyIds.map((competencyId) => ({
        course_id: createdCourse.id,
        competency_id: competencyId,
        target_level_gain: 1,
      }));
      const { error: linkError } = await client
        .from('course_competencies')
        .upsert(links, { onConflict: 'course_id,competency_id' });
      if (linkError) throw new Error(linkError.message);
    }

    return createdCourse;
  },

  async updateCourse(
    courseId: string,
    input: {
      title?: string;
      domain?: string;
      delivery_mode?: DeliveryMode;
      target_level?: CourseTargetLevel;
      duration_hours?: number;
      summary?: string;
      learning_objectives?: string[];
      prerequisites?: string;
      assessment_method?: string;
      lead_department?: string;
      is_published?: boolean;
      competencyIds?: string[];
    }
  ): Promise<CourseRecord> {
    const client = requireSupabaseClient();
    const { competencyIds, learning_objectives, ...baseUpdates } = input;
    const updatePayload: Record<string, unknown> = { ...baseUpdates };
    if (learning_objectives !== undefined) {
      updatePayload.learning_objectives = learning_objectives;
    }

    let { data, error } = await client
      .from('courses')
      .update(updatePayload)
      .eq('id', courseId)
      .select('*')
      .single();

    if (error && isMissingSchemaError(error) && 'learning_objectives' in updatePayload) {
      const retry = await client
        .from('courses')
        .update(baseUpdates)
        .eq('id', courseId)
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) throw new Error(error.message);

    if (competencyIds !== undefined) {
      const { data: existingLinks, error: existingErr } = await client
        .from('course_competencies')
        .select('competency_id')
        .eq('course_id', courseId);
      if (existingErr) throw new Error(existingErr.message);

      const nextSet = new Set(competencyIds);
      const toRemove = (existingLinks ?? [])
        .map((row) => row.competency_id as string)
        .filter((compId) => !nextSet.has(compId));

      if (toRemove.length > 0) {
        const { error: delErr } = await client
          .from('course_competencies')
          .delete()
          .eq('course_id', courseId)
          .in('competency_id', toRemove);
        if (delErr) throw new Error(delErr.message);
      }

      if (competencyIds.length > 0) {
        const links = competencyIds.map((competencyId) => ({
          course_id: courseId,
          competency_id: competencyId,
          target_level_gain: 1,
        }));
        const { error: upsertErr } = await client
          .from('course_competencies')
          .upsert(links, { onConflict: 'course_id,competency_id' });
        if (upsertErr) throw new Error(upsertErr.message);
      }
    }

    return data as CourseRecord;
  },

  async adminUpdateCourseApproval(
    courseId: string,
    input: {
      approval_status: CourseApprovalStatus;
      approval_notes?: string;
      is_published: boolean;
      approved_by: string;
    }
  ): Promise<CourseRecord> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('courses')
      .update({
        approval_status: input.approval_status,
        approval_notes: input.approval_notes ?? '',
        is_published: input.is_published,
        approved_by: input.approved_by,
        approved_at: new Date().toISOString(),
      })
      .eq('id', courseId)
      .select('*')
      .single();

    if (error && isMissingSchemaError(error)) {
      throw new Error(
        'Course approval columns require database migration 006_training_learning_workflows.sql to be executed in Supabase.'
      );
    }
    if (error) throw new Error(error.message);
    return data as CourseRecord;
  },

  async updateCoursePublished(courseId: string, isPublished: boolean): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client
      .from('courses')
      .update({ is_published: isPublished })
      .eq('id', courseId);
    if (error) throw new Error(error.message);
  },

  async deleteCourse(courseId: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('courses').delete().eq('id', courseId);
    if (error) throw new Error(error.message);
  },

  // --- TRAINER ASSIGNMENTS ---
  async listTrainerAssignments(trainerId?: string): Promise<TrainerAssignmentRecord[]> {
    const client = requireSupabaseClient();
    let query = client
      .from('trainer_assignments')
      .select(
        `
        *,
        trainer:profiles!trainer_assignments_trainer_id_fkey(id, full_name, email, department),
        course:courses(id, code, title, domain)
      `
      )
      .order('assigned_at', { ascending: false });

    if (trainerId) {
      query = query.eq('trainer_id', trainerId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as TrainerAssignmentRecord[];
  },

  async listActiveTrainerAssignments(): Promise<TrainerAssignmentRecord[]> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('trainer_assignments')
      .select(
        `
        *,
        trainer:profiles!trainer_assignments_trainer_id_fkey(id, full_name, department),
        course:courses(id, code, title, domain)
      `
      )
      .eq('status', 'active')
      .order('assigned_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as TrainerAssignmentRecord[];
  },

  async createTrainerAssignment(input: {
    trainer_id: string;
    course_id: string;
    cohort_code: string;
    department: string;
    assigned_by: string;
  }): Promise<TrainerAssignmentRecord> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('trainer_assignments')
      .insert(input)
      .select(
        `
        *,
        trainer:profiles!trainer_assignments_trainer_id_fkey(id, full_name, email, department),
        course:courses(id, code, title, domain)
      `
      )
      .single();
    if (error) throw new Error(error.message);
    return data as TrainerAssignmentRecord;
  },

  async updateTrainerAssignmentStatus(
    id: string,
    status: 'active' | 'completed' | 'archived'
  ): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('trainer_assignments').update({ status }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async deleteTrainerAssignment(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('trainer_assignments').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // --- ENROLLMENTS ---
  async listEnrollments(filters?: { traineeId?: string }): Promise<EnrollmentRecord[]> {
    const client = requireSupabaseClient();
    let query = client
      .from('enrollments')
      .select(
        `
        *,
        trainee:profiles!enrollments_trainee_id_fkey(id, full_name, email, department, designation),
        course:courses(id, code, title, domain, delivery_mode, duration_hours),
        competency:competencies(id, code, title),
        trainer_assignment:trainer_assignments(
          id,
          cohort_code,
          trainer:profiles!trainer_assignments_trainer_id_fkey(id, full_name, department)
        )
      `
      )
      .order('enrolled_at', { ascending: false });

    if (filters?.traineeId) {
      query = query.eq('trainee_id', filters.traineeId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as EnrollmentRecord[];
  },

  async enrollInCourse(input: {
    trainee_id: string;
    course_id: string;
    trainer_assignment_id?: string | null;
    mapped_competency_id?: string | null;
    assignment_reason: string;
    assigned_by?: string | null;
    status?: 'assigned' | 'in_progress';
  }): Promise<EnrollmentRecord> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('enrollments')
      .insert({
        trainee_id: input.trainee_id,
        course_id: input.course_id,
        trainer_assignment_id: input.trainer_assignment_id ?? null,
        mapped_competency_id: input.mapped_competency_id ?? null,
        assignment_reason: input.assignment_reason,
        assigned_by: input.assigned_by ?? input.trainee_id,
        status: input.status ?? 'in_progress',
        progress_percent: 0,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Trainee is already enrolled in this course.');
      }
      throw new Error(error.message);
    }
    return data as EnrollmentRecord;
  },

  async updateEnrollmentProgress(
    enrollmentId: string,
    progressPercent: number,
    status: 'assigned' | 'in_progress' | 'completed' | 'withdrawn',
    trainerAssignmentId?: string | null
  ): Promise<void> {
    const client = requireSupabaseClient();
    const payload: Record<string, unknown> = {
      progress_percent: progressPercent,
      status,
    };
    if (trainerAssignmentId !== undefined) {
      payload.trainer_assignment_id = trainerAssignmentId || null;
    }
    if (status === 'completed') {
      payload.completed_at = new Date().toISOString();
      payload.progress_percent = 100;
    }
    const { error } = await client.from('enrollments').update(payload).eq('id', enrollmentId);
    if (error) throw new Error(error.message);
  },

  // --- ASSESSMENTS, QUESTIONS & ATTEMPTS ---
  async listAssessments(filters?: { publishedOnly?: boolean }): Promise<AssessmentRecord[]> {
    const client = requireSupabaseClient();
    let query = client
      .from('assessments')
      .select(
        `
        *,
        course:courses(id, code, title),
        competency:competencies(id, code, title)
      `
      )
      .order('created_at', { ascending: false });

    if (filters?.publishedOnly) {
      query = query.eq('is_published', true);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as AssessmentRecord[];
  },

  async createAssessment(input: {
    code: string;
    title: string;
    domain: string;
    assessment_type: AssessmentType;
    course_id?: string | null;
    competency_id?: string | null;
    duration_minutes: number;
    passing_score_percent: number;
    due_at?: string | null;
    instructions: string;
    created_by: string;
    is_published?: boolean;
  }): Promise<AssessmentRecord> {
    const client = requireSupabaseClient();
    const { due_at, ...rest } = input;
    const basePayload = {
      ...rest,
      course_id: rest.course_id || null,
      competency_id: rest.competency_id || null,
      is_published: rest.is_published ?? true,
    };

    const insertPayload: Record<string, unknown> = due_at
      ? { ...basePayload, due_at }
      : basePayload;

    let { data, error } = await client
      .from('assessments')
      .insert(insertPayload)
      .select('*, course:courses(id, code, title), competency:competencies(id, code, title)')
      .single();

    if (error && isMissingSchemaError(error) && 'due_at' in insertPayload) {
      const retry = await client
        .from('assessments')
        .insert(basePayload)
        .select('*, course:courses(id, code, title), competency:competencies(id, code, title)')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) throw new Error(error.message);
    return data as AssessmentRecord;
  },

  async updateAssessment(
    assessmentId: string,
    updates: {
      title?: string;
      domain?: string;
      duration_minutes?: number;
      passing_score_percent?: number;
      due_at?: string | null;
      instructions?: string;
      is_published?: boolean;
    }
  ): Promise<AssessmentRecord> {
    const client = requireSupabaseClient();
    let { data, error } = await client
      .from('assessments')
      .update(updates)
      .eq('id', assessmentId)
      .select('*, course:courses(id, code, title), competency:competencies(id, code, title)')
      .single();

    if (error && isMissingSchemaError(error) && 'due_at' in updates) {
      if (updates.due_at) {
        throw new Error(
          'Assessment due dates require migration 006_training_learning_workflows.sql to be executed in Supabase.'
        );
      }
      const { due_at: _omit, ...legacyUpdates } = updates;
      const retry = await client
        .from('assessments')
        .update(legacyUpdates)
        .eq('id', assessmentId)
        .select('*, course:courses(id, code, title), competency:competencies(id, code, title)')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) throw new Error(error.message);
    return data as AssessmentRecord;
  },

  async deleteAssessment(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('assessments').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listAssessmentQuestions(
    assessmentId?: string,
    includeAnswerKey = true
  ): Promise<AssessmentQuestionRecord[]> {
    const client = requireSupabaseClient();
    const baseQuery = includeAnswerKey
      ? client
          .from('assessment_questions')
          .select('*, assessment:assessments(id, code, title)')
      : client
          .from('assessment_questions')
          .select(
            'id, assessment_id, question_text, question_type, options, max_marks, order_index, created_at, assessment:assessments(id, code, title)'
          );

    let orderedQuery = baseQuery
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (assessmentId) {
      orderedQuery = orderedQuery.eq('assessment_id', assessmentId);
    }

    const { data, error } = await orderedQuery;
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as AssessmentQuestionRecord[]).map((row) => ({
      ...row,
      correct_option: includeAnswerKey ? (row.correct_option ?? null) : null,
    }));
  },

  async createAssessmentQuestion(input: {
    assessment_id: string;
    question_text: string;
    question_type: QuestionType;
    options: string[];
    correct_option: string | null;
    max_marks: number;
    order_index: number;
  }): Promise<AssessmentQuestionRecord> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('assessment_questions')
      .insert(input)
      .select('*, assessment:assessments(id, code, title)')
      .single();
    if (error) throw new Error(error.message);
    return data as AssessmentQuestionRecord;
  },

  async updateAssessmentQuestion(
    questionId: string,
    updates: {
      question_text?: string;
      question_type?: QuestionType;
      options?: string[];
      correct_option?: string | null;
      max_marks?: number;
      order_index?: number;
    }
  ): Promise<AssessmentQuestionRecord> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('assessment_questions')
      .update(updates)
      .eq('id', questionId)
      .select('*, assessment:assessments(id, code, title)')
      .single();
    if (error) throw new Error(error.message);
    return data as AssessmentQuestionRecord;
  },

  async deleteAssessmentQuestion(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('assessment_questions').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async listAssessmentAttempts(filters?: { traineeId?: string }): Promise<AssessmentAttemptRecord[]> {
    const client = requireSupabaseClient();
    let query = client
      .from('assessment_attempts')
      .select(
        `
        *,
        assessment:assessments(id, code, title, domain, assessment_type, passing_score_percent, course_id, competency_id),
        trainee:profiles!assessment_attempts_trainee_id_fkey(id, full_name, email, department, designation),
        competency:competencies(id, code, title)
      `
      )
      .order('started_at', { ascending: false });

    if (filters?.traineeId) {
      query = query.eq('trainee_id', filters.traineeId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as AssessmentAttemptRecord[];
  },

  async submitAssessmentAttempt(input: {
    assessmentId: string;
    answers: Record<string, string>;
  }): Promise<{
    attempt: AssessmentAttemptRecord;
    questionFeedback: QuestionSubmissionFeedback[];
  }> {
    const token = await authService.getCurrentSessionAccessToken();
    if (!token) {
      throw new Error('Your login session expired. Sign in again before submitting this assessment.');
    }

    const response = await fetch('/api/assessments/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });

    const data = (await response.json()) as {
      attempt?: AssessmentAttemptRecord;
      questionFeedback?: QuestionSubmissionFeedback[];
      error?: string;
    };

    if (!response.ok || !data.attempt) {
      throw new Error(data.error ?? 'Failed to submit assessment attempt.');
    }

    return {
      attempt: data.attempt,
      questionFeedback: data.questionFeedback ?? [],
    };
  },

  async evaluateAssessmentAttempt(input: {
    attempt: AssessmentAttemptRecord;
    evaluatorId: string;
    scorePercent: number;
    achievedLevel: number;
    passed: boolean;
    evaluatorNotes: string;
    issueCertificate?: boolean;
  }): Promise<void> {
    const client = requireSupabaseClient();
    const { attempt, evaluatorId, scorePercent, achievedLevel, passed, evaluatorNotes, issueCertificate } =
      input;
    const evaluatedAt = new Date().toISOString();
    const cleanScore = clampScore(scorePercent);

    const { error } = await client
      .from('assessment_attempts')
      .update({
        score_percent: cleanScore,
        achieved_level: achievedLevel,
        passed,
        evaluator_notes: evaluatorNotes,
        evaluated_by: evaluatorId,
        status: 'evaluated',
        evaluated_at: evaluatedAt,
      })
      .eq('id', attempt.id);

    if (error) throw new Error(error.message);

    const stage: ProgressStage =
      attempt.assessment?.assessment_type === 'Reassessment Verification'
        ? 'reassessment'
        : 'skill_assessment';

    const skillCode = attempt.competency?.code ?? attempt.assessment?.code ?? 'ASSMT';
    const skillName = attempt.competency?.title ?? attempt.assessment?.title ?? 'Assessment Evaluation';
    const domain = attempt.assessment?.domain ?? 'General Governance';

    const baseHistoryPayload = {
      trainee_id: attempt.trainee_id,
      competency_id: attempt.competency_id ?? attempt.assessment?.competency_id ?? null,
      skill_code: skillCode,
      skill_name: skillName,
      domain,
      stage,
      recorded_level: achievedLevel,
      notes: `Evaluated by trainer (${cleanScore}/100 · ${passed ? 'Passed' : 'Follow-up Required'}). ${evaluatorNotes}`.trim(),
      source_attempt_id: attempt.id,
    };

    const { error: phError } = await client.from('progress_history').insert({
      ...baseHistoryPayload,
      recorded_score: cleanScore,
      target_score: attempt.assessment?.passing_score_percent ?? null,
      assessed_by: evaluatorId,
    });

    if (phError && isMissingSchemaError(phError)) {
      const { error: legacyPhErr } = await client.from('progress_history').insert(baseHistoryPayload);
      if (legacyPhErr) throw new Error(legacyPhErr.message);
    } else if (phError) {
      throw new Error(phError.message);
    }

    if (issueCertificate && passed && attempt.assessment?.course_id) {
      const code = `CERT-${new Date().getFullYear()}-${attempt.id.slice(0, 6).toUpperCase()}`;
      await client.from('certificates').insert({
        certificate_code: code,
        trainee_id: attempt.trainee_id,
        course_id: attempt.assessment.course_id,
        assessment_attempt_id: attempt.id,
        verified_by: evaluatorId,
        status: 'verified',
      });
    }
  },

  // --- LEARNING RESOURCES ---
  async listLearningResources(courseId?: string): Promise<LearningResourceRecord[]> {
    const client = requireSupabaseClient();
    let query = client
      .from('learning_resources')
      .select(
        `
        *,
        course:courses(id, code, title, domain),
        uploader:profiles!learning_resources_uploaded_by_fkey(id, full_name)
      `
      )
      .order('created_at', { ascending: false });

    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as LearningResourceRecord[];
  },

  async uploadLearningResource(input: {
    course_id: string;
    title: string;
    material_type: LearningMaterialType;
    uploaded_by: string;
    file: File;
  }): Promise<LearningResourceRecord> {
    const client = requireSupabaseClient();
    const validation = validateStorageUploadFile(input.file, input.material_type);
    if (!validation.valid) {
      throw new Error(validation.error ?? 'Invalid file upload format or size.');
    }

    const uploaded = await storageService.uploadFile('learning-resources', input.course_id, input.file);

    const { data, error } = await client
      .from('learning_resources')
      .insert({
        course_id: input.course_id,
        title: input.title,
        material_type: input.material_type,
        storage_bucket: 'learning-resources',
        storage_path: uploaded.storagePath,
        file_name: uploaded.fileName,
        file_size_bytes: uploaded.fileSizeBytes,
        mime_type: uploaded.mimeType,
        uploaded_by: input.uploaded_by,
      })
      .select('*, course:courses(id, code, title, domain)')
      .single();

    if (error) {
      await storageService.removeFile('learning-resources', uploaded.storagePath).catch(() => {});
      throw new Error(error.message);
    }

    return data as LearningResourceRecord;
  },

  async deleteLearningResource(resource: LearningResourceRecord): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('learning_resources').delete().eq('id', resource.id);
    if (error) throw new Error(error.message);
    await storageService.removeFile('learning-resources', resource.storage_path).catch(() => {});
  },

  // --- PROGRESS HISTORY & TRAINER COMPETENCY ASSESSMENTS ---
  async listProgressHistory(traineeId?: string): Promise<ProgressHistoryRecord[]> {
    const client = requireSupabaseClient();
    let query = client
      .from('progress_history')
      .select(
        '*, competency:competencies(id, code, title), assessor:profiles!progress_history_assessed_by_fkey(id, full_name)'
      )
      .order('recorded_at', { ascending: false });

    if (traineeId) {
      query = query.eq('trainee_id', traineeId);
    }

    const { data, error } = await query;
    if (error && isMissingSchemaError(error)) {
      let legacyQuery = client
        .from('progress_history')
        .select('*, competency:competencies(id, code, title)')
        .order('recorded_at', { ascending: false });
      if (traineeId) {
        legacyQuery = legacyQuery.eq('trainee_id', traineeId);
      }
      const { data: legacyData, error: legacyErr } = await legacyQuery;
      if (legacyErr) throw new Error(legacyErr.message);
      return (legacyData ?? []) as ProgressHistoryRecord[];
    }
    if (error) throw new Error(error.message);
    return (data ?? []) as ProgressHistoryRecord[];
  },

  async addProgressEntry(input: {
    trainee_id: string;
    competency_id?: string | null;
    skill_code: string;
    skill_name: string;
    domain: string;
    stage: ProgressStage;
    recorded_level: number;
    recorded_score?: number;
    target_level?: number | null;
    target_score?: number | null;
    assessed_by?: string | null;
    notes: string;
  }): Promise<ProgressHistoryRecord> {
    const client = requireSupabaseClient();
    const score = clampScore(
      typeof input.recorded_score === 'number'
        ? input.recorded_score
        : levelToBenchmarkScore(input.recorded_level)
    );
    const level =
      typeof input.recorded_score === 'number'
        ? scoreToProficiencyLevel(score)
        : input.recorded_level;

    const baseRow = {
      trainee_id: input.trainee_id,
      competency_id: input.competency_id ?? null,
      skill_code: input.skill_code,
      skill_name: input.skill_name,
      domain: input.domain,
      stage: input.stage,
      recorded_level: level,
      target_level: input.target_level ?? null,
      notes: input.notes,
    };

    const { data, error } = await client
      .from('progress_history')
      .insert({
        ...baseRow,
        recorded_score: score,
        target_score: input.target_score ?? null,
        assessed_by: input.assessed_by ?? null,
      })
      .select(
        '*, competency:competencies(id, code, title), assessor:profiles!progress_history_assessed_by_fkey(id, full_name)'
      )
      .single();

    if (error && isMissingSchemaError(error)) {
      const { data: legacyData, error: legacyErr } = await client
        .from('progress_history')
        .insert(baseRow)
        .select('*, competency:competencies(id, code, title)')
        .single();
      if (legacyErr) throw new Error(legacyErr.message);
      return legacyData as ProgressHistoryRecord;
    }

    if (error) throw new Error(error.message);
    return data as ProgressHistoryRecord;
  },

  async recordTrainerCompetencyAssessment(input: {
    traineeId: string;
    trainerId: string;
    stage: 'skill_assessment' | 'reassessment';
    entries: Array<{
      competencyId: string;
      skillCode: string;
      skillName: string;
      domain: string;
      recordedScore: number;
      targetScore: number | null;
      notes: string;
    }>;
  }): Promise<ProgressHistoryRecord[]> {
    const client = requireSupabaseClient();
    if (input.entries.length === 0) {
      throw new Error('Select at least one competency score to record.');
    }

    const payload = input.entries.map((entry) => {
      const score = clampScore(entry.recordedScore);
      const targetScore = entry.targetScore !== null ? clampScore(entry.targetScore) : null;
      return {
        trainee_id: input.traineeId,
        competency_id: entry.competencyId,
        skill_code: entry.skillCode,
        skill_name: entry.skillName,
        domain: entry.domain,
        stage: input.stage,
        recorded_score: score,
        recorded_level: scoreToProficiencyLevel(score),
        target_score: targetScore,
        target_level: targetScore !== null ? scoreToProficiencyLevel(targetScore) : null,
        assessed_by: input.trainerId,
        notes:
          entry.notes.trim() ||
          `${input.stage === 'reassessment' ? 'Post-training reassessment' : 'Trainer competency evaluation'} (${score}/100)`,
      };
    });

    const { data, error } = await client
      .from('progress_history')
      .insert(payload)
      .select(
        '*, competency:competencies(id, code, title), assessor:profiles!progress_history_assessed_by_fkey(id, full_name)'
      );
    if (error && isMissingSchemaError(error)) {
      throw new Error(
        'Authorised numerical competency scoring requires database migration 005_competency_scoring_engine.sql in Supabase.'
      );
    }
    if (error) throw new Error(error.message);

    // Notify trainee of official assessment result without blocking score persistence
    try {
      const stageLabel =
        input.stage === 'reassessment'
          ? 'Post-Training Reassessment'
          : 'Competency Baseline Assessment';
      await client.from('notifications').insert({
        recipient_id: input.traineeId,
        audience: 'User',
        priority: 'Important',
        title: `${stageLabel} Recorded`,
        body: `Authorised trainer evaluation recorded for ${payload.length} competenc${
          payload.length === 1 ? 'y' : 'ies'
        }. Review your updated Skill Gap Report.`,
        created_by: input.trainerId,
      });
    } catch {
      // Non-blocking notification failure
    }

    return (data ?? []) as ProgressHistoryRecord[];
  },

  async deleteProgressEntry(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('progress_history').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // --- COMPUTED SKILL GAP & IMPROVEMENT ENGINE ---
  computeSkillGapRows(params: {
    requirements: RoleRequirementRecord[];
    progressHistory: ProgressHistoryRecord[];
    courses: CourseRecord[];
    trainers?: PublicTrainerDirectoryItem[];
    activeAssignments?: TrainerAssignmentRecord[];
  }): SkillGapComputedRow[] {
    return computeCompetencyGapReport(params).rows;
  },

  computeCompetencyReport(params: {
    requirements: RoleRequirementRecord[];
    progressHistory: ProgressHistoryRecord[];
    courses: CourseRecord[];
    trainers?: PublicTrainerDirectoryItem[];
    activeAssignments?: TrainerAssignmentRecord[];
  }): { rows: SkillGapComputedRow[]; summary: CompetencyAnalysisSummary } {
    return computeCompetencyGapReport(params);
  },

  // --- CERTIFICATES ---
  async listCertificates(traineeId?: string): Promise<CertificateRecord[]> {
    const client = requireSupabaseClient();
    let query = client
      .from('certificates')
      .select(
        `
        *,
        trainee:profiles!certificates_trainee_id_fkey(id, full_name, email, department, designation),
        course:courses(id, code, title, domain, duration_hours),
        verifier:profiles!certificates_verified_by_fkey(id, full_name)
      `
      )
      .order('issued_at', { ascending: false });

    if (traineeId) {
      query = query.eq('trainee_id', traineeId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as CertificateRecord[];
  },

  async issueCertificate(input: {
    certificate_code: string;
    trainee_id: string;
    course_id: string;
    verified_by: string;
    file?: File | null;
  }): Promise<CertificateRecord> {
    const client = requireSupabaseClient();
    let storagePath: string | null = null;

    if (input.file) {
      const validation = validateStorageUploadFile(input.file, 'certificate');
      if (!validation.valid) {
        throw new Error(validation.error ?? 'Invalid certificate file.');
      }
      const uploaded = await storageService.uploadFile('certificates', input.trainee_id, input.file);
      storagePath = uploaded.storagePath;
    }

    const { data, error } = await client
      .from('certificates')
      .insert({
        certificate_code: input.certificate_code,
        trainee_id: input.trainee_id,
        course_id: input.course_id,
        verified_by: input.verified_by,
        status: 'verified',
        storage_path: storagePath,
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

    if (error) {
      if (storagePath) {
        await storageService.removeFile('certificates', storagePath).catch(() => {});
      }
      throw new Error(error.message);
    }

    return data as CertificateRecord;
  },

  async claimEligibleCertificate(
    courseId: string
  ): Promise<{ certificate: CertificateRecord; alreadyIssued: boolean }> {
    const token = await authService.getCurrentSessionAccessToken();
    if (!token) {
      throw new Error('Your login session expired. Sign in again to claim your certificate.');
    }

    const response = await fetch('/api/certificates/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ courseId }),
    });

    const data = (await response.json()) as {
      certificate?: CertificateRecord;
      alreadyIssued?: boolean;
      error?: string;
    };

    if (!response.ok || !data.certificate) {
      throw new Error(data.error ?? 'Unable to claim completion certificate.');
    }

    return {
      certificate: data.certificate,
      alreadyIssued: Boolean(data.alreadyIssued),
    };
  },

  async updateCertificateStatus(id: string, status: 'verified' | 'revoked'): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('certificates').update({ status }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  // --- FEEDBACK ---
  async listFeedback(
    filters?: string | { userId?: string; courseId?: string }
  ): Promise<FeedbackRecord[]> {
    const client = requireSupabaseClient();
    const opts = typeof filters === 'string' ? { userId: filters } : (filters ?? {});

    let query = client
      .from('feedback')
      .select(
        '*, course:courses(id, code, title), author:profiles!feedback_user_id_fkey(id, full_name, department, designation)'
      )
      .order('created_at', { ascending: false });

    if (opts.userId) {
      query = query.eq('user_id', opts.userId);
    }
    if (opts.courseId) {
      query = query.eq('course_id', opts.courseId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as FeedbackRecord[];
  },

  async createFeedback(input: {
    user_id: string;
    course_id?: string | null;
    category: FeedbackCategory;
    subject: string;
    comments: string;
  }): Promise<FeedbackRecord> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('feedback')
      .insert({ ...input, course_id: input.course_id || null })
      .select('*, course:courses(id, code, title)')
      .single();
    if (error) throw new Error(error.message);
    return data as FeedbackRecord;
  },

  async deleteFeedback(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('feedback').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // --- NOTIFICATIONS / ANNOUNCEMENTS ---
  async listNotifications(): Promise<NotificationRecord[]> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as NotificationRecord[];
  },

  async createNotification(input: {
    recipient_id?: string | null;
    audience: NotificationAudience;
    priority: 'Standard' | 'Important';
    title: string;
    body: string;
    created_by: string;
  }): Promise<NotificationRecord> {
    const client = requireSupabaseClient();
    const { data, error } = await client
      .from('notifications')
      .insert({ ...input, recipient_id: input.recipient_id ?? null })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as NotificationRecord;
  },

  async markNotificationRead(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async deleteNotification(id: string): Promise<void> {
    const client = requireSupabaseClient();
    const { error } = await client.from('notifications').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
