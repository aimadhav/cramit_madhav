-- Make the mobile user's private profile and study history reproducibly private.
-- Existing dashboard-created policies are removed so a permissive legacy policy
-- cannot silently override these rules.

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'users',
        'reviews',
        'study_sessions',
        'user_flashcard_statuses',
        'user_active_chapters'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END;
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_flashcard_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_active_chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own
ON public.users FOR SELECT TO authenticated
USING (id = auth.uid()::text);

CREATE POLICY users_insert_own
ON public.users FOR INSERT TO authenticated
WITH CHECK (id = auth.uid()::text);

CREATE POLICY users_update_own
ON public.users FOR UPDATE TO authenticated
USING (id = auth.uid()::text)
WITH CHECK (id = auth.uid()::text);

CREATE POLICY reviews_select_own
ON public.reviews FOR SELECT TO authenticated
USING (user_id = auth.uid()::text);

CREATE POLICY reviews_insert_own
ON public.reviews FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY reviews_update_own
ON public.reviews FOR UPDATE TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY study_sessions_select_own
ON public.study_sessions FOR SELECT TO authenticated
USING (user_id = auth.uid()::text);

CREATE POLICY study_sessions_insert_own
ON public.study_sessions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY study_sessions_update_own
ON public.study_sessions FOR UPDATE TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY statuses_select_own
ON public.user_flashcard_statuses FOR SELECT TO authenticated
USING (user_id = auth.uid()::text);

CREATE POLICY statuses_insert_own
ON public.user_flashcard_statuses FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY statuses_update_own
ON public.user_flashcard_statuses FOR UPDATE TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY statuses_delete_own
ON public.user_flashcard_statuses FOR DELETE TO authenticated
USING (user_id = auth.uid()::text);

CREATE POLICY active_chapters_select_own
ON public.user_active_chapters FOR SELECT TO authenticated
USING (user_id = auth.uid()::text);

CREATE POLICY active_chapters_insert_own
ON public.user_active_chapters FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY active_chapters_update_own
ON public.user_active_chapters FOR UPDATE TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY active_chapters_delete_own
ON public.user_active_chapters FOR DELETE TO authenticated
USING (user_id = auth.uid()::text);

REVOKE ALL ON TABLE public.users FROM anon;
REVOKE ALL ON TABLE public.reviews FROM anon;
REVOKE ALL ON TABLE public.study_sessions FROM anon;
REVOKE ALL ON TABLE public.user_flashcard_statuses FROM anon;
REVOKE ALL ON TABLE public.user_active_chapters FROM anon;

GRANT SELECT ON TABLE public.users TO authenticated;
REVOKE DELETE ON TABLE public.users FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.reviews TO authenticated;
REVOKE DELETE ON TABLE public.reviews FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.study_sessions TO authenticated;
REVOKE DELETE ON TABLE public.study_sessions FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_flashcard_statuses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_active_chapters TO authenticated;
