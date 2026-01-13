# CramIt Project Documentation: Functions and Logic (Branch: prash-main)

This document provides a comprehensive overview of the functions and logic within the **CramIt** codebase, specifically tailored to the features found in the `fixederrors-newdatabase` / `prash-main` branch.

---

## 1. Backend (API & Business Logic)

The backend is built using **Hono** as the web framework, **tRPC** for type-safe API communication, and **Prisma** with a **SQLite** database.

### 1.1. Core Server (`backend/hono.ts`)
- **`app.get("/")`**: Health check endpoint returning API status and server timestamp.
- **`app.use("/trpc/*", trpcServer(...))`**: Routes tRPC requests to the `appRouter`.

### 1.2. Auth Router (`backend/trpc/routes/auth/router.ts`)
Handles user authentication and profile sync.
- **`signup/login/refreshSession`**: Manages Supabase Auth integration.
- **Note**: Some procedures currently use a fallback `"guest-user"` ID for simplified local development and testing.

### 1.3. Flashcard Router (`backend/trpc/routes/flashcards/router.ts`)
Manages the lifecycle and study status of flashcards.
- **JSON Serialization**: Since SQLite does not support scalar arrays, fields like `tags` and `mediaUrls` are stored as JSON strings (`tagsJson`, `mediaUrlsJson`) and parsed on the fly.
- **`create`**: Adds a flashcard. Automatically serializes media arrays into JSON for database storage.
- **`updateUserStatus`**: Updates Spaced Repetition (SRS) metrics.
- **`getDueFlashcardsForUser`**: Identifies cards ready for review.
- **`updateContent` (Copy-on-Edit)**: If a user edits a public card, the system creates a personal copy to preserve the original while allowing customization and tracking personal progress.

### 1.4. Deck Router (`backend/trpc/routes/deck.router.ts`)
- **`listPublic`**: Retrieves shared decks with metadata.
- **`create` / `update`**: Handles deck containers, including **Cover Photo** support.

### 1.5. Admin Router (`backend/trpc/routes/adminRouter.ts`)
Provides global access for deck management, user listing, and administrative privilege control.

---

## 2. Frontend (App Development)

The frontend is an Expo app using **Zustand** for state management.

### 2.1. Flashcard Store (`store/flashcard-store.ts`)
The central hub for app logic and offline persistence.
- **Optimistic UI**: All CRUD operations (`add/update/delete`) update the local UI immediately before the server confirms.
- **Media Management**: Enhanced to support **multiple images** per card side.
- **New Cards Support**: Logic to identify and prioritize "New" cards (where `repetitions === 0`) when no "Due" cards are available.
- **Incomplete Sessions**: Enhanced `studyProgress` tracking allows users to resume a deck study session if they close the app.
- **Reset Progress**: Functions to clear all SRS metrics (`interval`, `easeFactor`, `repetitions`) for a deck or user.
- **Deferred Operations**: Handles "pending dependency" states where actions (like adding a card) are queued until the parent item (like a new deck) receives a real ID from the server.

### 2.2. User Store (`store/user-store.ts`)
- **Session Tracking**: Securely stores access and refresh tokens using `Expo SecureStore`.
- **Study Stats**: Maintains streaks and total cards studied locally.

### 2.3. Spaced Repetition Utility (`utils/spaced-repetition.ts`)
- **`calculateNextReview`**: Implements the **SM-2 Algorithm**.
    - Calculates the next `dueDate` and `interval` based on ratings: `again`, `hard`, `good`, `easy`.
- **Filtering Logic**: Provides helpers like `getDueCards` and `sortCardsByDue`.

### 2.4. tRPC Client & Auth Link (`utils/trpc.ts`)
- **Auto-Refresh**: Automatically detects `401 Unauthorized` errors and attempts to refresh the session using the stored refresh token.
- **Proactive Refresh**: Schedules a token refresh 5 minutes before the current session expires.

---

## 3. UI & Rendering Logic

### 3.1. LaTeX & Multimedia
- **`WebViewLatexBlock`**: Safe rendering of MathJax formulas.
- **Image Picker**: Enhanced with permission checks and support for selecting both cover photos and card-side images.

### 3.2. Resilience
- **Error Boundaries**: Catches UI-level crashes to provide a graceful recovery screen.
- **BackendStatus**: Visual indicator for server connectivity.
