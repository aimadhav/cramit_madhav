import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, and, sql, desc, lte, isNull } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { MediaService } from './media-service';

export class DatabaseService {
  
  private static async addToSyncQueue(
    operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'REVIEW',
    entityType: 'deck' | 'card_status' | 'review',
    entityId: string,
    payload: any
  ) {
    const now = Date.now();
    await db.insert(schema.syncQueue).values({
      id: Crypto.randomUUID(),
      operation,
      entityType,
      entityId,
      payload: JSON.stringify(payload),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
  }

  static async getAllDecks(userId: string) {
    const now = Date.now();
    
    try {
      const allDecks = await db.query.decks.findMany({
        where: (decks, { isNull }) => isNull(decks.deletedAt),
        orderBy: [desc(schema.decks.updatedAt)],
      });

      const enhancedDecks = await Promise.all(allDecks.map(async (deck) => {
        const cards = await db.select().from(schema.flashcards).where(eq(schema.flashcards.deckId, deck.id));
        const totalCards = cards.length;

        const dueRows = await db.select()
          .from(schema.userFlashcardStatus)
          .where(
            and(
              eq(schema.userFlashcardStatus.userId, userId),
              lte(schema.userFlashcardStatus.due_date, now)
            )
          );
        
        const deckCardIds = new Set(cards.map(c => c.id));
        const dueInThisDeck = dueRows.filter(r => deckCardIds.has(r.flashcardId)).length;

        const allStatusForUser = await db.select()
          .from(schema.userFlashcardStatus)
          .where(eq(schema.userFlashcardStatus.userId, userId));
        
        const reviewedCardIds = new Set(allStatusForUser.map(s => s.flashcardId));
        const newInThisDeck = cards.filter(c => !reviewedCardIds.has(c.id)).length;

        const finalDueCount = dueInThisDeck + newInThisDeck;

        return {
          ...deck,
          cardCount: totalCards,
          dueCount: finalDueCount,
          tags: JSON.parse(deck.tags || '[]'),
        };
      }));

      return enhancedDecks;
    } catch (e: any) {
      if (e.message.includes('no such table')) {
        console.warn('⚠️ [DB] Tables not created yet, skipping deck fetch.');
        return [];
      }
      throw e;
    }
  }

  static async upsertDeck(deck: any, flashcards: any[]) {
    const now = Date.now();
    const deckId = deck.id || Crypto.randomUUID();
    
    const name = deck.name || 'Untitled Deck';
    const description = deck.description || '';
    
    let subject = deck.subject || deck.subjectName || null;
    if (subject === 'subject') subject = null; // Fix for previous corrupted values

    const chapter = deck.chapter || null;
    
    let coverImage = deck.coverImage || null;
    if (coverImage && coverImage.startsWith('http')) {
      const localCover = await MediaService.downloadImage(coverImage);
      if (localCover) coverImage = localCover;
    }

    await db.insert(schema.decks).values({
      id: deckId,
      remoteId: deck.remoteId || null,
      name,
      description,
      subject,
      chapter,
      coverImage,
      version: deck.version || 1,
      isDownloaded: true,
      downloadedAt: now,
      userId: deck.userId || 'system',
      tags: JSON.stringify(deck.tags || []),
      createdAt: deck.createdAt || now,
      updatedAt: now,
      deletedAt: null
    }).onConflictDoUpdate({
      target: schema.decks.id,
      set: {
        name,
        description,
        subject,
        chapter,
        coverImage,
        updatedAt: now,
      }
    });

    if (flashcards.length > 0) {
      for (const fc of flashcards) {
        let mediaUrls = fc.mediaUrls || [];
        if (mediaUrls.length > 0) {
          mediaUrls = await MediaService.downloadImages(mediaUrls);
        }

        let frontContent = fc.frontContent || JSON.stringify([{ type: fc.contentType || 'text', value: fc.front }]);
        let backContent = fc.backContent || JSON.stringify([{ type: fc.contentType || 'text', value: fc.back }]);

        await db.insert(schema.flashcards).values({
          id: fc.id || Crypto.randomUUID(),
          deckId: deckId,
          frontContent,
          backContent,
          mediaUrls: JSON.stringify(mediaUrls),
          createdAt: fc.createdAt || now,
          updatedAt: fc.updatedAt || now,
          deletedAt: null
        }).onConflictDoUpdate({
          target: schema.flashcards.id,
          set: {
            frontContent,
            backContent,
            mediaUrls: JSON.stringify(mediaUrls),
            updatedAt: now,
          }
        });
      }
    }

    return deckId;
  }

  static async getDeckWithCards(deckId: string, userId: string) {
    const cards = await db.select({
      card: schema.flashcards,
      status: schema.userFlashcardStatus
    })
    .from(schema.flashcards)
    .leftJoin(
      schema.userFlashcardStatus, 
      and(
        eq(schema.flashcards.id, schema.userFlashcardStatus.flashcardId),
        eq(schema.userFlashcardStatus.userId, userId)
      )
    )
    .where(eq(schema.flashcards.deckId, deckId));

    return cards;
  }

  static async saveReview(reviewData: {
    flashcardId: string;
    userId: string;
    rating: number;
    newStatus: any;
    responseTimeMs?: number;
  }) {
    const now = Date.now();
    const reviewId = Crypto.randomUUID();

    await db.insert(schema.reviews).values({
      id: reviewId,
      flashcardId: reviewData.flashcardId,
      userId: reviewData.userId,
      rating: reviewData.rating,
      reviewedAt: now,
      responseTimeMs: reviewData.responseTimeMs,
      previousStability: reviewData.newStatus.previousStability,
      newStability: reviewData.newStatus.stability,
      previousDifficulty: reviewData.newStatus.previousDifficulty,
      newDifficulty: reviewData.newStatus.difficulty,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    });

    await db.insert(schema.userFlashcardStatus).values({
      id: Crypto.randomUUID(),
      userId: reviewData.userId,
      flashcardId: reviewData.flashcardId,
      interval: reviewData.newStatus.interval,
      stability: reviewData.newStatus.stability,
      difficulty: reviewData.newStatus.difficulty,
      repetitions: reviewData.newStatus.repetitions,
      due_date: reviewData.newStatus.dueDate,
      lastReviewed: now,
      updatedAt: now,
      createdAt: now,
      deletedAt: null
    }).onConflictDoUpdate({
      target: [schema.userFlashcardStatus.userId, schema.userFlashcardStatus.flashcardId],
      set: {
        interval: reviewData.newStatus.interval,
        stability: reviewData.newStatus.stability,
        difficulty: reviewData.newStatus.difficulty,
        repetitions: reviewData.newStatus.repetitions,
        due_date: reviewData.newStatus.dueDate,
        lastReviewed: now,
        updatedAt: now,
      }
    });

    await this.addToSyncQueue('REVIEW', 'card_status', reviewData.flashcardId, {
      rating: reviewData.rating,
      reviewedAt: now,
      ...reviewData.newStatus
    });
  }

  static async toggleBookmark(cardId: string, userId: string, isBookmarked: boolean) {
    const now = Date.now();
    
    await db.insert(schema.userFlashcardStatus).values({
      id: Crypto.randomUUID(),
      userId,
      flashcardId: cardId,
      isBookmarked,
      due_date: now,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }).onConflictDoUpdate({
      target: [schema.userFlashcardStatus.userId, schema.userFlashcardStatus.flashcardId],
      set: {
        isBookmarked,
        updatedAt: now,
      }
    });

    await this.addToSyncQueue('UPDATE', 'card_status', cardId, { isBookmarked });
  }

  static async updateNote(cardId: string, userId: string, notes: string) {
    const now = Date.now();
    
    await db.insert(schema.userFlashcardStatus).values({
      id: Crypto.randomUUID(),
      userId,
      flashcardId: cardId,
      notes,
      due_date: now,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }).onConflictDoUpdate({
      target: [schema.userFlashcardStatus.userId, schema.userFlashcardStatus.flashcardId],
      set: {
        notes,
        updatedAt: now,
      }
    });

    await this.addToSyncQueue('UPDATE', 'card_status', cardId, { notes });
  }

  static async getDebugCardData(userId: string) {
    return await db.select({
      id: schema.flashcards.id,
      front: schema.flashcards.frontContent,
      isBookmarked: schema.userFlashcardStatus.isBookmarked,
      notes: schema.userFlashcardStatus.notes,
      stability: schema.userFlashcardStatus.stability,
      difficulty: schema.userFlashcardStatus.difficulty,
      repetitions: schema.userFlashcardStatus.repetitions,
      dueDate: schema.userFlashcardStatus.due_date,
    })
    .from(schema.flashcards)
    .leftJoin(
      schema.userFlashcardStatus,
      and(
        eq(schema.flashcards.id, schema.userFlashcardStatus.flashcardId),
        eq(schema.userFlashcardStatus.userId, userId)
      )
    );
  }
}
