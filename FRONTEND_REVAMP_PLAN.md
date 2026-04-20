# Frontend Revamp Execution Plan

This document outlines the step-by-step technical implementation plan for the Cramit frontend revamp.

## Architectural Decisions
*   **Data:** We will use mock data for all new UI components. Backend/DB integration will be handled in a future phase.
*   **Study Session Routing:** We will use a "Temporary Deck" pattern. When a user selects multiple chapters in the Quick Prep Builder, we will generate a temporary deck ID containing mock cards and pass that to the existing study screen.
*   **Theme:** The app will be forced into permanent Dark Mode.
*   **Deprecated Screens:** `search.tsx` and `settings.tsx` will be hidden from the main navigation but their files will not be deleted.

---

## Phase 1: Foundation & Navigation (Routing)

### 1.1 Theme & Colors
*   Update `constants/colors.ts` to include the new dark theme palette.
    *   Primary Accent: Vibrant Indigo/Purple.
    *   Backgrounds: Deep blacks and dark grays.
    *   Text: Pure white and muted grays.
*   Force React Navigation/Expo Router to always use the Dark Theme configuration.

### 1.2 Tab Bar Restructuring (`app/(tabs)/_layout.tsx`)
*   Hide the `search` and `settings` tabs by setting their `href` to `null` or using `options={{ tabBarButton: () => null }}`.
*   Create a new tab file `app/(tabs)/stats.tsx`.
*   Style the bottom tab bar to match the dark theme.
*   Implement a custom `tabBarButton` for the `index` (Home) route. This will be the floating, overlapping purple rounded-square button in the center of the tab bar.

---

## Phase 2: Mock Data Setup

### 2.1 Create `constants/mockData.ts`
*   **User Stats Mock:** Data for streaks, 90-day activity heatmap (array of dates/intensities), subject mastery percentages, and weekly activity trends.
*   **Curriculum Mock:** Structured data representing:
    *   Subjects (e.g., Physics, Chemistry, Maths)
    *   Chapters under each subject
    *   Content Types (Formulas, Concepts, Problem Types)
*   **Temp Flashcards:** A pool of generic mock flashcards that can be assembled into a "Temporary Deck".

---

## Phase 3: Screen Implementation (UI)

### 3.1 Home Screen (`app/(tabs)/index.tsx`)
*   **Header:** Custom top bar with the Cramit logo and a "Streak" pill indicator.
*   **Recommended Now:** A large, prominent focal card suggesting the next best thing to study.
*   **Other Subject Queues:** A 2-column grid displaying quick-start buttons for other subjects.
*   **Today's Activity:** A summary card showing cards reviewed today vs. daily goal.

### 3.2 Library / Quick Prep Builder (`app/(tabs)/decks.tsx`)
*   **Subject Segment Control:** A top tab bar to switch between Physics, Chem, Maths.
*   **Content Type Selector:** A horizontal scrollable row of selectable pills (Formulas, Concepts).
*   **Chapter List:** A vertical list of chapters with custom styled checkboxes.
*   **Sticky Bottom Bar:** A floating action bar at the bottom summarizing the selection (e.g., "3 Chapters Selected") with a "Select Items to Start" button.

### 3.3 Stats Screen (`app/(tabs)/stats.tsx`)
*   **Activity Heatmap:** A custom grid component resembling the GitHub contribution graph, driven by the mock data.
*   **Subject Mastery:** A list of subjects with custom animated progress bars.
*   **Activity Trend:** A basic bar chart (using standard React Native `View` components with calculated heights) showing cards studied over the last 7 days.

---

## Phase 4: Integration (The "Temp Deck" Flow)

### 4.1 Quick Prep Logic
*   Implement local state in `decks.tsx` to track which subjects, content types, and chapters are selected.
*   When "Select Items to Start" is pressed:
    1.  Generate a mock deck containing flashcards related to the selected chapters.
    2.  Store this temporary deck in a temporary store or local state.
    3.  Route the user to `app/study/[temp_deck_id]`.
*   *Note:* Ensure the `study/[id].tsx` screen can gracefully accept this temporary deck ID and load the mock cards without breaking existing DB logic.