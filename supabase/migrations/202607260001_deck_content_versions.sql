-- Keep deck.version as the content version consumed by mobile clients.
-- Any flashcard insert/update/delete makes an installed copy eligible for a
-- targeted content refresh. This is intentionally additive and idempotent.

CREATE OR REPLACE FUNCTION public.bump_deck_content_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_deck_id text;
BEGIN
  affected_deck_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.deck_id ELSE NEW.deck_id END;

  UPDATE public.decks
  SET version = COALESCE(version, 1) + 1,
      updated_at = now()
  WHERE id = affected_deck_id;

  -- A card moved between decks must invalidate both copies.
  IF TG_OP = 'UPDATE' AND OLD.deck_id IS DISTINCT FROM NEW.deck_id THEN
    UPDATE public.decks
    SET version = COALESCE(version, 1) + 1,
        updated_at = now()
    WHERE id = OLD.deck_id;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS flashcards_bump_deck_content_version ON public.flashcards;

CREATE TRIGGER flashcards_bump_deck_content_version
AFTER INSERT OR UPDATE OR DELETE ON public.flashcards
FOR EACH ROW
EXECUTE FUNCTION public.bump_deck_content_version();

REVOKE ALL ON FUNCTION public.bump_deck_content_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_deck_content_version() TO authenticated, service_role;
