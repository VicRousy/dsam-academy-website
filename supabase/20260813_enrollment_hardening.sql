-- Safe upgrade for an existing DSAM Supabase project.
-- Run this file once in Supabase SQL Editor. It does not delete enrolments,
-- students, courses, payments, or lessons.

alter table public.enrollments
  add column if not exists created_at timestamptz default now();

update public.enrollments
set created_at = now()
where created_at is null;

alter table public.enrollments
  alter column created_at set default now(),
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'enrollments_valid_status'
      and conrelid = 'public.enrollments'::regclass
  ) then
    alter table public.enrollments
      add constraint enrollments_valid_status
      check (status in ('pending', 'active', 'declined')) not valid;
  end if;
end;
$$;

create or replace function public.prevent_duplicate_enrollment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.enrollments
    where student_id = new.student_id
      and course_id = new.course_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'An application already exists for this student and programme.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_duplicate_enrollment on public.enrollments;
create trigger prevent_duplicate_enrollment
before insert on public.enrollments
for each row execute function public.prevent_duplicate_enrollment();

create index if not exists enrollments_student_created_at_index
on public.enrollments (student_id, created_at desc);

grant update on table public.enrollments to authenticated;

alter table public.enrollments enable row level security;

drop policy if exists "students create own enrolments" on public.enrollments;
create policy "students create own enrolments"
on public.enrollments
for insert
to authenticated
with check (auth.uid() = student_id and status = 'pending');

drop policy if exists "admins read all enrolments" on public.enrollments;
create policy "admins read all enrolments"
on public.enrollments
for select
to authenticated
using (public.is_staff());

drop policy if exists "admins update enrolments" on public.enrollments;
create policy "admins update enrolments"
on public.enrollments
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
