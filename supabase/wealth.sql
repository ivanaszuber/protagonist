-- PRP-008d: Vault / net worth tracking (run in Supabase SQL Editor)

CREATE TABLE IF NOT EXISTS net_worth_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount FLOAT NOT NULL,
  note TEXT,
  entry_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS impulse_resists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  amount FLOAT NOT NULL,
  entry_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE net_worth_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE impulse_resists DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS net_worth_entries_user_date
  ON net_worth_entries (user_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS impulse_resists_user_date
  ON impulse_resists (user_id, entry_date DESC);
