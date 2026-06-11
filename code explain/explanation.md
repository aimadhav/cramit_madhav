# Project Folder Structure & File Explanations

This document provides an extensive explanation of the core files within the `app` directory of the Cramit project.

## 1. `app/_layout.tsx` (The Root Architect)
This is the **entry point** of the application's UI hierarchy. It serves several critical roles:

*   **Global Providers**: It wraps the entire app in `SafeAreaProvider` (for notch handling), `GestureHandlerRootView` (for touch interactions), and `DatabaseProvider` (for SQLite access).
*   **Authentication Flow**: It monitors the `sessionToken`. If a user is not logged in, it automatically redirects them to the `(auth)/login` screen. If they are logged in, it ensures they are on the main `(tabs)` screen.
*   **Initialization**: It calls `initializeStore()` from the flashcard store, which sets up the local SQLite database and loads the user's decks.
*   **Fonts & Splash Screen**: It manages the loading of custom fonts (`Outfit`) and keeps the splash screen visible until the app is fully ready.
*   **Sync Engine**: It initializes a network listener (`NetInfo`). When the device regains internet connectivity, it triggers `SyncService.pushChanges()` to upload local offline changes to the cloud (Supabase).
*   **Routing**: It defines the root `Stack` navigator, including the main tab interface, the auth flow, and global modals.

---

## 2. `app/debug-cards.tsx` (Data Inspector)
A specialized developer tool designed to verify the integrity of local flashcard data.

*   **Visualization**: It displays a horizontal-scrolling table showing every card stored in the local SQLite database for the current user.
*   **Column Details**: It surfaces technical fields like `REPS` (repetitions), `STAB.` (FSRS stability score), and `DUE DATE`. This is vital for debugging the spaced-repetition algorithm.
*   **Content Parsing**: It includes a `formatFront` helper to parse the JSON-based card content (which can include text, LaTeX, or images) into a readable string for the table view.
*   **Live Refresh**: Provides a refresh button to re-query the database after performing actions in other parts of the app.

---

## 3. `app/debug-sqlite.tsx` (Database Management)
A power-user tool for direct interaction with the device's storage layer.

*   **Database Statistics**: Shows real-time counts of Decks, Cards, and the **Sync Queue** (items waiting to be uploaded to the cloud).
*   **Seeding**: Includes a `seedTestData` function that creates a "Physics 101" deck with sample cards and a mock sync task. This is used to test the app's behavior without needing a real server.
*   **Destructive Reset**: Allows developers to "Wipe SQLite Tables." This drops all local tables, forcing the app to recreate them from scratch—essential when the database schema changes during development.
*   **Sync Queue Inspector**: Lists specific pending operations (CREATE/UPDATE/DELETE) so developers can track exactly what the `SyncService` is about to do.

---

## 4. `app/hello+api.ts` (Serverless Endpoint)
This file represents an **Expo Router API Route**.

*   **Backend Functionality**: It runs on the server (or during local development via Node.js) rather than the mobile device.
*   **REST Endpoint**: It exports an `async function GET()` which returns a JSON response. 
*   **Usage**: Accessing `/hello` in the app's base URL will trigger this function. It serves as a template or lightweight backend utility for the project.

---

## 5. `app/modal.tsx` (Generic Modal)
A template for full-screen overlays in the application.

*   **Presentation**: Defined in the `_layout.tsx` as `presentation: 'modal'`, it slides up from the bottom on iOS.
*   **Customization**: Currently serves as a placeholder for transient UI elements (like adding a quick note or settings popup).
*   **Platform Specifics**: Adjusts the `StatusBar` style specifically for iOS to ensure the top status bar remains visible and aesthetically pleasing against the modal background.
