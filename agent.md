# Agent Tracker (Pair Programming Log)

We use this file to keep track of our progress, what we are currently working on, and what comes next.

## Phase 1: Foundation & Mobile Prep
- [x] Draft PRD and Agent Tracker.
- [x] Update Local SQLite Schema in Mobile App (`db/schema.ts`).
- [x] Provide Supabase SQL Migration commands to the user.
- [x] Update `signup.tsx` to include `prep_focus` selection.
- [x] Update `user-store.ts` to sync the new `prep_focus` and `role`.
- [x] Refactor `(tabs)/index.tsx` (Home Screen) to dynamically fetch and display Decks by `subject`.

## Phase 2: Creator Web App (Next.js)
- [x] Initialize Next.js project in `../cramit-creator`.
- [x] Install Tailwind, Shadcn/UI, and Supabase JS.
- [x] Setup Supabase SSR Auth & Middleware (Teacher Role Guard).
- [x] Build Dashboard UI (Deck List).
- [x] Build Deck Creation Modal.
- [x] Build Flashcard Editor (Markdown + Mobile Preview + Stability Selector).
- [x] Refine Flashcard Editor Mobile UI & Add Image Support.
- [x] Implement Staging Area (Draft vs Published statuses).
- [x] Build Bulk JSON Importer Route.

## Final Review
- [ ] **CURRENT:** User testing the full Creator Workflow.

---
*Last Updated: Moving to update Local SQLite Schema.*