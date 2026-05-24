-- PRP-005: Oura tables (run in Supabase SQL Editor)

CREATE TABLE IF NOT EXISTS oura_tokens (
  user_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oura_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  sleep_score INTEGER,
  sleep_total_seconds INTEGER,
  sleep_rem_seconds INTEGER,
  sleep_deep_seconds INTEGER,
  sleep_efficiency INTEGER,
  sleep_latency_seconds INTEGER,
  readiness_score INTEGER,
  hrv_balance INTEGER,
  recovery_index INTEGER,
  body_temperature_deviation FLOAT,
  activity_score INTEGER,
  steps INTEGER,
  active_calories INTEGER,
  resilience_level TEXT,
  hrv_average FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS oura_daily_user_date ON oura_daily(user_id, date DESC);

ALTER TABLE oura_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE oura_daily ENABLE ROW LEVEL SECURITY;

-- v0: permissive policies (tighten when Supabase Auth ships)
CREATE POLICY "v0 oura_tokens all" ON oura_tokens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "v0 oura_daily all" ON oura_daily FOR ALL USING (true) WITH CHECK (true);
