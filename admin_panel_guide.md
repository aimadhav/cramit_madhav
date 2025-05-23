# Admin Panel Development Guide for CramItFinal

This document provides a comprehensive guide (A to Z) for creating an admin panel for the CramItFinal application. The primary purpose of this admin panel is to allow a designated administrator (you) to create, manage, and publish decks and flashcards as public content for all students/users.

## 1. Purpose and Core Functionalities

**Purpose:**
To provide a secure and efficient interface for administrators to manage globally available educational content (public decks and flashcards) within the CramItFinal application.

**Core Functionalities:**
- **Admin Authentication:** Secure login for administrators.
- **Deck Management:**
    - Create new decks and explicitly mark them as `isPublic: true`.
    - List all decks (both public and private) with clear distinction.
    - Edit existing decks (content, metadata, and `isPublic` status).
    - Delete decks (with appropriate warnings, especially for public decks).
- **Flashcard Management (within a deck context):**
    - Add new flashcards to any deck (especially public decks).
    - Edit existing flashcards in any deck.
    - Delete flashcards from any deck.
- **(Optional) User Management:**
    - List users.
    - Grant/revoke admin privileges (if more admins are needed).

## 2. Key Design Decisions

### a. Authentication & Authorization

This is the most critical aspect for security.

- **Recommendation: Role-Based Access Control (RBAC)**
    - Add an `isAdmin: Boolean @default(false)` field to your existing `User` model in `prisma/schema.prisma`.
    - You (and any other designated admins) will have this flag set to `true` in the database.
    - Backend API endpoints for the admin panel will be protected by a middleware that checks if `ctx.user.isAdmin === true`.

### b. Technology Stack for Admin Panel

- **Option 1: Integrated with Main App (if simple UI needed)**
    - If the admin UI is simple, you could potentially build it as a set of specific routes within your existing Expo app, conditionally rendered if the user is an admin.
    - **Pros:** Shared codebase, potentially faster initial setup.
    - **Cons:** Can bloat the main app, mobile UI might not be ideal for admin tasks.
- **Option 2: Separate Web Application (Recommended for flexibility & desktop use)**
    - A dedicated web application (e.g., built with React/Vite, Next.js, Remix, or even a simpler framework like SvelteKit or Vue.js).
    - **Pros:** Optimized desktop UI, separation of concerns, independent deployment.
    - **Cons:** Requires setting up a new project.
- **Option 3: Third-Party Admin Panel Builder**
    - Tools like Retool, Appsmith, or Forest Admin can quickly build internal tools by connecting to your database or API.
    - **Pros:** Very fast development for CRUD UIs.
    - **Cons:** Less customization, potential costs, reliance on a third-party service.

- **Backend API:**
    - A new, dedicated tRPC router (e.g., `adminRouter`) is recommended. This router will house all procedures specific to admin functionalities and will be protected by admin-only middleware.

### c. User Interface (UI) / User Experience (UX)

- **Focus on Efficiency:** Admin tasks are often data-heavy. Prioritize clear forms, tables, search, and filtering.
- **Clear Indication of Public Status:** When managing decks, clearly show and allow toggling of the `isPublic` flag.
- **Bulk Operations (Future):** Consider if you'll need to import flashcards from CSV/JSON, etc.
- **Safety Nets:** Implement confirmation dialogs for destructive actions like deletion.

## 3. Backend API Design for Admin Panel

### a. Add `isAdmin` to User Model

Modify `prisma/schema.prisma`:
```prisma
model User {
  // ... existing fields (id, email, name, etc.)
  isAdmin           Boolean  @default(false)

  // ... existing relations (decks, flashcardStatuses)
}
```
- **Action:** After adding this, run `npx prisma migrate dev --name add_isAdmin_to_user` and `npx prisma generate`.
- **Set Admin User:** Manually update your user record in the database to set `isAdmin = true`.

### b. Admin tRPC Context & Middleware

Modify `backend/trpc/create-context.ts` (or create a new one for admin if fully separate):

The `Context` type might include the full user object fetched including `isAdmin`.
Then create a new protected procedure for admins:

```typescript
// backend/trpc/create-context.ts (or a new admin-specific context file)

// ... (other imports)
import { TRPCError } from '@trpc/server';

// Assuming 'user' in context includes the 'isAdmin' field
export const createTRPCRouter = t.router; // Assuming 't' is your initTRPC instance
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(
  async function isAuthenticated(opts) {
    const { ctx } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    return opts.next({
      ctx: {
        ...ctx,
        user: ctx.user, // user is now guaranteed to be non-null
      },
    });
  }
);

// New Admin-only procedure
export const adminProcedure = protectedProcedure.use(
  async function isAdmin(opts) {
    const { ctx } = opts;
    // Assuming ctx.user is already populated by protectedProcedure and includes isAdmin
    if (!ctx.user.isAdmin) { 
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have admin privileges.' });
    }
    return opts.next({
      ctx: {
        ...ctx,
        user: ctx.user, // user is an admin
      },
    });
  }
);
```
*(Note: Ensure your `Context` creation logic actually fetches and includes the `isAdmin` field for the logged-in user).*

### c. New `adminRouter.ts`

Create `backend/trpc/routers/adminRouter.ts` (the path we used):

```typescript
import { z } from 'zod';
import { createTRPCRouter, adminProcedure } from '../create-context'; // Adjusted path
// Import Prisma types if needed, e.g. import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server'; // Ensure TRPCError is available if throwing custom errors beyond procedure checks

// Example Input Schemas for Admin Operations (align with actual implementation)
const adminCreateDeckInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isPublic: z.boolean().default(false), // Admin can set this directly
  // userId will be inferred from ctx.prismaUser.id
});

const adminUpdateDeckInput = z.object({
  id: z.string(), // ID of the deck to update
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

const adminDeleteDeckInput = z.object({
  id: z.string(),
});

const adminCreateFlashcardInput = z.object({
  deckId: z.string(),
  front: z.string().min(1),
  back: z.string().min(1),
  contentType: z.string().default('text'), // Added contentType
  // mediaUrls and tags can be added if admins should manage them
});

const adminUpdateFlashcardInput = z.object({
  id: z.string(), // ID of the flashcard to update
  front: z.string().min(1).optional(),
  back: z.string().min(1).optional(),
  deckId: z.string().optional(), // Optional: allow moving card to a different deck
  contentType: z.string().optional(), // Added contentType
});

const adminDeleteFlashcardInput = z.object({
  id: z.string(),
});


export const adminRouter = createTRPCRouter({
  // User Management (Example)
  listUsers: adminProcedure.query(async ({ ctx }) => {
    const users = await ctx.prisma.user.findMany();
    return users;
    // Consider adding pagination and selection of fields
  }),

  // Deck Management by Admin
  adminCreateDeck: adminProcedure
    .input(adminCreateDeckInput)
    .mutation(async ({ ctx, input }) => {
      const adminUserId = ctx.prismaUser.id;
      return ctx.prisma.deck.create({
        data: {
          ...input,
          userId: adminUserId,
        },
      });
    }),

  adminUpdateDeck: adminProcedure
    .input(adminUpdateDeckInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...dataToUpdate } = input;
      return ctx.prisma.deck.update({
        where: { id },
        data: dataToUpdate,
        // Potentially add 'lastModified: new Date()' if relevant
      });
    }),

  adminDeleteDeck: adminProcedure
    .input(adminDeleteDeckInput)
    .mutation(async ({ ctx, input }) => {
      // Ensure cascading deletes for flashcards are handled by Prisma schema
      // or implement manual deletion of associated flashcards.
      await ctx.prisma.deck.delete({ where: { id: input.id } });
      return { success: true, deletedDeckId: input.id };
    }),
  
  // Flashcard Management by Admin
  adminCreateFlashcard: adminProcedure
    .input(adminCreateFlashcardInput)
    .mutation(async ({ ctx, input }) => {
      // Admin can add flashcards to any deck.
      // The Flashcard model does not have a direct userId; it's linked via the Deck.
      return ctx.prisma.flashcard.create({
        data: {
          deckId: input.deckId,
          front: input.front,
          back: input.back,
          contentType: input.contentType,
          // mediaUrls: input.mediaUrls, // if added to schema
          // tags: input.tags,         // if added to schema
        },
      });
    }),

  adminUpdateFlashcard: adminProcedure
    .input(adminUpdateFlashcardInput)
    .mutation(async ({ ctx, input }) => {
      const { id, ...dataToUpdate } = input;
      return ctx.prisma.flashcard.update({
        where: { id },
        data: dataToUpdate,
      });
    }),

  adminDeleteFlashcard: adminProcedure
    .input(adminDeleteFlashcardInput)
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.flashcard.delete({ where: { id: input.id } });
      return { success: true, deletedFlashcardId: input.id };
    }),

  // (Optional) Further User Management
  // grantAdmin: adminProcedure.input(z.object({ userId: z.string() }))...
  // revokeAdmin: adminProcedure.input(z.object({ userId: z.string() }))...

  // (Optional) Admin-specific analytics or dashboard data
  // getSystemStats: adminProcedure.query(...),

});

export type AdminRouter = typeof adminRouter;
```

Then, ensure this `adminRouter` is mounted in your main `appRouter.ts`:

## 4. Frontend Implementation Outline (Example with React/Vite)

Assuming you choose a separate web application (e.g., React with Vite).

### a. Project Setup
- `npm create vite@latest admin-panel -- --template react-ts`
- Install tRPC client, react-query, and a UI library (e.g., Material UI, Chakra UI, Tailwind CSS + Headless UI).

### b. Core Structure
- **API Client:** Setup tRPC client to connect to your backend (`/trpc/admin.*` procedures).
- **Routing:** Use React Router for navigation (e.g., `/login`, `/dashboard`, `/decks`, `/decks/:deckId/flashcards`, `/users`).
- **State Management:** React Query for server state, Zustand or Context API for global UI state if needed.
- **Authentication Flow:**
    - Login page calling your main `authRouter.login` (or a dedicated admin login if you prefer).
    - Store session/token.
    - On tRPC client, include auth headers.
    - Protected routes that redirect to login if not authenticated as admin.

### c. Key Admin Panel Pages/Components
- **Login Page:** Form for admin credentials.
- **Layout:** Sidebar navigation, header with user info/logout.
- **Dashboard:** (Optional) Overview stats.
- **Deck Management Page:**
    - Table/list of all decks from `admin.listAllDecks`.
        - Columns: Name, Description, Creator, Public Status, Actions (Edit, Delete, View Cards).
        - Filtering/Sorting options.
    - Button to "Create New Deck".
    - **Deck Form (Create/Edit):**
        - Inputs for name, description, tags, subject, etc.
        - **Crucially, a toggle/checkbox for `isPublic`**.
        - Calls `admin.createDeck` or `admin.updateDeck`.
- **Flashcard Management Page (Contextual, e.g., `/decks/:deckId/flashcards`):**
    - Display info about the parent deck.
    - Table/list of flashcards in that deck.
    - Button to "Add New Flashcard" to this deck.
    - **Flashcard Form (Create/Edit):**
        - Inputs for front, back, contentType, etc.
        - Calls `admin.createFlashcard` or `admin.updateFlashcard`.
    - **Flashcard Preview Component (NEW):**
        - **Purpose:** To visually render a flashcard as it would appear to an end-user, based on its `front`, `back`, and `contentType`.
        - **Location:** Could be part of the flashcard form (live preview as admin types), or a separate modal/section when viewing a flashcard.
        - **Implementation Logic (Frontend - e.g., React component):**
            ```typescript
            // interface FlashcardPreviewProps {
            //   front: string;
            //   back: string;
            //   contentType: string; // e.g., 'text', 'latex', 'image', 'markdown'
            //   mediaUrls?: string[];
            //   showFront: boolean; // To toggle between front and back
            // }

            // const FlashcardPreview: React.FC<FlashcardPreviewProps> = ({ 
            //   front, back, contentType, mediaUrls, showFront 
            // }) => {
            //   const contentToShow = showFront ? front : back;
            //   let renderedContent;

            //   switch (contentType) {
            //     case 'text':
            //       renderedContent = <p>{contentToShow}</p>;
            //       break;
            //     case 'markdown': // Assuming you might use Markdown
            //       // Use a library like 'react-markdown'
            //       // renderedContent = <ReactMarkdown>{contentToShow}</ReactMarkdown>;
            //       renderedContent = <p>Markdown: {contentToShow}</p>; // Placeholder
            //       break;
            //     case 'latex':
            //       // Use a library like 'katex' or 'react-latex-next'
            //       // renderedContent = <KaTeXComponent math={contentToShow} />;
            //       renderedContent = <p>LaTeX: {contentToShow}</p>; // Placeholder
            //       break;
            //     case 'image':
            //       // If mediaUrls are used for image content type
            //       // renderedContent = mediaUrls && mediaUrls[0] ? <img src={mediaUrls[0]} alt="Flashcard image" /> : <p>No image</p>;
            //       // Or if front/back directly contain image URLs for this type
            //       renderedContent = <img src={contentToShow} alt="Flashcard image" />;
            //       break;
            //     default:
            //       renderedContent = <p>{contentToShow}</p>;
            //   }

            //   return (
            //     <div className="flashcard-preview" style={{ border: '1px solid #ccc', padding: '10px', minHeight: '100px' }}>
            //       {renderedContent}
            //       {/* Add buttons/controls to flip card, show media if separate etc. */}
            //     </div>
            //   );
            // };
            ```
        - **Styling:** Apply CSS to make it resemble your mobile app's flashcard appearance.
        - **Libraries for Rich Content:**
            - For Markdown: `react-markdown`
            - For LaTeX: `katex` and its React wrappers like `react-latex-next`.
        - **Considerations:** The admin panel preview doesn't need to be *pixel-perfect* identical to the mobile app but should accurately represent the content based on `contentType`.
- **(Optional) User Management Page:**
    - Table of users from `admin.listUsers`.
    - Action to toggle `isAdmin` status (calling `admin.setUserAdminStatus`).

## 5. Deployment and Security

### a. Deployment
- **Separate Web App:** Deploy as a static site (e.g., Vercel, Netlify, AWS S3/CloudFront) if it's a React/Vite SPA.
- **Access Control:**
    - If possible, restrict access to the admin panel URL via IP whitelisting, VPN, or a dedicated authentication proxy in front of it, in addition to the application-level admin login.

### b. Security Best Practices
- **Strong Admin Passwords:** Enforce this.
- **HTTPS:** Ensure the admin panel is served over HTTPS.
- **Regularly Update Dependencies:** Both frontend and backend.
- **Principle of Least Privilege:** The admin API procedures should only allow what's necessary.
- **Input Validation:** Zod on the backend is good. Frontend validation is also important for UX.
- **CSRF Protection:** If using session cookies for auth, ensure your framework handles this (tRPC generally doesn't use cookies directly for calls, relying on headers).
- **Audit Logs (Advanced):** For critical admin actions, consider logging who did what and when.

## 6. Simplified Step-by-Step "A to Z" Summary

1.  **Plan:** Confirm core functionalities and tech choices.
2.  **DB Schema:** Add `User.isAdmin`, migrate DB (`npx prisma migrate dev`), generate client (`npx prisma generate`).
3.  **Set Admin:** Manually update your user in the DB: `UPDATE "User" SET "isAdmin" = true WHERE email = 'your-email@example.com';`.
4.  **Backend API:**
    - Implement `adminProcedure` middleware in tRPC.
    - Create `adminRouter.ts` with procedures for deck, flashcard, and (optional) user management.
    - Add `adminRouter` to the main `appRouter`.
5.  **Frontend Project:**
    - Set up your chosen frontend framework (e.g., React/Vite).
    - Install tRPC client, React Query, router.
6.  **Frontend UI & Logic:**
    - Build login page and authentication flow.
    - Create protected routes for admin sections.
    - Develop UI components for listing and managing decks (with `isPublic` toggle).
    - Develop UI components for listing and managing flashcards within decks.
    - Integrate UI with the `adminRouter` procedures.
7.  **Testing:** Test admin functionalities thoroughly.
8.  **Security Review:** Check for common web vulnerabilities.
9.  **Deployment:** Deploy the admin panel securely, considering access restrictions.
10. **Documentation:** Document how to use the admin panel for any future admins.

This guide provides a comprehensive starting point. Each step, especially frontend development, involves significant effort. Start with the most critical path: admin auth, and creating/editing public decks and their flashcards. 

## 7. Testing the Admin Backend API

Thorough testing of your `adminRouter` and associated procedures is crucial to ensure they function correctly, securely, and reliably. This section outlines a strategy for testing your tRPC backend, focusing on integration tests.

### a. Importance of Testing

- **Catch Bugs Early:** Identify issues before they reach production.
- **Ensure Security:** Verify that authorization rules (like `adminProcedure`) are correctly enforced.
- **Facilitate Refactoring:** Confidently make changes to your code knowing tests will catch regressions.
- **Documentation:** Tests serve as a form of executable documentation for your API.

### b. Levels of Testing

- **Unit Tests:** Test individual, isolated functions. For the current `adminRouter`, where most logic involves Prisma calls, comprehensive unit tests might be less emphasized than integration tests.
- **Integration Tests (Primary Focus):** Test the interaction between your tRPC procedures, the `adminProcedure`, Prisma, and a real (test) database. This is where you'll get the most value for testing your admin backend.
- **End-to-End (E2E) Tests:** Test the entire flow from an HTTP client to the tRPC server. Can be useful for basic smoke testing of the API endpoints.

### c. Setting Up the Test Environment

- **Test Runner:**
    - **Recommendation:** Vitest (`vitest.dev`) or Jest. Both are popular, feature-rich test runners for TypeScript/JavaScript projects.
- **Test Database:**
    - **Requirement:** Use a separate PostgreSQL database instance dedicated to testing (e.g., `cramit_test`). **Never run tests against your development or production database.**
    - **Configuration:**
        - Set up an environment variable for your test database URL (e.g., `TEST_DATABASE_URL=postgresql://user:password@host:port/cramit_test`).
        - Configure your testing scripts or Prisma client instantiation in tests to use this `TEST_DATABASE_URL`.
    - **Schema Management:** Apply Prisma migrations to your test database to keep its schema in sync: `DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy` (or `dev` initially).
- **Prisma Client for Tests:** Instantiate a separate Prisma client instance in your test setup pointed to the test database.

### d. Writing Integration Tests

- **Test File Location:** Co-locate test files with your router (e.g., `backend/trpc/routers/adminRouter.test.ts`) or in a dedicated `__tests__` directory.
- **tRPC Caller for Tests:** Create a helper function to instantiate your `appRouter.createCaller` with a specific tRPC context tailored for different test scenarios (admin user, non-admin user, unauthenticated).

    ```typescript
    // Example: backend/trpc/routers/adminRouter.test.ts (simplified setup)
    import { appRouter, type AppRouter } from '../app-router'; // Your main appRouter
    import { createTRPCContext } from '../create-context'; // Your actual context creation
    import { PrismaClient, User } from '@prisma/client';
    import { TRPCError } from '@trpc/server';

    // Ensure this points to your TEST_DATABASE_URL in test environment
    const prismaTestClient = new PrismaClient(); 

    async function createTestCaller(user?: { id: string; isAdmin: boolean; email?: string; name?: string }) {
      const ctx = await createTRPCContext({
        req: {} as any, // Mock if your context uses req/res
        res: {} as any,
        // Simulate the prismaUser and supabaseUser parts of your context
        prismaUser: user ? { id: user.id, isAdmin: user.isAdmin, email: user.email || 'test@example.com', name: user.name || 'Test User' /* ...other fields */ } : null,
        supabaseUser: user ? { id: user.id /* ...other Supabase fields */ } : null,
        // Make sure your actual createTRPCContext doesn't try to fetch from a live DB if you provide mock users here
        // or adapt this helper to work with how your context truly resolves users.
      });
      return appRouter.createCaller(ctx);
    }
    ```

- **Data Seeding and Cleanup:**
    - **`beforeAll` / `beforeEach`:** Seed necessary data (e.g., admin user, non-admin user, initial decks/flashcards).
    - **`afterAll` / `afterEach`:** Clean up data from tables to ensure test isolation. Deleting records in reverse order of creation (or based on dependencies) is often a good strategy.

    ```typescript
    // Example adminRouter.test.ts
    let adminUser: User;
    let nonAdminUser: User;

    beforeAll(async () => {
      // Clean up potential previous test runs & seed initial users
      await prismaTestClient.userFlashcardStatus.deleteMany({});
      await prismaTestClient.flashcard.deleteMany({});
      await prismaTestClient.deck.deleteMany({});
      await prismaTestClient.user.deleteMany({});

      adminUser = await prismaTestClient.user.create({
        data: { id: 'test-admin-id', email: 'admin@test.com', isAdmin: true, name: 'Test Admin' },
      });
      nonAdminUser = await prismaTestClient.user.create({
        data: { id: 'test-user-id', email: 'user@test.com', isAdmin: false, name: 'Test User' },
      });
    });

    afterAll(async () => {
      // Final cleanup
      await prismaTestClient.user.deleteMany({}); // Will cascade delete related if schema is set up
      await prismaTestClient.$disconnect();
    });
    ```

- **Testing `adminProcedure` (Authorization):**

    ```typescript
    describe('Admin Procedure Authorization', () => {
      it('should ALLOW access for admin users', async () => {
        const caller = await createTestCaller(adminUser);
        // Example: calling listUsers which is protected by adminProcedure
        await expect(caller.admin.listUsers()).resolves.toBeDefined();
      });

      it('should DENY access for non-admin users with FORBIDDEN error', async () => {
        const caller = await createTestCaller(nonAdminUser);
        await expect(caller.admin.listUsers()).rejects.toThrowError(TRPCError);
        await expect(caller.admin.listUsers()).rejects.toHaveProperty('meta.cause.code', 'FORBIDDEN'); // Adjust based on actual error structure
      });

      it('should DENY access for unauthenticated users with UNAUTHORIZED error', async () => {
        const caller = await createTestCaller(); // No user
        await expect(caller.admin.listUsers()).rejects.toThrowError(TRPCError);
        await expect(caller.admin.listUsers()).rejects.toHaveProperty('meta.cause.code', 'UNAUTHORIZED'); // Adjust
      });
    });
    ```

- **Testing CRUD Operations (Example: `adminCreateDeck`):**

    ```typescript
    describe('Admin Deck Management', () => {
      let adminCaller: Awaited<ReturnType<typeof createTestCaller>>;

      beforeAll(async () => {
        adminCaller = await createTestCaller(adminUser);
      });
      
      afterEach(async () => {
        // Clean decks potentially created by tests in this block to avoid interference
        await prismaTestClient.deck.deleteMany({ where: { userId: adminUser.id } });
      });

      it('adminCreateDeck: should create a new deck as admin', async () => {
        const input = { name: 'My Admin Deck', description: 'Created by admin', isPublic: true };
        const newDeck = await adminCaller.admin.adminCreateDeck(input);
        
        expect(newDeck.name).toBe(input.name);
        expect(newDeck.isPublic).toBe(input.isPublic);
        expect(newDeck.userId).toBe(adminUser.id);

        // Verify in DB
        const dbDeck = await prismaTestClient.deck.findUnique({ where: { id: newDeck.id } });
        expect(dbDeck).not.toBeNull();
        expect(dbDeck?.isPublic).toBe(true);
      });
      
      // ... More tests for adminUpdateDeck, adminDeleteDeck, adminListDecks with various inputs and scenarios
    });
    ```

### e. Key Areas to Test in `adminRouter`

- **Authorization:** Thoroughly test the `adminProcedure` for all entry points.
- **`listUsers`:** Correct data returned, proper fields selected.
- **Deck Management (`adminCreateDeck`, `adminUpdateDeck`, `adminDeleteDeck`, `adminListDecks`):
    - Correct creation, update, and deletion of decks.
    - `isPublic` status handled correctly.
    - Decks associated with the correct admin user (`userId`).
    - `adminListDecks` returns all decks, respects filters (`isPublic`, `userId`), includes user info, card counts, and pagination works.
- **Flashcard Management (`adminCreateFlashcard`, `adminUpdateFlashcard`, `adminDeleteFlashcard`):
    - Correct creation, update, deletion.
    - Association with `deckId` and `contentType`.
    - Behavior when moving flashcards (updating `deckId`).
    - Cascading deletes from deck deletion (if configured in Prisma schema).

### f. Running Tests

- Add a script to your `package.json`:
  ```json
  "scripts": {
    // ... other scripts
    "test": "NODE_ENV=test vitest run", // Or your chosen test runner command
    "test:watch": "NODE_ENV=test vitest"
  }
  ```
- Execute tests using `npm test` or `yarn test`.

By implementing these testing practices, you can significantly improve the quality and maintainability of your admin backend API. 