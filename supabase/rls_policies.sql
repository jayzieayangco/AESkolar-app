-- =============================================================================
-- AESkolar: GRANTs + RLS for React frontend (anon + authenticated)
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Broad grants (RLS still enforces row access)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Per-table grants (explicit; safe to re-run)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.classes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assignment_tasks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.documents TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.evaluations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.feedback TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rubrics TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.criteria TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.languages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.score_details TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_classes TO anon, authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- =============================================================================
-- Enable RLS
-- =============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_classes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (re-run safe)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'users','classes','assignment_tasks','documents','evaluations',
        'feedback','rubrics','criteria','languages','score_details','student_classes'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- =============================================================================
-- users
-- =============================================================================
CREATE POLICY "users_select_own" ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "users_select_all" ON public.users FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "users_insert_own" ON public.users FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "users_update_own" ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- =============================================================================
-- assignment_tasks (readable by all signed-in users)
-- =============================================================================
CREATE POLICY "assignment_tasks_select" ON public.assignment_tasks FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "assignment_tasks_write" ON public.assignment_tasks FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- =============================================================================
-- documents
-- =============================================================================
CREATE POLICY "documents_select_own" ON public.documents FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "documents_insert_own" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "documents_update_own" ON public.documents FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "documents_update_teacher" ON public.documents FOR UPDATE TO authenticated
  USING (role = 'student')
  WITH CHECK (role = 'student');
CREATE POLICY "documents_delete_own" ON public.documents FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "documents_select_teacher_class" ON public.documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = documents.class_id AND c.teacher_id = auth.uid()
    )
  );
CREATE POLICY "documents_select_submitted_students" ON public.documents FOR SELECT TO authenticated
  USING (role = 'student' AND status IN ('submitted', 'graded'));

-- =============================================================================
-- classes
-- =============================================================================
CREATE POLICY "classes_select" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "classes_teacher_write" ON public.classes FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

-- =============================================================================
-- student_classes
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

-- =============================================================================
-- evaluations, feedback, score_details
-- =============================================================================
CREATE POLICY "evaluations_select" ON public.evaluations FOR SELECT TO authenticated USING (true);
CREATE POLICY "evaluations_write" ON public.evaluations FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "feedback_select" ON public.feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY "feedback_write" ON public.feedback FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "score_details_select" ON public.score_details FOR SELECT TO authenticated USING (true);
CREATE POLICY "score_details_write" ON public.score_details FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- =============================================================================
-- rubrics, criteria, languages
-- =============================================================================
CREATE POLICY "rubrics_all" ON public.rubrics FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rubrics_select_anon" ON public.rubrics FOR SELECT TO anon USING (true);

CREATE POLICY "criteria_all" ON public.criteria FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "criteria_select_anon" ON public.criteria FOR SELECT TO anon USING (true);

CREATE POLICY "languages_select" ON public.languages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "languages_write" ON public.languages FOR ALL TO authenticated USING (true) WITH CHECK (true);
