-- Classroom operations upgrade. Run once after classroom_delivery.sql and student_services.sql.
-- Adds student-facing classroom notifications and staff-visible access audit events.

alter table public.student_notifications
  drop constraint if exists student_notifications_category_check;

alter table public.student_notifications
  add constraint student_notifications_category_check
  check (category in ('lesson', 'assignment', 'support', 'invoice', 'classroom'));

create table if not exists public.classroom_access_events (
  id uuid primary key default gen_random_uuid(),
  classroom_session_id uuid not null references public.classroom_sessions(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  accessed_at timestamptz not null default now()
);

create index if not exists classroom_access_events_session_accessed_index
  on public.classroom_access_events (classroom_session_id, accessed_at desc);

alter table public.classroom_access_events enable row level security;

grant select, insert on public.classroom_access_events to authenticated;

drop policy if exists "students log own published classroom access" on public.classroom_access_events;
create policy "students log own published classroom access"
on public.classroom_access_events
for insert
to authenticated
with check (
  auth.uid() = student_id
  and exists (
    select 1
    from public.classroom_sessions
    join public.enrollments on enrollments.course_id = classroom_sessions.course_id
    where classroom_sessions.id = classroom_access_events.classroom_session_id
      and classroom_sessions.is_published
      and enrollments.student_id = auth.uid()
      and enrollments.status = 'active'
  )
);

drop policy if exists "staff read classroom access events" on public.classroom_access_events;
create policy "staff read classroom access events"
on public.classroom_access_events
for select
to authenticated
using (public.is_staff());

create or replace function public.notify_students_of_classroom_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_published and (
    tg_op = 'INSERT'
    or not old.is_published
    or old.title is distinct from new.title
    or old.description is distinct from new.description
    or old.starts_at is distinct from new.starts_at
    or old.ends_at is distinct from new.ends_at
    or old.join_url is distinct from new.join_url
    or old.recording_url is distinct from new.recording_url
  ) then
    insert into public.student_notifications (student_id, title, message, category)
    select
      enrollments.student_id,
      case when new.delivery_type = 'live' then 'Classroom session available' else 'New tutorial recording available' end,
      case
        when new.delivery_type = 'live' then new.title || ' is scheduled for ' || to_char(new.starts_at, 'FMDay, FMMonth FMDD at HH12:MI AM TZ') || '.'
        else new.title || ' is now available in your Classroom.'
      end,
      'classroom'
    from public.enrollments
    where enrollments.course_id = new.course_id
      and enrollments.status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists classroom_session_student_notification on public.classroom_sessions;
create trigger classroom_session_student_notification
after insert or update of is_published, title, description, starts_at, ends_at, join_url, recording_url
on public.classroom_sessions
for each row execute function public.notify_students_of_classroom_session();
