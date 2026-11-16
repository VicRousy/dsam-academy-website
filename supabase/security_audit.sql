-- Read-only production security audit for the DSAM portal.
-- Run this in Supabase SQL Editor. It does not modify data or policies.

-- 1. Confirm RLS is enabled on every portal table.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'profiles',
    'user_roles',
    'courses',
    'enrollments',
    'payments',
    'lesson_sessions',
    'staff_access_requests'
  )
order by c.relname;

-- 2. Review every policy on portal tables.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'user_roles',
    'courses',
    'enrollments',
    'payments',
    'lesson_sessions',
    'staff_access_requests'
  )
order by tablename, policyname;

-- 3. Check whether anonymous users have any table privileges.
select
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where grantee = 'anon'
  and table_schema = 'public'
order by table_name, privilege_type;

-- 4. Confirm the owner account and assigned role.
select
  u.email,
  r.role
from auth.users u
left join public.user_roles r on r.user_id = u.id
where lower(u.email) = 'dsamacademyofmusic@gmail.com';

-- 5. Review security-definer functions used by access control.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig as configuration
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'is_admin',
    'is_staff',
    'decide_staff_access',
    'handle_new_user'
  )
order by p.proname;
