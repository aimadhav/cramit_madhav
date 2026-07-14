-- Run as database owner. The test changes role/JWT claims only and does not
-- mutate production rows.
\set ON_ERROR_STOP on

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '84b3926c-877e-4ea3-88b1-fcee02aaab79', true);

DO $$
DECLARE
  leaked_count integer;
BEGIN
  SELECT count(*) INTO leaked_count
  FROM public.users
  WHERE id <> auth.uid()::text;
  IF leaked_count <> 0 THEN
    RAISE EXCEPTION 'users RLS leaked another profile';
  END IF;

  SELECT count(*) INTO leaked_count
  FROM public.reviews
  WHERE user_id <> auth.uid()::text;
  IF leaked_count <> 0 THEN
    RAISE EXCEPTION 'reviews RLS leaked another user history';
  END IF;

  SELECT count(*) INTO leaked_count
  FROM public.user_flashcard_statuses
  WHERE user_id <> auth.uid()::text;
  IF leaked_count <> 0 THEN
    RAISE EXCEPTION 'status RLS leaked another user progress';
  END IF;

  SELECT count(*) INTO leaked_count
  FROM public.user_active_chapters
  WHERE user_id <> auth.uid()::text;
  IF leaked_count <> 0 THEN
    RAISE EXCEPTION 'active chapter RLS leaked another user configuration';
  END IF;
END;
$$;

RESET ROLE;
ROLLBACK;
