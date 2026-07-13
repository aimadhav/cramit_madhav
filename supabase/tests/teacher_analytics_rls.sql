-- Integration smoke test for teacher analytics. Run with psql as the database
-- owner. Every fixture is rolled back.
\set ON_ERROR_STOP on

BEGIN;

INSERT INTO public.decks (
  id, name, description, tags_json, is_premium, is_public, subject, chapter,
  created_at, updated_at, user_id, version, prep_category
)
VALUES (
  '00000000-0000-0000-0000-00000000a410',
  'Analytics QA Deck',
  'Temporary rolled-back fixture',
  '[]', false, true, 'Physics', 'QA Chapter', now(), now(),
  '84b3926c-877e-4ea3-88b1-fcee02aaab79', 1, 'JEE'
);

INSERT INTO public.flashcards (
  id, front, back, content_type, media_urls_json, tags_json,
  created_at, updated_at, deck_id, status
)
VALUES (
  '00000000-0000-0000-0000-00000000a411',
  'QA question', 'QA answer', 'text', '[]', '[]', now(), now(),
  '00000000-0000-0000-0000-00000000a410', 'published'
);

-- This review predates the membership fixture below, proving that an active
-- member's complete history is included after they join.
INSERT INTO public.reviews (
  id, flashcard_id, user_id, rating, reviewed_at, response_time_ms,
  created_at, updated_at
)
VALUES
  ('00000000-0000-0000-0000-00000000a412', '00000000-0000-0000-0000-00000000a411', 'cb0997f4-0be6-49e8-b125-098ce40f775b', 1, now() - interval '100 days', 100, now() - interval '100 days', now() - interval '100 days'),
  ('00000000-0000-0000-0000-00000000a413', '00000000-0000-0000-0000-00000000a411', 'cb0997f4-0be6-49e8-b125-098ce40f775b', 1, now() - interval '100 days' + interval '1 second', 400000, now() - interval '100 days', now() - interval '100 days'),
  ('00000000-0000-0000-0000-00000000a414', '00000000-0000-0000-0000-00000000a411', 'cb0997f4-0be6-49e8-b125-098ce40f775b', 4, now() - interval '100 days' + interval '2 seconds', 60000, now() - interval '100 days', now() - interval '100 days'),
  ('00000000-0000-0000-0000-00000000a415', '00000000-0000-0000-0000-00000000a411', 'cb0997f4-0be6-49e8-b125-098ce40f775b', 4, now() - interval '100 days' + interval '3 seconds', 60000, now() - interval '100 days', now() - interval '100 days'),
  ('00000000-0000-0000-0000-00000000a416', '00000000-0000-0000-0000-00000000a411', 'cb0997f4-0be6-49e8-b125-098ce40f775b', 4, now() - interval '100 days' + interval '4 seconds', 60000, now() - interval '100 days', now() - interval '100 days');

INSERT INTO public.user_flashcard_statuses (
  id, user_id, flashcard_id, interval, stability, difficulty, repetitions,
  due_date, last_reviewed, is_bookmarked, is_learned, is_deleted,
  created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-00000000a417',
  'cb0997f4-0be6-49e8-b125-098ce40f775b',
  '00000000-0000-0000-0000-00000000a411',
  1, 1, 5, 5, now() - interval '1 day', now() - interval '100 days',
  false, false, false, now(), now()
);

INSERT INTO public.rooms (id, code, name, description, created_by, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-00000000a401',
  'QA401X',
  'Analytics QA Class',
  'Temporary rolled-back fixture',
  '84b3926c-877e-4ea3-88b1-fcee02aaab79',
  now(),
  now()
);

INSERT INTO public.room_memberships (id, room_id, user_id, role, joined_at)
VALUES
  (
    '00000000-0000-0000-0000-00000000a402',
    '00000000-0000-0000-0000-00000000a401',
    '84b3926c-877e-4ea3-88b1-fcee02aaab79',
    'teacher',
    now()
  ),
  (
    '00000000-0000-0000-0000-00000000a403',
    '00000000-0000-0000-0000-00000000a401',
    'cb0997f4-0be6-49e8-b125-098ce40f775b',
    'student',
    now()
  );

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '84b3926c-877e-4ea3-88b1-fcee02aaab79', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
DECLARE
  class_dto jsonb;
  recent_dto jsonb;
  student_dto jsonb;
BEGIN
  class_dto := public.get_teacher_class_dashboard(
    '00000000-0000-0000-0000-00000000a401', 0, 'Asia/Kolkata'
  );
  student_dto := public.get_teacher_student_dashboard(
    '00000000-0000-0000-0000-00000000a401',
    'cb0997f4-0be6-49e8-b125-098ce40f775b',
    0,
    'Asia/Kolkata'
  );
  recent_dto := public.get_teacher_class_dashboard(
    '00000000-0000-0000-0000-00000000a401', 30, 'Not/A-Timezone'
  );

  IF (class_dto #>> '{summary,studentCount}')::integer <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one student in class DTO';
  END IF;
  IF (class_dto #>> '{summary,reviews}')::integer <> 5 THEN
    RAISE EXCEPTION 'Full-history class analytics did not include pre-join reviews';
  END IF;
  IF (student_dto #>> '{summary,reviews}')::integer <> 5 THEN
    RAISE EXCEPTION 'Full-history student analytics did not include pre-join reviews';
  END IF;
  IF (class_dto #>> '{summary,recallRate}')::numeric <> 60.0 THEN
    RAISE EXCEPTION 'Recall calculation did not map ratings 2-4 as recalled';
  END IF;
  IF (class_dto #>> '{summary,focusedTimeMinutes}')::numeric <> 3.0 THEN
    RAISE EXCEPTION 'Focused time did not filter response times to 250-300000ms';
  END IF;
  IF (class_dto #>> '{summary,backlog}')::integer <> 1 THEN
    RAISE EXCEPTION 'Current due-card backlog was not returned';
  END IF;
  IF jsonb_array_length(class_dto -> 'strugglingDecks') <> 1
     OR jsonb_array_length(student_dto -> 'strugglingDecks') <> 1 THEN
    RAISE EXCEPTION 'Struggling-deck thresholds were not applied';
  END IF;
  IF (class_dto #>> '{decks,0,coverage}')::numeric <> 100.0 THEN
    RAISE EXCEPTION 'Published-card coverage was not calculated';
  END IF;
  IF (recent_dto #>> '{summary,reviews}')::integer <> 0
     OR recent_dto ->> 'timezone' <> 'Asia/Kolkata' THEN
    RAISE EXCEPTION 'Date range or timezone fallback is incorrect';
  END IF;
  IF jsonb_array_length(class_dto -> 'activity') < 1 THEN
    RAISE EXCEPTION 'Activity buckets were not returned';
  END IF;
END;
$$;

-- A different user cannot access the room or its student analytics.
SELECT set_config('request.jwt.claim.sub', 'e91110ed-beeb-4117-ab2a-4b8fa503ba93', true);
DO $$
DECLARE
  denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.get_teacher_class_dashboard(
      '00000000-0000-0000-0000-00000000a401', 30, 'Asia/Kolkata'
    );
  EXCEPTION WHEN others THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Non-owner unexpectedly accessed class analytics';
  END IF;
END;
$$;

-- Even another active admin/teacher cannot inspect a class they do not own.
SELECT set_config('request.jwt.claim.sub', '3f636538-aa4d-4916-b97e-9a5e42ac7f1a', true);
DO $$
DECLARE
  denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.get_teacher_student_dashboard(
      '00000000-0000-0000-0000-00000000a401',
      'cb0997f4-0be6-49e8-b125-098ce40f775b',
      30,
      'Asia/Kolkata'
    );
  EXCEPTION WHEN others THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'A different teacher unexpectedly accessed student analytics';
  END IF;
END;
$$;

RESET ROLE;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.get_teacher_class_dashboard(text,integer,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous role unexpectedly has class analytics permission';
  END IF;
  IF has_function_privilege('anon', 'public.get_teacher_student_dashboard(text,text,integer,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous role unexpectedly has student analytics permission';
  END IF;
END;
$$;

ROLLBACK;
