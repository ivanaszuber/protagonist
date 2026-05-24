-- Run AFTER schema.sql if inserts fail with RLS errors.
-- v0 uses client-generated user_id (no Supabase Auth yet).
-- Tighten these policies when you add real authentication.

alter table check_ins enable row level security;
alter table quests enable row level security;
alter table dimension_xp enable row level security;
alter table dimension_memories enable row level security;

create policy "v0 check_ins all" on check_ins for all using (true) with check (true);
create policy "v0 quests all" on quests for all using (true) with check (true);
create policy "v0 dimension_xp all" on dimension_xp for all using (true) with check (true);
create policy "v0 dimension_memories all" on dimension_memories for all using (true) with check (true);
