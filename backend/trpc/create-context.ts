import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { PrismaClient } from "@prisma/client";
import { createClient, SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";

// Initialize Prisma Client (global instance)
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

// Initialize Supabase Client options (from .env)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Anon Key is not defined in .env");
}

// Helper function to get user from JWT
const getUserFromHeader = async (
  req: FetchCreateContextFnOptions["req"],
  supabase: SupabaseClient
): Promise<SupabaseUser | null> => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return null;
  }
  const token = authHeader.split("Bearer ")[1];
  if (!token) {
    return null;
  }
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error) {
    // console.error("Error getting user from token:", error.message); // Optional: log error
    return null;
  }
  return user;
};

// Define the Context type explicitly
export type Context = {
  req: FetchCreateContextFnOptions["req"];
  prisma: PrismaClient;
  supabase: SupabaseClient;
  user: SupabaseUser | null;
  timestamp: number;
};

// Context creation function
export const createContext = async (opts: FetchCreateContextFnOptions): Promise<Context> => {
  // Create a new Supabase client for each request
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const user = await getUserFromHeader(opts.req, supabase);
  const timestamp = Date.now();

  // JIT User Sync: Ensure user exists in Prisma if they are authenticated via Supabase
  if (user) {
    try {
      // We use upsert as a safe "ensure exists" operation
      await prisma.user.upsert({
        where: { id: user.id },
        update: {
          email: user.email!, // Keep email synced if it changed
          updatedAt: new Date(),
        },
        create: {
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        },
      });
      // console.log(`[Context] User ${user.id} synced to Prisma`);
    } catch (err) {
      console.error(`[Context] Failed to sync user ${user.id} to Prisma:`, err);
      // We don't throw here to avoid blocking requests, 
      // but subsequent DB operations requiring the user might fail.
    }
  }

  // Note: __manuallyParsedInput is added by the wrapper in [trpc]+api.ts
  // So the object returned here doesn't strictly need it, but the type Context does.
  return { req: opts.req, prisma, supabase, user, timestamp };
};

// Initialize tRPC
// The context type is now explicitly defined for initTRPC
const t = initTRPC.context<Context>().create({
  // transformer: superjson, // Temporarily commented out for debugging.
  // Enabling superjson seems to cause issues with POST request body parsing
  // in conjunction with fetchRequestHandler in Expo API Routes, leading to
  // Zod errors (expected: "object", received: "undefined").
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        errorCode: error.code,
        // Potentially add more error details in development
        ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
      },
    };
  },
});

// Create router and procedures
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

// Middleware for protected routes
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }
  return next({
    ctx: {
      // Pass down context, ensuring `user` is typed as non-null for protected procedures
      ...ctx,
      user: ctx.user, // TypeScript now knows user is not null here
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthenticated);