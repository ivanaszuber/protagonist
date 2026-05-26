-- PRP-029: Milestone focus flag
-- Run in Supabase SQL editor
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS is_focused BOOLEAN NOT NULL DEFAULT FALSE;
