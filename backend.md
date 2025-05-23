# Backend Development Plan & Status

This document outlines the development plan, current status, and key decisions made for the backend of the CramItFinal application.

## Current Objective:
Implement a hybrid model for managing shared and user-specific flashcards and decks. This includes:
- Modifying the Prisma schema to support shared flashcards, user-created decks, and user-specific metadata for progress tracking.
- Creating tRPC API endpoints for managing decks and flashcards (CRUD operations, progress tracking).

## Schema Evolution & Key Decisions:

### Initial Schema (and what was removed/changed):
- **Flashcard Model (Old):**
    - Initially, the `Flashcard` model contained all Spaced Repetition System (SRS) fields directly (e.g., `interval`, `easeFactor`, `dueDate`, `isBookmarked`). This was suitable for a simple, single-user or non-shared card system.
    - **Removed Fields:** `interval`, `easeFactor`, `repetitions`, `dueDate`, `lastReviewed`, `isBookmarked`.
- **Deck Model (Old - `isPublic` field):**
    - The `Deck` model previously had an `isPublic` field. This was removed because the current schema version (as of 2025-05-23, after schema review) did not include it. If public/private decks are needed again, this field will need to be re-added to `prisma.schema.prisma`, followed by a migration.
    - The foreign key to `User` was confirmed to be `userId` and the relation `user` (not `creatorId`/`creator` as initially assumed in some router code).

### Current Schema (Hybrid Model - Implemented 2025-05-23, `isPublic` added to Deck YYYY-MM-DD_New):
- **User Model:**
    - Added `flashcardStatuses: UserFlashcardStatus[]` relation.
- **Flashcard Model:**
    - SRS fields were **removed**.
    - Added `userStatuses: UserFlashcardStatus[]` relation.
    - This model now represents the core, potentially shareable content of a flashcard.
- **UserFlashcardStatus Model (NEW):**
    - Links a `User` and a `Flashcard`.
    - Contains all user-specific SRS fields: `interval`, `easeFactor`, `repetitions`, `dueDate`, `lastReviewed`.
    - Contains user-specific metadata: `isBookmarked`, `isLearned`, `isDeleted` (soft delete).
    - This model is crucial for tracking individual user progress on any given flashcard.
- **Deck Model:**
    - Uses `userId` to link to the `User` model (creator).
    - Added `isPublic: Boolean @default(false) @index` field (as of YYYY-MM-DD_New) to enable deck sharing.

## tRPC API Routers:

### 1. `authRouter` (`backend/trpc/routes/auth/router.ts`)
- **Status:** Implemented.
- **Functionality:** Handles user authentication (login, signup - likely using Supabase Auth context).
- **Key Procedures:**
    - `login`
    - `signup`
    - `getSecretMessage` (example protected procedure)

### 2. `deckRouter` (`backend/trpc/routes/deck.router.ts`)
- **Status:** Implemented and refactored. Enhanced with sharing features.
- **Functionality:** Manages decks (CRUD operations, sharing).
- **Key Procedures:**
    - `listPublic`: Lists decks explicitly marked with `isPublic: true`. Includes pagination and basic filtering.
    - `listUserDecks`: Lists decks created by the authenticated user. Includes pagination.
    - `create`: Creates a new deck for the authenticated user. Decks are created as private (`isPublic: false`) by default. Users cannot set `isPublic` via this endpoint. **Public deck creation is handled by `adminRouter`.**
    - `getById`: Fetches a single deck by ID, including its flashcards and creator (user) info.
    - `update`: Updates a deck owned by the authenticated user. Users cannot change `isPublic` status via this endpoint. **Updating `isPublic` status is handled by `adminRouter`.**
    - `delete`: Deletes a deck owned by the authenticated user. **Deleting any deck (including public ones) can also be done via `adminRouter`.**
    - `studyPublicDeck` (NEW): Allows a user to "add" a public deck to their study list by creating `UserFlashcardStatus` entries for its flashcards.
- **Schema Alignment:**
    - Uses `userId` and `user` relation.
    - `isPublic` field now utilized for sharing logic. **Making decks public, and managing them, is an admin-level action via `adminRouter`.**

### 3. `flashcardRouter` (`backend/trpc/routes/flashcards/router.ts`)
- **Status:** Core CRUD and SRS features implemented. Enhanced for shared content interaction.
- **Functionality:** Manages flashcards within decks and their user-specific statuses, including copy-on-edit for shared cards.
- **Key Procedures Implemented:**
    - `create`: Creates a new flashcard within a user-owned deck and its initial `UserFlashcardStatus`. **Creating flashcards for public/admin-managed decks is handled by `adminRouter`.**
    - `listByDeck`: Lists all flashcards for a given `deckId`, includes user-specific status if user is logged in. Implements pagination and tag filtering. Checks for deck existence.
    - `getById`: Fetches a single flashcard by ID, includes user-specific status if user is logged in.
    - `updateUserStatus`: A `protectedProcedure` to update SRS data (`interval`, `easeFactor`, etc.), `isBookmarked`, `isLearned`, `isDeleted` in the `UserFlashcardStatus` table.
    - `getDueFlashcardsForUser`: Fetches flashcards due for review for the authenticated user from their `UserFlashcardStatus` records.
    - `updateContent` (NEW): Allows updating flashcard content. Implements "copy-on-edit" logic. **Directly editing flashcards in any deck (especially public ones) without copy-on-edit is handled by `adminRouter`.**
    - `delete`: Deletes a flashcard. (Consideration: implications for `UserFlashcardStatus` entries). **Deleting any flashcard (including from public/admin-managed decks) can also be done via `adminRouter`.**
- **Procedures Removed (from mock implementation, re-added with Prisma & new schema):**
    - `getDecks`: Moved to `deckRouter`.
    - `getDeckById`: Moved to `deckRouter`.
- **Pending Procedures (based on new schema):**
    - `delete`: Deletes a flashcard. (Consideration: implications for `UserFlashcardStatus` entries, especially if it's a user's personal copy of a previously public card).

### 4. `adminRouter` (`backend/trpc/routers/adminRouter.ts`) (NEW SECTION)
- **Status:** Implemented.
- **Functionality:** Manages administrative tasks, including global content management.
- **Protection:** All procedures use `adminProcedure` to ensure only admin users can access them.
- **Key Procedures:**
    - `listUsers`: (Example) Lists all users in the system.
    - `adminCreateDeck`: Allows an admin to create a new deck and set its `name`, `description`, and `isPublic` status. The deck is associated with the admin user.
    - `adminUpdateDeck`: Allows an admin to update any deck's `name`, `description`, and `isPublic` status.
    - `adminDeleteDeck`: Allows an admin to delete any deck.
    - `adminCreateFlashcard`: Allows an admin to create a new flashcard in any specified `deckId`, providing `front`, `back`, and `contentType`.
    - `adminUpdateFlashcard`: Allows an admin to update any flashcard's `front`, `back`, `contentType`, or change its `deckId`.
    - `adminDeleteFlashcard`: Allows an admin to delete any flashcard.

## Next Steps (Immediate):
1.  ~~**Apply Schema Changes:**~~ (Completed for UserFlashcardStatus and `isPublic` on Deck)
    - ~~Run `npx prisma migrate dev --name update_flashcard_srs_model` (or similar).~~
    - ~~Run `npx prisma generate`.~~
2.  ~~**Implement `flashcard.create`:**~~ (Completed)
3.  ~~**Implement `flashcard.updateUserStatus`:**~~ (Completed)
4.  **Implement `flashcard.delete`**: With careful consideration for shared vs. personal copies.
5.  ~~**Enhance `deckRouter.create` and `deckRouter.update`**: To allow users to set the `isPublic` flag on their decks.~~ (Decision: Users will not set this. Public decks are admin-curated.)

## Future Considerations / To Be Discussed:
- **Testing:** Develop a comprehensive testing strategy for all API routers, with a particular focus on writing integration tests for the `adminRouter` to ensure its procedures and authorization logic are correct and robust. *(Refer to `admin_panel_guide.md` for detailed testing guidance)*.
- **Shared Decks/Flashcards:** Implemented via `isPublic` flag on Decks (admin-set) and `deckRouter.studyPublicDeck`. Users "add" by linking via `UserFlashcardStatus`.
- **Editing Shared Flashcards:** Implemented via "copy-on-edit" in `flashcardRouter.updateContent`. User edits on shared cards result in a personal copy.
- **Soft Deletes:** `isDeleted` in `UserFlashcardStatus` is used. `updateContent` (copy-on-edit) soft-deletes the old status. `getDueFlashcardsForUser` and status fetching in `listByDeck`/`getById` filter out deleted statuses. Needs consistent frontend handling.
- **Error Handling & Validation:** Robust input validation (Zod) and error handling (TRPCError) across all procedures.
- **Pagination & Filtering:** Implement for all list procedures.

This document should be updated as development progresses.
(Please replace YYYY-MM-DD_New with today's date when you review this)
