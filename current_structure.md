# Project Status & Architecture (Offline-First)

## 🏗️ What Has Been Built (The New Foundation)

### 1. Local Database (SQLite + Drizzle)
- **Source of Truth**: The app now uses a local SQLite database (`cramit.db`) for ALL core functionality.
- **Relational Schema**: 7 dedicated tables (`decks`, `flashcards`, `user_flashcard_status`, `reviews`, `sync_queue`, `study_sessions`, `rooms`).
- **FSRS Core**: Spaced Repetition math (stability, difficulty, intervals) is calculated on-device and stored in SQLite.
- **Segmentation**: Data is strictly isolated by `user_id`. Progress for "Arjun" is separate from "Beta" even on the same device.

### 2. Service Layer (The Brain)
- **DatabaseService**: Manages SQL CRUD operations (saving cards, calculating "Due" counts).
- **StudyService**: Handles session queue generation (Prioritizing Due cards > New cards).
- **MediaService**: Downloads images from Supabase/Web and stores them locally as `file:///` paths.
- **SyncService**: An event-based background engine that mirrors local changes to Supabase.

### 3. Frontend / UI
- **Reactive Home Screen**: Shows "Available" card counts based on real-time local SQL queries.
- **Study Session**: Full swipe-to-learn interface with LaTeX support and **instant image loading**.
- **Dev Tools**: Integrated "SQLite Debugger" and "Card Data Inspector" for live database monitoring.

---

## 🛠️ What is Being Built Right Now (Active Development)

### 1. Cloud-to-Local Bridge
- **`pullChanges` Implementation**: Logic to fetch real curriculum decks/cards from Supabase and populate the local SQLite database.
- **Incremental Sync**: Only downloading data that has changed since the last local update (using `version` and `updated_at`).

### 2. User Data Persistence
- **Cloud Backup**: Fixing Supabase RLS (Row Level Security) so that local swiping progress is successfully backed up to the `user_flashcard_status` table in the cloud.

---

## 📅 Future Roadmap (Learning Client Only)

- **Room Integration**: logic to "Join Room" via code and automatically download the specific decks assigned by a teacher.
- **Mastery Analytics**: Converting local `reviews` history into beautiful charts and heatmaps on the Stats tab.
- **Push Notifications**: Offline-scheduled reminders for when cards become "Due" according to SQLite.

---

## 🗑️ Retired Architecture (Removed)
- **Redundant Backend**: The `backend/` and `prisma/` folders have been physically deleted.
- **tRPC/API Routes**: All middle-man protocol layers have been removed.
- **Zustand Bloat**: The store no longer holds massive arrays of 1000+ cards; it acts only as a lightweight UI state manager.
