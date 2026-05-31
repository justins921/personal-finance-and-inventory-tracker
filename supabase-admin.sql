-- ============================================================================
-- Admin read-only access for Financial Command Center
--
-- OPTIONAL add-on. Run this in your Supabase project (SQL Editor → New query →
-- paste → "Run") AFTER supabase-setup.sql. It lets accounts whose email you
-- add to `admin_emails` view (read-only) any other user's data.
--
-- Security model:
--   • Admin status is enforced in the DATABASE via Row Level Security, not in
--     the browser. A normal user — even with the public anon key — still can
--     only ever read their own row. Hiding the "Admin" menu in the UI is just
--     cosmetic; this policy is the real gate.
--   • Admins get SELECT (read) on everyone's data. They CANNOT write to another
--     user's row: no admin INSERT/UPDATE/DELETE policy exists, so the original
--     "owner only" write rules still apply.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. The admin allowlist. Add a row per admin email. Only the SQL editor /
--    service role can read or change this table (no RLS policies = no client
--    access), so users can't see or grant admin rights.
-- ----------------------------------------------------------------------------
create table if not exists public.admin_emails (
  email text primary key
);
alter table public.admin_emails enable row level security;

-- 👉 EDIT THIS: add yourself (and any other admins) here.
insert into public.admin_emails (email) values
  ('justin.sobojinski@gmail.com')
on conflict (email) do nothing;

-- ----------------------------------------------------------------------------
-- 2. is_admin(): true when the *currently signed-in* user's email is allowlisted.
--    SECURITY DEFINER lets it read admin_emails past that table's locked-down
--    RLS. Email comes from the verified JWT, so it can't be spoofed by clients.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1 from public.admin_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Small RPC wrapper the frontend calls to decide whether to show the Admin menu.
create or replace function public.am_i_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select public.is_admin();
$$;
grant execute on function public.am_i_admin() to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Let admins READ every user_data row (in addition to the existing
--    owner-only policy). No write policy is added, so admins remain read-only.
-- ----------------------------------------------------------------------------
drop policy if exists "Admins can read all data" on public.user_data;
create policy "Admins can read all data"
  on public.user_data for select
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. A directory so an admin can pick who to view. `auth.users` isn't readable
--    from the client, so we mirror (id, email) into a profiles table, keep it
--    fresh with a trigger, and backfill existing users. Each user can read
--    their own profile; admins can read all.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.is_admin());

-- Keep profiles in sync with auth.users on signup / email change.
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed up before this migration.
insert into public.profiles (id, email)
  select id, email from auth.users
  on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- To REVOKE admin from someone later:
--   delete from public.admin_emails where email = 'them@example.com';
-- ----------------------------------------------------------------------------
