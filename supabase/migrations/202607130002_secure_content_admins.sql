-- Only the two approved Cramit content administrators may mutate decks or
-- flashcards. Public clients may read only active public decks and their
-- published cards.

-- Normalize the launch administrator allowlist. Other accounts remain valid
-- students, but any old/demo admin flag is removed.
UPDATE public.users
SET
  is_admin = lower(email) IN (
    'madhav24101@iiitnr.edu.in',
    'malayrc276@gmail.com'
  ),
  role = CASE
    WHEN lower(email) IN (
      'madhav24101@iiitnr.edu.in',
      'malayrc276@gmail.com'
    ) THEN 'teacher'::public.user_role
    ELSE role
  END,
  updated_at = now()
WHERE
  is_admin = true
  OR lower(email) IN (
    'madhav24101@iiitnr.edu.in',
    'malayrc276@gmail.com',
    'prashil1411@gmail.com'
  );

-- The owner explicitly approved removal of the old guest/demo catalogue.
-- Foreign keys cascade to its flashcards and other dependent test rows.
DELETE FROM public.decks
WHERE user_id = 'guest-user';

CREATE OR REPLACE FUNCTION public.is_content_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()::text
      AND is_admin = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_content_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_content_admin() TO anon, authenticated;

ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS decks_select_public_or_own ON public.decks;
DROP POLICY IF EXISTS decks_insert_own ON public.decks;
DROP POLICY IF EXISTS decks_update_own ON public.decks;
DROP POLICY IF EXISTS decks_delete_own ON public.decks;

CREATE POLICY decks_select_public_or_admin
ON public.decks
FOR SELECT
TO anon, authenticated
USING (
  (is_public = true AND deleted_at IS NULL)
  OR public.is_content_admin()
);

CREATE POLICY decks_insert_admin
ON public.decks
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_content_admin()
  AND user_id = auth.uid()::text
);

CREATE POLICY decks_update_admin
ON public.decks
FOR UPDATE
TO authenticated
USING (public.is_content_admin())
WITH CHECK (public.is_content_admin());

CREATE POLICY decks_delete_admin
ON public.decks
FOR DELETE
TO authenticated
USING (public.is_content_admin());

DROP POLICY IF EXISTS flashcards_select_visible ON public.flashcards;
DROP POLICY IF EXISTS flashcards_insert_own_deck ON public.flashcards;
DROP POLICY IF EXISTS flashcards_update_own_deck ON public.flashcards;
DROP POLICY IF EXISTS flashcards_delete_own_deck ON public.flashcards;

CREATE POLICY flashcards_select_published_or_admin
ON public.flashcards
FOR SELECT
TO anon, authenticated
USING (
  public.is_content_admin()
  OR (
    status = 'published'
    AND EXISTS (
      SELECT 1
      FROM public.decks
      WHERE decks.id = flashcards.deck_id
        AND decks.is_public = true
        AND decks.deleted_at IS NULL
    )
  )
);

CREATE POLICY flashcards_insert_admin
ON public.flashcards
FOR INSERT
TO authenticated
WITH CHECK (public.is_content_admin());

CREATE POLICY flashcards_update_admin
ON public.flashcards
FOR UPDATE
TO authenticated
USING (public.is_content_admin())
WITH CHECK (public.is_content_admin());

CREATE POLICY flashcards_delete_admin
ON public.flashcards
FOR DELETE
TO authenticated
USING (public.is_content_admin());
