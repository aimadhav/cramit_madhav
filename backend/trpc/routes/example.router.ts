import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

export const exampleRouter = createTRPCRouter({
  hi: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.name}!`,
        timestamp: new Date().toISOString(),
        status: "Backend is connected and working properly",
        version: "1.0.0",
      };
    }),
});