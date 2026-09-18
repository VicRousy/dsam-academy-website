-- Learning workspace upgrade. Run once after admin_operations.sql.
-- Adds academic materials, progress feedback, attendance, and announcements without deleting existing data.

alter table public.lesson_sessions
  add column if not exists attendance_status text not null default 'scheduled'
  check (attendance_status in ('scheduled', 'attended', 'missed', 'cancelled'));

create table if not exists public.learning_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  material_type text not null default 'resource' check (material_type in ('resource', 'assignment', 'sheet_music', 'video', 'recording')),
  resource_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.student_progress_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  feedback text,
  practice_goal text,
  progress_level text not null default 'developing' check (progress_level in ('beginner', 'developing', 'proficient', 'mastering')),
  recorded_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.academy_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'students' check (audience in ('students', 'active_students')),
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists learning_materials_course_published_index on public.learning_materials (course_id, is_published, created_at desc);
create index if not exists student_progress_entries_student_recorded_index on public.student_progress_entries (student_id, recorded_at desc);
create index if not exists academy_announcements_published_index on public.academy_announcements (is_published, published_at desc);

alter table public.learning_materials enable row level security;
alter table public.student_progress_entries enable row level security;
alter table public.academy_announcements enable row level security;

grant select on public.learning_materials, public.student_progress_entries, public.academy_announcements to authenticated;
grant insert, update, delete on public.learning_materials, public.student_progress_entries, public.academy_announcements to authenticated;
grant update on public.lesson_sessions to authenticated;

drop policy if exists "students read published course materials" on public.learning_materials;
create policy "students read published course materials"
on public.learning_materials
for select
to authenticated
using (
  is_published
  and exists (
    select 1
    from public.enrollments
    where enrollments.student_id = auth.uid()
      and enrollments.course_id = learning_materials.course_id
      and enrollments.status = 'active'
  )
);

drop policy if exists "staff manage learning materials" on public.learning_materials;
create policy "staff manage learning materials"
on public.learning_materials
for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "students read own progress entries" on public.student_progress_entries;
create policy "students read own progress entries"
on public.student_progress_entries
for select
to authenticated
using (auth.uid() = student_id);

drop policy if exists "staff manage student progress entries" on public.student_progress_entries;
create policy "staff manage student progress entries"
on public.student_progress_entries
for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "students read published announcements" on public.academy_announcements;
create policy "students read published announcements"
on public.academy_announcements
for select
to authenticated
using (
  is_published
  and (
    audience = 'students'
    or (
      audience = 'active_students'
      and exists (
        select 1
        from public.enrollments
        where enrollments.student_id = auth.uid()
          and enrollments.status = 'active'
      )
    )
  )
);

drop policy if exists "admins manage academy announcements" on public.academy_announcements;
create policy "admins manage academy announcements"
on public.academy_announcements
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "staff update lesson attendance" on public.lesson_sessions;
create policy "staff update lesson attendance"
on public.lesson_sessions
for update
to authenticated
using (public.is_staff())
with check (public.is_staff());
