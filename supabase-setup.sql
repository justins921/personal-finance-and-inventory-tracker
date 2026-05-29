-- ============================================================================
-- Supabase setup for Financial Command Center
--
-- Run this once in your Supabase project: SQL Editor → New query → paste →
-- "Run". It creates the per-user data table and locks it down with Row Level
-- Security so each account can only ever read or write its OWN row.
-- ============================================================================

-- One row per user. The whole app state is stored as a single JSON document.
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security (RLS). With this on, the public "anon" key shipped
-- in the browser CANNOT read or write anyone's data without a valid login, and
-- even then only the signed-in user's own row.
alter table public.user_data enable row level security;

-- Re-runnable: drop existing policies before recreating.
drop policy if exists "Users can read their own data"   on public.user_data;
drop policy if exists "Users can insert their own data"  on public.user_data;
drop policy if exists "Users can update their own data"  on public.user_data;
drop policy if exists "Users can delete their own data"  on public.user_data;

create policy "Users can read their own data"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "Users can insert their own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own data"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own data"
  on public.user_data for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- After running this:
--   1. Project Settings → API → copy "Project URL" and the "anon / public" key.
--   2. Paste them into js/config.js (SUPABASE_URL and SUPABASE_ANON_KEY).
--   3. (Optional, for instant logins without email confirmation)
--      Authentication → Providers → Email → turn OFF "Confirm email".
--      Leave it ON if you prefer verified email addresses.
--   4. (Recommended) Authentication → URL Configuration → add your site URL
--      (e.g. your GitHub Pages URL) to the allowed redirect/site URLs.
-- ----------------------------------------------------------------------------
