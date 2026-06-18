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
    payload: any,
    tx?: any
  ) {
    const now = Date.now();
    const executor = tx || db;
    await executor.insert(schema.syncQueue).values({
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

      if (allDecks.length === 0) return [];

      // Optimize: Only fetch needed ids to avoid loading massive content columns
      const allCards = await db.select({
        id: schema.flashcards.id,
        deckId: schema.flashcards.deckId
      }).from(schema.flashcards);
      
      const allStatusForUser = await db.select({
        flashcardId: schema.userFlashcardStatus.flashcardId,
        due_date: schema.userFlashcardStatus.due_date
      })
        .from(schema.userFlashcardStatus)
        .where(eq(schema.userFlashcardStatus.userId, userId));

      // Build lookup maps for O(1) access
      const cardsByDeck = new Map<string, any[]>();
      allCards.forEach(card => {
        const existing = cardsByDeck.get(card.deckId) || [];
        existing.push(card);
        cardsByDeck.set(card.deckId, existing);
      });

      const reviewedCardIds = new Set(allStatusForUser.map(s => s.flashcardId));
      const dueCardIds = new Set(
        allStatusForUser
          .filter(s => s.due_date <= now)
          .map(s => s.flashcardId)
      );

      const enhancedDecks = allDecks.map((deck) => {
        const deckCards = cardsByDeck.get(deck.id) || [];
        const totalCards = deckCards.length;

        const dueInThisDeck = deckCards.filter(c => dueCardIds.has(c.id)).length;
        const newInThisDeck = deckCards.filter(c => !reviewedCardIds.has(c.id)).length;

        const finalDueCount = dueInThisDeck + newInThisDeck;

        let tags = [];
        try {
          tags = JSON.parse(deck.tags || '[]');
        } catch (e) {
          tags = [];
        }

        return {
          ...deck,
          cardCount: totalCards,
          dueCount: finalDueCount,
          tags: tags,
        };
      });

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
    if (subject === 'subject') subject = null; 

    const chapter = deck.chapter || null;
    
    let coverImage = deck.cover_image || deck.coverImage || null;
    if (coverImage && coverImage.startsWith('http')) {
      const localCover = await MediaService.downloadImage(coverImage);
      if (localCover) coverImage = localCover;
    }

    const tags = deck.tags_json 
      ? (typeof deck.tags_json === 'string' ? JSON.parse(deck.tags_json) : deck.tags_json)
      : (deck.tags || []);

    // Process image downloads in chunks to avoid unbounded concurrency (rate-limiting/timeouts)
    const processedFlashcards: any[] = [];
    const chunkSize = 10;
    
    for (let i = 0; i < flashcards.length; i += chunkSize) {
      const chunk = flashcards.slice(i, i + chunkSize);
      const processedChunk = await Promise.all(chunk.map(async (fc) => {
        let mediaUrls: string[] = [];
        const rawMediaUrls = fc.media_urls_json ?? fc.mediaUrls ?? '[]';
        try {
          mediaUrls = typeof rawMediaUrls === 'string' ? JSON.parse(rawMediaUrls) : rawMediaUrls;
        } catch {
          mediaUrls = [];
        }

        if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
          mediaUrls = await MediaService.downloadImages(mediaUrls);
        }

        const contentType = fc.content_type || fc.contentType || 'text';
        
        let frontContent = fc.front_content 
          ? (typeof fc.front_content === 'string' ? fc.front_content : JSON.stringify(fc.front_content))
          : fc.frontContent || JSON.stringify([{ type: contentType, value: fc.front }]);
          
        let backContent = fc.back_content
          ? (typeof fc.back_content === 'string' ? fc.back_content : JSON.stringify(fc.back_content))
          : fc.backContent || JSON.stringify([{ type: contentType, value: fc.back }]);

        return {
          ...fc,
          frontContent,
          backContent,
          mediaUrls
        };
      }));
      processedFlashcards.push(...processedChunk);
    }

    await db.transaction(async (tx) => {
      await tx.insert(schema.decks).values({
        id: deckId,
        remoteId: deck.remote_id || deck.remoteId || null,
        name,
        description,
        subject,
        chapter,
        coverImage,
        version: deck.version || 1,
        isDownloaded: processedFlashcards.length > 0,
        downloadedAt: now,
        isPublic: deck.is_public ?? true,
        prepCategory: deck.prep_category || deck.prepCategory || null,
        userId: deck.user_id || deck.userId || 'system',
        tags: JSON.stringify(tags),
        createdAt: deck.created_at || deck.createdAt || now,
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
          isDownloaded: processedFlashcards.length > 0,
          isPublic: deck.is_public ?? true,
          prepCategory: deck.prep_category || deck.prepCategory || null,
          updatedAt: now,
        }
      });

      if (processedFlashcards.length > 0) {
        for (const fc of processedFlashcards) {
          await tx.insert(schema.flashcards).values({
            id: fc.id || Crypto.randomUUID(),
            deckId: deckId,
            frontContent: fc.frontContent,
            backContent: fc.backContent,
            startingStability: fc.starting_stability || fc.startingStability || 0,
            mediaUrls: JSON.stringify(fc.mediaUrls),
            createdAt: fc.createdAt || fc.created_at || now,
            updatedAt: fc.updatedAt || fc.updated_at || now,
            deletedAt: null
          }).onConflictDoUpdate({
            target: schema.flashcards.id,
            set: {
              frontContent: fc.frontContent,
              backContent: fc.backContent,
              startingStability: fc.starting_stability || fc.startingStability || 0,
              mediaUrls: JSON.stringify(fc.mediaUrls),
              updatedAt: now,
            }
          });
        }
      }
    });

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

    await db.transaction(async (tx) => {
      await tx.insert(schema.reviews).values({
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

      await tx.insert(schema.userFlashcardStatus).values({
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
      }, tx);
    });
  }

  static async toggleBookmark(cardId: string, userId: string, isBookmarked: boolean) {
    const now = Date.now();
    
    await db.transaction(async (tx) => {
      await tx.insert(schema.userFlashcardStatus).values({
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

      await this.addToSyncQueue('UPDATE', 'card_status', cardId, { isBookmarked }, tx);
    });
  }

  static async updateNote(cardId: string, userId: string, notes: string) {
    const now = Date.now();
    
    await db.transaction(async (tx) => {
      await tx.insert(schema.userFlashcardStatus).values({
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

      await this.addToSyncQueue('UPDATE', 'card_status', cardId, { notes }, tx);
    });
  }

  static async getDebugCardData(userId: string) {
    if (!__DEV__) return [];
    
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
