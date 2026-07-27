import { db } from '@/db';
import * as schema from '@/db/schema';
import { canonicalizeSubject } from '@/constants/examSubjects';
import { eq, and, desc, inArray, notInArray } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { MediaService } from './media-service';
import { safeParseJsonArray, toStoredJson } from './database-content';
import { buildCardsByDeck, buildDeckSummary } from './database-deck-summary';
import { getDeckWithCards as getDeckWithCardsQuery } from './database-cards';
import {
  saveReview as saveReviewWrite,
  toggleBookmark as toggleBookmarkWrite,
  updateNote as updateNoteWrite,
  addActiveChapter as addActiveChapterWrite,
  completeActiveChapter as completeActiveChapterWrite,
  getActiveChapterIds as getActiveChapterIdsWrite,
} from './database-status-writes';

export class DatabaseService {
  
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

      const cardsByDeck = buildCardsByDeck(allCards);

      const reviewedCardIds = new Set(allStatusForUser.map(s => s.flashcardId));
      const dueCardIds = new Set(
        allStatusForUser
          .filter(s => s.due_date <= now)
          .map(s => s.flashcardId)
      );

      const enhancedDecks = allDecks.map((deck) => buildDeckSummary(deck, now, cardsByDeck, reviewedCardIds, dueCardIds));

      return enhancedDecks;
    } catch (e: any) {
      if (e.message.includes('no such table')) {
        console.warn('⚠️ [DB] Tables not created yet, skipping deck fetch.');
        return [];
      }
      throw e;
    }
  }

  static async upsertDeck(deck: any, flashcards: any[], options?: { replaceCards?: boolean }) {
    const now = Date.now();
    const deckId = deck.id || Crypto.randomUUID();
    const contentSynced = options?.replaceCards === true;
    const remoteVersion = Number(deck.version ?? 1);
    
    const name = deck.name || 'Untitled Deck';
    const description = deck.description || '';
    
    let subject = canonicalizeSubject(deck.subject || deck.subjectName);
    if (subject === 'subject') subject = null; 

    const chapter = deck.chapter || null;
    
    let coverImage = deck.cover_image || deck.coverImage || null;
    if (coverImage && coverImage.startsWith('http')) {
      const localCover = await MediaService.downloadImage(coverImage);
      if (localCover) coverImage = localCover;
    }

    const tags = deck.tags_json
      ? safeParseJsonArray(deck.tags_json, [])
      : safeParseJsonArray(deck.tags, []);

    // Process image downloads in chunks to avoid unbounded concurrency (rate-limiting/timeouts)
    const processedFlashcards: any[] = [];
    const chunkSize = 10;
    
    for (let i = 0; i < flashcards.length; i += chunkSize) {
      const chunk = flashcards.slice(i, i + chunkSize);
      const processedChunk = await Promise.all(chunk.map(async (fc) => {
        let mediaUrls: string[] = safeParseJsonArray<string>(fc.media_urls_json ?? fc.mediaUrls, []);

        if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
          mediaUrls = await MediaService.downloadImages(mediaUrls);
        }

        const contentType = fc.content_type || fc.contentType || 'text';
        
        const frontContent = fc.front_content
          ? toStoredJson(fc.front_content, fc.frontContent || JSON.stringify([{ type: contentType, value: fc.front }]))
          : fc.frontContent || JSON.stringify([{ type: contentType, value: fc.front }]);

        const backContent = fc.back_content
          ? toStoredJson(fc.back_content, fc.backContent || JSON.stringify([{ type: contentType, value: fc.back }]))
          : fc.backContent || JSON.stringify([{ type: contentType, value: fc.back }]);

        const tags = fc.tags_json 
          ? (typeof fc.tags_json === 'string' ? fc.tags_json : JSON.stringify(fc.tags_json))
          : JSON.stringify(fc.tags || []);

        return {
          ...fc,
          frontContent,
          backContent,
          mediaUrls,
          tags
        };
      }));
      processedFlashcards.push(...processedChunk);
    }

    await db.transaction(async (tx) => {
      const deckUpdate: any = {
        name,
        description,
        subject,
        chapter,
        coverImage,
        isPublic: deck.is_public ?? true,
        prepCategory: deck.prep_category || deck.prepCategory || null,
        updatedAt: now,
        deletedAt: null,
      };

      // Metadata refreshes must preserve the last locally synced content
      // version. A replaceCards refresh advances it, including for empty decks.
      if (contentSynced || processedFlashcards.length > 0) {
        deckUpdate.isDownloaded = true;
        deckUpdate.version = remoteVersion;
      }

      await tx.insert(schema.decks).values({
        id: deckId,
        remoteId: deck.remote_id || deck.remoteId || null,
        name,
        description,
        subject,
        chapter,
        coverImage,
        version: remoteVersion,
        isDownloaded: contentSynced || processedFlashcards.length > 0,
        downloadedAt: now,
        isPublic: deck.is_public ?? true,
        prepCategory: deck.prep_category || deck.prepCategory || null,
        userId: deck.user_id || deck.userId || 'system',
        tags: toStoredJson(tags, '[]'),
        createdAt: deck.created_at || deck.createdAt || now,
        updatedAt: now,
        deletedAt: null
      }).onConflictDoUpdate({
        target: schema.decks.id,
        set: deckUpdate,
      });

      if (options?.replaceCards) {
        const incomingCardIds = processedFlashcards
          .map((card) => card.id)
          .filter((id): id is string => Boolean(id));
        if (incomingCardIds.length > 0) {
          await tx.delete(schema.flashcards).where(and(
            eq(schema.flashcards.deckId, deckId),
            notInArray(schema.flashcards.id, incomingCardIds),
          ));
        } else {
          await tx.delete(schema.flashcards).where(eq(schema.flashcards.deckId, deckId));
        }
      }

      if (processedFlashcards.length > 0) {
        for (const fc of processedFlashcards) {
          await tx.insert(schema.flashcards).values({
            id: fc.id || Crypto.randomUUID(),
            deckId: deckId,
            problemBundleId: fc.problem_bundle_id || fc.problemBundleId || null,
            cardRole: fc.card_role || fc.cardRole || null,
            childType: fc.child_type || fc.childType || null,
            position: fc.position == null ? null : Number(fc.position),
            bundleOrder: fc.bundle_order == null && fc.bundleOrder == null ? null : Number(fc.bundle_order ?? fc.bundleOrder),
            frontContent: fc.frontContent,
            backContent: fc.backContent,
            startingStability: fc.starting_stability != null ? parseFloat(fc.starting_stability) : (fc.startingStability ?? 0),
            mediaUrls: toStoredJson(fc.mediaUrls, '[]'),
            tags: fc.tags || '[]',
            createdAt: fc.createdAt || fc.created_at || now,
            updatedAt: fc.updatedAt || fc.updated_at || now,
            deletedAt: null
          }).onConflictDoUpdate({
            target: schema.flashcards.id,
            set: {
              frontContent: fc.frontContent,
              backContent: fc.backContent,
              problemBundleId: fc.problem_bundle_id || fc.problemBundleId || null,
              cardRole: fc.card_role || fc.cardRole || null,
              childType: fc.child_type || fc.childType || null,
              position: fc.position == null ? null : Number(fc.position),
              bundleOrder: fc.bundle_order == null && fc.bundleOrder == null ? null : Number(fc.bundle_order ?? fc.bundleOrder),
              startingStability: fc.starting_stability != null ? parseFloat(fc.starting_stability) : (fc.startingStability ?? 0),
              mediaUrls: toStoredJson(fc.mediaUrls, '[]'),
              tags: fc.tags || '[]',
              updatedAt: now,
            }
          });
        }
      }
    });

    return deckId;
  }

  static async getDeckWithCards(deckId: string, userId: string) {
    return getDeckWithCardsQuery(deckId, userId);
  }

  static async saveReview(reviewData: {
    flashcardId: string;
    userId: string;
    rating: number;
    newStatus: any;
    responseTimeMs?: number;
  }) {
    return saveReviewWrite(reviewData);
  }

  static async toggleBookmark(cardId: string, userId: string, isBookmarked: boolean) {
    return toggleBookmarkWrite(cardId, userId, isBookmarked);
  }

  static async updateNote(cardId: string, userId: string, notes: string) {
    return updateNoteWrite(cardId, userId, notes);
  }

  static async addActiveChapter(userId: string, deckId: string, subject: string) {
    return addActiveChapterWrite(userId, deckId, subject);
  }

  static async completeActiveChapter(userId: string, deckId: string) {
    return completeActiveChapterWrite(userId, deckId);
  }

  static async getActiveChapterIds(userId: string, subject: string): Promise<string[]> {
    return getActiveChapterIdsWrite(userId, subject);
  }

}
