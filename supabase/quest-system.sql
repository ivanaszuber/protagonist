-- PRP-009: Quest system (main quests → milestones → daily tasks)
-- Run in Supabase SQL Editor. If an older dimension_xp table exists (dimension_id / total_xp),
-- see quest-system-migration.sql or use a fresh project schema.

-- ── Main Quests (one per dimension, the big vision) ──────────────────────────
CREATE TABLE IF NOT EXISTS main_quests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  dimension TEXT NOT NULL,
  character_name TEXT NOT NULL,
  character_class TEXT NOT NULL,
  vision TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, dimension)
);

ALTER TABLE main_quests DISABLE ROW LEVEL SECURITY;

-- ── Milestones (current chapter within a main quest) ─────────────────────────
CREATE TABLE IF NOT EXISTS milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quest_id UUID REFERENCES main_quests(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  target_date DATE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE milestones DISABLE ROW LEVEL SECURITY;

-- ── Daily Tasks (specific quests to complete) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  dimension TEXT NOT NULL,
  title TEXT NOT NULL,
  xp_reward INTEGER DEFAULT 50,
  task_date DATE DEFAULT CURRENT_DATE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS tasks_user_date ON tasks (user_id, task_date DESC);
CREATE INDEX IF NOT EXISTS tasks_user_dimension_date ON tasks (user_id, dimension, task_date);

-- ── XP Log (history of every XP earn event) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS xp_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  dimension TEXT NOT NULL,
  xp_amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  source_id UUID,
  earned_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE xp_log DISABLE ROW LEVEL SECURITY;

-- ── Dimension XP (quest system — career / social / wealth) ───────────────────
-- Separate from legacy dimension_xp (7 dimensions) if that table already exists.
CREATE TABLE IF NOT EXISTS quest_dimension_xp (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  dimension TEXT NOT NULL,
  xp INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, dimension)
);

ALTER TABLE quest_dimension_xp DISABLE ROW LEVEL SECURITY;
