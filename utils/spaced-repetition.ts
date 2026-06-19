import { Flashcard, DifficultyRating } from '@/types';

// Standard FSRS v4 weights (optimized for general learning retention)
const W = [
  0.4025, 0.8445, 2.1803, 5.8419, // Initial stability for Again (1), Hard (2), Good (3), Easy (4)
  4.9346, 0.9471,                 // Initial difficulty, Difficulty weight
  0.8602, 0.0066,                 // Difficulty mean, Difficulty recovery
  1.493, 0.1407,                  // Stability exponential, Stability coefficient
  0.9426, 2.1843,                 // Stability recall bonus, Stability forget penalty
  0.05, 0.3448, 1.2505, 0.298,    // Stability update parameters
  2.61,                           // Stability update parameters
];

const REQUESTED_RETENTION = 0.9;
const DECAY = Math.log(0.9);
const MAX_INTERVAL = 36500; // 100 years maximum interval

/**
 * Calculate the next review data using the FSRS algorithm.
 * Optimized to be extremely resilient to undefined, corrupted, or NaN state inputs.
 */
export function calculateNextReview(
  card: Flashcard,
  rating: DifficultyRating
): Partial<Flashcard> {
  const now = Date.now();
  
  // Strict FSRS rating mapping (1-4)
  const ratingMap: Record<DifficultyRating, number> = {
    'again': 1,
    'hard': 2,
    'good': 3,
    'easy': 4,
  };
  
  // Safe fallback to 'good' (3) if rating is undefined or invalid
  const G = ratingMap[rating] || 3;
  
  // Safe extraction of current FSRS metrics with defaults for missing or corrupted rows
  let stability = Number(card.stability ?? 0);
  let difficulty = Number(card.difficulty ?? 0);
  let repetitions = Number(card.repetitions ?? 0);
  const lastReviewed = card.lastReviewed ? Number(card.lastReviewed) : null;

  // Handle NaN properties safely
  if (isNaN(stability)) stability = 0;
  if (isNaN(difficulty)) difficulty = 0;
  if (isNaN(repetitions)) repetitions = 0;

  // Default values for brand new cards or legacy cards with missing FSRS stats
  if (repetitions === 0 || !lastReviewed || stability === 0) {
    if (card.startingStability && card.startingStability > 0) {
      stability = card.startingStability;
    } else {
      stability = W[G - 1] || 2.1803; // Fallback to Good initial stability
    }
    difficulty = Math.max(1, Math.min(10, W[4] - (G - 1) * W[5]));
    repetitions = 1;
  } else {
    // Calculate actual elapsed days since last review
    const msSinceLastReview = Math.max(0, now - lastReviewed);
    const t = Math.max(1, Math.floor(msSinceLastReview / (24 * 60 * 60 * 1000)));
    
    // Compute current retrievability (R)
    const R = Math.exp(DECAY * t / stability);
    
    // Update difficulty based on rating (Good/3 has no difficulty delta)
    difficulty = difficulty - W[6] * (G - 3);
    difficulty = Math.max(1, Math.min(10, difficulty));
    
    // Update stability based on review success or failure
    if (G === 1) { 
      // Again (Forgot memory)
      stability = W[11] * Math.pow(difficulty, -W[12]) * (Math.pow(stability + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R));
    } else { 
      // Hard (2), Good (3), Easy (4) (Recalled memory)
      const hardPenalty = G === 2 ? W[15] : 1.0;
      const easyBonus = G === 4 ? W[16] : 1.0;
      
      stability = stability * (1 + Math.exp(W[8]) * (11 - difficulty) * Math.pow(stability, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1) * hardPenalty * easyBonus);
    }
    
    repetitions += 1;
  }
  
  // Calculate next interval based on target retention rate
  // I = S * ln(R_target) / ln(0.9)
  let nextInterval = Math.max(1, Math.round(stability * Math.log(REQUESTED_RETENTION) / DECAY));
  
  // Enforce Max Interval constraint (standard FSRS capping)
  nextInterval = Math.min(MAX_INTERVAL, nextInterval);
  
  // Calculate exact future due date timestamp
  const dueDate = now + nextInterval * 24 * 60 * 60 * 1000;
  
  return {
    stability: Number(stability.toFixed(4)),
    difficulty: Number(difficulty.toFixed(4)),
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
