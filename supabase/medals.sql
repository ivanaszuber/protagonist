-- Migration: create medals table
-- Run this in your Supabase SQL editor

create table if not exists medals (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  dimension   text not null,
  medal_key   text not null,
  awarded_at  timestamptz not null default now(),
  -- Each medal can only be earned once per user per dimension
  unique (user_id, dimension, medal_key)
);

-- Index for fast lookups by user + dimension
create index if not exists idx_medals_user_dimension
  on medals (user_id, dimension);

-- Row-level security
alter table medals enable row level security;

create policy "Users can read their own medals"
  on medals for select
  using (user_id = auth.uid()::text);

create policy "Service role can manage medals"
  on medals for all
  using (true);
