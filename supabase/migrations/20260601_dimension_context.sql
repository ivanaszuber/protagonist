-- Migration: dimension_context
-- Generic identity card data per dimension per user
-- Run in Supabase SQL Editor

create table if not exists dimension_context (
  user_id text not null,
  dimension_id text not null,
  data jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (user_id, dimension_id)
);
