# Cramit Architecture Audit

This audit focuses on architecture, not product intent. The offline-first direction is sensible, but several repo-level decisions made the codebase much larger and harder to reason about than it needed to be.

## Executive Summary

The strongest parts of the project are the local-first study model, the clear product focus, and the separation between SQLite, services, and UI. The weakest parts are the accidental complexity around auth, sync, and repo structure.

The main pattern is this: the app is trying to be a mobile client, a backend, a teacher portal, a data migration tool, and a sync engine inside one package. That creates duplicated dependencies, duplicated state, and a lot of custom code that a smaller boundary or a purpose-built library could have removed.

## High Impact Issues

### 1. One package is carrying too many roles

The repo includes the Expo mobile app, backend-style seed scripts, a deleted but still referenced Prisma layer, tRPC/Hono dependencies, and references to a Next.js creator portal. The runtime app is clearly Expo Router, but `package.json` still carries `next`, `prisma`, `@prisma/client`, `hono`, and the tRPC packages.

Why this is bad:
- It increases install size and mental overhead.
- It makes dependency decisions ambiguous: are you building a mobile app, a backend, or a web admin system?
- It encourages shared code paths that do not actually share runtime needs.

What would have been better:
- Split the product into separate workspaces: `mobile/`, `admin/`, and `scripts/`.
- Keep the mobile app on Expo + SQLite + Supabase only.
- Keep any teacher/admin portal in a separate Next.js app if it truly exists.
- Move one-off seed/admin tooling out of the main runtime package.

What would have saved code:
- Removing unused backend framework dependencies would reduce config, type churn, and build confusion.
- Separate packages make it obvious where code belongs and prevent accidental cross-imports.

### 2. Auth is implemented with a custom redirect and manual token parsing

`services/auth-service.ts` uses `openAuthSessionAsync`, parses `access_token` and `refresh_token` from the returned URL, and then manually calls `supabase.auth.setSession()`.

Why this is bad:
- It reimplements what the auth library already supports.
- It creates a fragile browser/redirect parsing path.
- It is harder to secure and harder to test.

What would have been better:
- Use Supabase PKCE flow.
- Use `exchangeCodeForSession()` instead of manually extracting tokens.
- Let Supabase own the OAuth session handoff as much as possible.

What would have saved code:
- A standard auth flow removes the token parsing branch, most redirect handling, and part of the session bootstrapping logic.

### 3. The sync layer is hand-rolled when a local-first sync framework would fit better

The app builds its own offline sync system with a `sync_queue`, retry counters, push/pull methods, and manual reconciliation in `services/sync-service.ts`.

Why this is bad:
- You are writing infrastructure that is notoriously easy to get wrong.
- Conflict handling, retries, and incremental reconciliation are all custom.
- The app now owns a lot of synchronization policy instead of focusing on product behavior.

What would have been better:
- If offline-first is a core product requirement, use a sync-native solution such as PowerSync, Replicache, RxDB, or Electric-style tooling instead of building the whole pipeline yourself.
- If you keep the custom stack, isolate sync into a dedicated domain module with a strict DTO layer.

What would have saved code:
- A sync framework would remove much of the queue orchestration, retry handling, and manual pull/push code.

### 4. Zustand is being used as both UI state and application orchestration

`store/flashcard-store.ts` does more than store state. It triggers data loading, session creation, sync kicks, cache priming, review handling, bookmark updates, and navigation-adjacent side effects.

Why this is bad:
- The store becomes a second service layer.
- It is harder to test because state changes and side effects are tightly coupled.
- UI and data concerns bleed into one another.

What would have been better:
- Keep Zustand for ephemeral UI state only.
- Move async domain actions into service hooks or use-case functions.
- Use TanStack Query for remote/server state instead of manually refreshing through the store.

What would have saved code:
- You would have fewer imperative `getState()` calls, fewer side effects inside the store, and less manual refresh glue in the screens.

### 5. `DatabaseService` is doing too many jobs at once

`services/database-service.ts` mixes persistence, record mapping, media downloading, JSON parsing, scoring updates, and deck-level aggregation.

Why this is bad:
- The service is a repository, mapper, content hydrator, and analytics helper all in one.
- It becomes hard to change one concern without risking another.
- The file is a classic example of a fat service class.

What would have been better:
- Split it into smaller modules: `deck-repository`, `card-repository`, `status-repository`, `content-mapper`, and `media-hydrator`.
- Keep media downloading outside the persistence layer.

What would have saved code:
- The current file would be much smaller and easier to reason about, and future features would not keep adding branches into one large class.

### 6. The code uses stringly-typed JSON blobs for core flashcard content

Flashcard front/back content, media URLs, and tags are stored as JSON strings in SQLite text columns.

Why this is bad:
- Every read and write requires parse/stringify logic.
- The app has to defend against malformed JSON everywhere.
- The data model is harder to query and harder to validate.

What would have been better:
- Use a normalized schema for card content where the shape matters.
- If JSON storage is required, keep one canonical serializer/deserializer and validate with Zod at the boundary.

What would have saved code:
- You would remove repeated parse guards, fallback logic, and special cases in the study and sync layers.

### 7. Subject detection is hard-coded and duplicated

`study-service.ts` and `store/flashcard-store.ts` both use hard-coded `knownSubjects` arrays to decide whether an ID is a subject or a deck.

Why this is bad:
- It duplicates business logic in multiple places.
- It is easy for one list to drift from another.
- Adding a subject requires editing code instead of data.

What would have been better:
- Store subject metadata in the database or a single config source.
- Infer subject/deck relationships from the schema instead of from repeated arrays.

What would have saved code:
- No repeated `knownSubjects` lists, fewer conditional branches, and fewer subject-routing bugs.

### 8. The app overwrites remote media references with local cache paths

The current media flow resolves remote URLs into cached local file paths and stores those local paths back into SQLite.

Why this is bad:
- You lose the canonical remote source of truth.
- Cache eviction or app reinstall can permanently break image recovery.
- Rehydrating content later becomes much harder.

What would have been better:
- Store both the remote URL and the local cache path.
- Let the UI fall back from local path to remote URL when needed.

What would have saved code:
- You would not need to reconstruct image provenance later, and cache repair becomes a deterministic fallback rather than a guess.

### 9. The auth/session state is duplicated across several storage layers

The app keeps session state in Supabase auth, Zustand, SecureStore/AsyncStorage, and local user objects.

Why this is bad:
- There are multiple sources of truth for the same user session.
- Logout, refresh, and offline login paths become fragile.
- It is easy for one layer to get stale.

What would have been better:
- Let Supabase manage the auth session and persist it in one place.
- Derive app profile state from a dedicated `profiles` table or a single local session model.

What would have saved code:
- You would need less custom session plumbing in `store/user-store.ts` and fewer reconciliation checks in `app/_layout.tsx`.

### 10. Initialization and sync side effects live in the root layout

`app/_layout.tsx` handles auth checking, store initialization, network listeners, sync triggers, and routing redirects in the same file.

Why this is bad:
- The root layout becomes a control tower instead of a layout.
- It is hard to see which side effect belongs to which subsystem.
- Small changes in auth or sync can accidentally affect navigation.

What would have been better:
- Move boot logic into dedicated providers or hooks.
- Keep the root layout focused on composition and route gating.

What would have saved code:
- Each concern becomes easier to test and easier to move without touching the entire app shell.

### 11. The app keeps an old backend/tooling stack alive in scripts and tests

Prisma is still used in `script-create-user.js` and the package manifest still references Prisma seed tooling, even though the runtime persistence layer is Drizzle + SQLite.

Why this is bad:
- It creates two database toolchains in one repo.
- New contributors have to understand both stacks.
- Tooling drift increases the chance of wrong assumptions.

What would have been better:
- Use one data access story.
- If scripts need admin access, call Supabase directly with service-role credentials or isolate them into a tooling package.

What would have saved code:
- Fewer install steps, fewer generated artifacts, and fewer conflicting database conventions.

## What I Would Keep

- Expo Router is a good fit for this app.
- SQLite as the on-device source of truth is a strong decision.
- Drizzle is a reasonable choice for typed local SQL.
- The split between study logic and UI is directionally correct, even if the boundaries are still too fat in places.

## Best Replacement Stack If You Wanted Less Code

If the goal was to ship this kind of app with less custom infrastructure, I would lean toward:

- Expo Router for the mobile shell
- Supabase for auth and backend storage
- TanStack Query for remote/server state
- A local-first sync framework such as PowerSync, Replicache, or RxDB if offline sync is a hard requirement
- Zod for DTO validation at service boundaries
- One workspace per product surface instead of one large mixed repo

That combination would have removed a lot of the manual session, sync, and parsing code you currently own.

## Bottom Line

The app is not architecturally weak because it is offline-first. It is architecturally expensive because it implemented offline-first with a lot of custom glue, while also keeping dead or migrated backend tooling in the same repo.

If you want, the next useful step is to turn this audit into a prioritized refactor plan with three buckets: what to delete, what to isolate, and what to replace.