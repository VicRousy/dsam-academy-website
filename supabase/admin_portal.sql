-- First, the owner must create/sign in to their DSAM'S account once.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz default now()
);
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin'))
);
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.enrollments add column if not exists created_at timestamptz default now();

insert into public.profiles (id, email, full_name)
select id, email, coalesce(raw_user_meta_data->>'full_name', '') from auth.users
on conflict (id) do update set email = excluded.email, full_name = excluded.full_name;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do update set email = excluded.email, full_name = excluded.full_name;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to authenticated;
grant select on public.profiles, public.user_roles to authenticated;

drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "admins read profiles" on public.profiles;
create policy "users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "admins read profiles" on public.profiles for select using (public.is_admin());
drop policy if exists "users read own role" on public.user_roles;
create policy "users read own role" on public.user_roles for select using (auth.uid() = user_id);
drop policy if exists "admins read all enrolments" on public.enrollments;
drop policy if exists "admins update enrolments" on public.enrollments;
create policy "admins read all enrolments" on public.enrollments for select using (public.is_admin());
create policy "admins update enrolments" on public.enrollments for update using (public.is_admin()) with check (public.is_admin());

insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where lower(email) = 'dsamacademyofmusic@gmail.com'
on conflict (user_id) do update set role = excluded.role;
