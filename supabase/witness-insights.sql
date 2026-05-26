-- Migration: create witness_insights table
-- Run this in your Supabase SQL editor

create table if not exists witness_insights (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  insight     text not null,
  dimension_id text null,
  memory_count integer not null default 0,
  generated_at timestamptz not null default now()
);

-- Index so the API can quickly find the latest insight for a user
create index if not exists idx_witness_insights_user_generated
  on witness_insights (user_id, generated_at desc);

-- Optional: enable row-level security (mirror your other tables)
alter table witness_insights enable row level security;

create policy "Users can read their own witness insights"
  on witness_insights for select
  using (user_id = auth.uid()::text);

create policy "Service role can manage witness insights"
  on witness_insights for all
  using (true);
