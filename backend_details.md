# Backend Details for CramItFinal

This document provides an overview of the backend architecture, components, and key files for the CramItFinal application.

## Overview

The backend is built using Node.js, TypeScript, and tRPC for creating a typesafe API. It primarily handles business logic, data persistence through Prisma, and user authentication. Hono might be used as the HTTP server framework for tRPC.

## Directory Structure

```
backend/
├── hono.ts             # Hono server setup for tRPC
└── trpc/
    ├── app-router.ts       # Root tRPC router merging all sub-routers
    ├── create-context.ts   # Defines the tRPC context (e.g., Prisma client, user session)
    └── routes/
        ├── auth/
        │   └── router.ts   # tRPC router for authentication (login, signup)
        ├── deck.router.ts  # tRPC router for deck management (CRUD)
        ├── example/
        │   └── router.ts   # Example tRPC router (if present)
        └── flashcards/
            └── router.ts   # tRPC router for flashcard management (CRUD, SRS updates)
```

## Key Components & Files

### 1. HTTP Server (`backend/hono.ts`)
- Likely sets up Hono as the HTTP server.
- Integrates the tRPC router to handle API requests.
- May include middleware for CORS, logging, etc.

### 2. tRPC Setup

#### `backend/trpc/create-context.ts`
- **Purpose:** Defines the context object available to all tRPC procedures.
- **Key Contents:**
    - Prisma Client instance for database interactions.
    - Authenticated user information (e.g., from Supabase Auth or similar).
    - Request object (`req`).
- This file is crucial for providing necessary resources (like DB access and user identity) to the API resolvers.

#### `backend/trpc/app-router.ts`
- **Purpose:** The main router that merges all other specific routers (auth, deck, flashcard).
- This acts as the entry point for all tRPC API calls from the client.
- Example:
  ```typescript
  import { createTRPCRouter } from './create-context';
  import { authRouter } from './routes/auth/router';
  import { deckRouter } from './routes/deck.router';
  import { flashcardRouter } from './routes/flashcards/router';
  // import { exampleRouter } from './routes/example/router'; // If present

  export const appRouter = createTRPCRouter({
    auth: authRouter,
    deck: deckRouter,
    flashcard: flashcardRouter,
    // example: exampleRouter, // If present
  });

  export type AppRouter = typeof appRouter;
  ```

### 3. tRPC Routers (`backend/trpc/routes/`)

#### `auth/router.ts`
- **Functionality:** Handles user authentication.
- **Key Procedures (examples):**
    - `login`: Authenticates a user.
    - `signup`: Registers a new user.
    - `logout` (if applicable).
    - `getSession` or procedures to get current user info.
- Likely uses `publicProcedure` for login/signup and `protectedProcedure` for session-based actions.

#### `deck.router.ts`
- **Functionality:** Manages flashcard decks.
- **Key Procedures:**
    - `listPublic` (or `listAll`): Lists decks accessible to users.
    - `listUserDecks`: Lists decks created by the authenticated user.
    - `create`: Creates a new deck.
    - `getById`: Fetches a single deck with its details.
    - `update`: Modifies an existing deck.
    - `delete`: Removes a deck.
- Primarily uses `protectedProcedure` for user-specific actions and potentially `publicProcedure` for listing public/shared decks.

#### `flashcards/router.ts`
- **Functionality:** Manages flashcards and their user-specific learning status.
- **Key Procedures:**
    - `create`: Creates a new flashcard within a deck and its initial `UserFlashcardStatus`.
    - `listByDeck`: Lists all flashcards for a given deck (enhancement planned to show user status).
    - `getById`: Fetches a single flashcard (enhancement planned to show user status).
    - `updateUserStatus`: Updates a user's learning progress (SRS fields, bookmarked, learned) for a flashcard.
    - `getDueFlashcardsForUser`: Fetches flashcards due for review for the authenticated user.
    - `update` (flashcard content): (To be considered - implications for shared cards).
    - `delete` (flashcard): (To be considered - implications for `UserFlashcardStatus`).
- Uses a mix of `publicProcedure` (for general card listing) and `protectedProcedure` (for user-specific actions and status updates).

## Data Flow
1. Client (Expo app) makes a call to a tRPC procedure.
2. Hono server (`hono.ts`) receives the HTTP request and routes it to the tRPC adapter.
3. tRPC adapter invokes the appropriate procedure in the `appRouter`.
4. The context (`create-context.ts`) is created and passed to the procedure.
5. The procedure (e.g., in `flashcardRouter.ts`) executes its logic:
    - Validates input using Zod.
    - Interacts with the database via Prisma Client (available in `ctx.prisma`).
    - Performs business logic.
6. The procedure returns data or throws a `TRPCError`.
7. tRPC serializes the response and sends it back to the client.

## Key Technologies
- **Node.js:** Runtime environment.
- **TypeScript:** For static typing.
- **tRPC:** For building typesafe APIs.
- **Hono:** Potentially as the HTTP server framework.
- **Prisma:** ORM for database interaction.
- **Zod:** For schema validation.

This document should be updated as the backend evolves. 