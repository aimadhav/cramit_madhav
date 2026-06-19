# Flashcard App Architecture Redesign Plan

## Overview
This plan details the transition from a passive library-based flashcard model to an active, exam-guided study experience. 

The core of this redesign revolves around abstracting how decks are presented. We will transition to a **Subject Deck** vs **Chapter Deck** model. 

### Core Concepts: Subject Decks vs. Chapter Decks
*   **Chapter Decks (Physical Representation):** In the database, the `decks` table currently holds individual chapters (e.g., a row where `name = 'Kinematics'` and `subject = 'Physics'`). **This does not change.** The database will continue to store decks at the chapter level.
*   **Subject Decks (Computed View):** The user will no longer study individual chapters manually. Instead, they interact with a "Subject Deck" (e.g., Physics). A Subject Deck is a **dynamically computed view** that aggregates all cards from the specific chapters the user is currently actively studying within that subject. 

By separating the physical storage (Chapters) from the study experience (Subjects), we enable seamless progression without constantly creating or destroying deck records.

---

## Phase 1: Database Enhancements (Minimal Refactor)

To power the guided flow and Cram Mode filters efficiently, we need a few small, targeted additions to the database.

### 1.1 New Table: `user_active_chapters`
*   **Goal:** Track which chapters a user has unlocked/activated for a specific subject, allowing the SQLite query to dynamically build the "Subject Deck".
*   **Schema Addition:**
    *   `id` (text, primary key)
    *   `user_id` (text, references `users.id`)
    *   `deck_id` (text, references `decks.id` - this is the chapter)
    *   `subject` (text, e.g., 'Physics')
    *   `status` (text, default `'active'`, can be updated to `'completed'`)
    *   `created_at` & `updated_at` (timestamps)
*   **Benefit:** This is architecturally superior to storing relationships in JSON blobs. It allows clean SQL `JOIN`s when fetching due cards and provides a historical record of completed chapters.

### 1.2 "Mistakes" Tracking Columns (`user_flashcard_status`)
*   **Goal:** Enable instantaneous, dynamic filtering for the "Mistakes" Cram Mode without running expensive queries across the entire review history table.
*   **Schema Addition (to `userFlashcardStatus`):**
    *   `left_swipes` (integer, default `0`)
    *   `right_swipes` (integer, default `0`)
    *   `last_swipe_direction` (text, nullable: `'left' | 'right'`)
*   **Action:** Create a local SQLite migration script for these additions.

---

## Phase 2: Core Logic Adaptations

### 2.1 Database Service Updates (`services/database-service.ts`)
*   **Goal:** Populate the new tracking columns during standard review.
*   **Action:** Update the `saveReview` function:
    *   If rating is `1` (Again/Left Swipe): Increment `left_swipes`, set `last_swipe_direction = 'left'`.
    *   If rating is `4` (Easy/Right Swipe): Increment `right_swipes`, set `last_swipe_direction = 'right'`.

### 2.2 Flashcard Store Updates (`store/flashcard-store.ts`)
*   **Goal:** Support Cram Mode's non-destructive review process.
*   **Action:** Modify `startStudySession` to accept an optional `isCramMode` boolean flag.
*   **Action:** Modify `rateCard` to accept `isCramMode`. If `isCramMode` is `true`, the action only advances the `currentCardIndex` and **completely bypasses** all calls to `StudyService.rateCard` and `DatabaseService.saveReview`. FSRS data remains untouched.

---

## Phase 3: The Guided Study Engine (Queue Generation)

### 3.1 Daily Study Queue (`services/study-service.ts`)
*   **Goal:** Build a session of exactly 45 cards, prioritizing due cards, then filling the remaining slots with sequential new cards from active chapters.
*   **Action:** Refactor `getSessionQueue(subject: string)`:
    1.  Fetch all active chapter IDs for the given subject by querying the new `user_active_chapters` table.
    2.  Fetch all cards belonging to those `activeChapterIds` via a `JOIN`.
    3.  Filter for `Due Cards` (`due_date <= now`).
    4.  Calculate `New Cards Needed = 45 - Due Cards.length`. (If Due Cards >= 45, New Cards Needed = 0).
    5.  Filter for `New Cards` (cards with no `lastReviewed` date).
    6.  Sort `New Cards` sequentially by chapter order (e.g., finish all Kinematics cards before showing Laws of Motion cards).
    7.  Slice exactly `New Cards Needed` from the sorted new cards array.
    8.  Return the combined queue (`Due Cards` + sliced `New Cards`).

### 3.2 Cram Mode Queue (`services/study-service.ts`)
*   **Goal:** Generate targeted cram sessions without affecting FSRS intervals.
*   **Action:** Create `getCramQueue(subject: string, filter: 'Formula' | 'Concept' | 'Mistakes')`:
    1.  Fetch *all* cards for the given `subject` (ignoring whether the chapter is currently 'active').
    2.  If filter is `Formula` or `Concept`: Return cards where `tags_json` contains the respective tag.
    3.  If filter is `Mistakes`: Return cards where `left_swipes > right_swipes` OR `last_swipe_direction == 'left'`.
    4.  Sort the resulting array by FSRS `stability` ASC (lowest stability/weakest memory first).

---

## Phase 4: FSRS & Swipe Standardization

### 4.1 Swipe Rating Standardization
*   **Goal:** Standardize the interaction model to strictly use binary pass/fail for FSRS to keep the logic simple and effective.
*   **Action:** Ensure the UI (`app/study/[id].tsx`) maps swipes exclusively to:
    *   **Left Swipe (Fail):** Rating = `1` (Again - resets stability).
    *   **Right Swipe (Pass):** Rating = `4` (Easy - increases stability).
*   **Note:** The existing FSRS algorithm in `utils/spaced-repetition.ts` perfectly handles these values. We are simply restricting the inputs to `1` and `4`.

---

## Phase 5: UI Data Hook Adjustments (Minimal Visual Changes)

The goal here is to retain the existing UI components (`app/(tabs)/index.tsx`, `app/(tabs)/decks.tsx`) but wire them to the new data architecture.

### 5.1 Cram Mode / Library Data Hooks (`app/(tabs)/decks.tsx`)
*   **Goal:** Replace the global library fetching logic with the targeted Cram Mode filters.
*   **Action:** Update the state and `handleStartPress` to utilize `getCramQueue` based on the selected `subject` and `filter` (tags/mistakes). The UI remains the same, but it now launches a Cram Session.

### 5.2 Chapter Progression State
*   **Goal:** Expose the necessary state so the UI knows when a user needs to pick a new chapter.
*   **Action:** Add a getter to the store `getRemainingNewCards(subject, chapterId)`. When this returns `0` for an active chapter, the home screen can accurately reflect that the chapter is exhausted and prompt the user to "Add new chapter".
