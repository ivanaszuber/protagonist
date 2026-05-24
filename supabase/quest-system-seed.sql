-- PRP-009 seed — replace YOUR_USER_ID (from oura_tokens.user_id)

INSERT INTO main_quests (user_id, dimension, character_name, character_class, vision) VALUES
  ('YOUR_USER_ID', 'career', 'Forge', 'Maker Class', 'CPTO · Board Advisor · Industry Voice in London'),
  ('YOUR_USER_ID', 'social', 'Echo', 'Bard Class', 'Build my London tribe — real friendships, real community'),
  ('YOUR_USER_ID', 'wealth', 'Vault', 'Strategist Class', 'Financial freedom — FIRE by 2030')
ON CONFLICT (user_id, dimension) DO NOTHING;

INSERT INTO milestones (quest_id, user_id, title, target_date, sort_order)
SELECT id, 'YOUR_USER_ID', 'Land a CPTO/CPO role', CURRENT_DATE + INTERVAL '60 days', 1
FROM main_quests WHERE user_id = 'YOUR_USER_ID' AND dimension = 'career';

INSERT INTO milestones (quest_id, user_id, title, target_date, sort_order)
SELECT id, 'YOUR_USER_ID', 'Make 3 genuine connections in London', CURRENT_DATE + INTERVAL '90 days', 1
FROM main_quests WHERE user_id = 'YOUR_USER_ID' AND dimension = 'social';

INSERT INTO milestones (quest_id, user_id, title, target_date, sort_order)
SELECT id, 'YOUR_USER_ID', 'Reach €60k net worth', CURRENT_DATE + INTERVAL '12 months', 1
FROM main_quests WHERE user_id = 'YOUR_USER_ID' AND dimension = 'wealth';

INSERT INTO quest_dimension_xp (user_id, dimension, xp) VALUES
  ('YOUR_USER_ID', 'career', 0),
  ('YOUR_USER_ID', 'social', 0),
  ('YOUR_USER_ID', 'wealth', 0)
ON CONFLICT (user_id, dimension) DO NOTHING;
