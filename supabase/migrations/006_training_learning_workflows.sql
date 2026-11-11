-- CAPACITY CONNECT (SIH26075)
-- Migration 006: Complete Training & Learning Workflows, Course Approvals, Assessment Deadlines,
-- Enrolment-Scoped Storage RLS & Trainee Privacy Hardening
-- Idempotent migration: safe to run on both fresh installs and databases previously migrated with 001-005.

-- 1. Courses: structured learning_objectives & Admin approval workflow
alter table public.courses
  add column if not exists learning_objectives jsonb not null default '[]'::jsonb,
  add column if not exists approval_status text not null default 'approved'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists approval_notes text not null default '',
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz;

create or replace function public.enforce_course_approval_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allow server/service-role migrations when auth.uid() is null
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    if new.approval_status in ('approved', 'rejected') then
      if tg_op = 'INSERT' or new.approval_status is distinct from old.approval_status then
        new.approved_by := coalesce(new.approved_by, auth.uid());
        new.approved_at := coalesce(new.approved_at, now());
      end if;
    elsif tg_op = 'INSERT' then
      new.approval_status := coalesce(new.approval_status, 'approved');
    end if;
    return new;
  end if;

  -- Non-admin (Approved Trainer) rules
  if tg_op = 'INSERT' then
    new.approval_status := 'pending';
    new.approval_notes := '';
    new.approved_by := null;
    new.approved_at := null;
    return new;
  end if;

  -- On UPDATE by non-admin trainer: never permit self-approval or rejecting
  if new.approval_status = 'approved' and old.approval_status <> 'approved' then
    raise exception 'Forbidden: only administrators can approve courses';
  end if;
  if new.approval_status = 'rejected' and old.approval_status <> 'rejected' then
    raise exception 'Forbidden: only administrators can reject courses';
  end if;

  -- Allow resubmitting a previously rejected course back to pending when revised
  if old.approval_status = 'rejected' then
    new.approval_status := 'pending';
    new.approved_by := null;
    new.approved_at := null;
  else
    new.approval_status := old.approval_status;
    new.approved_by := old.approved_by;
    new.approved_at := old.approved_at;
    new.approval_notes := old.approval_notes;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_course_approval_workflow on public.courses;
create trigger trg_enforce_course_approval_workflow
  before insert or update on public.courses
  for each row execute function public.enforce_course_approval_workflow();

-- 2. Assessments: deadline timestamp (due_at)
alter table public.assessments
  add column if not exists due_at timestamptz;

-- 3. Learning Resources: include Video Lecture alongside PDF manuals, Slide Decks, Exercises, Policies
do $$
declare
  constraint_rec record;
begin
  for constraint_rec in
    select conname
    from pg_constraint
    where conrelid = 'public.learning_resources'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%material_type%'
  loop
    execute format('alter table public.learning_resources drop constraint %I', constraint_rec.conname);
  end loop;
end $$;

alter table public.learning_resources
  add constraint learning_resources_material_type_check
  check (
    material_type in (
      'Reference Manual',
      'Slide Deck',
      'Video Lecture',
      'Case Exercise',
      'Policy Document'
    )
  );

-- Increase learning-resources private bucket file size limit to 100 MB for video & slide uploads
update storage.buckets
set public = false,
    file_size_limit = 104857600
where id = 'learning-resources';

-- 4. Access helper functions for enrolment-scoped resources & storage objects
create or replace function public.can_access_course_resource(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or (
      public.is_approved_trainer()
      and (
        exists (
          select 1 from public.courses c
          where c.id = target_course_id and c.created_by = auth.uid()
        )
        or exists (
          select 1 from public.trainer_assignments ta
          where ta.course_id = target_course_id and ta.trainer_id = auth.uid()
        )
      )
    )
    or exists (
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

create or replace function public.can_access_course_folder(folder_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parsed_course_id uuid;
begin
  if folder_name is null or trim(folder_name) = '' then
    return public.is_admin();
  end if;

  begin
    parsed_course_id := trim(folder_name)::uuid;
  exception when invalid_text_representation then
    return public.is_admin();
  end;

  return public.can_access_course_resource(parsed_course_id);
end;
$$;

-- 5. Hardened RLS Policies Across Courses, Enrollments, Learning Resources, Assessments & Feedback

-- Courses: public/trainees only see published + approved; trainer authors/assigned & admin see drafts/pending
drop policy if exists "courses_select_published_or_owner" on public.courses;
create policy "courses_select_published_or_owner"
  on public.courses for select
  to anon, authenticated
  using (
    (is_published = true and approval_status = 'approved')
    or created_by = auth.uid()
    or public.is_admin()
    or (
      public.is_approved_trainer()
      and exists (
        select 1 from public.trainer_assignments ta
        where ta.course_id = courses.id and ta.trainer_id = auth.uid()
      )
    )
  );

-- Enrollments: strict trainee isolation; trainers also see enrolments for courses they authored or cohorts assigned
drop policy if exists "enrollments_select" on public.enrollments;
create policy "enrollments_select"
  on public.enrollments for select
  using (
    trainee_id = auth.uid()
    or public.is_admin()
    or (
      public.is_approved_trainer()
      and (
        exists (
          select 1 from public.trainer_assignments ta
          where ta.id = enrollments.trainer_assignment_id
            and ta.trainer_id = auth.uid()
        )
        or exists (
          select 1 from public.trainer_assignments ta
          where ta.course_id = enrollments.course_id
            and ta.trainer_id = auth.uid()
        )
        or exists (
          select 1 from public.courses c
          where c.id = enrollments.course_id
            and c.created_by = auth.uid()
        )
      )
    )
  );

drop policy if exists "enrollments_update_own_or_admin_or_trainer" on public.enrollments;
create policy "enrollments_update_own_or_admin_or_trainer"
  on public.enrollments for update
  using (
    trainee_id = auth.uid()
    or public.is_admin()
    or (
      public.is_approved_trainer()
      and (
        exists (
          select 1 from public.trainer_assignments ta
          where ta.id = enrollments.trainer_assignment_id
            and ta.trainer_id = auth.uid()
        )
        or exists (
          select 1 from public.trainer_assignments ta
          where ta.course_id = enrollments.course_id
            and ta.trainer_id = auth.uid()
        )
        or exists (
          select 1 from public.courses c
          where c.id = enrollments.course_id
            and c.created_by = auth.uid()
        )
      )
    )
  );

-- Learning resources: strictly authorised by course enrolment (for trainees) or course ownership/assignment (for trainers)
drop policy if exists "learning_resources_select_authenticated" on public.learning_resources;
create policy "learning_resources_select_authenticated"
  on public.learning_resources for select
  to authenticated
  using (
    public.can_access_course_resource(course_id)
    or (public.is_approved_trainer() and uploaded_by = auth.uid())
  );

drop policy if exists "learning_resources_insert" on public.learning_resources;
create policy "learning_resources_insert"
  on public.learning_resources for insert
  with check (
    public.is_admin()
    or (
      public.is_approved_trainer()
      and uploaded_by = auth.uid()
      and (
        exists (
          select 1 from public.courses c
          where c.id = learning_resources.course_id and c.created_by = auth.uid()
        )
        or exists (
          select 1 from public.trainer_assignments ta
          where ta.course_id = learning_resources.course_id and ta.trainer_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "learning_resources_delete" on public.learning_resources;
create policy "learning_resources_delete"
  on public.learning_resources for delete
  using (
    public.is_admin()
    or (
      public.is_approved_trainer()
      and (
        uploaded_by = auth.uid()
        or exists (
          select 1 from public.courses c
          where c.id = learning_resources.course_id and c.created_by = auth.uid()
        )
      )
    )
  );

-- Storage RLS for 'learning-resources': private signed URL access restricted strictly by course authorisation
drop policy if exists "learning_resources_storage_read" on storage.objects;
create policy "learning_resources_storage_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'learning-resources'
    and public.can_access_course_folder((storage.foldername(name))[1])
  );

drop policy if exists "learning_resources_storage_upload" on storage.objects;
create policy "learning_resources_storage_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'learning-resources'
    and (
      public.is_admin()
      or (
        public.is_approved_trainer()
        and public.can_access_course_folder((storage.foldername(name))[1])
      )
    )
  );

drop policy if exists "learning_resources_storage_delete" on storage.objects;
create policy "learning_resources_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'learning-resources'
    and (
      public.is_admin()
      or (
        public.is_approved_trainer()
        and (
          owner = auth.uid()
          or public.can_access_course_folder((storage.foldername(name))[1])
        )
      )
    )
  );

-- Assessments & Questions: scope course-bound exams to enrolled trainees + protect draft items
drop policy if exists "assessments_select" on public.assessments;
create policy "assessments_select"
  on public.assessments for select
  to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or (public.is_approved_trainer() and is_published = true)
    or (
      is_published = true
      and (
        course_id is null
        or assessment_type = 'Diagnostic Baseline'
        or exists (
          select 1
          from public.enrollments e
          join public.courses c on c.id = e.course_id
          where e.trainee_id = auth.uid()
            and e.course_id = assessments.course_id
            and e.status <> 'withdrawn'
            and c.is_published = true
            and c.approval_status = 'approved'
        )
      )
    )
  );

drop policy if exists "assessment_questions_select" on public.assessment_questions;
create policy "assessment_questions_select"
  on public.assessment_questions for select
  to authenticated
  using (
    public.is_admin()
    or public.is_approved_trainer()
    or exists (
      select 1
      from public.assessments a
      where a.id = assessment_questions.assessment_id
        and a.is_published = true
        and (
          a.course_id is null
          or a.assessment_type = 'Diagnostic Baseline'
          or exists (
            select 1
            from public.enrollments e
            join public.courses c on c.id = e.course_id
            where e.trainee_id = auth.uid()
              and e.course_id = a.course_id
              and e.status <> 'withdrawn'
              and c.is_published = true
              and c.approval_status = 'approved'
          )
        )
    )
  );

-- Feedback: trainees strictly read ONLY their own; trainers read feedback for courses they authored or deliver; admins read all
drop policy if exists "feedback_select" on public.feedback;
create policy "feedback_select"
  on public.feedback for select
  using (
    user_id = auth.uid()
    or public.is_admin()
    or (
      public.is_approved_trainer()
      and course_id is not null
      and (
        exists (
          select 1 from public.courses c
          where c.id = feedback.course_id and c.created_by = auth.uid()
        )
        or exists (
          select 1 from public.trainer_assignments ta
          where ta.course_id = feedback.course_id and ta.trainer_id = auth.uid()
        )
      )
    )
  );

-- Unique index preventing duplicate verified certificates for the same trainee and course
create unique index if not exists idx_certificates_unique_verified_trainee_course
  on public.certificates(trainee_id, course_id)
  where status = 'verified';

create index if not exists idx_courses_approval_published
  on public.courses(approval_status, is_published);

create index if not exists idx_learning_resources_course
  on public.learning_resources(course_id, created_at desc);

create index if not exists idx_feedback_course
  on public.feedback(course_id, created_at desc);
