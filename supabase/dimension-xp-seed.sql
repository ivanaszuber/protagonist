-- Optional: seed dimension XP for dashboard Character Stats (run in Supabase SQL Editor)
-- Replace YOUR_USER_ID with user_id from oura_tokens or google_tokens table.

-- Schema matches PRP-003 (dimension_id + total_xp), NOT the alternate dimension/xp columns.

INSERT INTO dimension_xp (user_id, dimension_id, total_xp) VALUES
  ('YOUR_USER_ID', 'vitality', 150),
  ('YOUR_USER_ID', 'mind', 75),
  ('YOUR_USER_ID', 'create', 200),
  ('YOUR_USER_ID', 'social', 50),
  ('YOUR_USER_ID', 'love', 100),
  ('YOUR_USER_ID', 'family', 125),
  ('YOUR_USER_ID', 'wealth', 50)
ON CONFLICT (user_id, dimension_id) DO NOTHING;
