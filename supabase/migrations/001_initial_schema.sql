-- CAPACITY CONNECT (SIH26075)
-- Migration 001: Initial PostgreSQL Schema (17 Core Tables + Auth/Privilege Triggers)
-- Safe to run on a fresh Supabase database; checks IF NOT EXISTS before creating objects.

create extension if not exists "pgcrypto";

-- Helper trigger function for updated_at timestamps
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. job_roles
create table if not exists public.job_roles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  department text not null,
  grade_level text not null default '',
  description text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_job_roles_updated_at on public.job_roles;
create trigger trg_job_roles_updated_at
  before update on public.job_roles
  for each row execute function public.set_updated_at();

-- 2. profiles (linked 1:1 to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role text not null default 'trainee' check (role in ('trainee', 'trainer', 'admin')),
  approval_status text not null default 'approved' check (approval_status in ('pending', 'approved', 'rejected')),
  account_status text not null default 'active' check (account_status in ('active', 'suspended')),
  department text not null default '',
  designation text not null default '',
  office_location text not null default '',
  phone_extension text not null default '',
  job_role_id uuid references public.job_roles(id) on delete set null,
  notification_prefs jsonb not null default '{"email_alerts":true,"assessment_reminders":true,"digest_summary":false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 3. competencies
create table if not exists public.competencies (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  domain text not null,
  description text not null default '',
  max_level integer not null default 5 check (max_level between 1 and 5),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_competencies_updated_at on public.competencies;
create trigger trg_competencies_updated_at
  before update on public.competencies
  for each row execute function public.set_updated_at();

-- 4. role_requirements
create table if not exists public.role_requirements (
  id uuid primary key default gen_random_uuid(),
  job_role_id uuid not null references public.job_roles(id) on delete cascade,
  competency_id uuid not null references public.competencies(id) on delete cascade,
  required_level integer not null default 4 check (required_level between 1 and 5),
  required_score integer not null default 75 check (required_score between 0 and 100),
  priority text not null default 'core' check (priority in ('core', 'supporting')),
  created_at timestamptz not null default now(),
  unique (job_role_id, competency_id)
);

-- 5. trainer_expertise
create table if not exists public.trainer_expertise (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  competency_id uuid references public.competencies(id) on delete set null,
  domain text not null,
  specialization text not null,
  credential text not null,
  years_experience integer not null default 1 check (years_experience >= 0),
  verified_by_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- 6. courses
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  domain text not null,
  delivery_mode text not null check (delivery_mode in ('Blended', 'Instructor-Led', 'Applied Workshop')),
  target_level text not null default 'Intermediate' check (target_level in ('Foundation', 'Intermediate', 'Advanced')),
  duration_hours integer not null default 16 check (duration_hours > 0),
  summary text not null,
  learning_objectives jsonb not null default '[]'::jsonb,
  prerequisites text not null default '',
  assessment_method text not null default '',
  lead_department text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  is_published boolean not null default true,
  approval_status text not null default 'approved' check (approval_status in ('pending', 'approved', 'rejected')),
  approval_notes text not null default '',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_courses_updated_at on public.courses;
create trigger trg_courses_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

-- 7. course_competencies
create table if not exists public.course_competencies (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  competency_id uuid not null references public.competencies(id) on delete cascade,
  target_level_gain integer not null default 1 check (target_level_gain between 1 and 5),
  created_at timestamptz not null default now(),
  unique (course_id, competency_id)
);

-- 8. trainer_assignments
create table if not exists public.trainer_assignments (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  cohort_code text not null,
  department text not null default '',
  assigned_by uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  assigned_at timestamptz not null default now(),
  unique (trainer_id, course_id, cohort_code)
);

-- 9. enrollments
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  trainer_assignment_id uuid references public.trainer_assignments(id) on delete set null,
  mapped_competency_id uuid references public.competencies(id) on delete set null,
  assignment_reason text not null default 'Skill gap remediation',
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  status text not null default 'assigned' check (status in ('assigned', 'in_progress', 'completed', 'withdrawn')),
  assigned_by uuid references public.profiles(id) on delete set null,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (trainee_id, course_id)
);

-- 10. assessments
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  domain text not null,
  assessment_type text not null check (assessment_type in ('Diagnostic Baseline', 'Course Assessment', 'Reassessment Verification')),
  course_id uuid references public.courses(id) on delete set null,
  competency_id uuid references public.competencies(id) on delete set null,
  duration_minutes integer not null default 45 check (duration_minutes > 0),
  passing_score_percent integer not null default 75 check (passing_score_percent between 1 and 100),
  due_at timestamptz,
  instructions text not null,
  created_by uuid references public.profiles(id) on delete set null,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_assessments_updated_at on public.assessments;
create trigger trg_assessments_updated_at
  before update on public.assessments
  for each row execute function public.set_updated_at();

-- 11. assessment_questions
create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  question_text text not null,
  question_type text not null check (question_type in ('Multiple Choice', 'Scenario Response', 'Practical Checklist')),
  options jsonb not null default '[]'::jsonb,
  correct_option text,
  max_marks integer not null default 10 check (max_marks > 0),
  order_index integer not null default 1,
  created_at timestamptz not null default now()
);

-- 12. assessment_attempts
create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  trainee_id uuid not null references public.profiles(id) on delete cascade,
  competency_id uuid references public.competencies(id) on delete set null,
  answers jsonb not null default '{}'::jsonb,
  score_percent integer check (score_percent between 0 and 100),
  achieved_level integer check (achieved_level between 1 and 5),
  passed boolean,
  evaluated_by uuid references public.profiles(id) on delete set null,
  evaluator_notes text not null default '',
  status text not null default 'submitted' check (status in ('in_progress', 'submitted', 'evaluated')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  evaluated_at timestamptz
);

-- 13. learning_resources
create table if not exists public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  material_type text not null check (material_type in ('Reference Manual', 'Slide Deck', 'Video Lecture', 'Case Exercise', 'Policy Document')),
  storage_bucket text not null default 'learning-resources',
  storage_path text not null,
  file_name text not null,
  file_size_bytes bigint not null default 0,
  mime_type text not null default 'application/octet-stream',
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 14. progress_history (unified skill declaration, baseline, gap & reassessment ledger)
create table if not exists public.progress_history (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null references public.profiles(id) on delete cascade,
  competency_id uuid references public.competencies(id) on delete set null,
  skill_code text not null default '',
  skill_name text not null,
  domain text not null,
  stage text not null default 'self_declaration' check (stage in ('self_declaration', 'skill_assessment', 'skill_gap', 'training_progress', 'reassessment')),
  recorded_level integer not null check (recorded_level between 1 and 5),
  recorded_score integer not null default 0 check (recorded_score between 0 and 100),
  target_level integer check (target_level between 1 and 5),
  target_score integer check (target_score between 0 and 100),
  notes text not null default '',
  source_attempt_id uuid references public.assessment_attempts(id) on delete set null,
  assessed_by uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now()
);

-- 15. certificates
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_code text unique not null,
  trainee_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  assessment_attempt_id uuid references public.assessment_attempts(id) on delete set null,
  verified_by uuid references public.profiles(id) on delete set null,
  status text not null default 'verified' check (status in ('verified', 'revoked')),
  storage_path text,
  issued_at timestamptz not null default now()
);

-- 16. feedback
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  category text not null check (category in ('Course Content', 'Assessment Clarity', 'Trainer Delivery', 'Portal Experience')),
  subject text not null,
  comments text not null,
  created_at timestamptz not null default now()
);

-- 17. notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) on delete cascade,
  audience text not null default 'All Roles' check (audience in ('User', 'All Roles', 'Trainees Only', 'Trainers Only', 'Admins Only')),
  priority text not null default 'Standard' check (priority in ('Standard', 'Important')),
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Helpful Indexes
create index if not exists idx_profiles_role_approval on public.profiles(role, approval_status);
create index if not exists idx_role_requirements_role on public.role_requirements(job_role_id);
create index if not exists idx_enrollments_trainee on public.enrollments(trainee_id);
create index if not exists idx_enrollments_course on public.enrollments(course_id);
create index if not exists idx_attempts_trainee on public.assessment_attempts(trainee_id);
create index if not exists idx_progress_trainee on public.progress_history(trainee_id);
create index if not exists idx_notifications_audience on public.notifications(audience, created_at desc);

-- Auth Signup Trigger: auto-creates public.profiles linked to auth.users.id
-- Security: NEVER accepts 'admin' from public signup metadata; sets 'trainer' to approval_status = 'pending'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  final_role text;
  initial_approval text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'requested_role', 'trainee');

  if requested_role = 'trainer' then
    final_role := 'trainer';
    initial_approval := 'pending';
  else
    final_role := 'trainee';
    initial_approval := 'approved';
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    approval_status,
    account_status,
    department,
    designation
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'User'), '@', 1)),
    final_role,
    initial_approval,
    'active',
    coalesce(new.raw_user_meta_data ->> 'department', ''),
    coalesce(new.raw_user_meta_data ->> 'designation', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Guard against privilege escalation on self-updates
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  -- Allow service_role / postgres migrations (auth.uid() is null)
  if auth.uid() is null then
    return new;
  end if;

  select role into caller_role from public.profiles where id = auth.uid();

  if coalesce(caller_role, '') <> 'admin' then
    if new.role is distinct from old.role
       or new.approval_status is distinct from old.approval_status
       or new.account_status is distinct from old.account_status then
      raise exception 'Forbidden: only administrators can alter role, approval_status, or account_status';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_privilege_escalation on public.profiles;
create trigger trg_prevent_profile_privilege_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();
