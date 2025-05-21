import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";

// Context creation function
export const createContext = async (opts: FetchCreateContextFnOptions) => {
  return {
    req: opts.req,
    // You can add more context items here like database connections, auth, etc.
    timestamp: Date.now(),
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        errorCode: error.code,
      },
    };
  },
});

// Create router and procedures
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

// Create a middleware for protected routes (can be used later)
const isAuthed = t.middleware(({ next, ctx }) => {
  // This is where you would check if the user is authenticated
  // For now, we'll just pass through
  return next({
    ctx: {
      // Add user info to context if needed
      ...ctx,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);