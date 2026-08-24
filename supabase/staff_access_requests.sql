-- Personal staff Gmail approval workflow.
-- Run this AFTER admin_portal.sql in the Supabase SQL Editor.
-- It is additive: it does not delete students, enrolments, or existing roles.

create table if not exists public.staff_access_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id)
);

alter table public.staff_access_requests enable row level security;
grant select, insert, update on public.staff_access_requests to authenticated;

drop policy if exists "users request own staff access" on public.staff_access_requests;
create policy "users request own staff access"
on public.staff_access_requests
for insert
to authenticated
with check (
  auth.uid() = user_id
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and status = 'pending'
  and not public.is_staff()
);

drop policy if exists "users read own staff request" on public.staff_access_requests;
create policy "users read own staff request"
on public.staff_access_requests
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "admins read staff requests" on public.staff_access_requests;
create policy "admins read staff requests"
on public.staff_access_requests
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins grant staff role" on public.user_roles;
create policy "admins grant staff role"
on public.user_roles
for insert
to authenticated
with check (public.is_admin() and role = 'staff');

create or replace function public.decide_staff_access(
  request_id bigint,
  decision text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only the DSAM owner administrator can decide staff access.';
  end if;

  if decision not in ('approved', 'denied') then
    raise exception 'Invalid staff-access decision.';
  end if;

  select user_id into requested_user_id
  from public.staff_access_requests
  where id = request_id and status = 'pending'
  for update;

  if requested_user_id is null then
    raise exception 'This staff-access request is no longer pending.';
  end if;

  if decision = 'approved' then
    insert into public.user_roles (user_id, role)
    values (requested_user_id, 'staff')
    on conflict (user_id) do update
      set role = excluded.role
      where public.user_roles.role = 'staff';
  end if;

  update public.staff_access_requests
  set status = decision,
      decided_at = now(),
      decided_by = auth.uid()
  where id = request_id;
end;
$$;

grant execute on function public.decide_staff_access(bigint, text) to authenticated;
