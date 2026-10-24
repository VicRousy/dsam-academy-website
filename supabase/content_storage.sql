-- Private material uploads. Run once after learning_workspace.sql.
-- Staff upload course material directly; only active students in that course can retrieve it.

alter table public.learning_materials
  add column if not exists storage_path text;

create unique index if not exists learning_materials_storage_path_key
  on public.learning_materials (storage_path)
  where storage_path is not null;

insert into storage.buckets (id, name, public, file_size_limit)
values ('academy-materials', 'academy-materials', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = 52428800;

grant select, insert, update, delete on storage.objects to authenticated;

drop policy if exists "staff manage academy material files" on storage.objects;
create policy "staff manage academy material files"
on storage.objects
for all
to authenticated
using (bucket_id = 'academy-materials' and public.is_staff())
with check (bucket_id = 'academy-materials' and public.is_staff());

drop policy if exists "students read active programme material files" on storage.objects;
create policy "students read active programme material files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'academy-materials'
  and exists (
    select 1
    from public.learning_materials
    join public.enrollments on enrollments.course_id = learning_materials.course_id
    where learning_materials.storage_path = storage.objects.name
      and learning_materials.is_published
      and enrollments.student_id = auth.uid()
      and enrollments.status = 'active'
  )
);
