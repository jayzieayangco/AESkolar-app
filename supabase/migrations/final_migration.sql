
-- =============================================================================
-- AESkolar: Full Migration
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

-- =============================================================================
-- 1. Update classes table
-- =============================================================================
ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_class_code ON classes(class_code);

-- Generate class_code for existing classes that don't have it
UPDATE classes 
SET class_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6))
WHERE class_code IS NULL;

-- =============================================================================
-- 2. Create student_classes table
-- =============================================================================
CREATE TABLE IF NOT EXISTS student_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_student_classes_student_id ON student_classes(student_id);
CREATE INDEX IF NOT EXISTS idx_student_classes_class_id ON student_classes(class_id);

-- =============================================================================
-- 3. Update assignment_tasks table
-- =============================================================================
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 10;
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::JSONB;
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS links JSONB DEFAULT '[]'::JSONB;
ALTER TABLE assignment_tasks ADD COLUMN IF NOT EXISTS rubric_url TEXT;

-- =============================================================================
-- 3.5. Update documents table
-- =============================================================================
ALTER TABLE documents ADD COLUMN IF NOT EXISTS score NUMERIC;

CREATE INDEX IF NOT EXISTS idx_assignment_tasks_class_id ON assignment_tasks(class_id);
CREATE INDEX IF NOT EXISTS idx_assignment_tasks_teacher_id ON assignment_tasks(teacher_id);

-- =============================================================================
-- 4. Grants
-- =============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_classes TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- =============================================================================
-- 5. Enable RLS
-- =============================================================================
ALTER TABLE public.student_classes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (re-run safe)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'student_classes'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- =============================================================================
-- 6. RLS Policies for student_classes
-- =============================================================================
CREATE POLICY "student_classes_select_own" ON public.student_classes FOR SELECT TO authenticated
  USING (student_id = auth.uid());
CREATE POLICY "student_classes_insert_own" ON public.student_classes FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());
CREATE POLICY "student_classes_delete_own" ON public.student_classes FOR DELETE TO authenticated
  USING (student_id = auth.uid());
CREATE POLICY "student_classes_select_teacher" ON public.student_classes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = student_classes.class_id
        AND classes.teacher_id = auth.uid()
    )
  );

-- Done!
