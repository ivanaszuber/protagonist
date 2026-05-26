-- PRP-027: Vault net worth settings (run in Supabase SQL Editor)

CREATE TABLE IF NOT EXISTS vault_settings (
  user_id TEXT PRIMARY KEY,
  invested NUMERIC NOT NULL DEFAULT 0,
  cash NUMERIC NOT NULL DEFAULT 0,
  monthly_income NUMERIC NOT NULL DEFAULT 0,
  monthly_savings_target NUMERIC NOT NULL DEFAULT 0,
  fire_number NUMERIC NOT NULL DEFAULT 1500000,
  fire_target_year INTEGER NOT NULL DEFAULT 2030,
  fire_annual_spend NUMERIC NOT NULL DEFAULT 60000,
  nw_goal NUMERIC NOT NULL DEFAULT 200000,
  nw_goal_deadline DATE,
  coin_denomination NUMERIC NOT NULL DEFAULT 10000,
  shadow_interest_rate NUMERIC NOT NULL DEFAULT 7,
  expected_return_rate NUMERIC NOT NULL DEFAULT 7,
  isa_allowance_used NUMERIC NOT NULL DEFAULT 0,
  budget_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  shadow_gap NUMERIC NOT NULL DEFAULT 0,
  shadow_gap_updated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vault_settings DISABLE ROW LEVEL SECURITY;
