import { createTRPCRouter } from "./create-context";
import { hiProcedure } from "./routes/example/hi/route";
import { flashcardRouter } from "./routes/flashcards/router";
import { authRouter } from "./routes/auth/router";
import { deckRouter } from "./routes/deck.router";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiProcedure,
  }),
  flashcards: flashcardRouter,
  auth: authRouter,
  deck: deckRouter,
});

export type AppRouter = typeof appRouter;