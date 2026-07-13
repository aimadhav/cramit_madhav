-- Users may update their own study/profile fields through RLS, but must never
-- be able to promote themselves or grant themselves premium access.
REVOKE INSERT, UPDATE ON TABLE public.users FROM anon, authenticated;

GRANT INSERT (id, email, name, phone, updated_at, prep_focus)
ON TABLE public.users TO authenticated;

GRANT UPDATE (
  id,
  email,
  name,
  phone,
  total_cards_studied,
  total_time_studied,
  streak_days,
  last_study_date,
  updated_at,
  prep_focus
)
ON TABLE public.users TO authenticated;
