# Database Interactions Review

Here is a detailed breakdown of all Database interactions (Supabase and SQLite/Drizzle) across the application, categorized by their primary function.

### Authentication

**File:** `services/auth-service.ts`
*   **System:** Supabase
*   **Operation:** Standard Email/Password Login
*   **Request Structure:** `{ email: string, password: string }`
*   **Response Structure:** `{ data: { user: User, session: Session }, error: AuthError | null }`
*   **Actionable Improvements:** 
    *   **Rate Limiting:** Add client-side debounce and consider Supabase Edge Functions for IP-based rate limiting to prevent brute-force attacks.
    *   **Error Handling:** Implement a generic error message mapper to avoid exposing raw Supabase errors to the user (e.g., map "Invalid login credentials" to a localized string).

**File:** `services/auth-service.ts`
*   **System:** Supabase
*   **Operation:** Google OAuth Login initiation
*   **Request Structure:** `{ provider: 'google', options: { redirectTo: string, skipBrowserRedirect: boolean } }`
*   **Response Structure:** `{ data: { provider: 'google', url: string }, error: AuthError | null }`
*   **Actionable Improvements:** 
    *   **PKCE Flow:** Ensure PKCE (Proof Key for Code Exchange) is actively configured and enforced for mobile deep-linking security.

**File:** `services/auth-service.ts`
*   **System:** Supabase
*   **Operation:** Setting session after successful OAuth redirect
*   **Request Structure:** `{ access_token: string, refresh_token: string }`
*   **Response Structure:** `{ data: { user: User, session: Session }, error: AuthError | null }`
*   **Actionable Improvements:** 
    *   **Token Validation:** Add fallback logic to redirect the user back to the login screen with a clear message if tokens are expired or malformed.

**File:** `services/auth-service.ts`
*   **System:** Supabase
*   **Operation:** User Signup
*   **Request Structure:** `{ email: string, password: string, options: { data: { name?: string, prep_focus?: string } } }`
*   **Response Structure:** `{ data: { user: User | null, session: Session | null }, error: AuthError | null }`
*   **Actionable Improvements:** 
    *   **Pre-validation:** Add Zod schema validation on the client for password strength (e.g., 8+ chars, numbers) and email regex before making the network request.

---

### Fetching Data

**File:** `app/(tabs)/stats.tsx`
*   **System:** SQLite (Drizzle)
*   **Operation:** Counting total reviews for the user
*   **Request Structure:** `userId: string` (in WHERE clause)
*   **Response Structure:** `Array<{ value: number }>`
*   **Actionable Improvements:** 
    *   **Indexing:** Create a B-Tree index on `reviews(userId)` in the SQLite schema.
    *   **State Management:** Cache this total count in Zustand/Redux and increment locally on new reviews instead of re-querying the DB on every render.

**File:** `app/(tabs)/stats.tsx`
*   **System:** SQLite (Drizzle)
*   **Operation:** Counting unique flashcards reviewed by the user
*   **Request Structure:** `userId: string` (in WHERE clause)
*   **Response Structure:** `Array<{ value: number }>`
*   **Actionable Improvements:** 
    *   **Indexing:** Add a composite index on `userFlashcardStatus(userId, flashcardId)`.

**File:** `app/(tabs)/stats.tsx`
*   **System:** Supabase
*   **Operation:** Fetching room information by 6-character join code
*   **Request Structure:** `joinCode: string` (in `.eq('code', joinCode)`)
*   **Response Structure:** `{ data: RoomObject | null, error: PostgrestError | null }`
*   **Actionable Improvements:** 
    *   **Indexing:** Add a UNIQUE index on the `code` column in the Supabase `rooms` table for fast O(1) lookups.
    *   **Sanitization:** Ensure `joinCode` is trimmed and uppercase-normalized before querying.

**File:** `services/database-service.ts`
*   **System:** SQLite (Drizzle)
*   **Operation:** Fetching all non-deleted decks (ordered by update time)
*   **Request Structure:** `None`
*   **Response Structure:** `Array<DeckObject>`
*   **Actionable Improvements:** 
    *   **Pagination:** Implement `LIMIT` and `OFFSET` if the application scales to users with hundreds of decks.
    *   **Indexing:** Add a composite index on `decks(deletedAt, updatedAt)`.

**File:** `services/database-service.ts`
*   **System:** SQLite (Drizzle)
*   **Operation:** Fetching cards mapped to a specific deck
*   **Request Structure:** `deckId: string`
*   **Response Structure:** `Array<FlashcardObject>`
*   **Actionable Improvements:** 
    *   **Indexing:** Ensure a foreign key index exists on `flashcards(deckId)`.

**File:** `services/database-service.ts`
*   **System:** SQLite (Drizzle)
*   **Operation:** Fetching user's due/reviewed card statuses to calculate deck stats
*   **Request Structure:** `userId: string, now: number`
*   **Response Structure:** `Array<UserFlashcardStatusObject>`
*   **Actionable Improvements:** 
    *   **Query Optimization:** Instead of fetching full status objects, use a SQL aggregation: `SELECT count(*), status FROM userFlashcardStatus WHERE userId = ? GROUP BY status`. This vastly reduces memory overhead.

**File:** `services/database-service.ts`
*   **System:** SQLite (Drizzle)
*   **Operation:** Fetching a deck's cards along with user statuses via Left Join
*   **Request Structure:** `deckId: string, userId: string`
*   **Response Structure:** `Array<{ card: FlashcardObject, status: UserFlashcardStatusObject | null }>`
*   **Actionable Improvements:** 
    *   **Indexing:** Ensure an index exists on `userFlashcardStatus(userId, flashcardId)` to speed up the join.

**File:** `services/sync-service.ts`
*   **System:** Supabase
*   **Operation:** Pulling cloud card statuses to mirror locally (Stage A Sync)
*   **Request Structure:** `userId: string`
*   **Response Structure:** `{ data: Array<CloudStatusObject>, error: PostgrestError | null }`
*   **Actionable Improvements:** 
    *   **Delta Sync:** Add a `last_sync_timestamp` to the request and append `.gt('updated_at', last_sync_timestamp)` to pull only changes, reducing payload size.

**File:** `services/sync-service.ts`
*   **System:** Supabase
*   **Operation:** Pulling public library deck metadata (Stage B Sync)
*   **Request Structure:** `None`
*   **Response Structure:** `{ data: Array<CloudDeckObject>, error: PostgrestError | null }`
*   **Actionable Improvements:** 
    *   **Filtering:** Add `.eq('is_public', true)` and pagination (`.range(0, 50)`) to the query to avoid loading private or excessive data.

**File:** `services/sync-service.ts`
*   **System:** Supabase
*   **Operation:** Fetching full cards & specific deck metadata (Stage C Sync)
*   **Request Structure:** `deckId: string`
*   **Response Structure:** `{ cards: Array<CloudFlashcard>, deck: CloudDeckObject }`
*   **Actionable Improvements:** 
    *   **Query Combining:** Use Supabase's foreign table routing: `supabase.from('decks').select('*, flashcards(*)').eq('id', deckId)` to fetch the deck and its cards in a single network roundtrip.

---

### Storing Data (Inserts & Updates)

**File:** `app/(tabs)/stats.tsx`
*   **System:** SQLite (Drizzle)
*   **Operation:** Saving room data locally after joining it
*   **Request Structure:** `RoomObject`
*   **Response Structure:** `void`
*   **Actionable Improvements:** 
    *   **Conflict Handling:** Use `.onConflictDoNothing()` or `.onConflictDoUpdate()` in Drizzle to prevent SQLite `UNIQUE constraint failed` crashes if the room is already locally cached.

**File:** `services/database-service.ts`
*   **System:** SQLite (Drizzle)
*   **Operation:** Upserting deck metadata (from sync or default data)
*   **Request Structure:** `DeckObject`
*   **Response Structure:** `deckId: string`
*   **Actionable Improvements:** 
    *   **Transactions:** Wrap the deck upsert and associated flashcard upserts inside a `db.transaction(tx => { ... })` block.

**File:** `services/database-service.ts`
*   **System:** SQLite (Drizzle)
*   **Operation:** Upserting flashcards mapping to a deck
*   **Request Structure:** `Array<FlashcardObject>`
*   **Response Structure:** `void`
*   **Actionable Improvements:** 
    *   **Batching:** Do NOT loop `db.insert()`. Pass the entire array: `db.insert(flashcards).values(flashcardsArray).onConflictDoUpdate(...)`.

**File:** `services/database-service.ts`
*   **System:** SQLite (Drizzle)
*   **Operation:** Saving review history logs
*   **Request Structure:** `ReviewDataObject`
*   **Response Structure:** `void`
*   **Actionable Improvements:** 
    *   **Transactions:** Wrap the `insert(reviews)` and the `upsert(userFlashcardStatus)` in a SQLite transaction to avoid orphaned review logs if the status update fails.

**File:** `services/database-service.ts`
*   **System:** SQLite (Drizzle)
*   **Operation:** Toggling bookmark status & updating personal card notes
*   **Request Structure:** `{ cardId: string, userId: string, isBookmarked?: boolean, notes?: string }`
*   **Response Structure:** `void`
*   **Actionable Improvements:** 
    *   **Targeted Updates:** Use a simple `db.update().set({...}).where(...)` if the status row is known to exist, avoiding the overhead of upsert checks.

**File:** `services/sync-service.ts`
*   **System:** Supabase
*   **Operation:** Upserting user card status up to the cloud from local changes
*   **Request Structure:** `Array<CloudStatusObject>`
*   **Response Structure:** `{ error: PostgrestError | null }`
*   **Actionable Improvements:** 
    *   **Batch Requests:** Accumulate all pending statuses in an array and run a single `supabase.from('statuses').upsert(statusArray)` call to prevent network spam.

**File:** `services/sync-service.ts`
*   **System:** SQLite (Drizzle)
*   **Operation:** Mirroring pulled cloud statuses down to local SQLite
*   **Request Structure:** `Array<CloudStatusObject>`
*   **Response Structure:** `void`
*   **Actionable Improvements:** 
    *   **Batching:** Insert the data using `db.insert(...).values(array).onConflictDoUpdate(...)` instead of looping through individual inserts.

---

### Syncing & Queue Management

**File:** `services/database-service.ts`
*   **System:** SQLite (Drizzle)
*   **Operation:** Adding local operations (CREATE/UPDATE/DELETE/REVIEW) to the local Sync Queue
*   **Request Structure:** `{ operation: string, entityType: string, entityId: string, payload: any }`
*   **Response Structure:** `void`
*   **Actionable Improvements:** 
    *   **Strong Typing:** Use a discriminated union type for `payload` based on `entityType` and `operation` instead of `any`, ensuring schema consistency upon dequeue.

**File:** `services/sync-service.ts`
*   **System:** SQLite (Drizzle)
*   **Operation:** Fetching pending tasks from the sync queue for pushing to cloud
*   **Request Structure:** `{ limit: 50 }`
*   **Response Structure:** `Array<SyncQueueObject>`
*   **Actionable Improvements:** 
    *   **Indexing:** Create a composite index on `syncQueue(status, createdAt)` to guarantee fast reads for `WHERE status = 'pending' ORDER BY createdAt ASC`.

**File:** `services/sync-service.ts`
*   **System:** SQLite (Drizzle)
*   **Operation:** Updating queue status locally to "synced" or "failed_on_server"
*   **Request Structure:** `{ taskIds: Array<string>, status: string }`
*   **Response Structure:** `void`
*   **Actionable Improvements:** 
    *   **Batch Updates:** Pass an array of IDs and use the `inArray` Drizzle operator: `db.update(syncQueue).set({ status }).where(inArray(syncQueue.id, taskIds))`.

---

### Deleting Data

**File:** `store/flashcard-store.ts`
*   **System:** SQLite (Drizzle)
*   **Operation:** Resetting all learning progress locally
*   **Request Structure:** `{ userId: string }`
*   **Response Structure:** `void`
*   **Actionable Improvements:** 
    *   **Transactions & Cascades:** Execute the deletion of statuses and reviews within a transaction. Verify that SQLite `PRAGMA foreign_keys = ON;` is active to utilize `ON DELETE CASCADE` appropriately.