import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

export const hiProcedure = publicProcedure
  .input(
    z.object({
      name: z.string().min(1).default("World"),
    })
  )
  .query(({ input, ctx }) => { 
    return {
      greeting: `Hello ${input.name}!`, 
      date: new Date(),
      timestamp: ctx.timestamp,
    };
  });