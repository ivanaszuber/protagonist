-- ============================================================
-- PROTAGONIST — User Data Migration
--
-- CONTEXT: Before auth was added, each device generated its own random UUID
-- stored in localStorage/cookies. You have two user IDs:
--   • Mobile (the one to KEEP)
--   • Desktop (will be migrated → merged into mobile)
--
-- STEP 1: Find your two old user IDs (run before logging in with Google)
-- STEP 2: Find your new Supabase auth UUID (run after first Google login)
-- STEP 3: Run the migration to consolidate all data under your auth UUID
-- ============================================================


-- ── STEP 1: Identify your old user IDs ───────────────────────────────────────
-- Run this first to see all user IDs and how much data each has.
-- The mobile ID will have more data (voice notes, quests, etc.)

select
  user_id,
  count(*) as records,
  min(created_at) as first_seen,
  max(created_at) as last_seen,
  'voice_notes' as source
from voice_notes
group by user_id

union all

select
  user_id,
  count(*) as records,
  min(created_at) as first_seen,
  max(created_at) as last_seen,
  'main_quests' as source
from main_quests
group by user_id

union all

select
  user_id,
  count(*) as records,
  min(created_at) as first_seen,
  max(created_at) as last_seen,
  'quest_dimension_xp' as source
from quest_dimension_xp
group by user_id

order by last_seen desc;


-- ── STEP 2: Find your new Supabase auth UUID ─────────────────────────────────
-- After you've logged in with Google once, run this:

-- select id, email, created_at from auth.users order by created_at desc limit 5;


-- ── STEP 3: Run the migration ─────────────────────────────────────────────────
-- Replace the three variables below, then run the whole block.
--
-- OLD_MOBILE_ID  = your existing mobile UUID (data to keep)
-- OLD_DESKTOP_ID = your existing desktop UUID (data to merge away)
-- NEW_AUTH_ID    = your new Supabase auth UUID (the canonical ID going forward)

do $$
declare
  old_mobile_id  uuid := 'REPLACE_WITH_MOBILE_UUID';   -- ← edit this
  old_desktop_id uuid := 'REPLACE_WITH_DESKTOP_UUID';  -- ← edit this
  new_auth_id    uuid := 'REPLACE_WITH_NEW_AUTH_UUID';  -- ← edit this
begin

  -- Safety check: don't run with placeholder values
  if old_mobile_id::text  = 'REPLACE_WITH_MOBILE_UUID'
  or old_desktop_id::text = 'REPLACE_WITH_DESKTOP_UUID'
  or new_auth_id::text    = 'REPLACE_WITH_NEW_AUTH_UUID'
  then
    raise exception 'Please replace the placeholder UUIDs before running this migration.';
  end if;

  raise notice 'Migrating mobile data (%) → auth UUID (%)', old_mobile_id, new_auth_id;
  raise notice 'Merging desktop data (%) → auth UUID (%)', old_desktop_id, new_auth_id;

  -- ── voice_notes ────────────────────────────────────────────────────────────
  update voice_notes set user_id = new_auth_id where user_id = old_mobile_id;
  -- Desktop notes: insert only if not already covered (avoid duplication)
  update voice_notes set user_id = new_auth_id where user_id = old_desktop_id;

  -- ── main_quests ────────────────────────────────────────────────────────────
  update main_quests set user_id = new_auth_id where user_id = old_mobile_id;
  update main_quests set user_id = new_auth_id where user_id = old_desktop_id;

  -- ── quest_tasks ────────────────────────────────────────────────────────────
  update quest_tasks set user_id = new_auth_id where user_id = old_mobile_id;
  update quest_tasks set user_id = new_auth_id where user_id = old_desktop_id;

  -- ── quest_dimension_xp ─────────────────────────────────────────────────────
  -- Merge XP: for each dimension, keep the higher value from mobile vs desktop,
  -- then assign to the auth UUID.
  insert into quest_dimension_xp (user_id, dimension, xp, updated_at)
  select
    new_auth_id,
    dimension,
    max(xp) as xp,
    now()
  from quest_dimension_xp
  where user_id in (old_mobile_id, old_desktop_id)
  group by dimension
  on conflict (user_id, dimension)
  do update set xp = greatest(quest_dimension_xp.xp, excluded.xp), updated_at = now();

  -- Remove old XP rows
  delete from quest_dimension_xp where user_id in (old_mobile_id, old_desktop_id);

  -- ── checkins / mood ────────────────────────────────────────────────────────
  update checkins       set user_id = new_auth_id where user_id = old_mobile_id;
  update checkins       set user_id = new_auth_id where user_id = old_desktop_id;
  update mood_logs      set user_id = new_auth_id where user_id = old_mobile_id;
  update mood_logs      set user_id = new_auth_id where user_id = old_desktop_id;

  -- ── oura / calendar tokens ─────────────────────────────────────────────────
  update oura_tokens    set user_id = new_auth_id where user_id = old_mobile_id;
  update oura_tokens    set user_id = new_auth_id where user_id = old_desktop_id;
  update calendar_tokens set user_id = new_auth_id where user_id = old_mobile_id;
  update calendar_tokens set user_id = new_auth_id where user_id = old_desktop_id;
  update calendar_events set user_id = new_auth_id where user_id = old_mobile_id;
  update calendar_events set user_id = new_auth_id where user_id = old_desktop_id;

  -- ── medals ─────────────────────────────────────────────────────────────────
  update user_medals    set user_id = new_auth_id where user_id = old_mobile_id;
  update user_medals    set user_id = new_auth_id where user_id = old_desktop_id;

  -- ── memories ───────────────────────────────────────────────────────────────
  update memories       set user_id = new_auth_id where user_id = old_mobile_id;
  update memories       set user_id = new_auth_id where user_id = old_desktop_id;

  -- ── vault settings ─────────────────────────────────────────────────────────
  update vault_settings set user_id = new_auth_id where user_id = old_mobile_id;
  update vault_settings set user_id = new_auth_id where user_id = old_desktop_id;

  -- ── bosses ─────────────────────────────────────────────────────────────────
  update bosses         set user_id = new_auth_id where user_id = old_mobile_id;
  update bosses         set user_id = new_auth_id where user_id = old_desktop_id;

  raise notice '✅ Migration complete. All data is now under user ID: %', new_auth_id;

end $$;


-- ── STEP 4: Verify ───────────────────────────────────────────────────────────
-- After running, confirm everything moved correctly:
--
-- select 'voice_notes'        as tbl, count(*) from voice_notes where user_id = 'YOUR_NEW_AUTH_ID'
-- union all
-- select 'main_quests',              count(*) from main_quests where user_id = 'YOUR_NEW_AUTH_ID'
-- union all
-- select 'quest_dimension_xp',       count(*) from quest_dimension_xp where user_id = 'YOUR_NEW_AUTH_ID';
