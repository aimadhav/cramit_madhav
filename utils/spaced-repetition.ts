import { Flashcard, DifficultyRating } from '@/types';

// SM-2 algorithm implementation based on Anki's spaced repetition system
export function calculateNextReview(
  card: Flashcard,
  rating: DifficultyRating
): Partial<Flashcard> {
  let { interval, easeFactor, repetitions } = card;
  
  // Default values if not set
  interval = interval || 1;
  easeFactor = easeFactor || 2.5;
  repetitions = repetitions || 0;
  
  const now = Date.now();
  
  // Calculate new values based on rating
  switch (rating) {
    case 'again': // Failed to recall - reset to beginning
      repetitions = 0;
      interval = 1; // Reset interval to 1 day
      easeFactor = Math.max(1.3, easeFactor - 0.2); // Reduce ease factor
      break;
      
    case 'hard': // Correct but difficult
      if (repetitions === 0) {
        // First time seen - graduate to 1 day but mark as hard
        interval = 1;
        repetitions = 1;
      } else {
        // Subsequent reviews - multiply by 1.2 instead of full ease factor
        interval = Math.max(1, Math.round(interval * 1.2));
        repetitions += 1;
      }
      easeFactor = Math.max(1.3, easeFactor - 0.15); // Reduce ease factor slightly
      break;
      
    case 'good': // Normal correct answer (most common)
      if (repetitions === 0) {
        // First time seen - graduate to 1 day
        interval = 1;
        repetitions = 1;
      } else if (repetitions === 1) {
        // Second review - graduate to 6 days (standard Anki progression)
        interval = 6;
        repetitions = 2;
      } else {
        // Subsequent reviews - multiply by ease factor
        interval = Math.round(interval * easeFactor);
        repetitions += 1;
      }
      // Ease factor stays the same for 'good' ratings
      break;
      
    case 'easy': // Correct and easy
      if (repetitions === 0) {
        // First time seen - skip to 4 days (early graduation)
        interval = 4;
        repetitions = 2; // Skip the 6-day step
      } else if (repetitions === 1) {
        // Second review - jump to longer interval
        interval = 10;
        repetitions = 2;
      } else {
        // Subsequent reviews - multiply by ease factor * 1.3 (easier bonus)
        interval = Math.round(interval * easeFactor * 1.3);
        repetitions += 1;
      }
      easeFactor = Math.min(2.8, easeFactor + 0.15); // Increase ease factor (cap at 2.8)
      break;
  }
  
  // Calculate due date (current time + interval in days)
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
  return cards.filter(card => {
    // Only include cards that have been reviewed at least once (lastReviewed is not null)
    // AND are due for review (no dueDate set or dueDate is in the past)
    return card.lastReviewed !== null && (!card.dueDate || card.dueDate <= now);
  });
}

// Get new cards (cards that have never been reviewed)
export function getNewCards(cards: Flashcard[]): Flashcard[] {
  return cards.filter(card => card.lastReviewed === null);
}

// Sort cards by due date
export function sortCardsByDue(cards: Flashcard[]): Flashcard[] {
  return [...cards].sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0));
}