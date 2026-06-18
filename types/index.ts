export type ContentType = 'text' | 'image' | 'latex' | 'audio' | 'mixed';

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  contentType: ContentType;
  mediaUrls?: string[];
  tags: string[];
  deckId: string;
  createdAt: number;
  updatedAt: number;
  startingStability?: number; // Added from creator
  // Spaced repetition data
  interval: number; // Days until next review
  stability: number; // FSRS stability
  difficulty: number; // FSRS difficulty
  repetitions: number; // Number of times reviewed
  dueDate: number; // Timestamp when card is due for review
  lastReviewed: number | null; // Timestamp of last review
  isBookmarked?: boolean;
  notes?: string;
}

export interface Deck {
  id: string;
  name: string;
  description: string | null;
  cardCount: number;
  tags: string[];
  isPremium: boolean;
  price?: number | null;
  createdAt: number;
  updatedAt: number;
  coverImage?: string | null;
  subject?: string | null;
  chapter?: string | null;
  userId: string;
  isPublic: boolean;
  prepCategory?: string | null;
  areCardsLoaded?: boolean;
}

export interface StudySession {
  id: string;
  deckId: string;
  startTime: number;
  endTime?: number;
  cardsStudied: number;
  cardsCorrect: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isLoggedIn: boolean;
  isPremium: boolean;
  createdAt: number;
  updatedAt: number;
  totalCardsStudied: number;
  totalTimeStudied: number; // in minutes
  streakDays: number;
  lastStudyDate: number | null;
  ownedDecks: string[];
}

export type DifficultyRating = 'again' | 'hard' | 'good' | 'easy';

export interface StudyProgress {
  deckId: string;
  cardsLeft: number;
  cardsStudied: number;
  currentCardIndex: number;
}