-- Workflow + FK stabilization (run in Supabase SQL Editor if not using CLI migrate)

ALTER TABLE public.evaluations
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

ALTER TABLE public.evaluations
ALTER COLUMN status SET DEFAULT 'pending';

UPDATE public.evaluations SET status = 'pending' WHERE status IS NULL;

ALTER TABLE public.assignment_tasks
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id);

ALTER TABLE public.assignment_tasks
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
