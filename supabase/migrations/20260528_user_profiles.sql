-- User profiles table — stores personal facts and personality archetypes
-- Run once against your Supabase project

create table if not exists public.user_profiles (
  user_id   text primary key,
  -- Personal facts
  display_name        text,
  location            text,
  age                 integer,
  family_info         text,   -- e.g. "Mum of Zara"
  financial_status    text,   -- e.g. "Financially independent"
  relationship_status text,   -- e.g. "Divorced"
  -- Personality archetypes
  enneagram           text,   -- e.g. "3w4"
  sun_sign            text,   -- e.g. "Aries"
  rising_sign         text,   -- e.g. "Cancer"
  neurodivergent_notes text,  -- e.g. "AuDHD Spectrum"
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: users can only read/write their own profile
alter table public.user_profiles enable row level security;

create policy "users manage own profile"
  on public.user_profiles
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);
