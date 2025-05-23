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
    - The `Deck` model previously had an `isPublic` field. This was removed because the current schema version (as of YYYY-MM-DD, after schema review) did not include it. If public/private decks are needed again, this field will need to be re-added to `prisma.schema.prisma`, followed by a migration.
    - The foreign key to `User` was confirmed to be `userId` and the relation `user` (not `creatorId`/`creator` as initially assumed in some router code).

### Current Schema (Hybrid Model - Implemented YYYY-MM-DD):
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
    - Does **not** currently have an `isPublic` field.

## tRPC API Routers:

### 1. `authRouter` (`backend/trpc/routes/auth/router.ts`)
- **Status:** Implemented.
- **Functionality:** Handles user authentication (login, signup - likely using Supabase Auth context).
- **Key Procedures:**
    - `login`
    - `signup`
    - `getSecretMessage` (example protected procedure)

### 2. `deckRouter` (`backend/trpc/routes/deck.router.ts`)
- **Status:** Implemented and refactored.
- **Functionality:** Manages decks (CRUD operations).
- **Key Procedures:**
    - `listPublic`: Currently lists all decks as `isPublic` field is not in schema. (Previously named `listAll`).
    - `listUserDecks`: Lists decks created by the authenticated user.
    - `create`: Creates a new deck for the authenticated user.
    - `getById`: Fetches a single deck by ID, including its flashcards and creator (user) info.
    - `update`: Updates a deck owned by the authenticated user.
    - `delete`: Deletes a deck owned by the authenticated user. (Note: Cascading deletes for flashcards and user statuses need careful consideration and testing based on Prisma schema relations).
- **Schema Alignment:**
    - Uses `userId` and `user` relation (not `creatorId`/`creator`).
    - `isPublic` logic was removed to match the current schema. If re-added to schema, router needs update.

### 3. `flashcardRouter` (`backend/trpc/routes/flashcards/router.ts`)
- **Status:** Partially refactored from mock data; `create` procedure pending implementation based on new schema.
- **Functionality:** Manages flashcards within decks and their user-specific statuses.
- **Key Procedures Implemented (Basic):**
    - `listByDeck`: Lists all flashcards for a given `deckId`. (TODO: Enhance to include user-specific status if user is logged in).
    - `getById`: Fetches a single flashcard by ID. (TODO: Enhance to include user-specific status if user is logged in).
- **Procedures Removed (from mock implementation, to be re-added with Prisma & new schema):**
    - `getDecks`: Moved to `deckRouter`.
    - `getDeckById`: Moved to `deckRouter`.
    - `getDueFlashcards`: To be re-implemented as a `protectedProcedure` using `UserFlashcardStatus`.
- **Pending Procedures (based on new schema):**
    - `create`: (Next to implement) Creates a new flashcard within a deck, and simultaneously creates its initial `UserFlashcardStatus` for the creator.
    - `update`: Updates a flashcard. (Consideration: if a card is shared, does editing create a copy for the user, or can only original creators edit shared base cards?)
    - `delete`: Deletes a flashcard. (Consideration: implications for `UserFlashcardStatus` entries).
    - `updateUserStatus`: A `protectedProcedure` to update SRS data (`interval`, `easeFactor`, etc.), `isBookmarked`, `isLearned`, `isDeleted` in the `UserFlashcardStatus` table for a given flashcard and the authenticated user.
    - `getDueFlashcardsForUser`: (Replaces old `getDueFlashcards`) Fetches flashcards due for review for the authenticated user from their `UserFlashcardStatus` records.

## Next Steps (Immediate):
1.  **Apply Schema Changes:**
    - Run `npx prisma migrate dev --name update_flashcard_srs_model` (or similar).
    - Run `npx prisma generate`.
2.  **Implement `flashcard.create`:**
    - In `flashcardRouter.ts`.
    - Must create both a `Flashcard` entry and a corresponding `UserFlashcardStatus` entry for the creator, within a transaction.
3.  **Implement `flashcard.updateUserStatus`:**
    - In `flashcardRouter.ts` (or a new `userFlashcardStatusRouter.ts`).

## Future Considerations / To Be Discussed:
- **Shared Decks/Flashcards:** How does a user "add" a shared deck/flashcard to their collection? Does it copy the deck/cards, or just link them with new `UserFlashcardStatus` entries?
- **Editing Shared Flashcards:** If a base flashcard is shared, can users edit it? If so, does it create a personal copy, or are edits global (less likely for shared content)?
- **Soft Deletes:** The `isDeleted` field in `UserFlashcardStatus` allows users to "remove" a card from their view without deleting the base card. Ensure this is handled in frontend queries.
- **Error Handling & Validation:** Robust input validation (Zod) and error handling (TRPCError) across all procedures.
- **Pagination & Filtering:** Implement for all list procedures.
- **Testing:** Develop a strategy for testing API endpoints.

This document should be updated as development progresses.
(Please replace YYYY-MM-DD with today's date when you review this)
