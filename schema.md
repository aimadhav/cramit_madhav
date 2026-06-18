-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id text NOT NULL,
  email text NOT NULL,
  name text,
  phone text,
  is_premium boolean NOT NULL DEFAULT false,
  is_admin boolean NOT NULL DEFAULT false,
  total_cards_studied integer NOT NULL DEFAULT 0,
  total_time_studied integer NOT NULL DEFAULT 0,
  streak_days integer NOT NULL DEFAULT 0,
  last_study_date timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL,
  role USER-DEFINED DEFAULT 'student'::user_role,
  prep_focus text,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.decks (
  id text NOT NULL,
  name text NOT NULL,
  description text,
  tags_json text NOT NULL DEFAULT '[]'::text,
  is_premium boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT true,
  price double precision,
  cover_image text,
  subject text,
  chapter text,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL,
  user_id text NOT NULL,
  version integer DEFAULT 1,
  deleted_at timestamp with time zone,
  prep_category text,
  CONSTRAINT decks_pkey PRIMARY KEY (id),
  CONSTRAINT decks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.flashcards (
  id text NOT NULL,
  front text NOT NULL,
  back text NOT NULL,
  content_type USER-DEFINED NOT NULL DEFAULT 'text'::content_type,
  media_urls_json text NOT NULL DEFAULT '[]'::text,
  tags_json text NOT NULL DEFAULT '[]'::text,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL,
  deck_id text NOT NULL,
  front_content jsonb,
  back_content jsonb,
  starting_stability numeric,
  CONSTRAINT flashcards_pkey PRIMARY KEY (id),
  CONSTRAINT flashcards_deck_id_fkey FOREIGN KEY (deck_id) REFERENCES public.decks(id)
);
CREATE TABLE public.user_flashcard_statuses (
  id text NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  flashcard_id text NOT NULL,
  interval integer NOT NULL DEFAULT 1,
  stability double precision NOT NULL DEFAULT 0.0,
  difficulty double precision NOT NULL DEFAULT 0.0,
  repetitions integer NOT NULL DEFAULT 0,
  due_date timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_reviewed timestamp without time zone,
  is_bookmarked boolean NOT NULL DEFAULT false,
  is_learned boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL,
  notes text,
  CONSTRAINT user_flashcard_statuses_pkey PRIMARY KEY (id),
  CONSTRAINT user_flashcard_statuses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_flashcard_statuses_flashcard_id_fkey FOREIGN KEY (flashcard_id) REFERENCES public.flashcards(id)
);
CREATE TABLE public.study_sessions (
  id text NOT NULL,
  deck_id text NOT NULL,
  user_id text NOT NULL,
  start_time timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time timestamp without time zone,
  cards_studied integer NOT NULL DEFAULT 0,
  cards_correct integer NOT NULL DEFAULT 0,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT study_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT study_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.rooms (
  id text NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  created_by text NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL,
  CONSTRAINT rooms_pkey PRIMARY KEY (id),
  CONSTRAINT rooms_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.room_memberships (
  id text NOT NULL,
  role text NOT NULL DEFAULT 'student'::text,
  joined_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  room_id text NOT NULL,
  user_id text NOT NULL,
  CONSTRAINT room_memberships_pkey PRIMARY KEY (id),
  CONSTRAINT room_memberships_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id),
  CONSTRAINT room_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.room_decks (
  room_id text NOT NULL,
  deck_id text NOT NULL,
  CONSTRAINT room_decks_pkey PRIMARY KEY (room_id, deck_id),
  CONSTRAINT room_decks_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id),
  CONSTRAINT room_decks_deck_id_fkey FOREIGN KEY (deck_id) REFERENCES public.decks(id)
);
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  flashcard_id text NOT NULL,
  user_id text NOT NULL,
  rating integer NOT NULL,
  reviewed_at timestamp with time zone NOT NULL DEFAULT now(),
  response_time_ms integer,
  previous_stability real,
  new_stability real,
  previous_difficulty real,
  new_difficulty real,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id)
);