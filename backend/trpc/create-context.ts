import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { getPrismaClient } from '../prisma/client';
import superjson from 'superjson';

// Define the Context type with optional user auth
export type Context = {
  req: FetchCreateContextFnOptions["req"];
  prisma: PrismaClient;
  timestamp: number;
  user?: {
    id: string;
    email: string;
    name: string | null;
    isPremium: boolean;
    isAdmin: boolean;
  };
};

// Context creation function with basic auth support
export const createContext = async (opts: FetchCreateContextFnOptions): Promise<Context> => {
  const currentPrismaClient = getPrismaClient();
  const timestamp = Date.now();

  // Simple auth: check for Authorization header or use guest user
  const authHeader = opts.req.headers.get('authorization');
  let user = undefined;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // For now, any valid token gets the guest user
    // In production, this would validate the JWT and fetch the actual user
    const token = authHeader.substring(7);
    if (token) {
      try {
        const guestUser = await currentPrismaClient.user.findUnique({
          where: { id: "guest-user" }
        });
        if (guestUser) {
          user = {
            id: guestUser.id,
            email: guestUser.email,
            name: guestUser.name,
            isPremium: guestUser.isPremium,
            isAdmin: guestUser.isAdmin,
          };
        }
      } catch (error) {
        console.log("Error fetching user:", error);
      }
    }
  }

  return { req: opts.req, prisma: currentPrismaClient, timestamp, user };
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

// Protected procedure that requires authentication
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // now we know user is defined
    },
  });
});