-- PRP-006: Google Calendar (run in Supabase SQL Editor)

CREATE TABLE IF NOT EXISTS google_tokens (
  user_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  google_event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT FALSE,
  location TEXT,
  description TEXT,
  calendar_name TEXT,
  event_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, google_event_id)
);

CREATE INDEX IF NOT EXISTS calendar_events_user_date ON calendar_events(user_id, event_date);

ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v0 google_tokens all" ON google_tokens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "v0 calendar_events all" ON calendar_events FOR ALL USING (true) WITH CHECK (true);
