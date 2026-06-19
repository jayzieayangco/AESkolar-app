-- Fix UUID vs Integer type error in evaluations table
-- Run this in Supabase SQL Editor to fix the schema issue

-- Check current column types
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'evaluations' 
AND table_schema = 'public';

-- The issue is that essay_id or evaluator_id is defined as integer instead of uuid
-- Since we cannot directly cast integer to uuid, we need to recreate the column

-- Step 1: Add new uuid column
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS evaluator_id_new uuid;

-- Step 2: If there's existing data, you may need to map it properly
-- For now, set it to null since we can't convert integers to UUIDs
UPDATE public.evaluations SET evaluator_id_new = NULL WHERE evaluator_id_new IS NULL;

-- Step 3: Drop the old integer column
ALTER TABLE public.evaluations DROP COLUMN IF EXISTS evaluator_id;

-- Step 4: Rename the new column to the original name
ALTER TABLE public.evaluations RENAME COLUMN evaluator_id_new TO evaluator_id;

-- Repeat for essay_id if needed:
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS essay_id_new uuid;
UPDATE public.evaluations SET essay_id_new = NULL WHERE essay_id_new IS NULL;
ALTER TABLE public.evaluations DROP COLUMN IF EXISTS essay_id;
ALTER TABLE public.evaluations RENAME COLUMN essay_id_new TO essay_id;

-- After fixing the column types, verify the changes:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'evaluations' 
AND table_schema = 'public'
AND column_name IN ('essay_id', 'evaluator_id');
