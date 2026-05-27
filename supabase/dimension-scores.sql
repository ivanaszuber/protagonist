-- dimension_scores: user-reported baseline score (1–10) per life category
-- The displayed score on the dashboard blends this with the XP-derived score.

create table if not exists dimension_scores (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  dimension    text not null,
  baseline     integer not null check (baseline between 1 and 10),
  updated_at   timestamptz not null default now(),
  unique (user_id, dimension)
);

-- Index for fast per-user lookups
create index if not exists idx_dimension_scores_user
  on dimension_scores (user_id);

-- Row-level security (same pattern as other tables in this project)
alter table dimension_scores enable row level security;

create policy "Users can manage their own scores"
  on dimension_scores
  for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);
