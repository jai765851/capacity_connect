-- CAPACITY CONNECT (SIH26075)
-- Migration 005: Competency Mapping, 0-100 Scoring & Skill-Gap Analysis Engine Upgrade
-- Idempotent migration: safe to run on both fresh installs and databases previously migrated with 001-004.

-- 1. Ensure 0-100 score columns exist alongside 1-5 proficiency levels
alter table public.role_requirements
  add column if not exists required_score integer not null default 75 check (required_score between 0 and 100);

update public.role_requirements
set required_score = case required_level
  when 5 then 90
  when 4 then 80
  when 3 then 70
  when 2 then 55
  else 40
end
where required_score = 75 and required_level is not null and required_level <> 4;

alter table public.progress_history
  add column if not exists recorded_score integer check (recorded_score between 0 and 100),
  add column if not exists target_score integer check (target_score between 0 and 100),
  add column if not exists assessed_by uuid references public.profiles(id) on delete set null;

-- Backfill recorded_score from linked assessment_attempts or recorded_level if previously null
update public.progress_history ph
set recorded_score = coalesce(
  (select aa.score_percent from public.assessment_attempts aa where aa.id = ph.source_attempt_id),
  case ph.recorded_level
    when 5 then 92
    when 4 then 80
    when 3 then 65
    when 2 then 50
    else 35
  end
)
where ph.recorded_score is null;

alter table public.progress_history
  alter column recorded_score set default 0;

alter table public.progress_history
  alter column recorded_score set not null;

-- 2. Allow linking verified trainer_expertise directly to institutional competencies
alter table public.trainer_expertise
  add column if not exists competency_id uuid references public.competencies(id) on delete set null;

-- 3. Refresh public_trainer_directory view to expose competency_id & verified_by_admin
create or replace view public.public_trainer_directory as
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
    ) filter (where te.id is not null),
    '[]'::jsonb
  ) as expertise
from public.profiles p
left join public.trainer_expertise te on te.trainer_id = p.id
where p.role = 'trainer'
  and p.approval_status = 'approved'
  and p.account_status = 'active'
group by p.id, p.full_name, p.department, p.designation, p.office_location;

grant select on public.public_trainer_directory to anon, authenticated;

-- 4. Update RLS policies so approved Trainers can assess trainees & verified expertise/cohorts are matchable
drop policy if exists "profiles_select_own_or_admin_or_assigned_trainer" on public.profiles;
create policy "profiles_select_own_or_admin_or_assigned_trainer"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.is_admin()
    or (
      public.is_approved_trainer()
      and role in ('trainee', 'trainer')
    )
  );

drop policy if exists "trainer_expertise_select_own_or_admin" on public.trainer_expertise;
create policy "trainer_expertise_select_own_or_admin"
  on public.trainer_expertise for select
  to authenticated
  using (verified_by_admin = true or trainer_id = auth.uid() or public.is_admin());

drop policy if exists "trainer_assignments_select" on public.trainer_assignments;
create policy "trainer_assignments_select"
  on public.trainer_assignments for select
  to authenticated
  using (status = 'active' or trainer_id = auth.uid() or public.is_admin());

drop policy if exists "assessment_attempts_insert_trainee" on public.assessment_attempts;
create policy "assessment_attempts_insert_trainee"
  on public.assessment_attempts for insert
  with check (
    trainee_id = auth.uid()
    or public.is_approved_trainer()
    or public.is_admin()
  );

drop policy if exists "notifications_trainer_insert_user" on public.notifications;
create policy "notifications_trainer_insert_user"
  on public.notifications for insert
  with check (
    public.is_approved_trainer()
    and audience = 'User'
    and recipient_id is not null
    and created_by = auth.uid()
  );

create index if not exists idx_progress_history_comp_recorded
  on public.progress_history(trainee_id, competency_id, recorded_at desc);

create index if not exists idx_trainer_expertise_verified
  on public.trainer_expertise(verified_by_admin, competency_id, domain);
