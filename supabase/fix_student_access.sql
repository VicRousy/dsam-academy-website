-- Run this once in Supabase SQL Editor. It gives signed-in students only the
-- minimum access needed to see courses and their own records.
grant usage on schema public to authenticated;
grant select on table public.courses to authenticated;
grant select, insert on table public.enrollments to authenticated;
grant select on table public.payments to authenticated;
grant select on table public.lesson_sessions to authenticated;

alter table public.courses enable row level security;
drop policy if exists "signed in users can view courses" on public.courses;
create policy "signed in users can view courses"
on public.courses for select to authenticated
using (true);
