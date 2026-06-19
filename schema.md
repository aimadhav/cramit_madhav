## Table `users`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `email` | `text` |  |
| `name` | `text` |  Nullable |
| `phone` | `text` |  Nullable |
| `is_premium` | `bool` |  |
| `is_admin` | `bool` |  |
| `total_cards_studied` | `int4` |  |
| `total_time_studied` | `int4` |  |
| `streak_days` | `int4` |  |
| `last_study_date` | `timestamp` |  Nullable |
| `created_at` | `timestamp` |  |
| `updated_at` | `timestamp` |  |
| `role` | `user_role` |  Nullable |
| `prep_focus` | `text` |  Nullable |

## Table `decks`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `tags_json` | `text` |  |
| `is_premium` | `bool` |  |
| `is_public` | `bool` |  |
| `price` | `float8` |  Nullable |
| `cover_image` | `text` |  Nullable |
| `subject` | `text` |  Nullable |
| `chapter` | `text` |  Nullable |
| `created_at` | `timestamp` |  |
| `updated_at` | `timestamp` |  |
| `user_id` | `text` |  |
| `version` | `int4` |  Nullable |
| `deleted_at` | `timestamptz` |  Nullable |
| `prep_category` | `text` |  Nullable |

## Table `flashcards`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `front` | `text` |  |
| `back` | `text` |  |
| `content_type` | `content_type` |  |
| `media_urls_json` | `text` |  |
| `tags_json` | `text` |  |
| `created_at` | `timestamp` |  |
| `updated_at` | `timestamp` |  |
| `deck_id` | `text` |  |
| `front_content` | `jsonb` |  Nullable |
| `back_content` | `jsonb` |  Nullable |
| `starting_stability` | `numeric` |  Nullable |
| `status` | `text` |  Nullable |

## Table `user_flashcard_statuses`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `user_id` | `text` |  |
| `flashcard_id` | `text` |  |
| `interval` | `int4` |  |
| `stability` | `float8` |  |
| `difficulty` | `float8` |  |
| `repetitions` | `int4` |  |
| `due_date` | `timestamp` |  |
| `last_reviewed` | `timestamp` |  Nullable |
| `is_bookmarked` | `bool` |  |
| `is_learned` | `bool` |  |
| `is_deleted` | `bool` |  |
| `created_at` | `timestamp` |  |
| `updated_at` | `timestamp` |  |
| `notes` | `text` |  Nullable |

## Table `study_sessions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `deck_id` | `text` |  |
| `user_id` | `text` |  |
| `start_time` | `timestamp` |  |
| `end_time` | `timestamp` |  Nullable |
| `cards_studied` | `int4` |  |
| `cards_correct` | `int4` |  |
| `created_at` | `timestamp` |  |

## Table `rooms`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `code` | `text` |  |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `created_by` | `text` |  |
| `created_at` | `timestamp` |  |
| `updated_at` | `timestamp` |  |

## Table `room_memberships`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `role` | `text` |  |
| `joined_at` | `timestamp` |  |
| `room_id` | `text` |  |
| `user_id` | `text` |  |

## Table `room_decks`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `room_id` | `text` | Primary |
| `deck_id` | `text` | Primary |

## Table `reviews`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `flashcard_id` | `text` |  |
| `user_id` | `text` |  |
| `rating` | `int4` |  |
| `reviewed_at` | `timestamptz` |  |
| `response_time_ms` | `int4` |  Nullable |
| `previous_stability` | `float4` |  Nullable |
| `new_stability` | `float4` |  Nullable |
| `previous_difficulty` | `float4` |  Nullable |
| `new_difficulty` | `float4` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

