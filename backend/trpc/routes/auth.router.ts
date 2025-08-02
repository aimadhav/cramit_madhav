import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { TRPCError } from "@trpc/server";

export const authRouter = createTRPCRouter({
  refreshSession: publicProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // For now, return a simple mock response
      // In production, this would validate the refresh token and return new tokens
      console.log("Auth: Refreshing session with token:", input.refreshToken.substring(0, 10) + "...");
      
      return {
        session: {
          access_token: "mock-access-token-" + Date.now(),
          refresh_token: "mock-refresh-token-" + Date.now(),
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: "guest-user",
            email: "test@example.com",
            name: "Test User",
          }
        },
        user: {
          id: "guest-user",
          email: "test@example.com", 
          name: "Test User",
          phone: null,
          isPremium: true,
          isAdmin: false,
        }
      };
    }),

  login: publicProcedure
    .input(z.object({ 
      email: z.string().email(), 
      password: z.string() 
    }))
    .mutation(async ({ input, ctx }) => {
      console.log("Auth: Login attempt for:", input.email);
      
      // Mock authentication - in production, validate against database
      if (input.email === "test@example.com" && input.password === "password") {
        return {
          session: {
            access_token: "mock-access-token-" + Date.now(),
            refresh_token: "mock-refresh-token-" + Date.now(),
            expires_in: 3600,
            token_type: "bearer",
            user: {
              id: "guest-user",
              email: input.email,
              name: "Test User",
            }
          },
          user: {
            id: "guest-user",
            email: input.email,
            name: "Test User", 
            phone: null,
            isPremium: true,
            isAdmin: false,
          }
        };
      } else {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }
    }),
    
  signup: publicProcedure
    .input(z.object({ 
      email: z.string().email(), 
      password: z.string().min(6),
      name: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      console.log("Auth: Signup attempt for:", input.email);
      
      // Check if user already exists
      const existingUser = await ctx.prisma.user.findUnique({
        where: { email: input.email }
      });
      
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User with this email already exists",
        });
      }
      
      // Create new user
      const newUser = await ctx.prisma.user.create({
        data: {
          email: input.email,
          name: input.name || null,
          isPremium: false,
          isAdmin: false,
        }
      });
      
      return {
        session: {
          access_token: "mock-access-token-" + Date.now(),
          refresh_token: "mock-refresh-token-" + Date.now(),
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
          }
        },
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          phone: newUser.phone,
          isPremium: newUser.isPremium,
          isAdmin: newUser.isAdmin,
        }
      };
    }),
    
  logout: publicProcedure
    .mutation(async () => {
      console.log("Auth: User logged out");
      return { success: true };
    }),

  getCurrentUser: publicProcedure
    .query(async ({ ctx }) => {
      // For now, return the hardcoded guest user
      // In production, this would get the user from the session/token
      const user = await ctx.prisma.user.findUnique({
        where: { id: "guest-user" }
      });
      
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }
      
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        isPremium: user.isPremium,
        isAdmin: user.isAdmin,
        totalCardsStudied: user.totalCardsStudied,
        totalTimeStudied: user.totalTimeStudied,
        streakDays: user.streakDays,
        lastStudyDate: user.lastStudyDate,
      };
    }),
});