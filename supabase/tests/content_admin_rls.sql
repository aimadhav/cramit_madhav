-- Rollback-only content authorization checks for both approved creators and a
-- subscribed, non-admin teacher.
\set ON_ERROR_STOP on

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

-- Madhav can create, publish, unpublish, and update temporary content.
SELECT set_config('request.jwt.claim.sub', '84b3926c-877e-4ea3-88b1-fcee02aaab79', true);
INSERT INTO public.decks (
  id, name, tags_json, is_premium, is_public, subject, chapter,
  created_at, updated_at, user_id, version, prep_category
) VALUES (
  '00000000-0000-0000-0000-00000000c401', 'Creator QA Madhav', '[]', false, true,
  'Physics', 'QA', now(), now(), '84b3926c-877e-4ea3-88b1-fcee02aaab79', 1, 'JEE'
);
INSERT INTO public.flashcards (
  id, front, back, content_type, media_urls_json, tags_json,
  created_at, updated_at, deck_id, status
) VALUES (
  '00000000-0000-0000-0000-00000000c402', 'Question', 'Answer', 'text', '[]', '[]',
  now(), now(), '00000000-0000-0000-0000-00000000c401', 'draft'
);
UPDATE public.flashcards SET status = 'published', updated_at = now()
WHERE id = '00000000-0000-0000-0000-00000000c402';
UPDATE public.flashcards SET status = 'draft', updated_at = now()
WHERE id = '00000000-0000-0000-0000-00000000c402';
UPDATE public.decks SET description = 'Updated by approved creator', updated_at = now()
WHERE id = '00000000-0000-0000-0000-00000000c401';

-- Malay has the same creator permissions.
SELECT set_config('request.jwt.claim.sub', '3f636538-aa4d-4916-b97e-9a5e42ac7f1a', true);
INSERT INTO public.decks (
  id, name, tags_json, is_premium, is_public, subject, chapter,
  created_at, updated_at, user_id, version, prep_category
) VALUES (
  '00000000-0000-0000-0000-00000000c403', 'Creator QA Malay', '[]', false, true,
  'Chemistry', 'QA', now(), now(), '3f636538-aa4d-4916-b97e-9a5e42ac7f1a', 1, 'JEE'
);
INSERT INTO public.flashcards (
  id, front, back, content_type, media_urls_json, tags_json,
  created_at, updated_at, deck_id, status
) VALUES (
  '00000000-0000-0000-0000-00000000c404', 'Question', 'Answer', 'text', '[]', '[]',
  now(), now(), '00000000-0000-0000-0000-00000000c403', 'draft'
);
UPDATE public.flashcards SET status = 'published', updated_at = now()
WHERE id = '00000000-0000-0000-0000-00000000c404';
DELETE FROM public.flashcards WHERE id = '00000000-0000-0000-0000-00000000c404';
DELETE FROM public.decks WHERE id = '00000000-0000-0000-0000-00000000c403';

-- Temporarily model a paid non-admin teacher. The update is performed as the
-- database owner and is rolled back; the client role can read public content
-- but cannot create or mutate it.
RESET ROLE;
UPDATE public.users
SET role = 'teacher', is_premium = true, is_admin = false
WHERE id = 'e91110ed-beeb-4117-ab2a-4b8fa503ba93';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'e91110ed-beeb-4117-ab2a-4b8fa503ba93', true);

DO $$
DECLARE
  denied boolean := false;
  visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count
  FROM public.decks
  WHERE id = '00000000-0000-0000-0000-00000000c401';
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'Paid teacher could not read public content';
  END IF;

  BEGIN
    INSERT INTO public.decks (
      id, name, tags_json, is_premium, is_public, subject,
      created_at, updated_at, user_id, version, prep_category
    ) VALUES (
      '00000000-0000-0000-0000-00000000c405', 'Forbidden teacher deck', '[]', false, true,
      'Physics', now(), now(), 'e91110ed-beeb-4117-ab2a-4b8fa503ba93', 1, 'JEE'
    );
  EXCEPTION WHEN others THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Paid non-admin teacher unexpectedly created content';
  END IF;
END;
$$;

RESET ROLE;
ROLLBACK;
