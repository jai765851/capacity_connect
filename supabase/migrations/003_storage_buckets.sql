-- CAPACITY CONNECT (SIH26075)
-- Migration 003: Private Supabase Storage Buckets & Storage RLS Policies

-- Create private storage buckets (public = false ensures access only via signed URLs)
insert into storage.buckets (id, name, public, file_size_limit)
values ('learning-resources', 'learning-resources', false, 104857600)
on conflict (id) do update set public = false, file_size_limit = 104857600;

insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', false)
on conflict (id) do update set public = false;

-- Storage RLS for 'learning-resources' bucket (scoped by enrolled course_id folder or trainer ownership)
drop policy if exists "learning_resources_storage_read" on storage.objects;
create policy "learning_resources_storage_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'learning-resources'
    and (
      public.is_admin()
      or (
        public.is_approved_trainer()
        and (
          owner = auth.uid()
          or exists (
            select 1 from public.courses c
            where c.id::text = (storage.foldername(name))[1]
              and c.created_by = auth.uid()
          )
          or exists (
            select 1 from public.trainer_assignments ta
            where ta.course_id::text = (storage.foldername(name))[1]
              and ta.trainer_id = auth.uid()
          )
        )
      )
      or exists (
        select 1
        from public.enrollments e
        join public.courses c on c.id = e.course_id
        where e.trainee_id = auth.uid()
          and e.course_id::text = (storage.foldername(name))[1]
          and e.status <> 'withdrawn'
          and c.is_published = true
          and c.approval_status = 'approved'
      )
    )
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
        and (
          exists (
            select 1 from public.courses c
            where c.id::text = (storage.foldername(name))[1]
              and c.created_by = auth.uid()
          )
          or exists (
            select 1 from public.trainer_assignments ta
            where ta.course_id::text = (storage.foldername(name))[1]
              and ta.trainer_id = auth.uid()
          )
        )
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
      or (public.is_approved_trainer() and owner = auth.uid())
    )
  );

-- Storage RLS for 'certificates' bucket
drop policy if exists "certificates_storage_read" on storage.objects;
create policy "certificates_storage_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'certificates'
    and (
      public.is_admin()
      or public.is_approved_trainer()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

drop policy if exists "certificates_storage_manage" on storage.objects;
create policy "certificates_storage_manage"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'certificates'
    and (public.is_admin() or public.is_approved_trainer())
  );
