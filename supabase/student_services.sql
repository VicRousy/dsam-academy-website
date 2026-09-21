-- Student services upgrade. Run once after learning_workspace.sql.
-- Adds controlled lesson-change requests, assignment submissions, support tickets, notifications, and invoices.

create table if not exists public.lesson_change_requests (
  id uuid primary key default gen_random_uuid(),
  lesson_session_id uuid not null references public.lesson_sessions(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('reschedule', 'cancel')),
  requested_starts_at timestamptz,
  reason text not null check (char_length(reason) between 5 and 1500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  staff_response text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((request_type = 'reschedule' and requested_starts_at is not null) or request_type = 'cancel')
);

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.learning_materials(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  submission_text text check (char_length(submission_text) <= 5000),
  resource_url text,
  status text not null default 'submitted' check (status in ('submitted', 'reviewed', 'returned')),
  tutor_feedback text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (submission_text is not null or resource_url is not null)
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'general' check (category in ('general', 'lesson', 'payment', 'technical')),
  subject text not null check (char_length(subject) between 3 and 180),
  message text not null check (char_length(message) between 5 and 4000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  staff_response text,
  responded_at timestamptz,
  responded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid references public.enrollments(id) on delete set null,
  invoice_number text not null unique,
  amount_ngn numeric(12, 2) not null check (amount_ngn >= 0),
  due_at timestamptz,
  status text not null default 'issued' check (status in ('draft', 'issued', 'paid', 'void', 'overdue')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.student_notifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  category text not null check (category in ('lesson', 'assignment', 'support', 'invoice')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists lesson_change_requests_student_created_index on public.lesson_change_requests (student_id, created_at desc);
create index if not exists assignment_submissions_student_submitted_index on public.assignment_submissions (student_id, submitted_at desc);
create index if not exists support_tickets_student_created_index on public.support_tickets (student_id, created_at desc);
create index if not exists invoices_student_created_index on public.invoices (student_id, created_at desc);
create index if not exists student_notifications_student_created_index on public.student_notifications (student_id, created_at desc);

alter table public.lesson_change_requests enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.support_tickets enable row level security;
alter table public.invoices enable row level security;
alter table public.student_notifications enable row level security;

grant select, insert on public.lesson_change_requests, public.assignment_submissions, public.support_tickets to authenticated;
grant select on public.invoices to authenticated;
grant select on public.student_notifications to authenticated;
revoke update on public.student_notifications from authenticated;
grant update (is_read) on public.student_notifications to authenticated;
grant select, insert, update, delete on public.lesson_change_requests, public.assignment_submissions, public.support_tickets, public.invoices to authenticated;

drop policy if exists "students read own lesson change requests" on public.lesson_change_requests;
create policy "students read own lesson change requests" on public.lesson_change_requests for select to authenticated using (auth.uid() = student_id);
drop policy if exists "students request changes to own future lessons" on public.lesson_change_requests;
create policy "students request changes to own future lessons" on public.lesson_change_requests for insert to authenticated with check (
  auth.uid() = student_id
  and status = 'pending'
  and exists (select 1 from public.lesson_sessions where id = lesson_session_id and student_id = auth.uid() and starts_at > now())
);
drop policy if exists "staff manage lesson change requests" on public.lesson_change_requests;
create policy "staff manage lesson change requests" on public.lesson_change_requests for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "students read own assignment submissions" on public.assignment_submissions;
create policy "students read own assignment submissions" on public.assignment_submissions for select to authenticated using (auth.uid() = student_id);
drop policy if exists "students submit active programme assignments" on public.assignment_submissions;
create policy "students submit active programme assignments" on public.assignment_submissions for insert to authenticated with check (
  auth.uid() = student_id and status = 'submitted'
  and exists (select 1 from public.learning_materials m join public.enrollments e on e.course_id = m.course_id where m.id = material_id and m.material_type = 'assignment' and m.is_published and e.student_id = auth.uid() and e.status = 'active')
);
drop policy if exists "staff manage assignment submissions" on public.assignment_submissions;
create policy "staff manage assignment submissions" on public.assignment_submissions for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "students read own support tickets" on public.support_tickets;
create policy "students read own support tickets" on public.support_tickets for select to authenticated using (auth.uid() = student_id);
drop policy if exists "students create own support tickets" on public.support_tickets;
create policy "students create own support tickets" on public.support_tickets for insert to authenticated with check (auth.uid() = student_id and status = 'open');
drop policy if exists "staff manage support tickets" on public.support_tickets;
create policy "staff manage support tickets" on public.support_tickets for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "students read own invoices" on public.invoices;
create policy "students read own invoices" on public.invoices for select to authenticated using (auth.uid() = student_id);
drop policy if exists "admins manage invoices" on public.invoices;
create policy "admins manage invoices" on public.invoices for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "students read own notifications" on public.student_notifications;
create policy "students read own notifications" on public.student_notifications for select to authenticated using (auth.uid() = student_id);
drop policy if exists "students mark own notifications read" on public.student_notifications;
create policy "students mark own notifications read" on public.student_notifications for update to authenticated using (auth.uid() = student_id) with check (auth.uid() = student_id);

create or replace function public.decide_lesson_change_request(
  request_id uuid,
  decision text,
  response_text text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_change public.lesson_change_requests%rowtype;
begin
  if not public.is_staff() then
    raise exception 'Only approved academy staff can review lesson-change requests';
  end if;

  if decision not in ('approved', 'declined') then
    raise exception 'Decision must be approved or declined';
  end if;

  select * into requested_change
  from public.lesson_change_requests
  where id = request_id and status = 'pending'
  for update;

  if not found then
    raise exception 'This lesson-change request is no longer pending';
  end if;

  update public.lesson_change_requests
  set status = decision,
      staff_response = nullif(trim(response_text), ''),
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  where id = requested_change.id;

  if decision = 'approved' and requested_change.request_type = 'reschedule' then
    update public.lesson_sessions
    set starts_at = requested_change.requested_starts_at,
        status = 'scheduled',
        attendance_status = 'scheduled',
        updated_at = now()
    where id = requested_change.lesson_session_id;
  elsif decision = 'approved' and requested_change.request_type = 'cancel' then
    update public.lesson_sessions
    set status = 'cancelled',
        attendance_status = 'cancelled',
        updated_at = now()
    where id = requested_change.lesson_session_id;
  end if;

  insert into public.student_notifications (student_id, title, message, category)
  values (
    requested_change.student_id,
    case when decision = 'approved' then 'Lesson request approved' else 'Lesson request declined' end,
    coalesce(nullif(trim(response_text), ''), case when decision = 'approved' then 'Your lesson request has been applied to your schedule.' else 'Your lesson schedule remains unchanged.' end),
    'lesson'
  );
end;
$$;

grant execute on function public.decide_lesson_change_request(uuid, text, text) to authenticated;

create or replace function public.notify_student_service_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'assignment_submissions' and new.status in ('reviewed', 'returned') and (old.status is distinct from new.status or old.tutor_feedback is distinct from new.tutor_feedback) then
    insert into public.student_notifications (student_id, title, message, category)
    values (new.student_id, 'Assignment reviewed', coalesce(nullif(new.tutor_feedback, ''), 'Your assignment has been reviewed.'), 'assignment');
  elsif tg_table_name = 'support_tickets' and (old.status is distinct from new.status or old.staff_response is distinct from new.staff_response) then
    insert into public.student_notifications (student_id, title, message, category)
    values (new.student_id, 'Support request updated', coalesce(nullif(new.staff_response, ''), 'Your support request status is now ' || replace(new.status, '_', ' ') || '.'), 'support');
  end if;
  return new;
end;
$$;

drop trigger if exists assignment_submission_notification on public.assignment_submissions;
create trigger assignment_submission_notification after update on public.assignment_submissions for each row execute function public.notify_student_service_update();
drop trigger if exists support_ticket_notification on public.support_tickets;
create trigger support_ticket_notification after update on public.support_tickets for each row execute function public.notify_student_service_update();

create or replace function public.notify_student_invoice_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('issued', 'overdue') then
    insert into public.student_notifications (student_id, title, message, category)
    values (new.student_id, 'New academy invoice', 'Invoice ' || new.invoice_number || ' for ₦' || to_char(new.amount_ngn, 'FM999G999G999D00') || ' is available in your portal.', 'invoice');
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_notification on public.invoices;
create trigger invoice_notification after insert on public.invoices for each row execute function public.notify_student_invoice_created();
