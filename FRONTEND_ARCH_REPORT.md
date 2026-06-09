# Frontend Architecture & Database Integration Report

This report analyzes the current state of the "Cramit" project and provides a roadmap for transitioning to an offline-first architecture with Local SQL (SQLite) and Supabase backup.

## 1. Current State Analysis

### Frontend-Database Interaction
- **Communication Layer**: Uses **tRPC** for type-safe communication between the Expo frontend and Hono backend.
- **Backend**: Currently a Hono server using **Prisma ORM** connected to a **PostgreSQL** database.
- **Data Flow**:
    - The frontend fetches decks and cards via tRPC.
    - Data is stored in the **Zustand store** (`flashcard-store.ts`).
    - The entire store is serialized to JSON and persisted in **AsyncStorage** (via `zustand/middleware/persist`).

### State Management
- **Zustand**: Manages `user` and `flashcard` states.
- **Persistence**: Relies on `AsyncStorage`. This is problematic for large datasets (e.g., thousands of cards) as reading/writing a single large JSON blob becomes a performance bottleneck and can lead to data loss if the app crashes during write.

### Offline Capabilities
- **Manual Offline Mode**: A "Login Offline" feature exists that bypasses tRPC calls and uses locally persisted data.
- **Limitations**: It is not "Offline-First" but rather "Offline-Fallback". Changes made offline are not automatically queued for synchronization.

---

## 2. Feasibility of User Vision

### Local SQL Database + Supabase Backup
- **Feasibility**: High. Using **`expo-sqlite`** (ideally with **Drizzle ORM**) is the industry standard for robust React Native apps.
- **Sync Logic**: We need to move away from "fetching and saving in state" to "fetching and inserting into SQLite". The Zustand store should only hold the *currently active* deck/session data, while the bulk of the data stays in SQL.

### Chunked Uploads & Offline-First
- **Architecture**: A **Sync Manager** needs to be implemented.
- **Dirty Flags**: Each row in the local database should have a `is_dirty` or `sync_status` flag.
- **Job Queue**: A background process (using `expo-background-fetch` or `expo-task-manager`) can push these changes to Supabase in chunks whenever the internet is restored.

### Data Bundling & On-Demand Loading
- **Bundling**: The current `default-decks.json` is a good start. On first app launch, this should be "hydrated" into the local SQLite database.
- **Lazy Loading**:
    - When browsing the library, fetch only **Deck Metadata** (names, counts).
    - When a user selects a deck, check if cards exist in local SQL. If not, fetch from Supabase and cache them.

---

## 3. Schema Evaluation

The current Prisma schema is solid but needs adjustments for a robust sync engine:

### Recommended Changes:
1.  **Sync Metadata**: Add `server_updated_at` (DateTime) and `last_synced_at` (DateTime) to `UserFlashcardStatus` and `Deck`.
2.  **Soft Deletion**: Ensure `isDeleted` is consistently used across all tables so deletions can be synced.
3.  **Conflict Resolution**: Add a `version` (integer) or `client_updated_at` (BigInt/Timestamp) to handle cases where data changes on two devices.
4.  **Local ID mapping**: Use `uuid` or `cuid` for all IDs to avoid collisions between locally created records and server-created ones.

---

## 4. State Management Refactor

Currently, Zustand is doing too much heavy lifting (storing all cards). 
**Target State**:
- **SQLite**: Source of truth for all persistent data.
- **Zustand**: Manages "UI State" (current active card, session progress, temporary UI flags).
- **React Query**: (Optional but recommended) To handle the fetching/caching layer between the Sync Manager and the UI.

---

## 5. Questions & Action Items

### Questions for Clarification:
1.  **Supabase Auth**: Do you want to migrate authentication to **Supabase Auth**? (Recommended for easier integration with Supabase features).
2.  **Initial Data**: Should the bundled data (`default-decks.json`) be immutable, or should users be able to edit their own copies locally immediately?
3.  **Media Handling**: How should images/audio be handled offline? (Should we download all media for a deck when it's "selected" for study?)
4.  **Sync Priority**: Which data is more critical to sync first? (Usually `UserFlashcardStatus` is the most important as it tracks progress).

### Immediate Observations:
- The `flashcard-store.ts` currently tries to handle "normalization" and "syncing" internally. This logic should be extracted into a dedicated `SyncService` and `DatabaseService`.
- There is no logic currently to handle **Merge Conflicts** (e.g., studying the same deck on two different phones while offline).

---
**Report generated on Sat May 16 2026**
