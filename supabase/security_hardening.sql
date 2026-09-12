alter policy "users read own profile"
on public.profiles to authenticated;

alter policy "admins read profiles"
on public.profiles to authenticated;

alter policy "users read own role"
on public.user_roles to authenticated;

alter policy "admins read all enrolments"
on public.enrollments to authenticated;

alter policy "admins update enrolments"
on public.enrollments to authenticated;

alter policy "students create own enrolments"
on public.enrollments to authenticated;

alter policy "students read own enrolments"
on public.enrollments to authenticated;

alter policy "students read own payments"
on public.payments to authenticated;

alter policy "students read own lessons"
on public.lesson_sessions to authenticated;

revoke all on table
  public.profiles,
  public.user_roles,
  public.enrollments,
  public.payments,
  public.lesson_sessions,
  public.staff_access_requests
from anon;

revoke all on table public.courses from anon;
grant select on table public.courses to anon;
