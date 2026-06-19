import { DatabaseService } from './database-service';
import { calculateNextReview } from '@/utils/spaced-repetition';
import { DifficultyRating, Flashcard } from '@/types';
import * as Crypto from 'expo-crypto';

export class StudyService {
  
  /**
   * Starts a study session and returns a queue of card IDs
   */
  static async getSessionQueue(deckIdOrSubject: string, limit: number = 45, isCramMode: boolean = false) {
    const { useUserStore } = require('@/store/user-store');
    const { db } = require('@/db');
    const { sql, eq, and, inArray, isNull } = require('drizzle-orm');
    const { flashcards, userFlashcardStatus, decks } = require('@/db/schema');

    const userId = useUserStore.getState().user?.id || 'local';
    const now = Date.now();

    let activeDeckIds: string[] = [];

    // Support both single deck/chapter ID and subject-based dynamic views
    const knownSubjects = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Chemistry', 'Maths', 'DSA', 'DBMS', 'Operating Systems', 'OOP', 'Computer Networks'];
    const isSubject = knownSubjects.some(
      s => s.toLowerCase() === deckIdOrSubject.toLowerCase()
    );

    if (isSubject) {
      if (isCramMode) {
        // Cram mode pulls cards from ALL chapters of the subject
        const subjectDecks = await db.select({ id: decks.id })
          .from(decks)
          .where(eq(sql`lower(${decks.subject})`, deckIdOrSubject.toLowerCase()));
        activeDeckIds = subjectDecks.map((d: any) => d.id);
      } else {
        // Main deck daily progression strictly filters by selected active chapters
        activeDeckIds = await DatabaseService.getActiveChapterIds(userId, deckIdOrSubject);
      }
      
      if (activeDeckIds.length === 0) {
        console.warn(`⚠️ [StudyService] No chapters found for subject: ${deckIdOrSubject}`);
        return [];
      }
    } else {
      activeDeckIds = [deckIdOrSubject];
    }

    const cardsWithStatus = [];

    if (isSubject) {
      // Option 1: Fetch ALL reviewed/started cards for the entire subject
      const subjectDecks = await db.select({ id: decks.id })
        .from(decks)
        .where(eq(sql`lower(${decks.subject})`, deckIdOrSubject.toLowerCase()));
      const subjectDeckIds = subjectDecks.map((d: any) => d.id);

      if (subjectDeckIds.length > 0) {
        const reviewedCards = await db.select({
          card: flashcards,
          status: userFlashcardStatus
        })
        .from(flashcards)
        .innerJoin(
          userFlashcardStatus,
          and(
            eq(flashcards.id, userFlashcardStatus.flashcardId),
            eq(userFlashcardStatus.userId, userId)
          )
        )
        .where(inArray(flashcards.deckId, subjectDeckIds));

        cardsWithStatus.push(...reviewedCards);
      }

      // Option 1: Fetch unreviewed new cards. In Cram Mode, fetch from ALL chapters; otherwise strictly active chapters
      const targetDeckIdsForNew = isCramMode ? subjectDeckIds : activeDeckIds;

      if (targetDeckIdsForNew.length > 0) {
        const newCardsInActive = await db.select({
          card: flashcards,
          status: userFlashcardStatus
        })
        .from(flashcards)
        .leftJoin(
          userFlashcardStatus,
          and(
            eq(flashcards.id, userFlashcardStatus.flashcardId),
            eq(userFlashcardStatus.userId, userId)
          )
        )
        .where(
          and(
            inArray(flashcards.deckId, targetDeckIdsForNew),
            isNull(userFlashcardStatus.id)
          )
        );

        cardsWithStatus.push(...newCardsInActive);
      }
    } else {
      // Standard chapter/deck-only fallback
      if (activeDeckIds.length > 0) {
        const dbCards = await db.select({
          card: flashcards,
          status: userFlashcardStatus
        })
        .from(flashcards)
        .leftJoin(
          userFlashcardStatus, 
          and(
            eq(flashcards.id, userFlashcardStatus.flashcardId),
            eq(userFlashcardStatus.userId, userId)
          )
        )
        .where(inArray(flashcards.deckId, activeDeckIds));

        cardsWithStatus.push(...dbCards);
      }
    }

    if (cardsWithStatus.length === 0) return [];

    // Filter Due/Overdue cards (due date passed)
    const dueCards = cardsWithStatus.filter((c: any) => {
      const status = c.status;
      return status && status.due_date <= now;
    });

    // Filter New Cards
    const newCards = cardsWithStatus.filter((c: any) => !c.status);

    // Sort new cards sequentially by chapter deckId to ensure structured chapter progression
    newCards.sort((a: any, b: any) => {
      return String(a.card.deckId).localeCompare(String(b.card.deckId));
    });

    // Smart Capping: Reserve exactly 5 slots for new cards to guarantee learning progression
    // so we don't stall due to backlogs.
    const reservedNewCount = Math.min(5, newCards.length);
    const maxDueCount = Math.min(dueCards.length, limit - reservedNewCount);

    const sortedDueCards = dueCards.sort((a: any, b: any) => (a.status?.due_date || 0) - (b.status?.due_date || 0));
    const slicedDueCards = sortedDueCards.slice(0, maxDueCount);

    const newCardsNeeded = limit - slicedDueCards.length;
    const slicedNewCards = newCards.slice(0, newCardsNeeded);

    const combined = [...slicedDueCards, ...slicedNewCards];

    return combined.map((c: any) => c.card.id);
  }

  /**
   * Builds an optional study session specifically for overdue backlog cards
   */
  static async getBacklogQueue(subject: string, limit: number = 30) {
    const { useUserStore } = require('@/store/user-store');
    const { db } = require('@/db');
    const { eq, and, inArray } = require('drizzle-orm');
    const { flashcards, userFlashcardStatus } = require('@/db/schema');

    const userId = useUserStore.getState().user?.id || 'local';
    const now = Date.now();

    const activeDeckIds = await DatabaseService.getActiveChapterIds(userId, subject);
    if (activeDeckIds.length === 0) return [];

    const cardsWithStatus = await db.select({
      card: flashcards,
      status: userFlashcardStatus
    })
    .from(flashcards)
    .leftJoin(
      userFlashcardStatus, 
      and(
        eq(flashcards.id, userFlashcardStatus.flashcardId),
        eq(userFlashcardStatus.userId, userId)
      )
    )
    .where(inArray(flashcards.deckId, activeDeckIds));

    const dueCards = cardsWithStatus.filter((c: any) => {
      const status = c.status;
      return status && status.due_date <= now;
    });

    // Sort by due date ascending (oldest backlog items first)
    const backlogSorted = dueCards.sort((a: any, b: any) => (a.status?.due_date || 0) - (b.status?.due_date || 0));
    return backlogSorted.slice(0, limit).map((c: any) => c.card.id);
  }

  /**
   * Builds a targeted cram session queue ordered by lowest memory stability
   */
  static async getCramQueue(subject: string, filter: 'Formulas' | 'Concepts' | 'Mistakes' | string, limit: number = 50) {
    const { useUserStore } = require('@/store/user-store');
    const { db } = require('@/db');
    const { eq, and, inArray } = require('drizzle-orm');
    const { flashcards, userFlashcardStatus, decks } = require('@/db/schema');

    const userId = useUserStore.getState().user?.id || 'local';

    // Fetch all chapters (decks) for this subject
    const subjectDecks = await db.select({ id: decks.id })
      .from(decks)
      .where(eq(decks.subject, subject));

    if (subjectDecks.length === 0) return [];
    const deckIds = subjectDecks.map((d: any) => d.id);

    // Fetch all cards and statuses in those chapters
    const allCards = await db.select({
      card: flashcards,
      status: userFlashcardStatus
    })
    .from(flashcards)
    .leftJoin(
      userFlashcardStatus, 
      and(
        eq(flashcards.id, userFlashcardStatus.flashcardId),
        eq(userFlashcardStatus.userId, userId)
      )
    )
    .where(inArray(flashcards.deckId, deckIds));

    let filtered = [];

    if (filter === 'Formulas' || filter === 'Concepts') {
      const tagToMatch = filter === 'Formulas' ? 'formula' : 'concept';
      filtered = allCards.filter((c: any) => {
        try {
          const frontText = String(c.card.frontContent).toLowerCase();
          const backText = String(c.card.backContent).toLowerCase();
          return frontText.includes(tagToMatch) || backText.includes(tagToMatch);
        } catch {
          return false;
        }
      });
    } else if (filter === 'Mistakes') {
      filtered = allCards.filter((c: any) => {
        const status = c.status;
        if (!status) return false;
        return (status.leftSwipes > status.rightSwipes) || status.lastSwipeDirection === 'left';
      });
    } else {
      filtered = allCards;
    }

    // Sort by FSRS stability ASC (weakest memory first, putting new cards last)
    filtered.sort((a: any, b: any) => {
      const stabA = a.status?.stability ?? 0;
      const stabB = b.status?.stability ?? 0;
      if (stabA === 0 && stabB > 0) return 1;
      if (stabB === 0 && stabA > 0) return -1;
      return stabA - stabB;
    });

    return filtered.slice(0, limit).map((c: any) => c.card.id);
  }

  /**
   * Processes a card rating, updates SQLite, and returns the updated state
   */
  static async rateCard(params: {
    card: any; // The flashcard data
    status: any; // The current user_flashcard_status
    rating: DifficultyRating;
    userId: string;
    responseTimeMs?: number;
  }) {
    const { card, status, rating, userId, responseTimeMs } = params;

    // 1. Prepare card object for FSRS utility
    const fsrsInput: any = {
      ...status,
      lastReviewed: status?.lastReviewed || null,
      repetitions: status?.repetitions || 0,
      stability: status?.stability || 0,
      difficulty: status?.difficulty || 0,
    };

    // 2. Calculate next review
    const fsrsResult = calculateNextReview(fsrsInput, rating);

    // 3. Save to Database
    await DatabaseService.saveReview({
      flashcardId: card.id,
      userId,
      rating: this.ratingToNumber(rating),
      responseTimeMs,
      newStatus: {
        ...fsrsResult,
        previousStability: fsrsInput.stability,
        previousDifficulty: fsrsInput.difficulty,
      }
    });

    return fsrsResult;
  }

  private static ratingToNumber(rating: DifficultyRating): number {
    const map = { 'again': 1, 'hard': 2, 'good': 3, 'easy': 4 };
    return map[rating];
  }
}
