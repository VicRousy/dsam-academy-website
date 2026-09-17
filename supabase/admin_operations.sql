alter table public.profiles
  add column if not exists phone text,
  add column if not exists instrument text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.student_admin_notes (
  student_id uuid primary key references auth.users(id) on delete cascade,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.courses
  add column if not exists description text,
  add column if not exists duration_weeks integer,
  add column if not exists tuition_ngn numeric(12, 2),
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table public.enrollments
  add column if not exists admin_notes text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.lesson_sessions
  add column if not exists course_id uuid references public.courses(id) on delete set null,
  add column if not exists title text,
  add column if not exists status text not null default 'scheduled',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.payments
  add column if not exists enrollment_id uuid references public.enrollments(id) on delete set null,
  add column if not exists reference text,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists courses_active_index on public.courses (is_active, title);
create index if not exists lesson_sessions_student_start_index on public.lesson_sessions (student_id, starts_at);
create index if not exists payments_student_created_index on public.payments (student_id, created_at desc);
create index if not exists enrollments_status_created_index on public.enrollments (status, created_at desc);

alter table public.courses enable row level security;
alter table public.lesson_sessions enable row level security;
alter table public.payments enable row level security;
alter table public.student_admin_notes enable row level security;

grant insert, update, delete on public.courses to authenticated;
grant insert, update, delete on public.lesson_sessions to authenticated;
grant insert, update, delete on public.payments to authenticated;
grant update on public.profiles, public.enrollments to authenticated;
grant select, insert, update on public.student_admin_notes to authenticated;

drop policy if exists "admins manage courses" on public.courses;
create policy "admins manage courses"
on public.courses
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "staff manage lesson sessions" on public.lesson_sessions;
create policy "staff manage lesson sessions"
on public.lesson_sessions
for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "admins manage payments" on public.payments;
create policy "admins manage payments"
on public.payments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins update profiles" on public.profiles;
create policy "admins update profiles"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins manage student notes" on public.student_admin_notes;
create policy "admins manage student notes"
on public.student_admin_notes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
