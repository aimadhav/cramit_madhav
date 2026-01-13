# Cramit Final Codebase Overview

This document outlines the structure and components of the Cramit final project.

## Project Structure

The project is organized as a monorepo with distinct frontend, backend, and mobile application components.

### 1. Root Directory

The root directory contains global configuration files, shared utilities, documentation, and the main application components.

-   **Configuration:**
    -   `package.json`: Project dependencies and scripts.
    -   `package-lock.json`: Exact versions of dependencies.
    -   `tsconfig.json`: TypeScript configuration for the entire project.
    -   `.gitignore`: Specifies intentionally untracked files that Git should ignore.
    -   `babel.config.js`: Babel compiler configuration.
    -   `eas.json`: Expo Application Services (EAS) configuration for building and submitting the Expo app.
    -   `app.json`: Expo app configuration file.
    -   `vercel.json`: Vercel deployment configuration.
    -   `vitest.config.ts`: Configuration for Vitest testing framework.
-   **Documentation & Guides:**
    -   `README.md`: (Currently minimal: "cramit final")
    -   `admin_panel_guide.md`: Guide for the admin panel.
    -   `app_changes_for_admin.md`: Notes on app changes related to the admin panel.
    -   `backend.md`: Backend documentation.
    -   `backend_database_interaction.md`: Documentation on backend-database interaction.
    -   `backend_details.md`: More backend details.
    -   `database_details.md`: Database specific details.
-   **Source Code Directories (High Level):**
    -   `admin-panel-web/`: Frontend for the web-based admin panel.
    -   `admin-panel-backend/`: Supporting backend services, potentially for tasks like database migrations using Prisma.
    -   `backend/`: Main backend API.
    -   `app/`: Expo (React Native) mobile application.
    -   `components/`: Likely shared UI components.
    -   `constants/`: Application-wide constants.
    -   `lib/`: Shared library code.
    -   `mocks/`: Mock data or modules for testing.
    -   `prisma/`: Prisma schema, client, and migration files for database management.
    -   `store/`: State management (e.g., Zustand, Redux) setup.
    -   `tests/`: Test files.
    -   `types/`: TypeScript type definitions.
    -   `utils/`: Shared utility functions.
    -   `assets/`: Static assets like images and fonts.
        -   `images/`: Contains image files.
            -   `splash-icon.png`: Splash screen icon.
            -   `finallogo.png`: Main logo.
            -   `icon.png`: Application icon.
            -   `favicon.png`: Favicon for web applications.
            -   `adaptive-icon.png`: Adaptive icon for Android.
-   **Other:**
    -   `.expo/`: Expo-generated directory.
    -   `node_modules/`: Project dependencies.
    -   `.git/`: Git repository data.
    -   `expo-env.d.ts`: TypeScript definitions for Expo environment variables.
    -   `@new2__expo-app.jks`: Java KeyStore file, likely for Android app signing.


### 2. Admin Panel Frontend (`admin-panel-web/`)

A web application, likely built with React and Vite, serving as the admin interface.

-   **Key Files/Directories:**
    -   `package.json`: Frontend specific dependencies.
    -   `vite.config.ts`: Vite build tool configuration.
    -   `tsconfig.json`: TypeScript configuration for this part of the app.
    -   `index.html`: Main HTML entry point.
    -   `public/`: Static assets served directly.
    -   `src/`: Source code for the admin panel.
        -   `main.tsx`: Main entry point of the React application. Initializes tRPC client and renders the App.
            -   **Note:** This file currently has linter errors related to `trpc.createClient` and `trpc.Provider`, indicating a potential issue with the tRPC setup or type definitions. Errors suggest properties `createClient` and `Provider` do not exist on the `trpc` object.
        -   `App.tsx`: Root React component.
        -   `index.css`: Global styles.
        -   `App.css`: Styles for the `App` component.
        -   `components/`: UI components specific to the admin panel.
        -   `utils/`: Utility functions, including `trpc.ts` for tRPC client setup.
        -   `assets/`: Static assets used by the admin panel.

### 3. Main Backend (`backend/`)

The primary backend API for the application, built using Hono and tRPC.

-   **Key Files/Directories:**
    -   `hono.ts`: Sets up the Hono server and integrates tRPC routes.
    -   `trpc/`: Contains tRPC router definitions, procedures, and context. This is where the API logic resides.
    -   `prisma/`: (Likely a symlink or shared access to the root `prisma/` directory) Used for database interaction.

### 4. Supporting Backend (`admin-panel-backend/`)

This directory appears to be a Node.js project, possibly for auxiliary backend tasks or management of the Prisma setup.

-   **Key Files/Directories:**
    -   `package.json`: Dependencies for this backend part.
    -   `tsconfig.json`: TypeScript configuration.
    -   `prisma/`: (Likely a symlink or shared access to the root `prisma/` directory) Contains Prisma schema and client. This might be the primary location for running Prisma migrations.

### 5. Mobile Application (`app/`)

An Expo (React Native) application for mobile users.

-   **Key Features & Structure:**
    -   Uses Expo's file-system based routing.
    -   `_layout.tsx`: Defines the root layout for navigation.
    -   `(auth)/`: Routes and components related to authentication.
    -   `(tabs)/`: Routes and components for tab-based navigation after login.
    -   `api/`: Client-side API interaction logic, possibly using tRPC client.
    -   `study-card-detail/`, `study/`, `card/`, `decks/`, `deck/`: Feature-specific directories for different parts of the app (e.g., managing study cards, decks).
    -   `modal.tsx`: A common modal component.
    -   `error-boundary.tsx`: Handles errors within the app.
    -   `+not-found.tsx`: Handles unmatched routes.

### 6. Shared Prisma Setup (`prisma/`)

Located at the root, this directory is crucial for database interactions across different parts of the backend.

-   `schema.prisma`: Defines the database schema, models, and relations.
-   `migrations/`: Contains database migration files generated by Prisma Migrate.
    -   `migration_lock.toml`: Ensures migrations are applied sequentially.
    -   Timestamped directories (e.g., `20250523054632_init_schema/`): Each directory represents a specific database migration and contains the SQL script (`migration.sql`) for that migration.
-   (Generated Prisma Client): Used by backend services (`backend/`, `admin-panel-backend/`) to query the database.

### 7. Shared Components (`components/`)

This root-level directory contains React components that are likely shared, primarily by the Expo (React Native) application.

-   `FlashcardContentModal.tsx`: A modal component for displaying flashcard content.
-   `WebViewLatexBlock.tsx`: A component for rendering LaTeX content, possibly within a WebView.
-   `BackendStatus.tsx`: A component to display the status of the backend.

### 8. Shared Constants (`constants/`)

Contains constant values used across the applications.

-   `colors.ts`: Defines a palette of color constants for UI styling.

### 9. Shared Library Code (`lib/`)

Contains shared library or utility code.

-   `trpc.ts`: Likely sets up and exports a tRPC client instance, configured for use by the mobile app or other client applications. This is separate from the `utils/trpc.ts` in `admin-panel-web/src/utils/` which is specific to the admin panel.

### 10. Shared State Management (`store/`)

Contains files related to client-side state management, likely for the Expo app using a library like Zustand or Redux.

-   `user-store.ts`: Manages state related to the user (e.g., authentication status, user profile).
-   `flashcard-store.ts`: Manages state related to flashcards (e.g., current flashcard, study progress).

### 11. Shared TypeScript Types (`types/`)

Defines shared TypeScript type definitions used throughout the project.

-   `index.ts`: Exports various custom types and interfaces to ensure type safety and consistency across different modules and applications.

### 12. Shared Utilities (`utils/`)

This root-level directory provides various utility functions used across the project, particularly by the mobile app or shared logic.

-   `trpc.ts`: This might be another tRPC utility or a more generic helper related to tRPC, potentially for server-side concerns or a different client setup than `lib/trpc.ts`.
-   `latex-renderer.ts`: Contains functions to process or render LaTeX strings, likely used in conjunction with components that display mathematical formulas or scientific text.
-   `spaced-repetition.ts`: Implements the logic for the spaced repetition system (SRS), a core feature for the flashcard application.

## Technology Stack Summary (Inferred)

-   **Frontend (Admin Panel):** React, TypeScript, Vite, tRPC (client)
-   **Backend API:** Node.js, Hono, tRPC, Prisma (ORM)
-   **Mobile App:** React Native, Expo, TypeScript, tRPC (client)
-   **Database:** (Not explicitly stated, but Prisma supports PostgreSQL, MySQL, SQLite, SQL Server, MongoDB, CockroachDB)
-   **Build/Tooling:** npm (based on `package-lock.json`), TypeScript, Vitest
-   **Deployment:** Vercel (for web), EAS (for mobile)

## Inter-component Communication

-   The Admin Panel Frontend (`admin-panel-web`) likely communicates with the Main Backend (`backend/`) via tRPC.
-   The Mobile App (`app/`) likely communicates with the Main Backend (`backend/`) via tRPC.
-   The Main Backend (`backend/`) and Supporting Backend (`admin-panel-backend/`) interact with the database through Prisma.

---

This map provides a comprehensive overview of the `cramitfinal` codebase. Further detailed exploration of individual files within these directories would provide deeper insights into specific functionalities. 