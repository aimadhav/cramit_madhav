import { createTRPCRouter } from "./create-context";
import { hiProcedure } from "./routes/example/hi/route";
import { flashcardRouter } from "./routes/flashcards/router";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiProcedure,
  }),
  flashcards: flashcardRouter,
});

export type AppRouter = typeof appRouter;