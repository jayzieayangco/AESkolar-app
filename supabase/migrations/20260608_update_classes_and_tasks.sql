
-- =============================================================================
-- AESkolar: Update classes, add student_classes, update assignment_tasks
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. Update classes table: add class_code column (generate codes for existing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'class_code') THEN
    ALTER TABLE classes ADD COLUMN class_code TEXT UNIQUE;
  END IF;
END $$;

-- Generate class codes for existing classes that don't have them
UPDATE classes 
SET class_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6))
WHERE class_code IS NULL;

-- Make class_code NOT NULL
DO $$
BEGIN
  ALTER TABLE classes ALTER COLUMN class_code SET NOT NULL;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not set class_code NOT NULL: %', SQLERRM;
END $$;


-- 2. Create student_classes table if it doesn't exist
CREATE TABLE IF NOT EXISTS student_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, class_id)
);

-- Enable RLS on student_classes
ALTER TABLE student_classes ENABLE ROW LEVEL SECURITY;

-- 3. Add new columns to assignment_tasks (if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignment_tasks' AND column_name = 'class_id') THEN
    ALTER TABLE assignment_tasks ADD COLUMN class_id UUID REFERENCES classes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignment_tasks' AND column_name = 'teacher_id') THEN
    ALTER TABLE assignment_tasks ADD COLUMN teacher_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignment_tasks' AND column_name = 'points') THEN
    ALTER TABLE assignment_tasks ADD COLUMN points INTEGER DEFAULT 10;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignment_tasks' AND column_name = 'attachments') THEN
    ALTER TABLE assignment_tasks ADD COLUMN attachments JSONB DEFAULT '[]'::JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignment_tasks' AND column_name = 'links') THEN
    ALTER TABLE assignment_tasks ADD COLUMN links JSONB DEFAULT '[]'::JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignment_tasks' AND column_name = 'rubric_url') THEN
    ALTER TABLE assignment_tasks ADD COLUMN rubric_url TEXT;
  END IF;
END $$;


-- 4. RLS Policies for student_classes
DROP POLICY IF EXISTS "students_view_own_enrollments" ON student_classes;
DROP POLICY IF EXISTS "students_enroll" ON student_classes;
DROP POLICY IF EXISTS "students_unenroll" ON student_classes;
DROP POLICY IF EXISTS "teachers_view_class_enrollments" ON student_classes;

CREATE POLICY "students_view_own_enrollments" ON student_classes
  FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "students_enroll" ON student_classes
  FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

CREATE POLICY "students_unenroll" ON student_classes
  FOR DELETE TO authenticated USING (student_id = auth.uid());

CREATE POLICY "teachers_view_class_enrollments" ON student_classes
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = student_classes.class_id
      AND classes.teacher_id = auth.uid()
    )
  );


-- 5. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_student_classes_student_id ON student_classes(student_id);
CREATE INDEX IF NOT EXISTS idx_student_classes_class_id ON student_classes(class_id);
CREATE INDEX IF NOT EXISTS idx_assignment_tasks_class_id ON assignment_tasks(class_id);
CREATE INDEX IF NOT EXISTS idx_assignment_tasks_teacher_id ON assignment_tasks(teacher_id);

-- Done!
