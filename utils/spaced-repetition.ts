import { Flashcard, DifficultyRating } from '@/types';

const W = [
  0.4025, 0.8445, 2.1803, 5.8419, // Initial stability for Again, Hard, Good, Easy
  4.9346, 0.9471, // Initial difficulty, Difficulty weight
  0.8602, 0.0066, // Difficulty mean, Difficulty recovery
  1.493, 0.1407, // Stability exponential, Stability coefficient
  0.9426, 2.1843, // Stability recall bonus, Stability forget penalty
  0.05, 0.3448, 1.2505, 0.298, // Stability update parameters
  2.61, // Max interval
];

const REQUESTED_RETENTION = 0.9;
const DECAY = Math.log(0.9);

/**
 * Calculate the next review data using FSRS algorithm.
 */
export function calculateNextReview(
  card: Flashcard,
  rating: DifficultyRating
): Partial<Flashcard> {
  const now = Date.now();
  const ratingMap: Record<DifficultyRating, number> = {
    'again': 1,
    'hard': 2,
    'good': 3,
    'easy': 4,
  };
  const G = ratingMap[rating];
  
  let { stability, difficulty, repetitions, lastReviewed } = card; 
  
  // Default values for new cards or legacy cards where FSRS fields are 0
  if (repetitions === 0 || !lastReviewed || stability === 0) {
    // Initial review or migration to FSRS
    if (card.startingStability && card.startingStability > 0) {
      stability = card.startingStability;
    } else {
      stability = W[G - 1];
    }
    difficulty = Math.max(1, Math.min(10, W[4] - (G - 1) * W[5]));
    repetitions = repetitions === 0 ? 1 : repetitions + 1;
  } else {
    // Calculated days since last review
    const t = Math.max(1, Math.floor((now - lastReviewed) / (24 * 60 * 60 * 1000)));
    
    // Current retrievability
    const R = Math.exp(DECAY * t / stability);
    
    // Update difficulty
    difficulty = difficulty - W[6] * (G - 3);
    difficulty = Math.max(1, Math.min(10, difficulty));
    
    // Update stability
    if (G === 1) { // Again (Forget)
      stability = W[11] * Math.pow(difficulty, -W[12]) * (Math.pow(stability + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R));
    } else { // Hard, Good, Easy (Recall)
      const hardPenalty = G === 2 ? W[15] : 1.0;
      const easyBonus = G === 4 ? W[16] : 1.0;
      
      stability = stability * (1 + Math.exp(W[8]) * (11 - difficulty) * Math.pow(stability, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1) * hardPenalty * easyBonus);
    }
    
    repetitions += 1;
  }
  
  // Calculate next interval based on stability and requested retention
  // I = S * ln(R_target) / ln(0.9)
  const nextInterval = Math.max(1, Math.round(stability * Math.log(REQUESTED_RETENTION) / DECAY));
  
  // Calculate due date
  const dueDate = now + nextInterval * 24 * 60 * 60 * 1000;
  
  return {
    stability,
    difficulty,
    interval: nextInterval,
    repetitions,
    dueDate,
    lastReviewed: now,
  };
}

/**
 * Get cards due for review.
 */
export function getDueCards(cards: Flashcard[]): Flashcard[] {
  const now = Date.now();
  return cards.filter(card => {
    // Cards are due if they've been reviewed before AND (no due date OR due date passed)
    return card.lastReviewed !== null && (!card.dueDate || card.dueDate <= now);
  });
}

/**
 * Get new cards (never reviewed).
 */
export function getNewCards(cards: Flashcard[]): Flashcard[] {
  return cards.filter(card => !card.lastReviewed);
}

/**
 * Sort cards by priority (due date).
 */
export function sortCardsByDue(cards: Flashcard[]): Flashcard[] {
  return [...cards].sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0));
}