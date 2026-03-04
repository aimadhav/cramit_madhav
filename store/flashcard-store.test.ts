// @ts-nocheck
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('react-native', () => ({
  StyleSheet: { create: vi.fn((styles) => styles) },
  Platform: { OS: 'test', select: vi.fn() },
}));

vi.mock('@react-native-async-storage/async-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@react-native-async-storage/async-storage')>();
  return {
    ...actual,
    default: {
        getItem: vi.fn(() => Promise.resolve(null)),
        setItem: vi.fn(() => Promise.resolve()),
        removeItem: vi.fn(() => Promise.resolve()),
        clear: vi.fn(() => Promise.resolve()),
    }
  };
});

vi.mock('@/utils/trpc', () => ({
  trpcClient: {
    deck: {
      getByIdWithCards: { query: vi.fn() },
    },
    flashcards: {
      batchUpdateUserStatus: { mutate: vi.fn() },
      updateUserStatus: { mutate: vi.fn() },
    },
  },
}));

import { useFlashcardStore } from './flashcard-store';
import { trpcClient } from '@/utils/trpc';
import { DifficultyRating, ContentType } from '@/types';

const initialState = useFlashcardStore.getState();

describe('useFlashcardStore offline queueing logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlashcardStore.setState(useFlashcardStore.getInitialState(), true); 
    useFlashcardStore.setState({ 
      decks: [],
      flashcards: [],
      sessionRatings: {},
      studyProgress: null,
      currentCardIndex: 0,
    });
  });

  it('should offline queue a rating in sessionRatings and update optimistic SRS fields', async () => {
    const cardId = 'mock-card-id';
    // Initial mockup
    useFlashcardStore.setState({
      decks: [{ id: 'deck1', name: 'Deck', cardCount: 1 }],
      flashcards: [{
        id: cardId, deckId: 'deck1', front: 'Q1', back: 'A1', contentType: 'text',
        createdAt: Date.now(), updatedAt: Date.now(),
        interval: 1, stability: 0, difficulty: 0, repetitions: 0,
        dueDate: Date.now(), isBookmarked: false, lastReviewed: null,
        tags: [], mediaUrls: []
      }],
      currentDeckId: 'deck1'
    });

    useFlashcardStore.getState().startStudySession('deck1');
    
    // Attempt local rating buffer
    await useFlashcardStore.getState().rateCard(cardId, 'good');

    const state = useFlashcardStore.getState();
    const ratedCard = state.flashcards.find(c => c.id === cardId)!;

    // sessionRatings should capture the queue
    expect(state.sessionRatings[cardId]).toBeDefined();
    expect(state.sessionRatings[cardId].interval).toBeDefined();
    expect(state.sessionRatings[cardId].repetitions).toBe(1);

    // card itself should have visually optimistic fields
    expect(ratedCard.repetitions).toBe(1);
    expect(ratedCard.lastReviewed).not.toBeNull();
    // Since it was rated good, due date increases significantly past now
    expect(ratedCard.dueDate).toBeGreaterThan(Date.now() + 100);
  });

  it('should toggle bookmark locally and immediately upload it', async () => {
    const cardId = 'mock-card-id-bm';
    useFlashcardStore.setState({
      flashcards: [{
        id: cardId, deckId: 'deck1', front: 'Q1', back: 'A1', contentType: 'text',
        createdAt: Date.now(), updatedAt: Date.now(),
        interval: 1, stability: 0, difficulty: 0, repetitions: 0,
        dueDate: Date.now(), isBookmarked: false, lastReviewed: null,
        tags: [], mediaUrls: []
      }]
    });

    (trpcClient.flashcards.updateUserStatus.mutate as any).mockResolvedValueOnce({ success: true, isBookmarked: true });

    await useFlashcardStore.getState().toggleBookmark(cardId);
    
    const state = useFlashcardStore.getState();
    const updatedCard = state.flashcards.find(c => c.id === cardId)!;

    // Check frontend state was updated
    expect(updatedCard.isBookmarked).toBe(true);
    // Check background sync is triggered
    expect(trpcClient.flashcards.updateUserStatus.mutate).toHaveBeenCalled();
  });
});