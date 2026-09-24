-- Classroom delivery upgrade. Run once after learning_workspace.sql.
-- Staff publish provider-hosted live classes and recordings; active students see only their own programme's content.

create table if not exists public.classroom_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 180),
  description text check (char_length(description) <= 2000),
  delivery_type text not null check (delivery_type in ('live', 'recording')),
  provider text not null default 'other' check (provider in ('zoom', 'google_meet', 'microsoft_teams', 'youtube', 'vimeo', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  join_url text,
  recording_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (ends_at is null or ends_at > starts_at),
  check (join_url is null or join_url ~* '^https://'),
  check (recording_url is null or recording_url ~* '^https://'),
  check ((delivery_type = 'live' and join_url is not null) or (delivery_type = 'recording' and recording_url is not null))
);

create index if not exists classroom_sessions_course_schedule_index on public.classroom_sessions (course_id, is_published, starts_at desc);

alter table public.classroom_sessions enable row level security;

grant select, insert, update, delete on public.classroom_sessions to authenticated;

drop policy if exists "students read published programme classroom sessions" on public.classroom_sessions;
create policy "students read published programme classroom sessions"
on public.classroom_sessions
for select
to authenticated
using (
  is_published
  and exists (
    select 1
    from public.enrollments
    where enrollments.student_id = auth.uid()
      and enrollments.course_id = classroom_sessions.course_id
      and enrollments.status = 'active'
  )
);

drop policy if exists "staff manage classroom sessions" on public.classroom_sessions;
create policy "staff manage classroom sessions"
on public.classroom_sessions
for all
to authenticated
using (public.is_staff())
with check (public.is_staff());
