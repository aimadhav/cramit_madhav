-- Secure, aggregated analytics for the paid teacher portal. These functions
-- intentionally expose minimized JSON DTOs instead of granting teachers direct
-- access to reviews, scheduling state, or other users' private rows.

CREATE INDEX IF NOT EXISTS reviews_user_reviewed_card_idx
  ON public.reviews (user_id, reviewed_at DESC, flashcard_id);

CREATE INDEX IF NOT EXISTS flashcards_deck_status_idx
  ON public.flashcards (deck_id, status);

CREATE INDEX IF NOT EXISTS room_memberships_room_role_user_idx
  ON public.room_memberships (room_id, role, user_id);

CREATE INDEX IF NOT EXISTS user_flashcard_statuses_user_due_active_idx
  ON public.user_flashcard_statuses (user_id, due_date, flashcard_id)
  WHERE is_deleted = false;

CREATE OR REPLACE FUNCTION public.canonical_cramit_subject(p_subject text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT CASE lower(trim(coalesce(p_subject, '')))
    WHEN '' THEN 'Other'
    WHEN 'physics' THEN 'Physics'
    WHEN 'chemistry' THEN 'Chemistry'
    WHEN 'mathematics' THEN 'Mathematics'
    WHEN 'math' THEN 'Mathematics'
    WHEN 'maths' THEN 'Mathematics'
    WHEN 'biology' THEN 'Biology'
    WHEN 'dsa' THEN 'DSA'
    WHEN 'data structures & algorithms' THEN 'DSA'
    WHEN 'data structures and algorithms' THEN 'DSA'
    WHEN 'dbms' THEN 'DBMS'
    WHEN 'database management systems' THEN 'DBMS'
    WHEN 'operating systems' THEN 'Operating Systems'
    WHEN 'os' THEN 'Operating Systems'
    WHEN 'oop' THEN 'OOP'
    WHEN 'object oriented programming' THEN 'OOP'
    WHEN 'object-oriented programming' THEN 'OOP'
    WHEN 'computer networks' THEN 'Computer Networks'
    WHEN 'networks' THEN 'Computer Networks'
    ELSE trim(p_subject)
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_class_dashboard(
  p_room_id text,
  p_range_days integer DEFAULT 30,
  p_timezone text DEFAULT 'Asia/Kolkata'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_timezone text := coalesce(nullif(trim(p_timezone), ''), 'Asia/Kolkata');
  v_range_days integer := coalesce(p_range_days, 30);
  v_today date;
  v_cutoff timestamptz;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_range_days NOT IN (0, 7, 30, 90) THEN
    RAISE EXCEPTION 'Range must be 7, 30, 90, or 0 for all history';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = v_timezone) THEN
    v_timezone := 'Asia/Kolkata';
  END IF;

  IF NOT public.is_room_owner(p_room_id)
     OR NOT public.can_user_manage_rooms(auth.uid()::text) THEN
    RAISE EXCEPTION 'Only the active room teacher can view class analytics';
  END IF;

  v_today := (pg_catalog.now() AT TIME ZONE v_timezone)::date;
  IF v_range_days > 0 THEN
    v_cutoff := ((v_today - (v_range_days - 1))::timestamp AT TIME ZONE v_timezone);
  END IF;

  WITH
  target_room AS MATERIALIZED (
    SELECT r.id, r.name, r.code, r.description
    FROM public.rooms AS r
    WHERE r.id = p_room_id
      AND r.created_by = auth.uid()::text
  ),
  members AS MATERIALIZED (
    SELECT m.user_id
    FROM public.room_memberships AS m
    WHERE m.room_id = p_room_id
      AND m.role = 'student'
  ),
  review_rows AS MATERIALIZED (
    SELECT
      r.id,
      r.user_id,
      r.flashcard_id,
      r.rating,
      r.reviewed_at,
      r.response_time_ms,
      f.deck_id,
      d.name AS deck_name,
      public.canonical_cramit_subject(d.subject) AS subject,
      coalesce(nullif(trim(d.chapter), ''), d.name) AS chapter
    FROM public.reviews AS r
    JOIN members AS m ON m.user_id = r.user_id
    JOIN public.flashcards AS f ON f.id = r.flashcard_id
    JOIN public.decks AS d ON d.id = f.deck_id
  ),
  selected_reviews AS MATERIALIZED (
    SELECT *
    FROM review_rows
    WHERE v_range_days = 0 OR reviewed_at >= v_cutoff
  ),
  backlog_rows AS MATERIALIZED (
    SELECT
      s.user_id,
      s.flashcard_id,
      f.deck_id,
      d.name AS deck_name,
      public.canonical_cramit_subject(d.subject) AS subject,
      coalesce(nullif(trim(d.chapter), ''), d.name) AS chapter
    FROM public.user_flashcard_statuses AS s
    JOIN members AS m ON m.user_id = s.user_id
    JOIN public.flashcards AS f ON f.id = s.flashcard_id
    JOIN public.decks AS d ON d.id = f.deck_id
    WHERE s.is_deleted = false
      AND s.due_date <= (pg_catalog.now() AT TIME ZONE 'UTC')
      AND f.status = 'published'
      AND d.deleted_at IS NULL
  ),
  published_cards AS MATERIALIZED (
    SELECT f.deck_id, count(*)::integer AS card_count
    FROM public.flashcards AS f
    JOIN public.decks AS d ON d.id = f.deck_id
    WHERE f.status = 'published'
      AND d.deleted_at IS NULL
    GROUP BY f.deck_id
  ),
  activity_start AS (
    SELECT CASE
      WHEN v_range_days > 0 THEN v_today - (v_range_days - 1)
      ELSE coalesce(min((reviewed_at AT TIME ZONE v_timezone)::date), v_today)
    END AS start_date
    FROM selected_reviews
  ),
  activity_bounds AS (
    SELECT
      CASE WHEN v_range_days IN (0, 90)
        THEN date_trunc('week', start_date::timestamp)::date
        ELSE start_date
      END AS start_date,
      CASE WHEN v_range_days IN (0, 90)
        THEN date_trunc('week', v_today::timestamp)::date
        ELSE v_today
      END AS end_date,
      CASE WHEN v_range_days IN (0, 90) THEN 7 ELSE 1 END AS step_days
    FROM activity_start
  ),
  activity_series AS (
    SELECT generated::date AS bucket_date, b.step_days
    FROM activity_bounds AS b
    CROSS JOIN LATERAL generate_series(
      b.start_date::timestamp,
      b.end_date::timestamp,
      make_interval(days => b.step_days)
    ) AS generated
  ),
  activity_counts AS (
    SELECT
      CASE WHEN v_range_days IN (0, 90)
        THEN date_trunc('week', (reviewed_at AT TIME ZONE v_timezone))::date
        ELSE (reviewed_at AT TIME ZONE v_timezone)::date
      END AS bucket_date,
      count(*)::integer AS reviews,
      count(DISTINCT user_id)::integer AS active_students
    FROM selected_reviews
    GROUP BY 1
  ),
  activity AS (
    SELECT
      s.bucket_date,
      coalesce(c.reviews, 0) AS reviews,
      coalesce(c.active_students, 0) AS active_students
    FROM activity_series AS s
    LEFT JOIN activity_counts AS c USING (bucket_date)
  ),
  subject_keys AS (
    SELECT subject FROM selected_reviews
    UNION
    SELECT subject FROM backlog_rows
  ),
  subject_metrics AS (
    SELECT
      k.subject,
      count(r.id)::integer AS reviews,
      CASE WHEN count(r.id) = 0 THEN NULL
        ELSE round(100.0 * count(*) FILTER (WHERE r.rating BETWEEN 2 AND 4) / count(r.id), 1)
      END AS recall_rate,
      count(DISTINCT r.user_id)::integer AS active_students,
      (SELECT count(*)::integer FROM backlog_rows b WHERE b.subject = k.subject) AS backlog
    FROM subject_keys AS k
    LEFT JOIN selected_reviews AS r ON r.subject = k.subject
    GROUP BY k.subject
  ),
  deck_keys AS (
    SELECT deck_id, deck_name, subject, chapter FROM selected_reviews
    UNION
    SELECT deck_id, deck_name, subject, chapter FROM backlog_rows
  ),
  deck_metrics AS (
    SELECT
      k.deck_id,
      k.deck_name,
      k.subject,
      k.chapter,
      count(r.id)::integer AS reviews,
      CASE WHEN count(r.id) = 0 THEN NULL
        ELSE round(100.0 * count(*) FILTER (WHERE r.rating BETWEEN 2 AND 4) / count(r.id), 1)
      END AS recall_rate,
      count(r.id) FILTER (WHERE r.rating NOT BETWEEN 2 AND 4)::integer AS misses,
      count(DISTINCT r.user_id)::integer AS participating_students,
      count(DISTINCT r.flashcard_id)::integer AS unique_cards_reviewed,
      coalesce(pc.card_count, 0) AS published_cards,
      CASE WHEN coalesce(pc.card_count, 0) = 0 THEN NULL
        ELSE round(100.0 * count(DISTINCT r.flashcard_id) / pc.card_count, 1)
      END AS coverage,
      (SELECT count(*)::integer FROM backlog_rows b WHERE b.deck_id = k.deck_id) AS backlog
    FROM deck_keys AS k
    LEFT JOIN selected_reviews AS r ON r.deck_id = k.deck_id
    LEFT JOIN published_cards AS pc ON pc.deck_id = k.deck_id
    GROUP BY k.deck_id, k.deck_name, k.subject, k.chapter, pc.card_count
  ),
  review_by_student AS (
    SELECT
      user_id,
      count(*)::integer AS reviews,
      round(100.0 * count(*) FILTER (WHERE rating BETWEEN 2 AND 4) / count(*), 1) AS recall_rate,
      count(DISTINCT (reviewed_at AT TIME ZONE v_timezone)::date)::integer AS active_days,
      round(sum(response_time_ms) FILTER (
        WHERE response_time_ms BETWEEN 250 AND 300000
      ) / 60000.0, 1) AS focused_time_minutes,
      max(reviewed_at) AS last_active_at
    FROM selected_reviews
    GROUP BY user_id
  ),
  backlog_by_student AS (
    SELECT user_id, count(*)::integer AS backlog
    FROM backlog_rows
    GROUP BY user_id
  ),
  roster AS (
    SELECT
      u.id AS student_id,
      coalesce(nullif(trim(u.name), ''), split_part(u.email, '@', 1), 'Student') AS name,
      u.email,
      coalesce(rs.reviews, 0) AS reviews,
      rs.recall_rate,
      coalesce(rs.active_days, 0) AS active_days,
      coalesce(bs.backlog, 0) AS backlog,
      coalesce(rs.focused_time_minutes, 0) AS focused_time_minutes,
      rs.last_active_at
    FROM members AS m
    JOIN public.users AS u ON u.id = m.user_id
    LEFT JOIN review_by_student AS rs ON rs.user_id = m.user_id
    LEFT JOIN backlog_by_student AS bs ON bs.user_id = m.user_id
  )
  SELECT jsonb_build_object(
    'room', (SELECT to_jsonb(tr) FROM target_room tr),
    'rangeDays', v_range_days,
    'timezone', v_timezone,
    'generatedAt', pg_catalog.now(),
    'summary', jsonb_build_object(
      'studentCount', (SELECT count(*) FROM members),
      'activeStudents', (SELECT count(DISTINCT user_id) FROM selected_reviews),
      'reviews', (SELECT count(*) FROM selected_reviews),
      'recallRate', (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE round(100.0 * count(*) FILTER (WHERE rating BETWEEN 2 AND 4) / count(*), 1) END FROM selected_reviews),
      'backlog', (SELECT count(*) FROM backlog_rows),
      'focusedTimeMinutes', (SELECT coalesce(round(sum(response_time_ms) FILTER (WHERE response_time_ms BETWEEN 250 AND 300000) / 60000.0, 1), 0) FROM selected_reviews)
    ),
    'activity', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'date', bucket_date,
        'label', CASE WHEN v_range_days IN (0, 90) THEN to_char(bucket_date, 'DD Mon') ELSE to_char(bucket_date, 'DD Mon') END,
        'reviews', reviews,
        'activeStudents', active_students
      ) ORDER BY bucket_date)
      FROM activity
    ), '[]'::jsonb),
    'subjects', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'subject', subject,
        'reviews', reviews,
        'recallRate', recall_rate,
        'activeStudents', active_students,
        'backlog', backlog
      ) ORDER BY reviews DESC, subject)
      FROM subject_metrics
    ), '[]'::jsonb),
    'decks', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'deckId', deck_id,
        'name', deck_name,
        'subject', subject,
        'chapter', chapter,
        'reviews', reviews,
        'recallRate', recall_rate,
        'misses', misses,
        'backlog', backlog,
        'participatingStudents', participating_students,
        'uniqueCardsReviewed', unique_cards_reviewed,
        'publishedCards', published_cards,
        'coverage', coverage
      ) ORDER BY reviews DESC, deck_name)
      FROM deck_metrics
    ), '[]'::jsonb),
    'strugglingDecks', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'deckId', deck_id,
        'name', deck_name,
        'subject', subject,
        'chapter', chapter,
        'reviews', reviews,
        'recallRate', recall_rate,
        'misses', misses,
        'backlog', backlog,
        'participatingStudents', participating_students,
        'coverage', coverage
      ) ORDER BY recall_rate ASC, backlog DESC, reviews DESC)
      FROM deck_metrics
      WHERE reviews >= 5 AND recall_rate < 70
    ), '[]'::jsonb),
    'roster', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'studentId', r.student_id,
        'name', r.name,
        'email', r.email,
        'reviews', r.reviews,
        'recallRate', r.recall_rate,
        'activeDays', r.active_days,
        'backlog', r.backlog,
        'focusedTimeMinutes', r.focused_time_minutes,
        'lastActiveAt', r.last_active_at
      ) ORDER BY r.name, r.email)
      FROM roster r
    ), '[]'::jsonb),
    'leaderboards', jsonb_build_object(
      'recall', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'studentId', x.student_id, 'name', x.name, 'email', x.email,
          'reviews', x.reviews, 'recallRate', x.recall_rate,
          'activeDays', x.active_days, 'backlog', x.backlog,
          'focusedTimeMinutes', x.focused_time_minutes, 'lastActiveAt', x.last_active_at
        ) ORDER BY x.recall_rate DESC, x.reviews DESC)
        FROM (SELECT * FROM roster WHERE reviews >= 10 ORDER BY recall_rate DESC, reviews DESC LIMIT 5) x
      ), '[]'::jsonb),
      'activity', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'studentId', x.student_id, 'name', x.name, 'email', x.email,
          'reviews', x.reviews, 'recallRate', x.recall_rate,
          'activeDays', x.active_days, 'backlog', x.backlog,
          'focusedTimeMinutes', x.focused_time_minutes, 'lastActiveAt', x.last_active_at
        ) ORDER BY x.reviews DESC, x.active_days DESC)
        FROM (SELECT * FROM roster WHERE reviews > 0 ORDER BY reviews DESC, active_days DESC LIMIT 5) x
      ), '[]'::jsonb),
      'consistency', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'studentId', x.student_id, 'name', x.name, 'email', x.email,
          'reviews', x.reviews, 'recallRate', x.recall_rate,
          'activeDays', x.active_days, 'backlog', x.backlog,
          'focusedTimeMinutes', x.focused_time_minutes, 'lastActiveAt', x.last_active_at
        ) ORDER BY x.active_days DESC, x.recall_rate DESC NULLS LAST)
        FROM (SELECT * FROM roster WHERE active_days > 0 ORDER BY active_days DESC, recall_rate DESC NULLS LAST LIMIT 5) x
      ), '[]'::jsonb)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_student_dashboard(
  p_room_id text,
  p_student_id text,
  p_range_days integer DEFAULT 30,
  p_timezone text DEFAULT 'Asia/Kolkata'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_timezone text := coalesce(nullif(trim(p_timezone), ''), 'Asia/Kolkata');
  v_range_days integer := coalesce(p_range_days, 30);
  v_today date;
  v_cutoff timestamptz;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_range_days NOT IN (0, 7, 30, 90) THEN
    RAISE EXCEPTION 'Range must be 7, 30, 90, or 0 for all history';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = v_timezone) THEN
    v_timezone := 'Asia/Kolkata';
  END IF;

  IF NOT public.is_room_owner(p_room_id)
     OR NOT public.can_user_manage_rooms(auth.uid()::text) THEN
    RAISE EXCEPTION 'Only the active room teacher can view student analytics';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.room_memberships m
    WHERE m.room_id = p_room_id
      AND m.user_id = p_student_id
      AND m.role = 'student'
  ) THEN
    RAISE EXCEPTION 'Student is not a current member of this class';
  END IF;

  v_today := (pg_catalog.now() AT TIME ZONE v_timezone)::date;
  IF v_range_days > 0 THEN
    v_cutoff := ((v_today - (v_range_days - 1))::timestamp AT TIME ZONE v_timezone);
  END IF;

  WITH
  target_room AS (
    SELECT r.id, r.name, r.code
    FROM public.rooms r
    WHERE r.id = p_room_id
  ),
  target_student AS (
    SELECT
      u.id,
      coalesce(nullif(trim(u.name), ''), split_part(u.email, '@', 1), 'Student') AS name,
      u.email
    FROM public.users u
    WHERE u.id = p_student_id
  ),
  review_rows AS MATERIALIZED (
    SELECT
      r.id,
      r.flashcard_id,
      r.rating,
      r.reviewed_at,
      r.response_time_ms,
      f.deck_id,
      d.name AS deck_name,
      public.canonical_cramit_subject(d.subject) AS subject,
      coalesce(nullif(trim(d.chapter), ''), d.name) AS chapter
    FROM public.reviews r
    JOIN public.flashcards f ON f.id = r.flashcard_id
    JOIN public.decks d ON d.id = f.deck_id
    WHERE r.user_id = p_student_id
  ),
  selected_reviews AS MATERIALIZED (
    SELECT * FROM review_rows
    WHERE v_range_days = 0 OR reviewed_at >= v_cutoff
  ),
  backlog_rows AS MATERIALIZED (
    SELECT
      s.flashcard_id,
      f.deck_id,
      d.name AS deck_name,
      public.canonical_cramit_subject(d.subject) AS subject,
      coalesce(nullif(trim(d.chapter), ''), d.name) AS chapter
    FROM public.user_flashcard_statuses s
    JOIN public.flashcards f ON f.id = s.flashcard_id
    JOIN public.decks d ON d.id = f.deck_id
    WHERE s.user_id = p_student_id
      AND s.is_deleted = false
      AND s.due_date <= (pg_catalog.now() AT TIME ZONE 'UTC')
      AND f.status = 'published'
      AND d.deleted_at IS NULL
  ),
  published_cards AS (
    SELECT f.deck_id, count(*)::integer AS card_count
    FROM public.flashcards f
    JOIN public.decks d ON d.id = f.deck_id
    WHERE f.status = 'published' AND d.deleted_at IS NULL
    GROUP BY f.deck_id
  ),
  activity_start AS (
    SELECT CASE
      WHEN v_range_days > 0 THEN v_today - (v_range_days - 1)
      ELSE coalesce(min((reviewed_at AT TIME ZONE v_timezone)::date), v_today)
    END AS start_date
    FROM selected_reviews
  ),
  activity_bounds AS (
    SELECT
      CASE WHEN v_range_days IN (0, 90) THEN date_trunc('week', start_date::timestamp)::date ELSE start_date END AS start_date,
      CASE WHEN v_range_days IN (0, 90) THEN date_trunc('week', v_today::timestamp)::date ELSE v_today END AS end_date,
      CASE WHEN v_range_days IN (0, 90) THEN 7 ELSE 1 END AS step_days
    FROM activity_start
  ),
  activity_series AS (
    SELECT generated::date AS bucket_date
    FROM activity_bounds b
    CROSS JOIN LATERAL generate_series(b.start_date::timestamp, b.end_date::timestamp, make_interval(days => b.step_days)) generated
  ),
  activity_counts AS (
    SELECT
      CASE WHEN v_range_days IN (0, 90)
        THEN date_trunc('week', reviewed_at AT TIME ZONE v_timezone)::date
        ELSE (reviewed_at AT TIME ZONE v_timezone)::date
      END AS bucket_date,
      count(*)::integer AS reviews
    FROM selected_reviews
    GROUP BY 1
  ),
  subject_keys AS (
    SELECT subject FROM selected_reviews UNION SELECT subject FROM backlog_rows
  ),
  subject_metrics AS (
    SELECT
      k.subject,
      count(r.id)::integer AS reviews,
      CASE WHEN count(r.id) = 0 THEN NULL ELSE round(100.0 * count(*) FILTER (WHERE r.rating BETWEEN 2 AND 4) / count(r.id), 1) END AS recall_rate,
      count(DISTINCT r.flashcard_id)::integer AS unique_cards_reviewed,
      (SELECT count(*)::integer FROM backlog_rows b WHERE b.subject = k.subject) AS backlog
    FROM subject_keys k
    LEFT JOIN selected_reviews r ON r.subject = k.subject
    GROUP BY k.subject
  ),
  deck_keys AS (
    SELECT deck_id, deck_name, subject, chapter FROM selected_reviews
    UNION
    SELECT deck_id, deck_name, subject, chapter FROM backlog_rows
  ),
  deck_metrics AS (
    SELECT
      k.deck_id,
      k.deck_name,
      k.subject,
      k.chapter,
      count(r.id)::integer AS reviews,
      CASE WHEN count(r.id) = 0 THEN NULL ELSE round(100.0 * count(*) FILTER (WHERE r.rating BETWEEN 2 AND 4) / count(r.id), 1) END AS recall_rate,
      count(r.id) FILTER (WHERE r.rating NOT BETWEEN 2 AND 4)::integer AS misses,
      count(DISTINCT r.flashcard_id)::integer AS unique_cards_reviewed,
      coalesce(pc.card_count, 0) AS published_cards,
      CASE WHEN coalesce(pc.card_count, 0) = 0 THEN NULL ELSE round(100.0 * count(DISTINCT r.flashcard_id) / pc.card_count, 1) END AS coverage,
      (SELECT count(*)::integer FROM backlog_rows b WHERE b.deck_id = k.deck_id) AS backlog
    FROM deck_keys k
    LEFT JOIN selected_reviews r ON r.deck_id = k.deck_id
    LEFT JOIN published_cards pc ON pc.deck_id = k.deck_id
    GROUP BY k.deck_id, k.deck_name, k.subject, k.chapter, pc.card_count
  )
  SELECT jsonb_build_object(
    'room', (SELECT to_jsonb(r) FROM target_room r),
    'student', (SELECT to_jsonb(s) FROM target_student s),
    'rangeDays', v_range_days,
    'timezone', v_timezone,
    'generatedAt', pg_catalog.now(),
    'summary', jsonb_build_object(
      'reviews', (SELECT count(*) FROM selected_reviews),
      'recallRate', (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE round(100.0 * count(*) FILTER (WHERE rating BETWEEN 2 AND 4) / count(*), 1) END FROM selected_reviews),
      'activeDays', (SELECT count(DISTINCT (reviewed_at AT TIME ZONE v_timezone)::date) FROM selected_reviews),
      'backlog', (SELECT count(*) FROM backlog_rows),
      'focusedTimeMinutes', (SELECT coalesce(round(sum(response_time_ms) FILTER (WHERE response_time_ms BETWEEN 250 AND 300000) / 60000.0, 1), 0) FROM selected_reviews),
      'uniqueCards', (SELECT count(DISTINCT flashcard_id) FROM selected_reviews)
    ),
    'activity', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'date', s.bucket_date,
        'label', to_char(s.bucket_date, 'DD Mon'),
        'reviews', coalesce(c.reviews, 0)
      ) ORDER BY s.bucket_date)
      FROM activity_series s LEFT JOIN activity_counts c USING (bucket_date)
    ), '[]'::jsonb),
    'subjects', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'subject', subject,
        'reviews', reviews,
        'recallRate', recall_rate,
        'uniqueCardsReviewed', unique_cards_reviewed,
        'backlog', backlog
      ) ORDER BY reviews DESC, subject)
      FROM subject_metrics
    ), '[]'::jsonb),
    'decks', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'deckId', deck_id,
        'name', deck_name,
        'subject', subject,
        'chapter', chapter,
        'reviews', reviews,
        'recallRate', recall_rate,
        'misses', misses,
        'backlog', backlog,
        'uniqueCardsReviewed', unique_cards_reviewed,
        'publishedCards', published_cards,
        'coverage', coverage
      ) ORDER BY reviews DESC, deck_name)
      FROM deck_metrics
    ), '[]'::jsonb),
    'strugglingDecks', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'deckId', deck_id,
        'name', deck_name,
        'subject', subject,
        'chapter', chapter,
        'reviews', reviews,
        'recallRate', recall_rate,
        'misses', misses,
        'backlog', backlog,
        'coverage', coverage
      ) ORDER BY recall_rate ASC, backlog DESC, reviews DESC)
      FROM deck_metrics
      WHERE reviews >= 3 AND recall_rate < 70
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.canonical_cramit_subject(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_teacher_class_dashboard(text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_teacher_student_dashboard(text, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_teacher_class_dashboard(text, integer, text) FROM anon;
REVOKE ALL ON FUNCTION public.get_teacher_student_dashboard(text, text, integer, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_teacher_class_dashboard(text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_teacher_student_dashboard(text, text, integer, text) TO authenticated;
