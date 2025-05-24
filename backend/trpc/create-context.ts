import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import type { PrismaClient, User as PrismaAppUser } from "@prisma/client";
import { getPrismaClient } from '../prisma/client';
import { createClient, SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";

// Initialize Supabase Client options (from .env)
console.log("[Backend Context] Raw EXPO_PUBLIC_SUPABASE_URL from process.env:", process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log("[Backend Context] Raw EXPO_PUBLIC_SUPABASE_ANON_KEY from process.env exists:", !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

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
  supabaseUser: SupabaseUser | null;
  prismaUser: PrismaAppUser | null;
  timestamp: number;
};

// Context creation function
export const createContext = async (opts: FetchCreateContextFnOptions): Promise<Context> => {
  const currentPrismaClient = getPrismaClient();

  // Create a new Supabase client for each request
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const supabaseUser = await getUserFromHeader(opts.req, supabase);
  const timestamp = Date.now();

  let prismaUser: PrismaAppUser | null = null;
  if (supabaseUser) {
    prismaUser = await currentPrismaClient.user.findUnique({
      where: { id: supabaseUser.id },
    });
  }

  // Note: __manuallyParsedInput is added by the wrapper in [trpc]+api.ts
  // So the object returned here doesn't strictly need it, but the type Context does.
  return { req: opts.req, prisma: currentPrismaClient, supabase, supabaseUser, prismaUser, timestamp };
};

// Initialize tRPC
// The context type is now explicitly defined for initTRPC
const t = initTRPC.context<Context>().create({
  // transformer: superjson, // REMOVED superjson transformer
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
  if (!ctx.supabaseUser) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Supabase user not available. You must be logged in.",
    });
  }

  if (!ctx.prismaUser) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User profile not found in application database.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      // supabaseUser and prismaUser are already part of ctx due to createContext
      // The crucial part is to make ctx.user available to the resolver, which expects it.
      user: ctx.prismaUser, // Explicitly map prismaUser to user for the procedure's context
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthenticated);