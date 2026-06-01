-- Migration: dimension_pillars, relationship_context, top_of_mind, pattern_log, dimension_settings
-- Run in Supabase SQL Editor

-- ── Dimension Pillars ──────────────────────────────────────────────────────
-- Reusable non-negotiables / commitments / principles per dimension
create table if not exists dimension_pillars (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  dimension_id text not null,
  text text not null,
  emoji text default '⭐',
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists dimension_pillars_user_dim on dimension_pillars (user_id, dimension_id, sort_order);

-- ── Relationship Context ───────────────────────────────────────────────────
-- Structured info about the partner / relationship
create table if not exists relationship_context (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  partner_name text,
  partner_emoji text default '🧑‍🦱',
  together_since date,
  living_situation text,
  relationship_stage text default 'Established',
  oracle_notes text,  -- free-text Oracle carries about the partner
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Dimension Top of Mind ──────────────────────────────────────────────────
-- Intentions / focus items per dimension (checkable)
create table if not exists dimension_top_of_mind (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  dimension_id text not null,
  text text not null,
  completed boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists dim_top_of_mind_user_dim on dimension_top_of_mind (user_id, dimension_id, completed, sort_order);

-- ── Pattern Log ────────────────────────────────────────────────────────────
-- Moments / observations feed (win | shift | hard)
create table if not exists dimension_pattern_log (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  dimension_id text not null,
  type text not null check (type in ('win', 'shift', 'hard')),
  text text not null,
  created_at timestamptz default now()
);
create index if not exists dim_pattern_log_user_dim on dimension_pattern_log (user_id, dimension_id, created_at desc);

-- ── Dimension Settings ─────────────────────────────────────────────────────
-- Per-dimension UI toggle settings
create table if not exists dimension_settings (
  user_id text not null,
  dimension_id text not null,
  show_quests boolean default true,
  show_milestones boolean default true,
  show_tasks boolean default true,
  show_pillars boolean default true,
  show_top_of_mind boolean default true,
  show_pattern_log boolean default true,
  show_conversation_seeds boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, dimension_id)
);

-- ── Conversation Seeds Cache ───────────────────────────────────────────────
-- Oracle-generated questions, cached per dimension
create table if not exists dimension_conversation_seeds (
  user_id text not null,
  dimension_id text not null,
  seeds jsonb not null default '[]',
  generated_at timestamptz default now(),
  primary key (user_id, dimension_id)
);
