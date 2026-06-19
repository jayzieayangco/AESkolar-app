-- Adds evaluation release state tracking.
-- Run in Supabase SQL Editor (or via migrations tooling).

ALTER TABLE public.evaluations
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- Optional: backfill existing rows that might be NULL (defensive)
UPDATE public.evaluations
SET status = 'scored'
WHERE status IS NULL;

