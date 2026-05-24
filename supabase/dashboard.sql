-- PRP-008: Daily Arc briefings (run in Supabase SQL Editor)

CREATE TABLE IF NOT EXISTS daily_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  briefing TEXT NOT NULL,
  data_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE daily_briefings DISABLE ROW LEVEL SECURITY;
