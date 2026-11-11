-- CAPACITY CONNECT (SIH26075)
-- Migration 002: Hardened Row Level Security (RLS) Policies, Function Permissions & Safe Public Directory View
-- Safe to run repeatedly (idempotent); preserves all existing tables, columns, relationships, and data from Migration 001.

-- ============================================================================
-- 1. NON-RECURSIVE SECURITY DEFINER HELPER FUNCTIONS
--    Executed with owner privileges and fixed search_path = public so cross-table
--    checks do not trigger recursive RLS evaluation.
-- ============================================================================

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.account_status = 'active'
  );
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.account_status = 'active';
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.approval_status = 'approved'
      and p.account_status = 'active'
  );
$$;

create or replace function public.is_approved_trainer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'trainer'
      and p.approval_status = 'approved'
      and p.account_status = 'active'
  );
$$;

create or replace function public.is_active_trainee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'trainee'
      and p.approval_status = 'approved'
      and p.account_status = 'active'
  );
$$;

-- Allows pending or approved (non-rejected, non-suspended) trainers to submit unverified expertise credentials for Admin verification
create or replace function public.is_active_trainer_applicant()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'trainer'
      and p.approval_status in ('pending', 'approved')
      and p.account_status = 'active'
  );
$$;

create or replace function public.is_trainer_profile_active_and_approved(target_trainer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target_trainer_id
      and p.role = 'trainer'
      and p.approval_status = 'approved'
      and p.account_status = 'active'
  );
$$;

create or replace function public.is_own_profile_update_permitted(
  target_id uuid,
  new_email text,
  new_role text,
  new_approval_status text,
  new_account_status text,
  new_created_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.id = target_id
      and p.account_status = 'active'
      and p.email is not distinct from new_email
      and p.role is not distinct from new_role
      and p.approval_status is not distinct from new_approval_status
      and p.account_status is not distinct from new_account_status
      and p.created_at is not distinct from new_created_at
  );
$$;

create or replace function public.is_course_publicly_visible(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses c
    where c.id = target_course_id
      and c.is_published = true
      and c.approval_status = 'approved'
  );
$$;

create or replace function public.is_course_owner(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses c
    where c.id = target_course_id
      and c.created_by = auth.uid()
  );
$$;

create or replace function public.is_course_approval_unchanged_or_resubmitted(
  target_course_id uuid,
  new_created_by uuid,
  new_approval_status text,
  new_approval_notes text,
  new_approved_by uuid,
  new_approved_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses c
    where c.id = target_course_id
      and c.created_by = auth.uid()
      and c.created_by is not distinct from new_created_by
      and (
        (
          c.approval_status is not distinct from new_approval_status
          and c.approval_notes is not distinct from new_approval_notes
          and c.approved_by is not distinct from new_approved_by
          and c.approved_at is not distinct from new_approved_at
        )
        or (
          c.approval_status = 'rejected'
          and new_approval_status = 'pending'
          and new_approved_by is null
          and new_approved_at is null
        )
      )
  );
$$;

create or replace function public.is_trainer_assigned_to_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_approved_trainer()
    and target_course_id is not null
    and (
      exists (
        select 1
        from public.courses c
        where c.id = target_course_id
          and c.created_by = auth.uid()
      )
      or exists (
        select 1
        from public.trainer_assignments ta
        where ta.course_id = target_course_id
          and ta.trainer_id = auth.uid()
          and ta.status in ('active', 'completed')
      )
    );
$$;

create or replace function public.can_view_course_authenticated(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or (
      public.is_active_user()
      and exists (
        select 1
        from public.courses c
        where c.id = target_course_id
          and (
            (c.is_published = true and c.approval_status = 'approved')
            or public.is_trainer_assigned_to_course(c.id)
          )
      )
    );
$$;

create or replace function public.is_trainee_assigned_to_cohort(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_trainee()
    and exists (
      select 1
      from public.enrollments e
      where e.trainee_id = auth.uid()
        and e.trainer_assignment_id = target_assignment_id
    );
$$;

create or replace function public.is_active_cohort_for_course(
  target_assignment_id uuid,
  target_course_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trainer_assignments ta
    where ta.id = target_assignment_id
      and ta.course_id = target_course_id
      and ta.status = 'active'
  );
$$;

create or replace function public.is_trainer_assigned_to_enrollment(
  target_course_id uuid,
  target_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_approved_trainer()
    and (
      (
        target_assignment_id is not null
        and exists (
          select 1
          from public.trainer_assignments ta
          where ta.id = target_assignment_id
            and ta.trainer_id = auth.uid()
            and ta.status in ('active', 'completed')
        )
      )
      or (
        target_assignment_id is null
        and exists (
          select 1
          from public.trainer_assignments ta
          where ta.course_id = target_course_id
            and ta.trainer_id = auth.uid()
            and ta.status in ('active', 'completed')
        )
      )
      or exists (
        select 1
        from public.courses c
        where c.id = target_course_id
          and c.created_by = auth.uid()
      )
    );
$$;

create or replace function public.is_trainer_assigned_to_trainee(target_trainee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_approved_trainer()
    and exists (
      select 1
      from public.profiles p
      where p.id = target_trainee_id
        and p.role = 'trainee'
    )
    and exists (
      select 1
      from public.enrollments e
      where e.trainee_id = target_trainee_id
        and e.status <> 'withdrawn'
        and public.is_trainer_assigned_to_enrollment(e.course_id, e.trainer_assignment_id)
    );
$$;

create or replace function public.is_trainer_assigned_to_trainee_course(
  target_trainee_id uuid,
  target_course_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_approved_trainer()
    and target_course_id is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = target_trainee_id
        and p.role = 'trainee'
    )
    and exists (
      select 1
      from public.enrollments e
      where e.trainee_id = target_trainee_id
        and e.course_id = target_course_id
        and e.status <> 'withdrawn'
        and public.is_trainer_assigned_to_enrollment(e.course_id, e.trainer_assignment_id)
    );
$$;

create or replace function public.is_trainee_enrolled_in_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_trainee()
    and target_course_id is not null
    and exists (
      select 1
      from public.enrollments e
      join public.courses c on c.id = e.course_id
      where e.trainee_id = auth.uid()
        and e.course_id = target_course_id
        and e.status <> 'withdrawn'
        and c.is_published = true
        and c.approval_status = 'approved'
    );
$$;

create or replace function public.is_enrollment_identity_unchanged(
  target_id uuid,
  new_trainee_id uuid,
  new_course_id uuid,
  new_trainer_assignment_id uuid,
  new_mapped_competency_id uuid,
  new_assigned_by uuid,
  new_enrolled_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments e
    where e.id = target_id
      and e.trainee_id is not distinct from new_trainee_id
      and e.course_id is not distinct from new_course_id
      and e.trainer_assignment_id is not distinct from new_trainer_assignment_id
      and e.mapped_competency_id is not distinct from new_mapped_competency_id
      and e.assigned_by is not distinct from new_assigned_by
      and e.enrolled_at is not distinct from new_enrolled_at
  );
$$;

create or replace function public.can_trainee_access_assessment(target_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_trainee()
    and exists (
      select 1
      from public.assessments a
      where a.id = target_assessment_id
        and a.is_published = true
        and (
          a.course_id is null
          or (
            a.assessment_type = 'Diagnostic Baseline'
            and public.is_course_publicly_visible(a.course_id)
          )
          or public.is_trainee_enrolled_in_course(a.course_id)
        )
    );
$$;

create or replace function public.can_trainer_access_assessment(target_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_approved_trainer()
    and exists (
      select 1
      from public.assessments a
      where a.id = target_assessment_id
        and (
          a.created_by = auth.uid()
          or public.is_trainer_assigned_to_course(a.course_id)
        )
    );
$$;

create or replace function public.can_trainer_manage_assessment(target_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_approved_trainer()
    and exists (
      select 1
      from public.assessments a
      where a.id = target_assessment_id
        and a.created_by = auth.uid()
    );
$$;

create or replace function public.can_trainer_access_attempt(
  target_assessment_id uuid,
  target_trainee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_approved_trainer()
    and exists (
      select 1
      from public.assessments a
      where a.id = target_assessment_id
        and (
          (
            a.course_id is not null
            and public.is_trainer_assigned_to_trainee_course(target_trainee_id, a.course_id)
            and (
              a.created_by = auth.uid()
              or public.is_trainer_assigned_to_course(a.course_id)
            )
          )
          or (
            a.course_id is null
            and a.created_by = auth.uid()
            and public.is_trainer_assigned_to_trainee(target_trainee_id)
          )
        )
    );
$$;

create or replace function public.is_attempt_identity_unchanged(
  target_id uuid,
  new_assessment_id uuid,
  new_trainee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assessment_attempts aa
    where aa.id = target_id
      and aa.assessment_id is not distinct from new_assessment_id
      and aa.trainee_id is not distinct from new_trainee_id
  );
$$;

create or replace function public.is_certificate_identity_unchanged(
  target_id uuid,
  new_certificate_code text,
  new_trainee_id uuid,
  new_course_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.certificates c
    where c.id = target_id
      and c.certificate_code is not distinct from new_certificate_code
      and c.trainee_id is not distinct from new_trainee_id
      and c.course_id is not distinct from new_course_id
  );
$$;

create or replace function public.is_notification_mark_read_only(
  target_id uuid,
  new_recipient_id uuid,
  new_audience text,
  new_priority text,
  new_title text,
  new_body text,
  new_created_by uuid,
  new_created_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.notifications n
    where n.id = target_id
      and n.recipient_id is not distinct from new_recipient_id
      and n.audience is not distinct from new_audience
      and n.priority is not distinct from new_priority
      and n.title is not distinct from new_title
      and n.body is not distinct from new_body
      and n.created_by is not distinct from new_created_by
      and n.created_at is not distinct from new_created_at
  );
$$;

-- Restrict helper function execution strictly to authenticated users (never PUBLIC or anon)
revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated;

revoke all on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.is_approved_trainer() from public, anon;
grant execute on function public.is_approved_trainer() to authenticated;

revoke all on function public.is_active_trainee() from public, anon;
grant execute on function public.is_active_trainee() to authenticated;

revoke all on function public.is_active_trainer_applicant() from public, anon;
grant execute on function public.is_active_trainer_applicant() to authenticated;

revoke all on function public.is_trainer_profile_active_and_approved(uuid) from public, anon;
grant execute on function public.is_trainer_profile_active_and_approved(uuid) to authenticated;

revoke all on function public.is_own_profile_update_permitted(uuid, text, text, text, text, timestamptz) from public, anon;
grant execute on function public.is_own_profile_update_permitted(uuid, text, text, text, text, timestamptz) to authenticated;

revoke all on function public.is_course_publicly_visible(uuid) from public, anon;
grant execute on function public.is_course_publicly_visible(uuid) to authenticated;

revoke all on function public.is_course_owner(uuid) from public, anon;
grant execute on function public.is_course_owner(uuid) to authenticated;

revoke all on function public.is_course_approval_unchanged_or_resubmitted(uuid, uuid, text, text, uuid, timestamptz) from public, anon;
grant execute on function public.is_course_approval_unchanged_or_resubmitted(uuid, uuid, text, text, uuid, timestamptz) to authenticated;

revoke all on function public.is_trainer_assigned_to_course(uuid) from public, anon;
grant execute on function public.is_trainer_assigned_to_course(uuid) to authenticated;

revoke all on function public.can_view_course_authenticated(uuid) from public, anon;
grant execute on function public.can_view_course_authenticated(uuid) to authenticated;

revoke all on function public.is_trainee_assigned_to_cohort(uuid) from public, anon;
grant execute on function public.is_trainee_assigned_to_cohort(uuid) to authenticated;

revoke all on function public.is_active_cohort_for_course(uuid, uuid) from public, anon;
grant execute on function public.is_active_cohort_for_course(uuid, uuid) to authenticated;

revoke all on function public.is_trainer_assigned_to_enrollment(uuid, uuid) from public, anon;
grant execute on function public.is_trainer_assigned_to_enrollment(uuid, uuid) to authenticated;

revoke all on function public.is_trainer_assigned_to_trainee(uuid) from public, anon;
grant execute on function public.is_trainer_assigned_to_trainee(uuid) to authenticated;

revoke all on function public.is_trainer_assigned_to_trainee_course(uuid, uuid) from public, anon;
grant execute on function public.is_trainer_assigned_to_trainee_course(uuid, uuid) to authenticated;

revoke all on function public.is_trainee_enrolled_in_course(uuid) from public, anon;
grant execute on function public.is_trainee_enrolled_in_course(uuid) to authenticated;

revoke all on function public.is_enrollment_identity_unchanged(uuid, uuid, uuid, uuid, uuid, uuid, timestamptz) from public, anon;
grant execute on function public.is_enrollment_identity_unchanged(uuid, uuid, uuid, uuid, uuid, uuid, timestamptz) to authenticated;

revoke all on function public.can_trainee_access_assessment(uuid) from public, anon;
grant execute on function public.can_trainee_access_assessment(uuid) to authenticated;

revoke all on function public.can_trainer_access_assessment(uuid) from public, anon;
grant execute on function public.can_trainer_access_assessment(uuid) to authenticated;

revoke all on function public.can_trainer_manage_assessment(uuid) from public, anon;
grant execute on function public.can_trainer_manage_assessment(uuid) to authenticated;

revoke all on function public.can_trainer_access_attempt(uuid, uuid) from public, anon;
grant execute on function public.can_trainer_access_attempt(uuid, uuid) to authenticated;

revoke all on function public.is_attempt_identity_unchanged(uuid, uuid, uuid) from public, anon;
grant execute on function public.is_attempt_identity_unchanged(uuid, uuid, uuid) to authenticated;

revoke all on function public.is_certificate_identity_unchanged(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.is_certificate_identity_unchanged(uuid, text, uuid, uuid) to authenticated;

revoke all on function public.is_notification_mark_read_only(uuid, uuid, text, text, text, text, uuid, timestamptz) from public, anon;
grant execute on function public.is_notification_mark_read_only(uuid, uuid, text, text, text, text, uuid, timestamptz) to authenticated;

-- ============================================================================
-- 2. SAFE PUBLIC TRAINER DIRECTORY VIEW (WITH SECURITY BARRIER)
--    Projects ONLY approved, active trainers and ONLY admin-verified expertise.
--    Excludes private emails, phone extensions, notification_prefs, job_role_id,
--    and all authentication/governance columns. Uses security_barrier = true
--    without security_invoker so underlying tables stay closed to anon callers.
-- ============================================================================

create or replace view public.public_trainer_directory
with (security_barrier = true) as
select
  p.id,
  p.full_name,
  p.department,
  p.designation,
  p.office_location,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'competency_id', te.competency_id,
        'domain', te.domain,
        'specialization', te.specialization,
        'credential', te.credential,
        'years_experience', te.years_experience,
        'verified_by_admin', te.verified_by_admin
      )
      order by te.created_at desc, te.domain asc
    ) filter (where te.id is not null),
    '[]'::jsonb
  ) as expertise
from public.profiles p
left join public.trainer_expertise te
  on te.trainer_id = p.id
 and te.verified_by_admin = true
where p.role = 'trainer'
  and p.approval_status = 'approved'
  and p.account_status = 'active'
group by p.id, p.full_name, p.department, p.designation, p.office_location;

revoke all on public.public_trainer_directory from public;
grant select on public.public_trainer_directory to anon, authenticated;

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY & HARDEN TABLE GRANTS FOR ANON DEFENSE-IN-DEPTH
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.job_roles enable row level security;
alter table public.competencies enable row level security;
alter table public.role_requirements enable row level security;
alter table public.trainer_expertise enable row level security;
alter table public.courses enable row level security;
alter table public.course_competencies enable row level security;
alter table public.trainer_assignments enable row level security;
alter table public.enrollments enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.learning_resources enable row level security;
alter table public.progress_history enable row level security;
alter table public.certificates enable row level security;
alter table public.feedback enable row level security;
alter table public.notifications enable row level security;

revoke all on table
  public.profiles,
  public.job_roles,
  public.role_requirements,
  public.trainer_expertise,
  public.trainer_assignments,
  public.enrollments,
  public.assessments,
  public.assessment_questions,
  public.assessment_attempts,
  public.learning_resources,
  public.progress_history,
  public.certificates,
  public.feedback,
  public.notifications
from public, anon;

revoke all on table
  public.competencies,
  public.courses,
  public.course_competencies
from public, anon;

grant select on table
  public.competencies,
  public.courses,
  public.course_competencies
to anon, authenticated;

-- ============================================================================
-- 4. TABLE-BY-TABLE ROW LEVEL SECURITY POLICIES (NO RECURSION / NO OVERLAP)
-- ============================================================================

-- 1. profiles
drop policy if exists "profiles_select_own_or_admin_or_assigned_trainer" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert_admin" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
drop policy if exists "profiles_delete_admin" on public.profiles;

create policy "profiles_select"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or public.is_trainer_assigned_to_trainee(id)
  );

create policy "profiles_insert_admin"
  on public.profiles for insert
  to authenticated
  with check (public.is_admin());

create policy "profiles_update"
  on public.profiles for update
  to authenticated
  using (
    public.is_admin()
    or (id = auth.uid() and public.is_active_user())
  )
  with check (
    public.is_admin()
    or (
      id = auth.uid()
      and public.is_own_profile_update_permitted(
        id,
        email,
        role,
        approval_status,
        account_status,
        created_at
      )
    )
  );

create policy "profiles_delete_admin"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- 2. job_roles
drop policy if exists "job_roles_select_authenticated" on public.job_roles;
drop policy if exists "job_roles_admin_manage" on public.job_roles;
drop policy if exists "job_roles_select" on public.job_roles;
drop policy if exists "job_roles_insert_admin" on public.job_roles;
drop policy if exists "job_roles_update_admin" on public.job_roles;
drop policy if exists "job_roles_delete_admin" on public.job_roles;

create policy "job_roles_select"
  on public.job_roles for select
  to authenticated
  using (public.is_active_user() or public.is_admin());

create policy "job_roles_insert_admin"
  on public.job_roles for insert
  to authenticated
  with check (public.is_admin());

create policy "job_roles_update_admin"
  on public.job_roles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "job_roles_delete_admin"
  on public.job_roles for delete
  to authenticated
  using (public.is_admin());

-- 3. competencies
drop policy if exists "competencies_select_all" on public.competencies;
drop policy if exists "competencies_admin_manage" on public.competencies;
drop policy if exists "competencies_select_anon" on public.competencies;
drop policy if exists "competencies_select_authenticated" on public.competencies;
drop policy if exists "competencies_insert_admin" on public.competencies;
drop policy if exists "competencies_update_admin" on public.competencies;
drop policy if exists "competencies_delete_admin" on public.competencies;

create policy "competencies_select_anon"
  on public.competencies for select
  to anon
  using (
    exists (
      select 1
      from public.course_competencies cc
      join public.courses c on c.id = cc.course_id
      where cc.competency_id = competencies.id
        and c.is_published = true
        and c.approval_status = 'approved'
    )
  );

create policy "competencies_select_authenticated"
  on public.competencies for select
  to authenticated
  using (public.is_active_user() or public.is_admin());

create policy "competencies_insert_admin"
  on public.competencies for insert
  to authenticated
  with check (public.is_admin());

create policy "competencies_update_admin"
  on public.competencies for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "competencies_delete_admin"
  on public.competencies for delete
  to authenticated
  using (public.is_admin());

-- 4. role_requirements
drop policy if exists "role_requirements_select_authenticated" on public.role_requirements;
drop policy if exists "role_requirements_admin_manage" on public.role_requirements;
drop policy if exists "role_requirements_select" on public.role_requirements;
drop policy if exists "role_requirements_insert_admin" on public.role_requirements;
drop policy if exists "role_requirements_update_admin" on public.role_requirements;
drop policy if exists "role_requirements_delete_admin" on public.role_requirements;

create policy "role_requirements_select"
  on public.role_requirements for select
  to authenticated
  using (public.is_active_user() or public.is_admin());

create policy "role_requirements_insert_admin"
  on public.role_requirements for insert
  to authenticated
  with check (public.is_admin());

create policy "role_requirements_update_admin"
  on public.role_requirements for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "role_requirements_delete_admin"
  on public.role_requirements for delete
  to authenticated
  using (public.is_admin());

-- 5. trainer_expertise
drop policy if exists "trainer_expertise_select_own_or_admin" on public.trainer_expertise;
drop policy if exists "trainer_expertise_trainer_insert_own" on public.trainer_expertise;
drop policy if exists "trainer_expertise_trainer_delete_own" on public.trainer_expertise;
drop policy if exists "trainer_expertise_admin_update" on public.trainer_expertise;
drop policy if exists "trainer_expertise_select" on public.trainer_expertise;
drop policy if exists "trainer_expertise_insert" on public.trainer_expertise;
drop policy if exists "trainer_expertise_update_admin" on public.trainer_expertise;
drop policy if exists "trainer_expertise_delete" on public.trainer_expertise;

create policy "trainer_expertise_select"
  on public.trainer_expertise for select
  to authenticated
  using (
    public.is_admin()
    or (trainer_id = auth.uid() and public.is_active_user())
    or (
      public.is_active_user()
      and verified_by_admin = true
      and public.is_trainer_profile_active_and_approved(trainer_id)
    )
  );

create policy "trainer_expertise_insert"
  on public.trainer_expertise for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      trainer_id = auth.uid()
      and public.is_active_trainer_applicant()
      and verified_by_admin = false
    )
  );

create policy "trainer_expertise_update_admin"
  on public.trainer_expertise for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "trainer_expertise_delete"
  on public.trainer_expertise for delete
  to authenticated
  using (
    public.is_admin()
    or (trainer_id = auth.uid() and public.is_active_trainer_applicant())
  );

-- 6. courses
drop policy if exists "courses_select_published_or_owner" on public.courses;
drop policy if exists "courses_insert_trainer_or_admin" on public.courses;
drop policy if exists "courses_update_owner_or_admin" on public.courses;
drop policy if exists "courses_delete_owner_or_admin" on public.courses;
drop policy if exists "courses_select_anon" on public.courses;
drop policy if exists "courses_select_authenticated" on public.courses;
drop policy if exists "courses_insert" on public.courses;
drop policy if exists "courses_update" on public.courses;
drop policy if exists "courses_delete" on public.courses;

create policy "courses_select_anon"
  on public.courses for select
  to anon
  using (is_published = true and approval_status = 'approved');

create policy "courses_select_authenticated"
  on public.courses for select
  to authenticated
  using (
    public.is_admin()
    or (
      public.is_active_user()
      and is_published = true
      and approval_status = 'approved'
    )
    or public.is_trainer_assigned_to_course(id)
  );

create policy "courses_insert"
  on public.courses for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      public.is_approved_trainer()
      and created_by = auth.uid()
      and approval_status = 'pending'
      and approved_by is null
      and approved_at is null
    )
  );

create policy "courses_update"
  on public.courses for update
  to authenticated
  using (
    public.is_admin()
    or (public.is_approved_trainer() and created_by = auth.uid())
  )
  with check (
    public.is_admin()
    or (
      public.is_approved_trainer()
      and created_by = auth.uid()
      and public.is_course_approval_unchanged_or_resubmitted(
        id,
        created_by,
        approval_status,
        approval_notes,
        approved_by,
        approved_at
      )
    )
  );

create policy "courses_delete"
  on public.courses for delete
  to authenticated
  using (
    public.is_admin()
    or (public.is_approved_trainer() and created_by = auth.uid())
  );

-- 7. course_competencies
drop policy if exists "course_competencies_select_all" on public.course_competencies;
drop policy if exists "course_competencies_manage" on public.course_competencies;
drop policy if exists "course_competencies_select_anon" on public.course_competencies;
drop policy if exists "course_competencies_select_authenticated" on public.course_competencies;
drop policy if exists "course_competencies_insert" on public.course_competencies;
drop policy if exists "course_competencies_update" on public.course_competencies;
drop policy if exists "course_competencies_delete" on public.course_competencies;

create policy "course_competencies_select_anon"
  on public.course_competencies for select
  to anon
  using (
    exists (
      select 1
      from public.courses c
      where c.id = course_competencies.course_id
        and c.is_published = true
        and c.approval_status = 'approved'
    )
  );

create policy "course_competencies_select_authenticated"
  on public.course_competencies for select
  to authenticated
  using (public.can_view_course_authenticated(course_id));

create policy "course_competencies_insert"
  on public.course_competencies for insert
  to authenticated
  with check (
    public.is_admin()
    or (public.is_approved_trainer() and public.is_course_owner(course_id))
  );

create policy "course_competencies_update"
  on public.course_competencies for update
  to authenticated
  using (
    public.is_admin()
    or (public.is_approved_trainer() and public.is_course_owner(course_id))
  )
  with check (
    public.is_admin()
    or (public.is_approved_trainer() and public.is_course_owner(course_id))
  );

create policy "course_competencies_delete"
  on public.course_competencies for delete
  to authenticated
  using (
    public.is_admin()
    or (public.is_approved_trainer() and public.is_course_owner(course_id))
  );

-- 8. trainer_assignments
drop policy if exists "trainer_assignments_select" on public.trainer_assignments;
drop policy if exists "trainer_assignments_admin_manage" on public.trainer_assignments;
drop policy if exists "trainer_assignments_insert_admin" on public.trainer_assignments;
drop policy if exists "trainer_assignments_update_admin" on public.trainer_assignments;
drop policy if exists "trainer_assignments_delete_admin" on public.trainer_assignments;

create policy "trainer_assignments_select"
  on public.trainer_assignments for select
  to authenticated
  using (
    public.is_admin()
    or (trainer_id = auth.uid() and public.is_approved_trainer())
    or (
      public.is_active_user()
      and status = 'active'
      and public.is_course_publicly_visible(course_id)
    )
    or public.is_trainee_assigned_to_cohort(id)
  );

create policy "trainer_assignments_insert_admin"
  on public.trainer_assignments for insert
  to authenticated
  with check (public.is_admin());

create policy "trainer_assignments_update_admin"
  on public.trainer_assignments for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "trainer_assignments_delete_admin"
  on public.trainer_assignments for delete
  to authenticated
  using (public.is_admin());

-- 9. enrollments
drop policy if exists "enrollments_select" on public.enrollments;
drop policy if exists "enrollments_insert_trainee_or_admin" on public.enrollments;
drop policy if exists "enrollments_update_own_or_admin_or_trainer" on public.enrollments;
drop policy if exists "enrollments_insert" on public.enrollments;
drop policy if exists "enrollments_update" on public.enrollments;
drop policy if exists "enrollments_delete_admin" on public.enrollments;

create policy "enrollments_select"
  on public.enrollments for select
  to authenticated
  using (
    public.is_admin()
    or (trainee_id = auth.uid() and public.is_active_trainee())
    or (
      status <> 'withdrawn'
      and public.is_trainer_assigned_to_enrollment(course_id, trainer_assignment_id)
    )
  );

create policy "enrollments_insert"
  on public.enrollments for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      trainee_id = auth.uid()
      and public.is_active_trainee()
      and (assigned_by is null or assigned_by = auth.uid())
      and progress_percent = 0
      and status in ('assigned', 'in_progress')
      and completed_at is null
      and public.is_course_publicly_visible(course_id)
      and (
        trainer_assignment_id is null
        or public.is_active_cohort_for_course(trainer_assignment_id, course_id)
      )
    )
  );

create policy "enrollments_update"
  on public.enrollments for update
  to authenticated
  using (
    public.is_admin()
    or (
      status <> 'withdrawn'
      and (
        (trainee_id = auth.uid() and public.is_active_trainee())
        or public.is_trainer_assigned_to_enrollment(course_id, trainer_assignment_id)
      )
    )
  )
  with check (
    public.is_admin()
    or (
      (
        (trainee_id = auth.uid() and public.is_active_trainee())
        or public.is_trainer_assigned_to_enrollment(course_id, trainer_assignment_id)
      )
      and public.is_enrollment_identity_unchanged(
        id,
        trainee_id,
        course_id,
        trainer_assignment_id,
        mapped_competency_id,
        assigned_by,
        enrolled_at
      )
    )
  );

create policy "enrollments_delete_admin"
  on public.enrollments for delete
  to authenticated
  using (public.is_admin());

-- 10. assessments
drop policy if exists "assessments_select" on public.assessments;
drop policy if exists "assessments_insert_trainer_or_admin" on public.assessments;
drop policy if exists "assessments_update_delete" on public.assessments;
drop policy if exists "assessments_insert" on public.assessments;
drop policy if exists "assessments_update" on public.assessments;
drop policy if exists "assessments_delete" on public.assessments;

create policy "assessments_select"
  on public.assessments for select
  to authenticated
  using (
    public.is_admin()
    or (
      public.is_approved_trainer()
      and (
        created_by = auth.uid()
        or public.is_trainer_assigned_to_course(course_id)
      )
    )
    or (
      public.is_active_trainee()
      and is_published = true
      and (
        course_id is null
        or (
          assessment_type = 'Diagnostic Baseline'
          and public.is_course_publicly_visible(course_id)
        )
        or public.is_trainee_enrolled_in_course(course_id)
      )
    )
  );

create policy "assessments_insert"
  on public.assessments for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      public.is_approved_trainer()
      and created_by = auth.uid()
      and (course_id is null or public.is_trainer_assigned_to_course(course_id))
    )
  );

create policy "assessments_update"
  on public.assessments for update
  to authenticated
  using (
    public.is_admin()
    or (public.is_approved_trainer() and created_by = auth.uid())
  )
  with check (
    public.is_admin()
    or (
      public.is_approved_trainer()
      and created_by = auth.uid()
      and (course_id is null or public.is_trainer_assigned_to_course(course_id))
    )
  );

create policy "assessments_delete"
  on public.assessments for delete
  to authenticated
  using (
    public.is_admin()
    or (public.is_approved_trainer() and created_by = auth.uid())
  );

-- 11. assessment_questions
drop policy if exists "assessment_questions_select" on public.assessment_questions;
drop policy if exists "assessment_questions_manage" on public.assessment_questions;
drop policy if exists "assessment_questions_insert" on public.assessment_questions;
drop policy if exists "assessment_questions_update" on public.assessment_questions;
drop policy if exists "assessment_questions_delete" on public.assessment_questions;

create policy "assessment_questions_select"
  on public.assessment_questions for select
  to authenticated
  using (
    public.is_admin()
    or public.can_trainer_access_assessment(assessment_id)
    or public.can_trainee_access_assessment(assessment_id)
  );

create policy "assessment_questions_insert"
  on public.assessment_questions for insert
  to authenticated
  with check (
    public.is_admin()
    or public.can_trainer_manage_assessment(assessment_id)
  );

create policy "assessment_questions_update"
  on public.assessment_questions for update
  to authenticated
  using (
    public.is_admin()
    or public.can_trainer_manage_assessment(assessment_id)
  )
  with check (
    public.is_admin()
    or public.can_trainer_manage_assessment(assessment_id)
  );

create policy "assessment_questions_delete"
  on public.assessment_questions for delete
  to authenticated
  using (
    public.is_admin()
    or public.can_trainer_manage_assessment(assessment_id)
  );

-- 12. assessment_attempts
drop policy if exists "assessment_attempts_select" on public.assessment_attempts;
drop policy if exists "assessment_attempts_insert_trainee" on public.assessment_attempts;
drop policy if exists "assessment_attempts_update_trainer_or_admin" on public.assessment_attempts;
drop policy if exists "assessment_attempts_insert" on public.assessment_attempts;
drop policy if exists "assessment_attempts_update" on public.assessment_attempts;
drop policy if exists "assessment_attempts_delete_admin" on public.assessment_attempts;

create policy "assessment_attempts_select"
  on public.assessment_attempts for select
  to authenticated
  using (
    public.is_admin()
    or (trainee_id = auth.uid() and public.is_active_trainee())
    or public.can_trainer_access_attempt(assessment_id, trainee_id)
  );

create policy "assessment_attempts_insert"
  on public.assessment_attempts for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      trainee_id = auth.uid()
      and public.is_active_trainee()
      and status in ('in_progress', 'submitted')
      and score_percent is null
      and achieved_level is null
      and passed is null
      and evaluated_by is null
      and evaluated_at is null
      and public.can_trainee_access_assessment(assessment_id)
    )
    or public.can_trainer_access_attempt(assessment_id, trainee_id)
  );

create policy "assessment_attempts_update"
  on public.assessment_attempts for update
  to authenticated
  using (
    public.is_admin()
    or public.can_trainer_access_attempt(assessment_id, trainee_id)
  )
  with check (
    public.is_admin()
    or (
      public.can_trainer_access_attempt(assessment_id, trainee_id)
      and (evaluated_by is null or evaluated_by = auth.uid())
      and public.is_attempt_identity_unchanged(id, assessment_id, trainee_id)
    )
  );

create policy "assessment_attempts_delete_admin"
  on public.assessment_attempts for delete
  to authenticated
  using (public.is_admin());

-- 13. learning_resources
drop policy if exists "learning_resources_select_authenticated" on public.learning_resources;
drop policy if exists "learning_resources_select" on public.learning_resources;
drop policy if exists "learning_resources_insert" on public.learning_resources;
drop policy if exists "learning_resources_update" on public.learning_resources;
drop policy if exists "learning_resources_delete" on public.learning_resources;

create policy "learning_resources_select"
  on public.learning_resources for select
  to authenticated
  using (
    public.is_admin()
    or (
      public.is_approved_trainer()
      and (uploaded_by = auth.uid() or public.is_trainer_assigned_to_course(course_id))
    )
    or public.is_trainee_enrolled_in_course(course_id)
  );

create policy "learning_resources_insert"
  on public.learning_resources for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      public.is_approved_trainer()
      and uploaded_by = auth.uid()
      and public.is_trainer_assigned_to_course(course_id)
    )
  );

create policy "learning_resources_update"
  on public.learning_resources for update
  to authenticated
  using (
    public.is_admin()
    or (
      public.is_approved_trainer()
      and (uploaded_by = auth.uid() or public.is_course_owner(course_id))
    )
  )
  with check (
    public.is_admin()
    or (
      public.is_approved_trainer()
      and uploaded_by = auth.uid()
      and public.is_trainer_assigned_to_course(course_id)
    )
  );

create policy "learning_resources_delete"
  on public.learning_resources for delete
  to authenticated
  using (
    public.is_admin()
    or (
      public.is_approved_trainer()
      and (uploaded_by = auth.uid() or public.is_course_owner(course_id))
    )
  );

-- 14. progress_history
drop policy if exists "progress_history_select" on public.progress_history;
drop policy if exists "progress_history_insert_own_or_trainer_admin" on public.progress_history;
drop policy if exists "progress_history_delete_own_or_admin" on public.progress_history;
drop policy if exists "progress_history_insert" on public.progress_history;
drop policy if exists "progress_history_update" on public.progress_history;
drop policy if exists "progress_history_delete" on public.progress_history;

create policy "progress_history_select"
  on public.progress_history for select
  to authenticated
  using (
    public.is_admin()
    or (trainee_id = auth.uid() and public.is_active_user())
    or public.is_trainer_assigned_to_trainee(trainee_id)
  );

create policy "progress_history_insert"
  on public.progress_history for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      trainee_id = auth.uid()
      and public.is_active_trainee()
      and stage = 'self_declaration'
      and source_attempt_id is null
      and assessed_by is null
    )
    or (
      public.is_trainer_assigned_to_trainee(trainee_id)
      and stage in ('skill_assessment', 'skill_gap', 'training_progress', 'reassessment')
      and assessed_by = auth.uid()
    )
  );

create policy "progress_history_update"
  on public.progress_history for update
  to authenticated
  using (
    public.is_admin()
    or (
      public.is_trainer_assigned_to_trainee(trainee_id)
      and assessed_by = auth.uid()
      and stage in ('skill_assessment', 'skill_gap', 'training_progress', 'reassessment')
    )
  )
  with check (
    public.is_admin()
    or (
      public.is_trainer_assigned_to_trainee(trainee_id)
      and assessed_by = auth.uid()
      and stage in ('skill_assessment', 'skill_gap', 'training_progress', 'reassessment')
    )
  );

create policy "progress_history_delete"
  on public.progress_history for delete
  to authenticated
  using (
    public.is_admin()
    or (
      trainee_id = auth.uid()
      and public.is_active_trainee()
      and stage = 'self_declaration'
    )
  );

-- 15. certificates
drop policy if exists "certificates_select" on public.certificates;
drop policy if exists "certificates_manage_trainer_or_admin" on public.certificates;
drop policy if exists "certificates_insert" on public.certificates;
drop policy if exists "certificates_update" on public.certificates;
drop policy if exists "certificates_delete_admin" on public.certificates;

create policy "certificates_select"
  on public.certificates for select
  to authenticated
  using (
    public.is_admin()
    or (trainee_id = auth.uid() and public.is_active_trainee())
    or public.is_trainer_assigned_to_trainee_course(trainee_id, course_id)
  );

create policy "certificates_insert"
  on public.certificates for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      public.is_trainer_assigned_to_trainee_course(trainee_id, course_id)
      and verified_by = auth.uid()
      and status = 'verified'
    )
  );

create policy "certificates_update"
  on public.certificates for update
  to authenticated
  using (
    public.is_admin()
    or public.is_trainer_assigned_to_trainee_course(trainee_id, course_id)
  )
  with check (
    public.is_admin()
    or (
      public.is_trainer_assigned_to_trainee_course(trainee_id, course_id)
      and public.is_certificate_identity_unchanged(id, certificate_code, trainee_id, course_id)
    )
  );

create policy "certificates_delete_admin"
  on public.certificates for delete
  to authenticated
  using (public.is_admin());

-- 16. feedback
drop policy if exists "feedback_select" on public.feedback;
drop policy if exists "feedback_insert_own" on public.feedback;
drop policy if exists "feedback_delete_own_or_admin" on public.feedback;
drop policy if exists "feedback_insert" on public.feedback;
drop policy if exists "feedback_update_admin" on public.feedback;
drop policy if exists "feedback_delete" on public.feedback;

create policy "feedback_select"
  on public.feedback for select
  to authenticated
  using (
    public.is_admin()
    or (user_id = auth.uid() and public.is_active_user())
    or (
      public.is_approved_trainer()
      and course_id is not null
      and public.is_trainer_assigned_to_course(course_id)
    )
  );

create policy "feedback_insert"
  on public.feedback for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      user_id = auth.uid()
      and public.is_active_user()
      and (
        course_id is null
        or public.is_course_publicly_visible(course_id)
        or public.is_trainee_enrolled_in_course(course_id)
      )
    )
  );

create policy "feedback_update_admin"
  on public.feedback for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "feedback_delete"
  on public.feedback for delete
  to authenticated
  using (
    public.is_admin()
    or (user_id = auth.uid() and public.is_active_user())
  );

-- 17. notifications
drop policy if exists "notifications_select" on public.notifications;
drop policy if exists "notifications_admin_manage" on public.notifications;
drop policy if exists "notifications_trainer_insert_user" on public.notifications;
drop policy if exists "notifications_mark_read_own" on public.notifications;
drop policy if exists "notifications_insert" on public.notifications;
drop policy if exists "notifications_update" on public.notifications;
drop policy if exists "notifications_delete_admin" on public.notifications;

create policy "notifications_select"
  on public.notifications for select
  to authenticated
  using (
    public.is_admin()
    or (
      public.is_active_user()
      and (
        recipient_id = auth.uid()
        or (audience = 'All Roles' and recipient_id is null)
        or (audience = 'Trainees Only' and public.is_active_trainee())
        or (audience = 'Trainers Only' and public.is_approved_trainer())
      )
    )
  );

create policy "notifications_insert"
  on public.notifications for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      public.is_approved_trainer()
      and audience = 'User'
      and recipient_id is not null
      and created_by = auth.uid()
      and public.is_trainer_assigned_to_trainee(recipient_id)
    )
  );

create policy "notifications_update"
  on public.notifications for update
  to authenticated
  using (
    public.is_admin()
    or (recipient_id = auth.uid() and public.is_active_user())
  )
  with check (
    public.is_admin()
    or (
      recipient_id = auth.uid()
      and public.is_active_user()
      and public.is_notification_mark_read_only(
        id,
        recipient_id,
        audience,
        priority,
        title,
        body,
        created_by,
        created_at
      )
    )
  );

create policy "notifications_delete_admin"
  on public.notifications for delete
  to authenticated
  using (public.is_admin());
