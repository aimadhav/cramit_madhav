# Supabase Database Tasks (T2, T3)

This file tracks the remaining Database & Supabase schema actions needed before public launch of the MVP.

---

## 📅 Tier 2: Class & Room Feature Loophole Closures (High Priority)

These tasks must be implemented as you finish building out the Class and Teacher/Student Room features to prevent deadlocks, phantom students, and RLS locking.

### ⬜ 1. Complete Cloud Room Membership Write (`stats.tsx`)
*   **The Problem**: Currently, when a student joins a class, the membership row is inserted *only* locally into SQLite. The Supabase `room_memberships` table never hears about it! This means the student is invisible to the teacher portal and won't sync to new devices.
*   **Action Needed**: Update your room-joining function inside the app to execute a Supabase insert write to `public.room_memberships` upon matching the code.

### ⬜ 2. Implement the `join_room_by_code` SECURITY DEFINER RPC
*   **The Problem**: If Row Level Security (RLS) is enabled on the `rooms` table, a student who is *not yet a member* cannot select or discover the room by its 6-character code (since RLS hides non-membership rooms).
*   **Action Needed**: Create a `SECURITY DEFINER` SQL function inside your Supabase editor. It bypasses RLS safely inside the server, validates the 6-character code, creates the membership row, and returns the room ID.
*   **SQL Code to run on Supabase**:
    ```sql
    CREATE OR REPLACE FUNCTION public.join_room_by_code(room_code text, student_id text)
    RETURNS text SECURITY DEFINER AS $$
    DECLARE
      target_room_id text;
    BEGIN
      -- 1. Find the room by code
      SELECT id INTO target_room_id FROM public.rooms WHERE code = room_code LIMIT 1;
      IF target_room_id IS NULL THEN
        RAISE EXCEPTION 'Invalid room code.';
      END IF;

      -- 2. Create membership safely (with ON CONFLICT protection)
      INSERT INTO public.room_memberships (id, room_id, user_id, role)
      VALUES (gen_random_uuid()::text, target_room_id, student_id, 'student')
      ON CONFLICT (room_id, user_id) DO NOTHING;

      RETURN target_room_id;
    END;
    $$ LANGUAGE plpgsql;
    ```
*   **Client Code**: Call the function from the app like this:
    ```tsx
    const { data: roomId, error } = await supabase.rpc('join_room_by_code', {
      room_code: joinCode,
      student_id: userId
    });
    ```

### ⬜ 3. Add Foreign Key on `reviews` Table (Orphan Vulnerability)
*   **The Problem**: The `reviews` table currently has zero constraints linking it to users or flashcards. Deleting a user or card will leave reviews orphaned, bloating the cloud storage.
*   **SQL Code to run on Supabase**:
    ```sql
    ALTER TABLE public.reviews 
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    ADD CONSTRAINT reviews_flashcard_id_fkey FOREIGN KEY (flashcard_id) REFERENCES public.flashcards(id) ON DELETE CASCADE;
    ```

---

## 📅 Tier 3: Client Resilience & Optimization (Medium-Low Priority)

These tasks are for performance optimization and cell-network resilience.

### ⬜ 4. Remove Redundancy on `public.flashcards` (Storage Saving)
*   **The Problem**: Storing content twice (`front`/`back` text AND `front_content`/`back_content` jsonb) is doubling database sizes.
*   **Action Needed**: Drop the redundant plain `front` and `back` columns from the Supabase `flashcards` table and rely strictly on the `front_content` and `back_content` `jsonb` fields since the client already loads those!

### ⬜ 5. Force Image Pre-Caching on Deck Downloads
*   **The Problem**: If a student loads a chapter and goes offline immediately, some images might show up broken because remote `http://` URLs were never cached.
*   **Action Needed**: Update your chapter-loading button to automatically run `SyncService.cacheDeckImages(deckId)` inside a background task immediately upon completing a cards metadata download.

### ⬜ 6. Standardize Timezones to Epoch Milliseconds (TIMESTAMPTZ)
*   **The Problem**: `timestamp without time zone` columns cause cards to shift due dates depending on regional timezone offsets of the user's device.
*   **Action Needed**: Convert all due dates and last reviewed columns to **`bigint`** (representing epoch milliseconds) or **`timestamp with time zone` (TIMESTAMPTZ)** to ensure uniform spaced-repetition scheduling worldwide.
