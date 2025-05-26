import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import type { PrismaClient, User as PrismaAppUser } from "@prisma/client";
import { getPrismaClient } from '../prisma/client';
import { createClient, SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";
import superjson from 'superjson';

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
    console.log("[Backend Context] getUserFromHeader: No authorization header found.");
    return null;
  }
  const token = authHeader.split("Bearer ")[1];
  if (!token) {
    console.log("[Backend Context] getUserFromHeader: Authorization header found, but no token after 'Bearer '.");
    return null;
  }
  // TEMPORARY LOG: Output the received token for debugging.
  // REMOVE THIS IN PRODUCTION OR AFTER DEBUGGING - TOKENS ARE SENSITIVE.
  console.log("[Backend Context] getUserFromHeader: Received token:", token ? token.substring(0, 20) + '...' : 'EMPTY_TOKEN'); 

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error) {
    console.error("[Backend Context] getUserFromHeader: Error getting user from Supabase token:", error.message);
    console.error("[Backend Context] getUserFromHeader: Supabase auth error object:", JSON.stringify(error, null, 2)); // Log the full error object
    return null;
  }
  if (!user) {
    console.log("[Backend Context] getUserFromHeader: Supabase returned no error, but no user object was found for the token.");
    return null;
  }
  console.log("[Backend Context] getUserFromHeader: Successfully retrieved user from token. User ID:", user.id);
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
  // transformer: superjson, // Commented out superjson transformer
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