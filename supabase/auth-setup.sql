-- ============================================================
-- PROTAGONIST — Auth Setup
-- Run this in your Supabase SQL Editor BEFORE enabling Google OAuth
-- ============================================================

-- ── 1. Profiles table (linked to Supabase auth.users) ────────────────────────
create table if not exists public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text,
  display_name text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: users can only see their own profile
alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);


-- ── 2. Allowed emails table (invite-only gate) ───────────────────────────────
create table if not exists public.allowed_emails (
  email       text        primary key,
  note        text,                       -- optional: who invited / why
  invited_at  timestamptz not null default now()
);

-- Only the service-role key can read this table (checked in /auth/callback)
alter table public.allowed_emails enable row level security;

-- No SELECT policy for anon/authenticated — only service role bypasses RLS
-- (The auth callback uses supabaseAdmin which has service_role key)


-- ── 3. Add Ivana (the only user right now) ───────────────────────────────────
insert into public.allowed_emails (email, note)
values ('ivanas.zuber@gmail.com', 'App creator')
on conflict (email) do nothing;


-- ── Done ─────────────────────────────────────────────────────────────────────
-- Next steps:
-- 1. Enable Google OAuth in Supabase Dashboard → Authentication → Providers
--    Set the redirect URL to: https://<your-domain>/auth/callback
-- 2. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local
-- 3. Add SUPABASE_SERVICE_ROLE_KEY to your .env.local (server-only, never exposed to browser)
-- 4. Deploy and visit /login
