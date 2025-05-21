import { Flashcard, DifficultyRating } from '@/types';

// Implementation of a simplified SM-2 algorithm (similar to Anki)
export function calculateNextReview(
  card: Flashcard,
  rating: DifficultyRating
): Partial<Flashcard> {
  let { interval, easeFactor, repetitions } = card;
  
  // Default values if not set
  interval = interval || 1;
  easeFactor = easeFactor || 2.5;
  repetitions = repetitions || 0;
  
  // Calculate new values based on rating
  switch (rating) {
    case 'again': // Failed to recall
      repetitions = 0;
      interval = 1;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
      break;
      
    case 'hard':
      if (repetitions === 0) {
        interval = 1;
      } else {
        interval = Math.max(1, Math.round(interval * 1.2));
      }
      easeFactor = Math.max(1.3, easeFactor - 0.15);
      repetitions += 1;
      break;
      
    case 'good':
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions += 1;
      break;
      
    case 'easy':
      if (repetitions === 0) {
        interval = 4;
      } else if (repetitions === 1) {
        interval = 8;
      } else {
        interval = Math.round(interval * easeFactor * 1.3);
      }
      easeFactor = easeFactor + 0.15;
      repetitions += 1;
      break;
  }
  
  // Calculate due date (current time + interval in days)
  const now = Date.now();
  const dueDate = now + interval * 24 * 60 * 60 * 1000;
  
  return {
    interval,
    easeFactor,
    repetitions,
    dueDate,
    lastReviewed: now,
  };
}

// Get cards due for review
export function getDueCards(cards: Flashcard[]): Flashcard[] {
  const now = Date.now();
  return cards.filter(card => !card.dueDate || card.dueDate <= now);
}

// Sort cards by due date
export function sortCardsByDue(cards: Flashcard[]): Flashcard[] {
  return [...cards].sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0));
}