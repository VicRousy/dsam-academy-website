-- Student portal upgrade. Run once after admin_portal.sql and admin_operations.sql.
-- This does not delete or expose existing student records.

grant update on public.profiles to authenticated;

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
