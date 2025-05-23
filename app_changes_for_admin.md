# Existing Codebase Changes for Admin Panel Integration

This document outlines the necessary modifications within your current CramItFinal codebase to support the backend functionalities required by the new admin panel. The admin panel itself is assumed to be a separate frontend application, but its backend API will be part of your existing tRPC setup.

## 1. Prisma Schema (`prisma/schema.prisma`)

- **Add `isAdmin` field to the `User` model:**
  This field will distinguish regular users from administrators.

  ```prisma
  model User {
    // ... existing fields (id, email, name, etc.)
    isAdmin           Boolean  @default(false)

    // ... existing relations (decks, flashcardStatuses)
  }
  ```

- **Action Required:**
    1.  Add the `isAdmin` field as shown above to your `prisma/schema.prisma` file.
    2.  Run database migration: `npx prisma migrate dev --name add_isAdmin_to_user`
    3.  Regenerate Prisma Client: `npx prisma generate`
    4.  Manually set your user account (and any other admin accounts) to `isAdmin = true` directly in the database. For example, using a SQL client:
        `UPDATE "User" SET "isAdmin" = true WHERE email = 'your-admin-email@example.com';`

## 2. tRPC Context and Procedures (`backend/trpc/create-context.ts`)

- **Ensure User Context Includes `isAdmin`:**
  Your `createContext` function, especially the part that fetches/derives the `user` object for authenticated sessions, must ensure that the `isAdmin` field is fetched from the database and included in the `ctx.user` object.
  If you are using Supabase Auth, when you fetch the user details from your own database based on the Supabase `id`, make sure to select the `isAdmin` field.

  ```typescript
  // Example snippet within your createContext or related user fetching logic
  // const sessionUser = await getSupabaseUserFromSession(opts.req); // Example
  // if (sessionUser) {
  //   const appUser = await prisma.user.findUnique({
  //     where: { id: sessionUser.id }, // or email, depending on your mapping
  //     select: { 
  //       id: true, 
  //       email: true, 
  //       name: true, 
  //       isAdmin: true, // *** Ensure isAdmin is selected ***
  //       // ... other fields needed in context
  //     }
  //   });
  //   return { ...opts, prisma, supabase, user: appUser, timestamp };
  // }
  ```

- **Create `adminProcedure` Middleware:**
  This middleware will be used to protect tRPC procedures that should only be accessible by administrators.

  ```typescript
  // Add to backend/trpc/create-context.ts (or your tRPC initialization file)
  // Assuming 't' is your initTRPC.create() instance and you have 'protectedProcedure'
  
  import { TRPCError } from '@trpc/server'; // Ensure this is imported
  
  // ... (your existing t, createTRPCRouter, publicProcedure, protectedProcedure)
  
  export const adminProcedure = protectedProcedure.use(
    async function isAdmin(opts) {
      const { ctx } = opts;
      // ctx.user should already be populated by protectedProcedure and non-null
      // It must also include the 'isAdmin' field from your database user record
      if (!ctx.user || !ctx.user.isAdmin) { 
        throw new TRPCError({ 
          code: 'FORBIDDEN', 
          message: 'Access denied. Administrator privileges required.' 
        });
      }
      return opts.next({
        ctx: {
          ...ctx,
          // user is already correctly typed and populated by protectedProcedure
          // and now confirmed to be an admin.
          user: ctx.user, 
        },
      });
    }
  );
  ```

## 3. New Admin tRPC Router (`backend/trpc/routers/adminRouter.ts`)

- **File Created:** `backend/trpc/routers/adminRouter.ts` (note the `routers` subdirectory).
- **Procedures Implemented:** This file has been populated with tRPC procedures for:
    - Listing users (example).
    - Admin creating decks (with ability to set `isPublic`).
    - Admin updating decks (with ability to set `isPublic`).
    - Admin deleting any deck.
    - Admin creating flashcards in any deck (includes `contentType`).
    - Admin updating any flashcard (includes `contentType`).
    - Admin deleting any flashcard.
- **Uses `adminProcedure`:** All procedures in this router correctly use the `adminProcedure` to ensure they are protected.

  *The implemented `adminRouter.ts` now contains these specific procedures. Refer to the file itself for the exact structure and Zod schemas used.*

## 4. Main tRPC Application Router (`backend/trpc/app-router.ts`)

- **`adminRouter` Mounted:** The `adminRouter` (from `backend/trpc/routers/adminRouter`) has been imported and mounted into the main `appRouter`.

  ```typescript
  // backend/trpc/app-router.ts
  import { createTRPCRouter } from "./create-context";
  // ... other router imports like authRouter, deckRouter, flashcardRouter ...
  import { adminRouter } from "./routers/adminRouter"; // <--- CORRECT PATH

  export const appRouter = createTRPCRouter({
    // ... auth, deck, flashcard routers ...
    admin: adminRouter, // <--- ADMIN ROUTER IS MOUNTED
    // ... example router ...
  });

  export type AppRouter = typeof appRouter;
  ```

## Summary of Changes to Existing Codebase:

-   **Schema:** Add `User.isAdmin`.
-   **Migrations:** Run migrations for the schema change.
-   **Context:** Ensure `ctx.user` includes `isAdmin` and create `adminProcedure`.
-   **Routers:** Create `adminRouter.ts` and add it to `app-router.ts`.

These backend changes provide the necessary API endpoints and security model for your admin panel frontend to consume. 

## 5. Testing Backend Changes

After implementing these backend modifications, it is crucial to conduct thorough testing:
- **Integration Tests:** Write integration tests for all new procedures in `adminRouter.ts` and for the `adminProcedure` itself. This involves setting up a test database, creating test data (admin users, non-admin users, sample decks/flashcards), and using a tRPC client to call the procedures and verify their behavior, including authorization checks and database interactions.
- **Manual Testing (Optional but Recommended):** Use a tool like Postman or a simple client script to manually call your new admin endpoints to verify they behave as expected with various inputs and authentication states.

*Refer to Section 7 of `admin_panel_guide.md` for a detailed guide on testing the admin backend API.* 