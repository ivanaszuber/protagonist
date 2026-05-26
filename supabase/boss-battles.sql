-- PRP-020: Boss Battles + Hall of Kills
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS boss_battles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  dimension       TEXT NOT NULL,
  quest_id        UUID REFERENCES main_quests(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  hp_total        INTEGER NOT NULL DEFAULT 10,
  hp_remaining    INTEGER NOT NULL DEFAULT 10,
  deadline        DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','slain','escaped')),
  reward_xp       INTEGER NOT NULL DEFAULT 300,
  slain_at        TIMESTAMPTZ,
  escaped_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS boss_battles_user_dim ON boss_battles (user_id, dimension);

CREATE TABLE IF NOT EXISTS boss_kills (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL,
  dimension        TEXT NOT NULL,
  boss_battle_id   UUID REFERENCES boss_battles(id) ON DELETE SET NULL,
  boss_name        TEXT NOT NULL,
  quest_name       TEXT,
  outcome          TEXT NOT NULL CHECK (outcome IN ('slain','escaped')),
  hp_total         INTEGER,
  tasks_completed  INTEGER,
  days_taken       INTEGER,
  xp_awarded       INTEGER NOT NULL DEFAULT 0,
  killed_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS boss_kills_user_dim ON boss_kills (user_id, dimension);

-- Add boss columns to tasks table (safe — no-ops if already present)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS hp_damage        INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS boss_battle_id   UUID REFERENCES boss_battles(id) ON DELETE SET NULL;
