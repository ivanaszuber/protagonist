-- Run in Supabase SQL Editor (PRP-003)

create extension if not exists "pgcrypto";

create table if not exists check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  date date not null default current_date,
  transcript text,
  energy_level integer check (energy_level between 1 and 10),
  mood text,
  social_battery integer check (social_battery between 1 and 10),
  main_concern text,
  main_desire text,
  arc_response text,
  created_at timestamptz default now()
);

create table if not exists quests (
  id text primary key,
  user_id text not null,
  date date not null default current_date,
  dimension_id text not null,
  title text not null,
  description text,
  xp_reward integer default 100,
  energy_required integer default 5,
  champion_name text,
  status text default 'pending' check (status in ('pending', 'completed', 'skipped')),
  proof_transcript text,
  xp_awarded integer,
  arc_proof_response text,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists dimension_xp (
  user_id text not null,
  dimension_id text not null,
  total_xp integer default 0,
  primary key (user_id, dimension_id)
);

create table if not exists dimension_memories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  dimension_id text not null,
  content text not null,
  source text default 'checkin',
  importance integer default 5 check (importance between 1 and 10),
  created_at timestamptz default now()
);

create index if not exists check_ins_user_date on check_ins (user_id, date desc);
create index if not exists quests_user_date on quests (user_id, date desc);
create index if not exists dimension_memories_user_dim on dimension_memories (user_id, dimension_id, importance desc);

-- XP increment helper (run after tables)
create or replace function increment_xp(
  p_user_id text,
  p_dimension_id text,
  p_amount integer
) returns void as $$
begin
  insert into dimension_xp (user_id, dimension_id, total_xp)
  values (p_user_id, p_dimension_id, p_amount)
  on conflict (user_id, dimension_id)
  do update set total_xp = dimension_xp.total_xp + p_amount;
end;
$$ language plpgsql;
