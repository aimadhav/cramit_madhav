-- Room access model:
--   * internal admins, or paid teachers (role=teacher + is_premium), own rooms;
--   * students join only through join_room_by_code and always receive student role;
--   * students can see their own membership and basic room metadata;
--   * only the active room owner can list members or read student statistics.

CREATE OR REPLACE FUNCTION public.can_user_manage_rooms(p_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users AS u
    WHERE u.id = p_user_id
      AND (
        u.is_admin = true
        OR (u.role::text = 'teacher' AND u.is_premium = true)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_room_owner(p_room_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rooms AS r
    WHERE r.id = p_room_id
      AND r.created_by = auth.uid()::text
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_room_student(p_room_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.room_memberships AS m
    JOIN public.rooms AS r ON r.id = m.room_id
    WHERE m.room_id = p_room_id
      AND m.user_id = auth.uid()::text
      AND m.role = 'student'
      AND public.can_user_manage_rooms(r.created_by)
  );
$$;

REVOKE ALL ON FUNCTION public.can_user_manage_rooms(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_room_owner(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_room_student(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_user_manage_rooms(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_room_owner(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_room_student(text) TO authenticated;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_decks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rooms_select_member ON public.rooms;
DROP POLICY IF EXISTS rooms_insert_self ON public.rooms;
DROP POLICY IF EXISTS rooms_update_creator ON public.rooms;
DROP POLICY IF EXISTS rooms_delete_creator ON public.rooms;

CREATE POLICY rooms_select_authorized
ON public.rooms
FOR SELECT
TO authenticated
USING (
  (
    public.is_room_owner(id)
    AND public.can_user_manage_rooms(auth.uid()::text)
  )
  OR public.is_active_room_student(id)
);

CREATE POLICY rooms_insert_subscribed_teacher
ON public.rooms
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()::text
  AND public.can_user_manage_rooms(auth.uid()::text)
);

CREATE POLICY rooms_update_subscribed_teacher
ON public.rooms
FOR UPDATE
TO authenticated
USING (
  public.is_room_owner(id)
  AND public.can_user_manage_rooms(auth.uid()::text)
)
WITH CHECK (
  created_by = auth.uid()::text
  AND public.can_user_manage_rooms(auth.uid()::text)
);

CREATE POLICY rooms_delete_owner
ON public.rooms
FOR DELETE
TO authenticated
USING (public.is_room_owner(id));

DROP POLICY IF EXISTS memberships_select ON public.room_memberships;
DROP POLICY IF EXISTS memberships_insert_self ON public.room_memberships;
DROP POLICY IF EXISTS memberships_delete ON public.room_memberships;

CREATE POLICY memberships_select_self_or_owner
ON public.room_memberships
FOR SELECT
TO authenticated
USING (
  (
    user_id = auth.uid()::text
    AND role = 'student'
    AND public.is_active_room_student(room_id)
  )
  OR (
    public.is_room_owner(room_id)
    AND public.can_user_manage_rooms(auth.uid()::text)
  )
);

CREATE POLICY memberships_delete_self_or_owner
ON public.room_memberships
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()::text
  OR public.is_room_owner(room_id)
);

DROP POLICY IF EXISTS room_decks_select_member ON public.room_decks;
DROP POLICY IF EXISTS room_decks_insert_creator ON public.room_decks;
DROP POLICY IF EXISTS room_decks_delete_creator ON public.room_decks;

CREATE POLICY room_decks_select_authorized
ON public.room_decks
FOR SELECT
TO authenticated
USING (
  (
    public.is_room_owner(room_id)
    AND public.can_user_manage_rooms(auth.uid()::text)
  )
  OR public.is_active_room_student(room_id)
);

CREATE POLICY room_decks_insert_owner
ON public.room_decks
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_room_owner(room_id)
  AND public.can_user_manage_rooms(auth.uid()::text)
);

CREATE POLICY room_decks_delete_owner
ON public.room_decks
FOR DELETE
TO authenticated
USING (
  public.is_room_owner(room_id)
  AND public.can_user_manage_rooms(auth.uid()::text)
);

-- Remove broad grants inherited from the original prototype. Room creation and
-- membership insertion happen through the guarded functions below.
REVOKE ALL ON TABLE public.rooms FROM anon, authenticated;
REVOKE ALL ON TABLE public.room_memberships FROM anon, authenticated;
REVOKE ALL ON TABLE public.room_decks FROM anon, authenticated;

GRANT SELECT, UPDATE, DELETE ON TABLE public.rooms TO authenticated;
GRANT SELECT, DELETE ON TABLE public.room_memberships TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.room_decks TO authenticated;

CREATE OR REPLACE FUNCTION public.create_teacher_room(
  p_name text,
  p_description text DEFAULT NULL
)
RETURNS TABLE(room_id text, code text, name text, description text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id text := auth.uid()::text;
  generated_room_id text;
  generated_code text;
  attempt integer;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.can_user_manage_rooms(current_user_id) THEN
    RAISE EXCEPTION 'An active teacher subscription is required';
  END IF;

  IF length(trim(coalesce(p_name, ''))) < 3 THEN
    RAISE EXCEPTION 'Class name must be at least 3 characters';
  END IF;

  FOR attempt IN 1..10 LOOP
    generated_room_id := gen_random_uuid()::text;
    generated_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    BEGIN
      INSERT INTO public.rooms (
        id,
        code,
        name,
        description,
        created_by,
        created_at,
        updated_at
      ) VALUES (
        generated_room_id,
        generated_code,
        trim(p_name),
        nullif(trim(coalesce(p_description, '')), ''),
        current_user_id,
        now(),
        now()
      );
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 10 THEN
        RAISE EXCEPTION 'Could not generate a unique room code';
      END IF;
    END;
  END LOOP;

  INSERT INTO public.room_memberships (id, room_id, user_id, role, joined_at)
  VALUES (gen_random_uuid()::text, generated_room_id, current_user_id, 'teacher', now())
  ON CONFLICT ON CONSTRAINT unique_room_user DO UPDATE
  SET role = 'teacher';

  RETURN QUERY
  SELECT generated_room_id, generated_code, trim(p_name), nullif(trim(coalesce(p_description, '')), '');
END;
$$;

CREATE OR REPLACE FUNCTION public.join_room_by_code(p_code text)
RETURNS TABLE(room_id text, code text, name text, description text, created_by text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id text := auth.uid()::text;
  target_room public.rooms%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NULLIF(trim(p_code), '') IS NULL THEN
    RAISE EXCEPTION 'A room code is required';
  END IF;

  SELECT r.*
  INTO target_room
  FROM public.rooms AS r
  WHERE upper(r.code) = upper(trim(p_code))
    AND public.can_user_manage_rooms(r.created_by)
  LIMIT 1;

  IF target_room.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or inactive room code';
  END IF;

  IF target_room.created_by = current_user_id THEN
    RAISE EXCEPTION 'You already own this class';
  END IF;

  INSERT INTO public.room_memberships (id, room_id, user_id, role, joined_at)
  VALUES (gen_random_uuid()::text, target_room.id, current_user_id, 'student', now())
  ON CONFLICT ON CONSTRAINT unique_room_user DO UPDATE
  SET role = 'student';

  RETURN QUERY
  SELECT
    target_room.id,
    target_room.code,
    target_room.name,
    target_room.description,
    target_room.created_by;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_rooms()
RETURNS TABLE(room_id text, name text, role text, member_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.name,
    CASE WHEN r.created_by = auth.uid()::text THEN 'teacher' ELSE 'student' END,
    (
      SELECT count(*)
      FROM public.room_memberships AS all_members
      WHERE all_members.room_id = r.id
        AND all_members.role = 'student'
    )
  FROM public.rooms AS r
  LEFT JOIN public.room_memberships AS own_membership
    ON own_membership.room_id = r.id
   AND own_membership.user_id = auth.uid()::text
   AND own_membership.role = 'student'
  WHERE
    (
      r.created_by = auth.uid()::text
      AND public.can_user_manage_rooms(auth.uid()::text)
    )
    OR (
      own_membership.user_id IS NOT NULL
      AND public.can_user_manage_rooms(r.created_by)
    )
  ORDER BY r.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_room_student_stats(p_room_id text)
RETURNS TABLE(
  student_id text,
  email text,
  name text,
  streak_days integer,
  total_cards_studied integer,
  total_time_studied integer,
  last_study_date timestamp without time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_room_owner(p_room_id)
     OR NOT public.can_user_manage_rooms(auth.uid()::text) THEN
    RAISE EXCEPTION 'Only the active room teacher can view student statistics';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email,
    u.name,
    coalesce(u.streak_days, 0),
    coalesce(u.total_cards_studied, 0),
    coalesce(u.total_time_studied, 0),
    u.last_study_date
  FROM public.room_memberships AS m
  JOIN public.users AS u ON u.id = m.user_id
  WHERE m.room_id = p_room_id
    AND m.role = 'student'
  ORDER BY coalesce(u.name, u.email), u.id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_teacher_room(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_room_by_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_rooms() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_room_student_stats(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_teacher_room(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_room_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_rooms() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_room_student_stats(text) TO authenticated;
