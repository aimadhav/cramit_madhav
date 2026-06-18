You can add them in a concise audit format like this:

### 🔴 High - OAuth Uses Implicit Flow with Manual Token Parsing

**Issue:** Google OAuth extracts `access_token` and `refresh_token` directly from the callback URL and manually creates a session. The flow lacks PKCE verification and uses a generic custom URI scheme (`myapp://`), increasing the risk of redirect interception and token exposure.

**Impact:** An attacker controlling or intercepting the callback could potentially obtain valid session credentials.

**Recommendation:** Enable Supabase PKCE (`flowType: 'pkce'`) and replace manual token extraction with `supabase.auth.exchangeCodeForSession()`.

---

### 🔴 High - OAuth Tokens Logged to Console

**Issue:** The full OAuth callback URL is logged after authentication.

**Impact:** Access and refresh tokens may be exposed through device logs, crash reports, debugging tools, or CI logging systems.

**Recommendation:** Remove all logging of callback URLs, access tokens, refresh tokens, and session objects.

---

### 🟠 Medium - Role Derived from User-Controlled Metadata

**Issue:** User roles are sourced from `user.user_metadata.role`, which can be modified by the authenticated user through the public Supabase API.

**Impact:** Future authorization checks based on this field could allow privilege escalation (e.g., student → admin/teacher).

**Recommendation:** Source roles only from `app_metadata` or an RLS-protected database table.

---

### 🟠 Medium - Premium Status Not Synced from Backend

**Issue:** `isPremium` is hardcoded during session establishment and is not fetched from the backend user record.

**Impact:** Premium users may be incorrectly treated as non-premium, and future client-side premium checks may become unreliable.

**Recommendation:** Load premium status from the database after authentication and enforce premium access server-side.

---

### 🟡 Low - Offline User Data Not Migrated After Login

**Issue:** Data created in offline mode remains associated with the local guest user and is not migrated when a user signs into a cloud account.

**Impact:** Offline study progress, reviews, and local data may become inaccessible after account login.

**Recommendation:** Implement guest-to-account data migration before clearing local session state.

---

### 🟡 Low - Generic Custom URI Scheme

**Issue:** OAuth uses a generic custom scheme (`myapp://`) instead of an application-specific scheme.

**Impact:** Increases the risk of URI scheme collisions with other installed applications.

**Recommendation:** Use a unique application-specific scheme such as `cramit://` or `com.cramit.app://`.

# Cramit — Architecture Walkthrough, Image Bug Root Cause, and Full Code Audit

Audience: you, before you ship this MVP. Written like I'd explain it to someone joining the project today.

---

## PART 1 — How data actually moves through this app

Think of the app as four stacked layers. Data only flows in one direction at a time, top-to-bottom or bottom-to-top:

```
UI Screens (Home, Decks, DeckDetail, Study)
        ↕ hooks
Zustand Store (flashcard-store.ts)  ← single source of truth for the UI
        ↕ calls
Services (StudyService, DatabaseService, SyncService, MediaService)
        ↕ queries                              ↕ REST calls
Local SQLite (Drizzle ORM)                  Supabase (Postgres + Storage)
```

The UI **never** talks to Supabase or SQLite directly — it always goes through the store, which always goes through a service. That part of the design is good and worth keeping.

### 1.1 App boot
`RootLayout` mounts → `checkAuthStatus()` restores a session → once mounted, it calls `useFlashcardStore.getState().initializeStore()`.

`initializeStore()`:
1. Asks `DatabaseService.getAllDecks(userId)` what's already in SQLite.
2. If SQLite has **zero** decks, it seeds from the bundled `default-decks.json` (your offline starter pack).
3. Re-reads decks from SQLite and puts them in the store.

This is purely local — no network yet.

### 1.2 Cloud sync (the "Library" feed)
Three independent triggers all call `SyncService.pushChanges()` / `pullDecks()` / `pullStatuses()`:
- `RootLayout`'s `NetInfo` listener (whenever connectivity returns)
- `RootLayout`'s "just logged in" effect
- `HomeScreen`'s mount effect (`pullDecks()` then `loadDecks()`)

`pullDecks()` does `supabase.from('decks').select('*')` — **with no filter** — then loops client-side and only keeps rows where `deck.is_public` is true, calling `DatabaseService.upsertDeck(deck, [])` (metadata only, no cards yet) for each.

### 1.3 Browsing the library
`DecksScreen` (Library tab) and `HomeScreen` both read `decks` straight from the store. At this point every deck has `cardCount` (real count from local SQLite `flashcards` table) and `dueCount` (computed in `getAllDecks`). Cards themselves haven't been downloaded yet — only metadata.

### 1.4 Opening a deck → on-demand content download
This is "Stage C." Both `DeckDetailScreen`, `HomeScreen.handleStartRevision`, and `DecksScreen.handleDeckPress` independently implement the same check:

```
if (deck.cardCount === 0) {
  await SyncService.downloadDeckContent(deckId);
  await store.loadDecks();
}
```

`downloadDeckContent(deckId)`:
1. `supabase.from('flashcards').select('*').eq('deck_id', deckId).eq('status','published')`
2. `supabase.from('decks').select('*').eq('id', deckId).single()`
3. `DatabaseService.upsertDeck(deck, cards)` — this is where each card's text **and images** get written into local SQLite (images get downloaded to disk inside this call, via `MediaService`).

### 1.5 Studying
`startStudySession` → `StudyService.getSessionQueue` builds an ordered list of due+new card IDs → `loadDeckWithCards` hydrates them with parsed front/back text → user rates a card → `rateCard` action in the store → `StudyService.rateCard` runs the FSRS calculation → `DatabaseService.saveReview` writes a `reviews` row + upserts `userFlashcardStatus` + pushes a `syncQueue` row.

### 1.6 Pushing back to the cloud
Every 3rd pending sync-queue item (or whenever connectivity returns) triggers `SyncService.pushChanges`, which uploads each `card_status` row to the `user_flashcard_statuses` Supabase table.

That's the whole loop. Now — the bug you asked about.

---

## PART 2 — 🔴 Root cause: why images never load

**Symptom you reported:** text and LaTeX render fine, cards appear, but images downloaded "from Supabase" never show.

**Cause:** a camelCase vs snake_case mismatch in `DatabaseService.upsertDeck`, and it's inconsistent *within the same function* — some fields have a snake_case fallback, this one doesn't.

Look at how other fields are read from the raw Supabase row in that same function:

```ts
remoteId: deck.remote_id || deck.remoteId || null,              // ✅ checks snake_case first
prepCategory: deck.prep_category || deck.prepCategory || null,   // ✅ checks snake_case first
userId: deck.user_id || deck.userId || 'system',                 // ✅ checks snake_case first
startingStability: fc.starting_stability || fc.startingStability || 0, // ✅ checks snake_case first
```

Whoever wrote this clearly knew Supabase/Postgres returns `snake_case` column names. But two fields were missed:

```ts
let coverImage = deck.coverImage || null;     // ❌ only checks camelCase
...
let mediaUrls = fc.mediaUrls || [];           // ❌ only checks camelCase
if (mediaUrls.length > 0) {
  mediaUrls = await MediaService.downloadImages(mediaUrls);
}
```

If your Postgres columns are actually named `cover_image` and `media_urls` (which is the standard convention, and matches every other column in this codebase), then:
- `fc.mediaUrls` is `undefined` → `mediaUrls` becomes `[]`
- `mediaUrls.length > 0` is `false` → **`MediaService.downloadImages` is never called**
- `JSON.stringify([])` gets written into the local `flashcards.mediaUrls` column
- Every screen that reads `card.mediaUrls` gets an empty array, forever, even though Supabase genuinely has the URLs

Same logic kills deck cover images. Text/LaTeX survive because `frontContent`/`backContent` have an explicit fallback-construction path that doesn't depend on snake_case detection in the same fragile way.

### The fix — CONFIRMED against the real Supabase schema

> **Update:** the original version of this section was an educated guess based on naming convention alone. We now have the actual `public.flashcards` / `public.decks` DDL, and the real column names are *not* what was guessed — they're not just snake_case versions of the camelCase names, they're genuinely different names. The fix below is the verified one.

The real `flashcards` table has `media_urls_json` (a `text` column holding a **JSON-encoded string**, not a native array) — not `media_urls`, not `mediaUrls`. The real `decks` table has `tags_json` (same deal — already a JSON string) for tags, but `cover_image` for the cover (that guess was correct). And `content_type` (not `contentType`), `front_content`/`back_content` `jsonb` columns (not `frontContent`/`backContent` — these exist but the current code's camelCase check never matches them, so they're silently never read; the app currently survives this only because it falls back to the plain `front`/`back` text columns, which do match).

```ts
// deck cover image — this one was already correct
let coverImage = deck.cover_image || deck.coverImage || null;

// deck tags — real column is tags_json, already a JSON-encoded string. Don't re-stringify it.
let tagsJson = deck.tags_json || JSON.stringify(deck.tags || []);
// later: tags: tagsJson   (replacing `JSON.stringify(deck.tags || [])`)

// flashcard media — real column is media_urls_json, a JSON STRING, not a pre-parsed array
let mediaUrls: string[] = [];
const rawMediaUrls = fc.media_urls_json ?? fc.mediaUrls ?? '[]';
try {
  mediaUrls = typeof rawMediaUrls === 'string' ? JSON.parse(rawMediaUrls) : rawMediaUrls;
} catch {
  mediaUrls = [];
}
if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
  mediaUrls = await MediaService.downloadImages(mediaUrls);
}

// content type — real column is content_type, not contentType
const contentType = fc.content_type || fc.contentType || 'text';

// front/back rich content — real columns are front_content / back_content (jsonb), not frontContent/backContent.
// Currently always falls through to reconstructing from fc.front/fc.back, which happens to work for plain
// text+latex, but means the richer mixed-content jsonb columns (if you ever populate them with inline image
// markers etc.) are completely ignored today.
let frontContent = fc.front_content
  ? JSON.stringify(fc.front_content)
  : fc.frontContent || JSON.stringify([{ type: contentType, value: fc.front }]);
let backContent = fc.back_content
  ? JSON.stringify(fc.back_content)
  : fc.backContent || JSON.stringify([{ type: contentType, value: fc.back }]);
```

One more thing to check while you're in there: once `upsertDeck` resolves a remote URL to a local file URI, the original remote URL is **gone** — it's overwritten in SQLite. If `MediaService.clearCache()` is ever called (or the OS reclaims the documents directory, or the app is reinstalled), every card permanently loses its image with no way to re-fetch it, because the canonical Supabase URL was never kept anywhere. Recommend storing the **remote** URL in one column and the **cached local path** in a separate column, and have the UI fall back from local → remote → nothing.

### 2.1 Correction: the second image bug isn't in your live study screen

A previous version of this doc flagged `FlashcardContentModal.tsx`'s `contentType === 'image' || 'mixed'` gate as "very likely your real study UI." That assumption was wrong — `app/study/[id].tsx` is the confirmed real study screen, and it does **not** gate on `contentType` at all; it renders the image purely based on `currentCard.mediaUrls.length > 0`. So once the `media_urls_json` fix above is applied, images should work correctly in the actual study flow.

The `contentType`-gated bug in `FlashcardContentModal.tsx` is still real and now fully confirmed against the schema — `content_type` exists in Postgres but nothing maps it into the local SQLite row or the normalized card object, so `card.contentType` is always `undefined` and this condition is permanently false:

```jsx
{(card.mediaUrls && card.mediaUrls.length > 0 &&
  (card.contentType === 'image' || card.contentType === 'mixed')) && (
  <Image source={{ uri: card.mediaUrls[0] }} style={styles.modalImage} contentFit="contain" />
)}
```

**Fix:** drop the `contentType` check and gate on data presence only:
```jsx
{card.mediaUrls && card.mediaUrls.length > 0 && (
  <Image source={{ uri: card.mediaUrls[0] }} style={styles.modalImage} contentFit="contain" />
)}
```

This just isn't the cause of what you're currently seeing — unless that modal is wired up somewhere you haven't shown me yet — so treat it as lower priority than the main flow.

**Also worth fixing — inconsistent front/back image handling across the three card-rendering components:**
- `app/study/[id].tsx` (the real study screen) and `card/[id].tsx` (`CardDetailScreen`) both treat `mediaUrls[0]` as the front image and `mediaUrls[1]` as the back image.
- `FlashcardContentModal.tsx` only ever renders `mediaUrls[0]`, on the front, and says so in a comment ("We'll only display the first image on the front for now").

Same card, two different image counts depending which screen shows it. Decide on one convention — ideally an explicit `{ front: [...], back: [...] }` shape instead of a flat array with positional meaning, since a card with only a back image currently has no correct way to express that.

---

## PART 3 — Column / field-name inventory (for your own audit)

This is the full list of every field name referenced in code, grouped by where it lives. Cross-check these against your actual Postgres schema — anywhere a snake_case fallback is missing is a place that will silently fail exactly like the image bug above.

### Local SQLite (Drizzle) — `schema.decks`
`id, remoteId, name, description, subject, chapter, coverImage, version, isDownloaded, downloadedAt, isPublic, prepCategory, userId, tags, createdAt, updatedAt, deletedAt`

### Local SQLite — `schema.flashcards`
`id, deckId, frontContent, backContent, startingStability, mediaUrls, createdAt, updatedAt, deletedAt`

### Local SQLite — `schema.userFlashcardStatus`
`id, userId, flashcardId, interval, stability, difficulty, repetitions, due_date, lastReviewed, isBookmarked, notes, createdAt, updatedAt, deletedAt`
> ⚠️ `due_date` is the **only** snake_case field in an otherwise camelCase schema. Not a bug today (every read site uses `due_date` consistently), but it's a landmine for the next person who assumes camelCase. Consider renaming for consistency.

### Local SQLite — `schema.reviews`
`id, flashcardId, userId, rating, reviewedAt, responseTimeMs, previousStability, newStability, previousDifficulty, newDifficulty, createdAt, updatedAt, deletedAt`

### Local SQLite — `schema.syncQueue`
`id, operation, entityType, entityId, payload, status, createdAt, updatedAt`

### Supabase remote — `decks` table (fields the code reads off the raw row)
| Code checks | Snake_case fallback present? |
|---|---|
| `remote_id` / `remoteId` | ✅ |
| `name`, `description`, `chapter`, `tags`, `version` | n/a (no casing issue) |
| `subject` / `subjectName` | ✅ (different naming, not casing) |
| `coverImage` | ❌ **missing `cover_image` fallback — likely bug** |
| `prep_category` / `prepCategory` | ✅ |
| `is_public` | n/a, read directly |
| `user_id` / `userId` | ✅ |
| `created_at` / `createdAt`, `updated_at` *(not read on insert path)* | ✅ |

### Supabase remote — `flashcards` table
| Code checks | Snake_case fallback present? |
|---|---|
| `frontContent` (falls back to building from `front`+`contentType`) | partial |
| `backContent` (falls back to building from `back`+`contentType`) | partial |
| `starting_stability` / `startingStability` | ✅ |
| `mediaUrls` | ❌ **missing `media_urls` fallback — confirmed root cause of your bug** |
| `deck_id` (query filter), `status` (query filter `'published'`) | n/a, read directly |
| `id`, `created_at`/`createdAt`, `updated_at`/`updatedAt` | ✅ |

### Supabase remote — `user_flashcard_statuses` table
`user_id, flashcard_id, interval, stability, difficulty, repetitions, due_date, last_reviewed, is_bookmarked, notes, updated_at, created_at, id` — all read with explicit snake_case names in `pullStatuses`/`syncCardStatus`, no issues found here.

---

## PART 4 — Security & privacy issues (ranked by severity)

### 🔴 Critical — `pullDecks()` fetches every deck row, public or not, before filtering
```ts
const { data, error } = await supabase.from('decks').select('*'); // no .eq('is_public', true)
...
if (deck.is_public) { await DatabaseService.upsertDeck(deck, []); }
```
The `if (deck.is_public)` check happens **after** the data already left Supabase and landed on the device. That means:
- This is only safe if Postgres **Row Level Security (RLS)** independently restricts what an anonymous/authenticated client can `select` from `decks`. If RLS isn't configured (or is permissive), private/draft deck metadata for every user is downloaded to every device, and the `is_public` check is just hiding it from the UI — not protecting it.
- **Fix:** add `.eq('is_public', true)` to the query itself, *and* verify/add an RLS policy on `decks` so that even a raw REST call to PostgREST can't return non-public rows to someone who shouldn't see them. Client-side filtering is never a security boundary by itself.

### 🔴 Critical — `downloadDeckContent(deckId)` has no public/ownership check at all
```ts
const { data: cards } = await supabase.from('flashcards').select('*').eq('deck_id', deckId).eq('status','published');
const { data: deck } = await supabase.from('decks').select('*').eq('id', deckId).single();
if (deck && cards) await DatabaseService.upsertDeck(deck, cards);
```
There is **no `is_public` check anywhere in this function**. If a client (legit user, or anyone calling your Supabase anon key directly) supplies a `deckId` for a private/unpublished deck — guessed, leaked from a log, or simply iterated — this function will happily pull and persist the full deck content locally. This is a classic IDOR (Insecure Direct Object Reference). It must be fixed at the database layer:
- Add an RLS policy on both `decks` and `flashcards`: `SELECT` only allowed where `is_public = true` (or the row belongs to `auth.uid()`).
- Optionally add a defensive `if (!deck?.is_public) return false;` client-side too, but treat that as UX, not security.

### 🟠 High — confirm RLS on `user_flashcard_statuses` write path
`syncCardStatus` upserts using a `userId` taken from local app state (`user_id: userId`). If there isn't a Postgres policy like `WITH CHECK (auth.uid() = user_id)` on this table, a modified client could write/overwrite another user's progress rows by simply changing the `userId` it sends. Verify this policy exists.

### 🟠 High — debug method ships in the production service
`DatabaseService.getDebugCardData()` returns notes, stability, difficulty, bookmarks — i.e. private user data — keyed by user. Make sure nothing reachable from the shipped app (a hidden settings screen, a deep link, etc.) calls this. Recommend deleting it or gating it behind `__DEV__`.

### 🟡 Medium — verbose `console.log` of PII and internal state throughout
Emails, names, deck contents, and category info are logged everywhere (`console.log('📦 ... user?.email')`, etc.). On-device logs can end up in crash reporters or be pulled off a device. Strip or gate behind `__DEV__` before release.

### 🟡 Medium — guest/local progress isn't migrated on login
Anonymous use stores everything under `userId = 'local'`. When a guest later logs in, there's no migration step moving `'local'`-scoped rows to the real `userId` — that study history just becomes orphaned/invisible. Worth a one-time migration routine on first login.

---

## PART 5 — Data integrity & reliability bugs

| # | Issue | Where | Why it matters |
|---|---|---|---|
| 1 | `getAllDecks` re-runs the **entire** `userFlashcardStatus` table query once per deck inside `Promise.all` | `database-service.ts` | Classic N+1: with 20 decks you run the same full-table scan 20 times. Hoist it outside the loop and compute a lookup map once. |
| 2 | No DB transaction wrapping `upsertDeck`'s deck-insert + per-card loop | `database-service.ts` | A crash mid-loop leaves a deck "synced" with only some of its cards saved, and no rollback. Wrap in `db.transaction(...)`. |
| 3 | `JSON.parse(deck.tags || '[]')` has no try/catch | `database-service.ts` → `getAllDecks` | One corrupted `tags` value throws and kills the **entire** deck list for the app, not just that deck. |
| 4 | `card.mediaUrls ? JSON.parse(...) : []` has no try/catch (unlike the front/back parsing right above it, which does) | `flashcard-store.ts` → `loadDeckWithCards` | Same failure mode as #3 but for the card list. |
| 5 | `task.entityId.includes('test')` used to skip fake sync rows | `sync-service.ts` → `pushChanges` | If any **real** production deck/card ID ever contains the substring "test" anywhere, that user's real reviews get silently discarded, marked "synced," and never reach the server. Use an explicit flag instead of substring matching on real IDs. |
| 6 | `downloadDeckContent`'s `.single()` deck fetch error is silently swallowed (`const { data: deck } = await ...`, error ignored) | `sync-service.ts` | If the deck row 404s/multi-matches, you get a quiet no-op with zero logging — hard to debug "why didn't this deck download." |
| 7 | `toggleBookmark` / `updateNote` insert a brand-new `userFlashcardStatus` row (with `due_date: now` and blank FSRS fields) for cards that were **never studied** | `database-service.ts` | Bookmarking an unstudied card makes it look like a "due" card with bogus stability/difficulty, and it stops counting as "new" in `getSessionQueue`. Side-effect actions shouldn't initialize spaced-repetition state. |
| 8 | `getDeckCompletionRate()` is a stub that always returns `0` | `flashcard-store.ts` | Dead/unimplemented — fine for MVP only if nothing in the UI relies on it yet. |
| 9 | `setDecks: (decks) => {}` is a no-op, but `RootLayout` extracts and references it | `flashcard-store.ts` / `_layout.tsx` | Dead code that looks load-bearing. Either implement it or delete the reference — it's misleading as-is. |
| 10 | `error: string | null` exists in store state but nothing ever sets it | `flashcard-store.ts` | Failures (failed loads, failed syncs) never surface to the UI through this field — it's purely decorative right now. |
| 11 | `resetAllProgress` is typed as `() => void` in the interface but implemented as `async` | `flashcard-store.ts` | Type lies to callers; anything awaiting completion (e.g., to refresh UI after reset) can't know when it's actually done. |
| 12 | `MediaService` hashes the **full URL** (including query string) for the cache filename | `media-service.ts` | If your Supabase Storage URLs carry signed tokens that rotate, every fetch gets a different hash → cache never hits, you keep redownloading the same image. Strip query params before hashing, or use the storage object's stable path/ID. |
| 13 | `clearCache()` deletes files but never touches the DB rows pointing at them | `media-service.ts` | After a cache clear, `flashcards.mediaUrls`/`decks.coverImage` still point at deleted local files — broken images with no automatic re-fetch, and (per Part 2) no remote URL kept to recover from. |
| 14 | No timeout on `FileSystem.downloadAsync` | `media-service.ts` | A slow/stalled connection can hang a deck's image batch indefinitely. |
| 15 | `syncQueue` schema already has `retryCount` and `lastError` columns, but `pushChanges` never writes to either | `db/schema.ts` vs `sync-service.ts` | The retry/backoff infrastructure is sitting there unused — failed tasks are just relabeled and never retried or explained. Wire these up instead of leaving them dead. |
| 16 | Schema comment documents sync status values as `'pending' / 'synced' / 'failed'`, but the code actually writes `'failed_on_server'` | `db/schema.ts` vs `sync-service.ts` | Any future cleanup/retry query written against the documented value `'failed'` will silently miss every row that's actually stuck, because the real value never matches. |
| 15 | `getTotalCardsStudied()` computed as `cardCount - dueCount` per deck | `flashcard-store.ts` | This is a proxy for "not currently due," not actual studied count — cards that are due again don't count, undercounting real study history. |

---

## PART 6 — State management & UI bugs

| # | Issue | Where |
|---|---|---|
| 1 | `const isLoading = useFlashcardStore.getState().isLoading;` reads state via `getState()` during render instead of the reactive selector `useFlashcardStore(s => s.isLoading)` | `DeckDetailScreen.tsx` — component won't re-render when loading toggles, so the spinner/disabled button state will look stuck until something *else* forces a re-render |
| 2 | The entire "Quick Prep" tab (`DecksScreen`) runs on `MOCK_CURRICULUM` / `MOCK_CONTENT_TYPES` / `MOCK_USER_STATS`, and its "Start Cramming" button always routes to a hardcoded `/study/temp_123`, ignoring whatever the user actually selected | `decks.tsx` | Looks fully functional but does nothing real — flag this clearly before release so it isn't mistaken for a finished feature |
| 3 | `handleStartRevision` (Home) and `handleDeckPress` (Decks) duplicate the same "download if empty, reload, then navigate" logic | `index.tsx`, `decks.tsx` | Any future fix has to be applied twice; pull into a shared store action or hook |
| 4 | Heavy use of `require()` inside store actions instead of top-level imports (sometimes duplicating an already-imported module, e.g. `StudyService` is imported at the top *and* re-required inside `rateCard`) | `flashcard-store.ts` | Works, but fragile — easy to end up with two different module instances/inconsistent mocking in tests, and harder to statically analyze |
| 5 | `CardDetailScreen` reads `mediaUrls[0]`=front/`mediaUrls[1]`=back; `FlashcardContentModal` only ever reads `mediaUrls[0]`, on the front, and explicitly hasn't implemented back-image display | `card/[id].tsx`, `FlashcardContentModal.tsx` | Same card shows a different number of images depending which screen renders it; the flat positional array can't correctly represent a card that only has a back image |

---

## PART 7 — Prioritized fix list

| Priority | Item |
|---|---|
| 🔴 Do first | Fix the `media_urls_json` / `tags_json` real-column mismatch in `upsertDeck` (Part 2) — this is your reported bug, now confirmed against the real schema |
| 🔴 Do first | Apply the RLS policies in Part 8 to `decks`, `flashcards`, and `user_flashcard_statuses` at minimum — this is the real fix for `pullDecks`/`downloadDeckContent` having no server-side ownership check |
| 🟠 Before launch | Remove the `card.contentType === 'image' \|\| 'mixed'` gate in `FlashcardContentModal.tsx` — confirmed dead condition, but not the cause of your main-flow symptom |
| 🟠 Before launch | Remove/guard `getDebugCardData`; strip PII from `console.log`s |
| 🟠 Before launch | Fix the `entityId.includes('test')` heuristic in `pushChanges` |
| 🟠 Before launch | Fix `DeckDetailScreen`'s `isLoading` selector bug |
| 🟡 Soon after | N+1 query fix in `getAllDecks`; wrap `upsertDeck` in a transaction; add try/catch around the two unguarded `JSON.parse` calls |
| 🟡 Soon after | Decide on real vs mock "Quick Prep" tab before users hit it |
| 🟢 Cleanup | Dead code: `setDecks`, `error` field, `getDeckCompletionRate` stub, `resetAllProgress` typing |
| 🟢 Cleanup | Store the remote image URL separately from the cached local path so cache clears are recoverable |

---

---

## PART 8 — Row Level Security (RLS) policy guide

This is based on the real schema you shared (`public.users`, `decks`, `flashcards`, `user_flashcard_statuses`, `reviews`, `study_sessions`, `rooms`, `room_memberships`, `room_decks`).

**Core mental model:** `GRANT`s decide whether a Postgres role (`anon`, `authenticated`) can touch a table at all; RLS policies decide which *rows* it can see/touch once RLS is enabled. Supabase-created tables usually already have the right grants — if these tables were created by hand, double check with `\dp public.decks` or the Table Editor's policy tab. With RLS **enabled** and zero matching policies, every row is denied by default — that default-deny is exactly what closes the `pullDecks`/`downloadDeckContent` leak from Part 4.

**⚠️ Assumption to verify first:** every policy below assumes `public.users.id` is set to the Supabase Auth UID as text, i.e. `auth.uid()::text = users.id`. Confirm with `select id from public.users limit 5;` compared against a real `auth.uid()` value — if your custom auth doesn't actually populate it that way, the join condition needs to change.

**Rollout order to avoid locking yourself out:** enable + test on `reviews` and `study_sessions` first (simplest, lowest blast radius), then `user_flashcard_statuses`, then `decks`/`flashcards` (test as both an anonymous/anon-key request and as a logged-in user), then the `rooms` family last.

### 8.1 `users`

```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid()::text = id) WITH CHECK (auth.uid()::text = id);

-- Only needed if the client itself creates the row (vs. a server-side trigger on signup)
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid()::text = id);

-- No DELETE policy → deletes denied by default.
```

⚠️ **Important gap a row policy can't close on its own:** `users_update_own` lets a user update *their own row* — including flipping `is_admin` or `is_premium` to `true` themselves, since RLS protects rows, not individual columns. Close that with a column-level revoke:

```sql
REVOKE UPDATE (is_admin, is_premium, role) ON public.users FROM authenticated;
-- Grant those columns only to a privileged role you control server-side, e.g. service_role or a custom admin role.
```

### 8.2 `decks`

```sql
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon/unauthenticated) can read public decks; owners can also read their own private/draft ones
CREATE POLICY "decks_select_public_or_own" ON public.decks
  FOR SELECT USING (is_public = true OR user_id = auth.uid()::text);

CREATE POLICY "decks_insert_own" ON public.decks
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "decks_update_own" ON public.decks
  FOR UPDATE USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "decks_delete_own" ON public.decks
  FOR DELETE USING (user_id = auth.uid()::text);
```

### 8.3 `flashcards` — this is the one that fixes the IDOR

```sql
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

-- Visible if the parent deck is public AND the card is published, OR you own the parent deck (so you can see your own drafts)
CREATE POLICY "flashcards_select_visible" ON public.flashcards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.decks d
      WHERE d.id = flashcards.deck_id
        AND ((d.is_public = true AND flashcards.status = 'published') OR d.user_id = auth.uid()::text)
    )
  );

CREATE POLICY "flashcards_insert_own_deck" ON public.flashcards
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.decks d WHERE d.id = flashcards.deck_id AND d.user_id = auth.uid()::text)
  );

CREATE POLICY "flashcards_update_own_deck" ON public.flashcards
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.decks d WHERE d.id = flashcards.deck_id AND d.user_id = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM public.decks d WHERE d.id = flashcards.deck_id AND d.user_id = auth.uid()::text));

CREATE POLICY "flashcards_delete_own_deck" ON public.flashcards
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.decks d WHERE d.id = flashcards.deck_id AND d.user_id = auth.uid()::text)
  );
```

With this in place, `downloadDeckContent(privateDeckId)` from a non-owner returns **zero rows** at the database level — no matter what the client-side JS does or doesn't check.

### 8.4 `user_flashcard_statuses` — closes the "forged userId" risk

```sql
ALTER TABLE public.user_flashcard_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ufs_select_own" ON public.user_flashcard_statuses
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "ufs_insert_own" ON public.user_flashcard_statuses
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "ufs_update_own" ON public.user_flashcard_statuses
  FOR UPDATE USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "ufs_delete_own" ON public.user_flashcard_statuses
  FOR DELETE USING (user_id = auth.uid()::text);
```

### 8.5 `reviews` — treat as an immutable log

```sql
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select_own" ON public.reviews
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "reviews_insert_own" ON public.reviews
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- Deliberately no UPDATE/DELETE policy — review history shouldn't be editable by clients.
```

### 8.6 `study_sessions`

```sql
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select_own" ON public.study_sessions
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "sessions_insert_own" ON public.study_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "sessions_update_own" ON public.study_sessions
  FOR UPDATE USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
```

### 8.7 `rooms`, `room_memberships`, `room_decks`

```sql
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_decks ENABLE ROW LEVEL SECURITY;

-- Members and the creator can read a room
CREATE POLICY "rooms_select_member" ON public.rooms
  FOR SELECT USING (
    created_by = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.room_memberships m WHERE m.room_id = rooms.id AND m.user_id = auth.uid()::text)
  );

CREATE POLICY "rooms_insert_self" ON public.rooms
  FOR INSERT WITH CHECK (created_by = auth.uid()::text);

CREATE POLICY "rooms_update_creator" ON public.rooms
  FOR UPDATE USING (created_by = auth.uid()::text) WITH CHECK (created_by = auth.uid()::text);

CREATE POLICY "rooms_delete_creator" ON public.rooms
  FOR DELETE USING (created_by = auth.uid()::text);

-- See your own membership, or any membership in a room you also belong to (so you can see classmates)
CREATE POLICY "memberships_select" ON public.room_memberships
  FOR SELECT USING (
    user_id = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.room_memberships m2 WHERE m2.room_id = room_memberships.room_id AND m2.user_id = auth.uid()::text)
  );

-- Join a room = insert your own membership row
CREATE POLICY "memberships_insert_self" ON public.room_memberships
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- Leave a room yourself, or be removed by the room's creator
CREATE POLICY "memberships_delete" ON public.room_memberships
  FOR DELETE USING (
    user_id = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_memberships.room_id AND r.created_by = auth.uid()::text)
  );

-- Decks attached to a room are visible to members/creator; only the creator attaches/detaches them
CREATE POLICY "room_decks_select_member" ON public.room_decks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.room_memberships m WHERE m.room_id = room_decks.room_id AND m.user_id = auth.uid()::text)
    OR EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_decks.room_id AND r.created_by = auth.uid()::text)
  );

CREATE POLICY "room_decks_insert_creator" ON public.room_decks
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_decks.room_id AND r.created_by = auth.uid()::text));

CREATE POLICY "room_decks_delete_creator" ON public.room_decks
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_decks.room_id AND r.created_by = auth.uid()::text));
```

**Gotcha:** `rooms_select_member` means a non-member can't `SELECT` a room to discover it — which breaks a "join by room code" flow, since the client needs to look the room up *before* it can join. Don't widen the `SELECT` policy to "anyone can read any room" just to make that work (that re-leaks room metadata to non-members). Instead, write a `SECURITY DEFINER` Postgres function that looks up the room by code (bypassing RLS internally, safely, since you control exactly what it does), validates, and inserts the membership row — call it from the client via `supabase.rpc('join_room_by_code', { code })`.

### 8.8 One open design question for later

Your `decks` table has `price` and `is_premium` columns, implying paid decks are planned. None of the code reviewed so far (or the policies above) handle "user hasn't purchased this premium deck" — right now a premium deck with `is_public = true` would be fully readable by anyone the moment monetization logic is added to the UI but not to RLS. Before you turn on payments, you'll want an `entitlements`/`purchases` table and an additional `AND (NOT is_premium OR EXISTS (entitlement check))` clause in the `flashcards_select_visible` (and deck) policies — flagging now so it's not a surprise later.

### 8.9 How to sanity-check policies before trusting them

- In the Supabase SQL editor, you can impersonate a role for testing: `SET ROLE authenticated; SET request.jwt.claims = '{"sub":"<some-user-id>"}';` then run a `SELECT` and confirm you only see what you expect — then `RESET ROLE`.
- Hit the table directly over REST with the anon key (`curl` with `apikey`/`Authorization` headers) for a deck you know is private, and confirm you get an empty array back, not the row.
- Do this **before** removing any client-side filters — once RLS is verified, the client-side `.eq('is_public', true)` becomes a (still worthwhile) performance optimization rather than your only line of defense.

---

If you want, I can patch `database-service.ts` and `sync-service.ts` directly with the fixes above (the image bug, the RLS-adjacent query filter, and the transaction wrapping) — just point me at the actual files in your repo.