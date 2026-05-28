-- Add brief column to voice_notes (used by journal stream for morning check-in summaries)
alter table public.voice_notes
  add column if not exists brief text;
