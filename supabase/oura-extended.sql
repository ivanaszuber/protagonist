-- PRP-008b: Extended Oura biometrics (run in Supabase SQL Editor)

ALTER TABLE oura_daily
  ADD COLUMN IF NOT EXISTS cycle_day INTEGER,
  ADD COLUMN IF NOT EXISTS cycle_phase TEXT,
  ADD COLUMN IF NOT EXISTS deep_sleep_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS rem_sleep_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS light_sleep_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS respiratory_rate FLOAT,
  ADD COLUMN IF NOT EXISTS skin_temperature_deviation FLOAT;
