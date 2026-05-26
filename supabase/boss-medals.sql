-- PRP-020: Boss battles, Hall of Kills, Medals, task boss linkage
-- Run in Supabase SQL Editor. Uses TEXT user_id to match quest-system tables.

CREATE TABLE IF NOT EXISTS boss_battles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  dimension TEXT NOT NULL,
  quest_id UUID REFERENCES main_quests(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  hp_total INTEGER NOT NULL,
  hp_remaining INTEGER NOT NULL,
  deadline DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  reward_xp INTEGER NOT NULL DEFAULT 300,
  slain_at TIMESTAMPTZ,
  escaped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS boss_battles_user_dimension_status
  ON boss_battles (user_id, dimension, status);

ALTER TABLE boss_battles DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS boss_kills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  dimension TEXT NOT NULL,
  boss_battle_id UUID REFERENCES boss_battles(id) ON DELETE SET NULL,
  boss_name TEXT NOT NULL,
  quest_name TEXT,
  outcome TEXT NOT NULL,
  hp_total INTEGER,
  tasks_completed INTEGER,
  days_taken INTEGER,
  xp_awarded INTEGER DEFAULT 0,
  killed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS boss_kills_user_dimension
  ON boss_kills (user_id, dimension, killed_at DESC);

ALTER TABLE boss_kills DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS medals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  dimension TEXT NOT NULL,
  medal_key TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, dimension, medal_key)
);

ALTER TABLE medals DISABLE ROW LEVEL SECURITY;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS boss_battle_id UUID REFERENCES boss_battles(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hp_damage INTEGER NOT NULL DEFAULT 1;
