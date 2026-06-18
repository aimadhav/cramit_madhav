# Cramit V2: Product Requirements Document (PRD)

## 1. Overview
Cramit is evolving from a hardcoded mobile app into a dynamic, two-platform ecosystem:
1. **Cramit Mobile App (Student Consumer)**: A dynamic React Native app where students select a preparation track (JEE, NEET, CS) and consume relevant flashcards using Spaced Repetition.
2. **Cramit Creator Portal (Teacher Admin)**: A Next.js web application for teachers to create, tag, and manage public decks, cards, and initial stability ratings.

---

## 2. Database Schema Changes (Supabase & SQLite)

### Users Table
*   `role`: string (default: 'student'). Values: 'student', 'teacher'.
*   `prep_focus`: string (nullable). Values: 'JEE', 'NEET', 'CS'.

### Decks Table
*   `is_public`: boolean (default: true).
*   `prep_category`: string. (e.g., 'JEE')
*   `subject`: string. (e.g., 'Physics', 'DSA')

### Flashcards Table
*   `starting_stability`: numeric (Calculated from Easy/Med/Hard on creation).

---

## 3. Cramit Mobile App Updates (`cramitfinal`)
*   **Onboarding**: `signup.tsx` must ask the user for their `prep_focus` (JEE, NEET, CS) via a clean UI selector.
*   **Local Storage**: Update SQLite schema (`db/schema.ts`) to handle the new deck/user columns.
*   **Dynamic Home Screen**: `(tabs)/index.tsx` must query decks where `prep_category == user.prep_focus` and dynamically render rows for each `subject` (Physics, Math, etc.) instead of hardcoded sections.

---

## 4. Cramit Creator Portal (`cramit-creator`)
*   **Tech Stack**: Next.js (App Router), Tailwind CSS, React Hook Form.
*   **Authentication**: Supabase SSR Auth. Middleware protects routes, allowing only users where `role === 'teacher'`.
*   **Deck Management**: Interface to create decks, assigning them a `prep_category` and `subject`.
*   **Card Editor**: 
    *   Split-pane design.
    *   Left: Markdown/LaTeX input for Front/Back. Dropdown for Initial Stability (Easy/Med/Hard).
    *   Right: Mobile Preview container mimicking React Native styling.
*   **Bulk Actions**: Placeholder structure for future JSON/CSV bulk imports.