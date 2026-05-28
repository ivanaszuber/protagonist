-- Add archetype_insights JSONB column to user_profiles
-- Stores Haiku-generated WIRING + WATCH insight pills derived from enneagram/astro/neurodivergent

alter table public.user_profiles
  add column if not exists archetype_insights jsonb;
