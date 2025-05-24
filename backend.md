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
- **Testing Setup (In Progress - 2025-05-24):**
    - **Test Runner:** Vitest configured.
    - **Test Database:** `cramit_test` PostgreSQL database is used. `DATABASE_URL` is switched via `tests/vitest.setup.ts`.
    - **Prisma Client:** Regenerated and schema migrations applied to `cramit_test`.
    - **Test Files:**
        - `tests/example.test.ts`: Basic test to confirm Vitest runner.
        - `backend/trpc/routers/adminRouter.test.ts`: Created with initial setup:
            - `beforeAll`/`beforeEach`/`afterAll` hooks for database connection, seeding (admin/non-admin users), and cleanup.
            - `createCallerForTest` helper to simulate tRPC calls with different user contexts (admin, non-admin, unauthenticated) using mock tokens and temporary context override.
    - **Current Status:** Initial seeding and basic test structure confirmed to be working.
- **Key Procedures (To be tested):**
    - `adminProcedure` (authorization logic)
- **Key Procedures:**
    - `listUsers`: (Example) Lists all users in the system.
    - `adminCreateDeck`: Allows an admin to create a new deck and set its `name`, `description`, and `isPublic` status. The deck is associated with the admin user.
    - `adminUpdateDeck`: Allows an admin to update any deck's `name`, `description`, and `isPublic` status.
    - `adminDeleteDeck`: Allows an admin to delete any deck.
    - `adminCreateFlashcard`: Allows an admin to create a new flashcard in any specified `deckId`, providing `front`, `back`, and `contentType`.
    - `adminUpdateFlashcard`: Allows an admin to update any flashcard's `front`, `back`, `contentType`, or change its `deckId`.
    - `adminDeleteFlashcard`: Allows an admin to delete any flashcard.

## Testing Strategy & Current Status

The backend uses Vitest for unit and integration testing.

### Prisma Client in Tests

A significant effort was made to stabilize the test environment, primarily addressing issues related to the Prisma client and database state management between tests.

1.  **Centralized Prisma Client:**
    *   A lazy-initialized, shared Prisma client is now provided by `backend/prisma/client.ts` via `getPrismaClient()`.
    *   All parts of the application, including tRPC context creation and test files, use this single function to obtain the Prisma client.
    *   A special function `_TEST_ONLY_disconnectAndResetPrismaClient()` was added to `backend/prisma/client.ts`. This function allows for a complete disconnect and reset (nullification) of the shared Prisma client instance.

2.  **Test File Structure for Prisma Client:**
    *   Both `adminRouter.test.ts` and `flashcardRouter.test.ts` now call `_TEST_ONLY_disconnectAndResetPrismaClient()` in their file-level `beforeAll()` (before acquiring the client via `getPrismaClient()`) and `afterAll()` hooks. This ensures that each test *file* starts with a potentially fresh Prisma client connection to a clean database (assuming migrations are handled correctly and the test database is reset).
    *   Seed data creation and cleanup are managed within `beforeEach()` and `afterEach()` hooks respectively within each test file (or within specific `describe` blocks for `adminRouter.test.ts`) to provide isolation for individual test cases.

3.  **Sequential Test Execution:**
    *   It was discovered that running tests in parallel (Vitest's default) caused conflicts with the shared Prisma client and database state.
    *   Tests must currently be run with the `--no-file-parallelism` flag (e.g., `npm run test -- --no-file-parallelism`).
    *   **Next Step**: This needs to be configured directly in `vitest.config.ts` (e.g., using `poolOptions.threads.singleThread: true` or `maxWorkers: 1`) to ensure consistent behavior without relying on CLI flags.

### Current Test Suite Status (as of latest run):

*   **`adminRouter.test.ts`**: ALL PASSING (45/45 tests).
*   **`flashcardRouter.test.ts`**:
    *   **Current State: 21 FAILURES** (as of last full run after attempting various fixes).
    *   **`delete` Procedure Tests**: Previously all 8 passing. Current status affected by broader issues.
    *   **`getById` Procedure Tests (3 failures in previous isolated runs):**
        *   Consistently fail because `result.userStatus` is `undefined` when it's expected to be defined for Scenarios 1, 3, and 4.
        *   Test and router console logs confirm correct `userId`, `flashcardId`, and `isDeleted: false` are used in the router's `prisma.userFlashcardStatus.findUnique` query.
        *   Seeding in `beforeEach` aims to create these active statuses.
        *   Router log shows `findUnique` returns `null`, indicating the record isn't found as expected.
    *   **`getDueFlashcardsForUser` Procedure Tests (1 failure in previous isolated runs, then 4 `PrismaClientValidationError` after `dueDate:null` attempt, then back to 1 logical failure):**
        *   The test "User A gets only cards due today or in the past" expects 2 cards but receives a different number (e.g., 0).
        *   This indicates an issue with how due cards are being counted or filtered, potentially due to test data interference or logic in the procedure.
        *   An attempt to use `dueDate: null` in `createMany` for non-due cards caused `PrismaClientValidationError`; reverting to `dueDate: undefined` fixed the validation error but not the core logic test.
    *   **`updateContent` Procedure Tests (Various failures, including `NOT_FOUND` and deck name mismatches, some resolved, but then impacted by global seeding issues):**
        *   Specific test message mismatches (e.g., 'Flashcard not found' vs 'Original flashcard not found') were corrected.
        *   Deck naming convention for copied decks (`Personal Copy of ...`) was aligned.
    *   **Recent Regression: Widespread Foreign Key Constraint Violations (MAJORITY of the 21 failures):**
        *   During the global `beforeEach` data seeding phase, numerous tests now fail with `Foreign key constraint violated` on tables like `Flashcard` (deckId_fkey), `Deck` (userId_fkey), and `UserFlashcardStatus` (flashcardId_fkey).
        *   This occurred after ensuring all entity IDs are Prisma-generated and used sequentially (Users -> Decks -> Flashcards -> Statuses). The exact cause of this new wave of FK violations during seeding needs further investigation, as the order of operations *should* be correct. It suggests a potential issue with how `mockAuthGetUser` is interacting with the Prisma-generated IDs or a deeper timing/async issue in the setup.
*   **`example.test.ts`**: ALL PASSING (1/1 test).
*   **Total: Variable, currently impacted by `flashcardRouter.test.ts` issues.**

*   **Resolution Path:**
    *   The primary issue causing `flashcardRouter.test.ts` failures was traced to how the `protectedProcedure`'s context was being passed down. Specifically, `ctx.user` (expected by the procedure) was not being explicitly populated from `ctx.prismaUser` within the `isAuthenticated` middleware, even though `ctx.prismaUser` itself was correctly fetched. The fix involved adding `user: ctx.prismaUser` to the context returned by `isAuthenticated`.
    *   The Prisma client management strategy (lazy global client with `_TEST_ONLY_disconnectAndResetPrismaClient` called in `beforeAll` and `afterAll` of each test file) proved effective once combined with sequential test execution.
    *   Diagnostic `console.log` statements added during troubleshooting have been removed from `client.ts`, `create-context.ts`, and both main test files.

### General Test Setup:

*   **Test Runner:** Vitest
*   **Sequential Execution:** `vitest.config.ts` has been updated with `poolOptions: { threads: { singleThread: true } }` to enforce sequential execution by default, eliminating the need for CLI flags.
*   **Database:** A separate test database (`cramit_test`) is used, configured via `DATABASE_URL` in `tests/vitest.setup.ts` (which reads `TEST_DATABASE_URL` from `.env`).
*   **Mocking:**
    *   Supabase client's `auth.getUser` is mocked using `vi.mock('@supabase/supabase-js', ...)` in `tests/testUtils.ts`.
    *   A `mockAuthGetUser` vi.fn() is exported and configured in the `beforeEach` of test files to simulate different authenticated users.
    *   `createCallerForTest` helper in `tests/testUtils.ts` facilitates creating a tRPC caller with a specific user context.
*   **Test Coverage (Completed for `delete` procedure in `flashcardRouter`):**
    *   User deleting their own flashcard (hard delete).
    *   User "soft-deleting" a public flashcard they are studying (sets `isDeleted` on `UserFlashcardStatus`).
    *   Attempting to re-delete an already soft-deleted card.
    *   Attempting to delete a public card not being studied (forbidden).
    *   Attempting to delete another user's private card (forbidden).
    *   Attempting to delete a non-existent card (not found).
    *   Unauthenticated delete attempt (unauthorized).

### Next Steps for Testing:

1.  **Complete `flashcardRouter` Tests:** Write tests for `create`, `listByDeck`, `getById`, `updateUserStatus`, `getDueFlashcardsForUser`, and `updateContent` procedures.
2.  **Test `deckRouter.ts`:** Implement comprehensive tests for all its procedures.
3.  **Test Other Routers:** Cover any remaining user-facing tRPC routers (e.g., `authRouter` if not already sufficiently covered by its usage in other tests or if it has more complex logic).

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
    - **Current Focus (2025-05-24):** Actively writing integration tests for `adminRouter`.
        - **Next Steps:**
            1.  Test the `adminProcedure` authorization mechanism.
            2.  Test `listUsers` procedure.
            3.  Test `adminCreateDeck` procedure.
            4.  Continue testing other `adminRouter` CRUD operations.
            5.  Refine `createCallerForTest` by implementing a more robust Supabase auth mocking strategy to replace the temporary context override.
- **Shared Decks/Flashcards:** Implemented via `isPublic` flag on Decks (admin-set) and `deckRouter.studyPublicDeck`. Users "add" by linking via `UserFlashcardStatus`.
- **Editing Shared Flashcards:** Implemented via "copy-on-edit" in `flashcardRouter.updateContent`. User edits on shared cards result in a personal copy.
- **Soft Deletes:** `isDeleted` in `UserFlashcardStatus` is used. `updateContent` (copy-on-edit) soft-deletes the old status. `getDueFlashcardsForUser` and status fetching in `listByDeck`/`getById` filter out deleted statuses. Needs consistent frontend handling.
- **Error Handling & Validation:** Robust input validation (Zod) and error handling (TRPCError) across all procedures.
- **Pagination & Filtering:** Implement for all list procedures.

This document should be updated as development progresses.
(Please replace YYYY-MM-DD_New with today's date when you review this)
