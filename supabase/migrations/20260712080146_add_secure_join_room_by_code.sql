CREATE OR REPLACE FUNCTION public.join_room_by_code(p_code text)
RETURNS TABLE (
  room_id text,
  code text,
  name text,
  description text,
  created_by text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id text := auth.uid()::text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NULLIF(trim(p_code), '') IS NULL THEN
    RAISE EXCEPTION 'A room code is required';
  END IF;

  RETURN QUERY
  WITH room_to_join AS (
    SELECT r.id, r.code, r.name, r.description, r.created_by
    FROM public.rooms AS r
    WHERE upper(r.code) = upper(trim(p_code))
    LIMIT 1
  ), inserted_membership AS (
    INSERT INTO public.room_memberships (id, room_id, user_id, role)
    SELECT gen_random_uuid()::text, r.id, current_user_id, 'student'
    FROM room_to_join AS r
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.room_memberships AS existing_membership
      WHERE existing_membership.room_id = r.id
        AND existing_membership.user_id = current_user_id
    )
    RETURNING room_id
  )
  SELECT r.id, r.code, r.name, r.description, r.created_by
  FROM room_to_join AS r;
END;
$$;

REVOKE ALL ON FUNCTION public.join_room_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_room_by_code(text) TO authenticated;;
