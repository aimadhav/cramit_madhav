import { createTRPCRouter } from "./create-context";
import { flashcardRouter } from "./routes/flashcards/router";
import { deckRouter } from "./routes/deck.router";
import { exampleRouter } from "./routes/example.router";
import { authRouter } from "./routes/auth.router";

export const appRouter = createTRPCRouter({
  flashcards: flashcardRouter,
  deck: deckRouter,
  example: exampleRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;