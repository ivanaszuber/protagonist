-- PRP-011: Daily mood tracking

CREATE TABLE IF NOT EXISTS mood_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  mood_score INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 5),
  mood_label TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mood_entries DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS mood_entries_user_date
  ON mood_entries (user_id, created_at DESC);
