-- PRP-007: Gmail digest cache (run in Supabase SQL Editor)

CREATE TABLE IF NOT EXISTS gmail_digest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  unread_count INTEGER DEFAULT 0,
  needs_reply_count INTEGER DEFAULT 0,
  action_items JSONB,
  arc_summary TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS gmail_digest_user_date ON gmail_digest(user_id, date DESC);

ALTER TABLE gmail_digest DISABLE ROW LEVEL SECURITY;
