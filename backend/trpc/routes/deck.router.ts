import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../create-context';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';

export const deckRouter = createTRPCRouter({
  listPublic: publicProcedure 
    .input(
      z.object({
        limit: z.number().min(1).max(100).nullish(),
        cursor: z.string().nullish(), 
        tags: z.array(z.string()).optional(),
        subject: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 10;
      const { cursor, tags, subject } = input ?? {};
      
      return ctx.prisma.deck.findMany({
        take: limit + 1, 
        cursor: cursor ? { id: cursor } : undefined,
        where: {
          AND: [
            tags ? { tags: { hasSome: tags } } : {},
            subject ? { subject: { contains: subject, mode: 'insensitive' } } : {},
          ],
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }),

  listUserDecks: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).nullish(),
        cursor: z.string().nullish(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 10;
      const { cursor } = input ?? {};
      const userIdAuth = ctx.user.id; 

      return ctx.prisma.deck.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        where: {
          userId: userIdAuth, 
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });
    }),
  
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        tags: z.array(z.string()).optional(),
        subject: z.string().optional(),
        chapter: z.string().optional(),
        coverImage: z.string().url().optional(),
        isPremium: z.boolean().default(false),
        price: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userIdAuth = ctx.user.id; 
      return ctx.prisma.deck.create({
        data: {
          ...input,
          userId: userIdAuth, 
        },
      });
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: input.id },
        include: {
          flashcards: {
            orderBy: {
              createdAt: 'asc',
            },
          },
          user: { 
            select: { id: true, name: true, email: true },
          }
        },
      });

      if (!deck) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deck not found',
        });
      }
      return deck;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional().nullable(),
        tags: z.array(z.string()).optional().nullable(),
        subject: z.string().optional().nullable(),
        chapter: z.string().optional().nullable(),
        coverImage: z.string().url().optional().nullable(),
        isPremium: z.boolean().optional(),
        price: z.number().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, tags, ...otherData } = input;
      const userIdAuth = ctx.user.id; 

      const deck = await ctx.prisma.deck.findUnique({
        where: { id },
      });

      if (!deck) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Deck not found' });
      }

      if (deck.userId !== userIdAuth) { 
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only update your own decks' });
      }

      const dataToUpdate: Prisma.DeckUpdateInput = { ...otherData };
      if (tags !== undefined) {
        dataToUpdate.tags = tags === null ? [] : tags;
      }

      return ctx.prisma.deck.update({
        where: { id },
        data: dataToUpdate,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userIdAuth = ctx.user.id; 
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: input.id },
      });

      if (!deck) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Deck not found' });
      }

      if (deck.userId !== userIdAuth) { 
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only delete your own decks' });
      }
      
      await ctx.prisma.deck.delete({
        where: { id: input.id },
      });
      return { success: true, message: 'Deck deleted successfully' };
    }),
});
