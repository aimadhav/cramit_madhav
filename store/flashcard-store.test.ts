// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/services/database-service', () => ({
  DatabaseService: {
    getAllDecks: vi.fn(async () => []),
    getDeckWithCards: vi.fn(async () => []),
    toggleBookmark: vi.fn(async () => undefined),
    updateNote: vi.fn(async () => undefined),
  },
}));

vi.mock('@/services/study-service', () => ({
  StudyService: {
    getSessionQueue: vi.fn(async () => []),
    rateCard: vi.fn(async () => undefined),
  },
}));

vi.mock('@/services/sync-service', () => ({
  SyncService: {
    pushChanges: vi.fn(async () => undefined),
    fullSync: vi.fn(async () => undefined),
    cacheDeckImages: vi.fn(async () => undefined),
  },
}));

import { useFlashcardStore } from './flashcard-store';

describe('useFlashcardStore local behavior', () => {
  beforeEach(() => {
    useFlashcardStore.setState(useFlashcardStore.getInitialState(), true);
  });

  it('advances the study progress counters', () => {
    useFlashcardStore.setState({
      studyProgress: {
        deckId: 'deck-1',
        cardsLeft: 3,
        cardsStudied: 0,
        currentCardIndex: 0,
      },
    });

    useFlashcardStore.getState().getNextCard();
    const progress = useFlashcardStore.getState().studyProgress;

    expect(progress).toMatchObject({
      currentCardIndex: 1,
      cardsStudied: 1,
      cardsLeft: 2,
    });
  });

  it('calculates deck completion from total and due cards', () => {
    useFlashcardStore.setState({
      decks: [{ id: 'deck-1', name: 'Deck', cardCount: 10, dueCount: 4 }],
    });

    expect(useFlashcardStore.getState().getDeckCompletionRate('deck-1')).toBe(60);
  });

  it('clears local study state', () => {
    useFlashcardStore.setState({
      decks: [{ id: 'deck-1', name: 'Deck', cardCount: 1 }],
      flashcards: [{ id: 'card-1' }],
      currentFlashcards: [{ id: 'card-1' }],
      currentDeckId: 'deck-1',
      sessionQueue: ['card-1'],
    });

    useFlashcardStore.getState().clearStore();
    const state = useFlashcardStore.getState();

    expect(state.decks).toEqual([]);
    expect(state.flashcards).toEqual([]);
    expect(state.currentFlashcards).toEqual([]);
    expect(state.currentDeckId).toBeNull();
    expect(state.sessionQueue).toEqual([]);
  });
});
