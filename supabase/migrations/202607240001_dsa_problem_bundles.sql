-- Problem bundles keep a DSA problem and its supporting prompts together
-- without changing the scheduling model: every flashcard still has its own
-- review status and FSRS history.

CREATE TABLE IF NOT EXISTS public.problem_bundles (
  id text PRIMARY KEY,
  deck_id text NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  original_id text NOT NULL,
  title text NOT NULL,
  difficulty text,
  tags_json text NOT NULL DEFAULT '[]',
  source text NOT NULL DEFAULT 'striver-a2z',
  roadmap_step integer NOT NULL,
  roadmap_step_title text NOT NULL,
  roadmap_sub_step_title text,
  source_order integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, original_id)
);

ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS problem_bundle_id text,
  ADD COLUMN IF NOT EXISTS card_role text,
  ADD COLUMN IF NOT EXISTS child_type text,
  ADD COLUMN IF NOT EXISTS position integer,
  ADD COLUMN IF NOT EXISTS bundle_order integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'flashcards_problem_bundle_id_fkey'
  ) THEN
    ALTER TABLE public.flashcards
      ADD CONSTRAINT flashcards_problem_bundle_id_fkey
      FOREIGN KEY (problem_bundle_id)
      REFERENCES public.problem_bundles(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS problem_bundles_deck_order_idx
  ON public.problem_bundles (deck_id, source_order);

CREATE INDEX IF NOT EXISTS problem_bundles_source_original_idx
  ON public.problem_bundles (source, original_id);

CREATE INDEX IF NOT EXISTS flashcards_problem_bundle_position_idx
  ON public.flashcards (problem_bundle_id, position);

ALTER TABLE public.problem_bundles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS problem_bundles_select_visible ON public.problem_bundles;
DROP POLICY IF EXISTS problem_bundles_insert_admin ON public.problem_bundles;
DROP POLICY IF EXISTS problem_bundles_update_admin ON public.problem_bundles;
DROP POLICY IF EXISTS problem_bundles_delete_admin ON public.problem_bundles;

CREATE POLICY problem_bundles_select_visible
ON public.problem_bundles
FOR SELECT
TO anon, authenticated
USING (
  public.is_content_admin()
  OR (
    status = 'published'
    AND EXISTS (
      SELECT 1
      FROM public.decks
      WHERE decks.id = problem_bundles.deck_id
        AND decks.is_public = true
        AND decks.deleted_at IS NULL
    )
  )
);

CREATE POLICY problem_bundles_insert_admin
ON public.problem_bundles
FOR INSERT
TO authenticated
WITH CHECK (public.is_content_admin());

CREATE POLICY problem_bundles_update_admin
ON public.problem_bundles
FOR UPDATE
TO authenticated
USING (public.is_content_admin())
WITH CHECK (public.is_content_admin());

CREATE POLICY problem_bundles_delete_admin
ON public.problem_bundles
FOR DELETE
TO authenticated
USING (public.is_content_admin());

REVOKE ALL ON public.problem_bundles FROM anon;
GRANT SELECT ON public.problem_bundles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.problem_bundles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.problem_bundles TO service_role;
