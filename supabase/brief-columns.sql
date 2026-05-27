-- Add structured morning check-in fields to voice_notes
-- Run this in the Supabase SQL editor
ALTER TABLE voice_notes ADD COLUMN IF NOT EXISTS mood_signal TEXT;
ALTER TABLE voice_notes ADD COLUMN IF NOT EXISTS focus_list JSONB;
ALTER TABLE voice_notes ADD COLUMN IF NOT EXISTS suggestions JSONB;
ALTER TABLE voice_notes ADD COLUMN IF NOT EXISTS calendar_matches JSONB;
