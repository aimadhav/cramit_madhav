import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../../create-context';
import { TRPCError } from '@trpc/server';

const createFlashcardInput = z.object({
  deckId: z.string(),
  front: z.string().min(1, "Front content cannot be empty"),
  back: z.string().min(1, "Back content cannot be empty"),
  contentType: z.string().optional().default('text'),
  mediaUrls: z.array(z.string().url("Invalid URL format")).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
});

const updateUserFlashcardStatusInput = z.object({
  flashcardId: z.string(),
  interval: z.number().int().positive().optional(),
  easeFactor: z.number().positive().optional(),
  repetitions: z.number().int().nonnegative().optional(),
  dueDate: z.date().optional(),
  lastReviewed: z.date().optional(),
  isBookmarked: z.boolean().optional(),
  isLearned: z.boolean().optional(),
});

export const flashcardRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createFlashcardInput)
    .mutation(async ({ ctx, input }) => {
      const { deckId, front, back, contentType, mediaUrls, tags } = input;
      const userId = ctx.user.id;

      // 1. Verify deck ownership
      const deck = await ctx.prisma.deck.findUnique({
        where: { id: deckId },
      });

      if (!deck) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Deck with ID ${deckId} not found.`,
        });
      }

      if (deck.userId !== userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to add flashcards to this deck.',
        });
      }

      // 2. Create Flashcard and UserFlashcardStatus in a transaction
      try {
        const newFlashcardAndStatus = await ctx.prisma.$transaction(async (prisma) => {
          const newFlashcard = await prisma.flashcard.create({
            data: {
              deckId,
              front,
              back,
              contentType,
              mediaUrls,
              tags,
            },
          });

          const newUserFlashcardStatus = await prisma.userFlashcardStatus.create({
            data: {
              userId,
              flashcardId: newFlashcard.id,
              // SRS fields will use default values from schema
              // isBookmarked, isLearned, isDeleted will also use defaults
            },
          });

          return { ...newFlashcard, userStatus: newUserFlashcardStatus }; // Return combined result
        });

        return newFlashcardAndStatus;
      } catch (error) {
        console.error("Error creating flashcard and status:", error);
        // Check if it's a known Prisma error or a general error
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create flashcard. Please try again.',
          cause: error,
        });
      }
    }),

  updateUserStatus: protectedProcedure
    .input(updateUserFlashcardStatusInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { flashcardId, ...updateData } = input;

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No update data provided.',
        });
      }

      const existingStatus = await ctx.prisma.userFlashcardStatus.findUnique({
        where: {
          userId_flashcardId: {
            userId,
            flashcardId,
          },
        },
      });

      if (!existingStatus) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Status for flashcard ID ${flashcardId} not found for this user. Please ensure the flashcard exists and you have interacted with it.`, 
        });
      }

      try {
        const updatedStatus = await ctx.prisma.userFlashcardStatus.update({
          where: {
            id: existingStatus.id,
          },
          data: updateData,
        });
        return updatedStatus;
      } catch (error) {
        console.error("Error updating user flashcard status:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update flashcard status.',
          cause: error,
        });
      }
    }),

  listByDeck: publicProcedure
    .input(z.object({ deckId: z.string() }))
    .query(async ({ ctx, input }) => {
      const flashcards = await ctx.prisma.flashcard.findMany({
        where: { deckId: input.deckId },
        orderBy: {
          createdAt: 'asc',
        },
        // TODO: Later, if user is logged in, fetch and merge UserFlashcardStatus
      });
      return flashcards;
    }),
  
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const card = await ctx.prisma.flashcard.findUnique({
        where: { id: input.id },
        // TODO: Later, if user is logged in, fetch and merge UserFlashcardStatus
      });
      if (!card) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Flashcard with ID ${input.id} not found`,
        });
      }
      return card;
    }),
});