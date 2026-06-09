import { DatabaseService } from './database-service';
import { calculateNextReview } from '@/utils/spaced-repetition';
import { DifficultyRating, Flashcard } from '@/types';
import * as Crypto from 'expo-crypto';

export class StudyService {
  
  /**
   * Starts a study session and returns a queue of card IDs
   */
  static async getSessionQueue(deckId: string, limit: number = 50) {
    const { useUserStore } = require('@/store/user-store');
    const userId = useUserStore.getState().user?.id || 'local';
    const allCards = await DatabaseService.getDeckWithCards(deckId, userId);
    
    const now = Date.now();
    
    // 1. Filter Due Cards
    const dueCards = allCards.filter(c => {
      const status = c.status;
      return status && status.due_date <= now;
    });

    // 2. Filter New Cards
    const newCards = allCards.filter(c => !c.status);

    // 3. Combine and sort
    // Priority: Due cards (oldest first) > New cards (original order)
    const combined = [
      ...dueCards.sort((a, b) => (a.status?.due_date || 0) - (b.status?.due_date || 0)),
      ...newCards
    ].slice(0, limit);

    return combined.map(c => c.card.id);
  }

  /**
   * Processes a card rating, updates SQLite, and returns the updated state
   */
  static async rateCard(params: {
    card: any; // The flashcard data
    status: any; // The current user_flashcard_status
    rating: DifficultyRating;
    userId: string;
  }) {
    const { card, status, rating, userId } = params;

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
