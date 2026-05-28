-- Memories table — photo memories contextualized by Oracle
CREATE TABLE IF NOT EXISTS memories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  photo_url   TEXT NOT NULL,          -- public URL from Supabase storage bucket "memory-photos"
  caption     TEXT,                   -- Oracle short line (≤15 words)
  reflection  TEXT,                   -- Oracle 2-3 sentence context
  dimensions  TEXT[] DEFAULT '{}',    -- life areas this memory touches
  chapter     TEXT,                   -- Oracle-assigned narrative chapter label
  location    TEXT,                   -- optional: user-supplied or EXIF-derived
  linked_note_id UUID,                -- optional: ties to a voice_note from the same day
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE memories DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS memories_user_id_idx    ON memories(user_id);
CREATE INDEX IF NOT EXISTS memories_created_at_idx ON memories(created_at DESC);

-- NOTE: You must also create a Supabase storage bucket named "memory-photos"
-- with public read access enabled (Storage → New bucket → "memory-photos" → Public).
