import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock React Native first to avoid its problematic imports
vi.mock('react-native', () => ({
  StyleSheet: {
    create: vi.fn((styles) => styles),
  },
  Platform: {
    OS: 'test',
    select: vi.fn(),
  },
  // Add other commonly used RN exports here if needed by transitive dependencies
  // For example, if Alert, Dimensions, etc., were somehow pulled in.
  Alert: {
    alert: vi.fn(),
  },
  Dimensions: {
    get: vi.fn().mockReturnValue({ width: 0, height: 0 }),
  },
  // For any other errors like "NativeModules.X is undefined", mock NativeModules:
  NativeModules: {},
  // If specific native modules are expected, mock them within NativeModules, e.g.:
  // UIManager: {RCTView: () => {}},
  // KeyboardObserver: {addListener: vi.fn(), removeListeners: vi.fn()},
}));

// Mock expo-constants
vi.mock('expo-constants', () => ({
  manifest: { id: '@anonymous/test-app' }, // Provide a minimal manifest
  // Add other constants if needed, e.g.:
  // deviceName: 'Test Device',
  // appOwnership: 'guest',
  // ...
  default: {
    manifest: { id: '@anonymous/test-app' }, // For default import if used
  }
}));

// Mock expo-secure-store
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(() => Promise.resolve(null)),
  setItemAsync: vi.fn(() => Promise.resolve()),
  deleteItemAsync: vi.fn(() => Promise.resolve()),
  // For isAvailableAsync, if used:
  isAvailableAsync: vi.fn(() => Promise.resolve(false)), // Assume not available in test env
}));

import { useFlashcardStore } from './flashcard-store';
// Do not import trpcClient directly from @/lib/trpc here, as it will be mocked.
import { Deck, Flashcard, ContentType, DifficultyRating, StudyProgress } from '@/types';

// Mock AsyncStorage using factory pattern
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

// Mock tRPC client
vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    deck: {
      create: { mutate: vi.fn() },
      update: { mutate: vi.fn() },
      delete: { mutate: vi.fn() },
    },
    flashcards: {
      create: { mutate: vi.fn() },
      updateContent: { mutate: vi.fn() },
      updateUserStatus: { mutate: vi.fn() },
      delete: { mutate: vi.fn() },
    },
    // user: { me: { query: vi.fn() } } // Example for queries
  },
}));

// Import store and types AFTER core mocks
import { trpcClient } from '@/lib/trpc';

const initialState = useFlashcardStore.getState();
const getInitialState = () => JSON.parse(JSON.stringify(initialState)); // Deep clone for true reset

describe('useFlashcardStore optimistic updates', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    // Use the getInitialState() method provided by the persist middleware
    useFlashcardStore.setState(useFlashcardStore.getInitialState(), true); 
    
    // Reset all mocks
    vi.clearAllMocks();

    // Explicitly clear/reset parts of the state that are not part of getInitialState()
    // or need a specific reset value for tests if getInitialState() doesn't cover them fully.
    // For persist, getInitialState() usually returns the full initial state including actions.
    // However, non-persisted, in-memory flags should be reset here if not part of the core initial definition.
    useFlashcardStore.setState({ 
        pendingOperations: {}, 
        isLoading: false, 
        error: null,
        currentDeckId: null,
        studyProgress: null,
        sessionJustCompletedDeckId: null,
    });
  });

  afterEach(() => {
    // Ensure any subscriptions or timers are cleared if added by tests
    // For example, if using useFlashcardStore.subscribe in a test, make sure to unsubscribe.
  });

  // --- Test addDeck ---
  describe('addDeck', () => {
    const deckData = { name: 'New Deck', description: 'A test deck', isPublic: false, tags: ['test'], subject: 'Math', chapter: 'Algebra', coverImage: 'http://example.com/cover.jpg', isPremium: false, price: 0 };
    const mockBackendDeck: Deck = {
      ...deckData,
      id: 'real-deck-id-123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cardCount: 0,
      userId: 'test-user',
    };

    it('should optimistically add a deck and then confirm with backend data', async () => {
      (trpcClient.deck.create.mutate as any).mockResolvedValueOnce(mockBackendDeck);

      let tempId = '';
      const addDeckPromise = useFlashcardStore.getState().addDeck(deckData, `deck-temp-${Date.now()}`);
      
      const stateAfterOptimisticAdd = useFlashcardStore.getState();
      expect(stateAfterOptimisticAdd.decks.length).toBe(1);
      const optimisticDeck = stateAfterOptimisticAdd.decks[0];
      tempId = optimisticDeck.id; 
      expect(optimisticDeck.name).toBe(deckData.name);
      expect(optimisticDeck.id).toMatch(/^deck-temp-/);
      expect(stateAfterOptimisticAdd.isLoading).toBe(true);
      expect(stateAfterOptimisticAdd.pendingOperations[tempId]).toBeDefined();
      expect(stateAfterOptimisticAdd.pendingOperations[tempId]?.type).toBe('add');

      const returnedId = await addDeckPromise; 
      expect(returnedId).toBe(mockBackendDeck.id);

      const stateAfterSuccess = useFlashcardStore.getState();
      expect(stateAfterSuccess.decks.length).toBe(1);
      const confirmedDeck = stateAfterSuccess.decks[0];
      expect(confirmedDeck.id).toBe(mockBackendDeck.id);
      expect(confirmedDeck.name).toBe(mockBackendDeck.name);
      expect(confirmedDeck.createdAt).toBe(String(mockBackendDeck.createdAt));
      expect(stateAfterSuccess.isLoading).toBe(false);
      expect(stateAfterSuccess.pendingOperations[tempId]).toBeUndefined();
      expect(stateAfterSuccess.pendingOperations[mockBackendDeck.id]).toBeUndefined(); 
      expect(stateAfterSuccess.error).toBeNull();
    });

    it('should optimistically add a deck and then roll back on backend error', async () => {
      const errorMessage = 'Network Error AddDeck';
      (trpcClient.deck.create.mutate as any).mockRejectedValueOnce(new Error(errorMessage));

      let tempId = '';
      const unsub = useFlashcardStore.subscribe(state => {
        if (state.decks.length > 0 && state.decks[0].id.startsWith('deck-temp-')) {
             tempId = state.decks[0].id;
        }
      });

      await expect(useFlashcardStore.getState().addDeck(deckData, `deck-temp-${Date.now()}`)).rejects.toThrow(errorMessage);
      unsub();
      
      const stateAfterError = useFlashcardStore.getState();
      expect(stateAfterError.decks.length).toBe(0);
      expect(stateAfterError.isLoading).toBe(false);
      if (tempId) { // tempId might not be set if error occurs before optimistic update flushes
          expect(stateAfterError.pendingOperations[tempId]).toBeUndefined();
      }
      expect(stateAfterError.error).toBe(errorMessage);
    });
  });

  // --- Test updateDeck ---
  describe('updateDeck', () => {
    const initialDeck: Deck = {
      id: 'deck-to-update', name: 'Old Deck Name', description: 'Old Desc',
      createdAt: new Date(Date.now() - 20000).toISOString(), updatedAt: new Date(Date.now() - 10000).toISOString(),
      cardCount: 5, userId: 'user1', isPublic: false, tags: ['initial'],
      subject: 'Initial Subject', chapter: 'Initial Chapter', coverImage: 'initial.jpg', isPremium: false, price: 0
    };
    const deckUpdateData = { name: 'New Deck Name', tags: ['updated', 'test'] };
    const mockBackendUpdatedDeck: Deck = {
      ...initialDeck,
      ...deckUpdateData,
      updatedAt: new Date().toISOString(), // Backend sets this
    };

    beforeEach(() => {
      useFlashcardStore.setState({ decks: [initialDeck] });
    });

    it('should optimistically update a deck and confirm with backend data', async () => {
      (trpcClient.deck.update.mutate as any).mockResolvedValueOnce(mockBackendUpdatedDeck);

      const updatePromise = useFlashcardStore.getState().updateDeck(initialDeck.id, deckUpdateData);

      const optimisticState = useFlashcardStore.getState();
      const optiDeck = optimisticState.decks.find(d => d.id === initialDeck.id)!;
      expect(optiDeck.name).toBe(deckUpdateData.name);
      expect(optiDeck.tags).toEqual(deckUpdateData.tags);
      expect(optiDeck.updatedAt).not.toBe(initialDeck.updatedAt);
      expect(optimisticState.isLoading).toBe(true);
      expect(optimisticState.pendingOperations[initialDeck.id]).toBeDefined();
      expect(optimisticState.pendingOperations[initialDeck.id]?.type).toBe('update');

      await updatePromise;

      const successState = useFlashcardStore.getState();
      const confirmedDeck = successState.decks.find(d => d.id === initialDeck.id)!;
      expect(confirmedDeck.name).toBe(mockBackendUpdatedDeck.name);
      expect(confirmedDeck.tags).toEqual(mockBackendUpdatedDeck.tags);
      expect(confirmedDeck.updatedAt).toBe(String(mockBackendUpdatedDeck.updatedAt));
      expect(successState.isLoading).toBe(false);
      expect(successState.pendingOperations[initialDeck.id]).toBeUndefined();
      expect(successState.error).toBeNull();
    });

    it('should roll back optimistic deck update on backend error', async () => {
      const errorMessage = 'Update Deck Failed';
      (trpcClient.deck.update.mutate as any).mockRejectedValueOnce(new Error(errorMessage));

      await expect(useFlashcardStore.getState().updateDeck(initialDeck.id, deckUpdateData))
            .rejects.toThrow(errorMessage);

      const errorState = useFlashcardStore.getState();
      const rolledBackDeck = errorState.decks.find(d => d.id === initialDeck.id)!;
      expect(rolledBackDeck.name).toBe(initialDeck.name);
      expect(rolledBackDeck.tags).toEqual(initialDeck.tags);
      expect(rolledBackDeck.updatedAt).toBe(initialDeck.updatedAt);
      expect(errorState.isLoading).toBe(false);
      expect(errorState.pendingOperations[initialDeck.id]).toBeUndefined();
      expect(errorState.error).toBe(errorMessage);
    });
  });

  // --- Test deleteDeck ---
  describe('deleteDeck', () => {
    const deckToDelete: Deck = {
      id: 'deck-to-delete', name: 'Old Deck', cardCount: 2, 
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      description: '', tags: [], isPublic: false, userId: 'user1',
      subject: '', chapter: '', coverImage: '', isPremium: false, price: 0
    };
    const associatedFlashcards: Flashcard[] = [
      { id: 'card1-in-deck', deckId: deckToDelete.id, front: 'f1', back: 'b1', contentType: 'text', createdAt: Date.now(), updatedAt: Date.now(), interval:1, easeFactor:2.5, repetitions:0, dueDate:Date.now(), lastReviewed:null, isBookmarked: false, tags:[], mediaUrls:[] },
      { id: 'card2-in-deck', deckId: deckToDelete.id, front: 'f2', back: 'b2', contentType: 'text', createdAt: Date.now(), updatedAt: Date.now(), interval:1, easeFactor:2.5, repetitions:0, dueDate:Date.now(), lastReviewed:null, isBookmarked: false, tags:[], mediaUrls:[] },
    ];

    beforeEach(() => {
      useFlashcardStore.setState({ decks: [deckToDelete], flashcards: associatedFlashcards });
    });

    it('should optimistically delete a deck and its flashcards, then confirm backend success', async () => {
      (trpcClient.deck.delete.mutate as any).mockResolvedValueOnce({ success: true });

      const deletePromise = useFlashcardStore.getState().deleteDeck(deckToDelete.id);

      const optimisticState = useFlashcardStore.getState();
      expect(optimisticState.decks.find(d => d.id === deckToDelete.id)).toBeUndefined();
      expect(optimisticState.flashcards.filter(f => f.deckId === deckToDelete.id).length).toBe(0);
      expect(optimisticState.isLoading).toBe(true);
      expect(optimisticState.pendingOperations[deckToDelete.id]).toBeDefined();
      expect(optimisticState.pendingOperations[deckToDelete.id]?.type).toBe('delete');

      await deletePromise;

      const successState = useFlashcardStore.getState();
      expect(successState.decks.length).toBe(0);
      expect(successState.flashcards.length).toBe(0);
      expect(successState.isLoading).toBe(false);
      expect(successState.pendingOperations[deckToDelete.id]).toBeUndefined();
      expect(successState.error).toBeNull();
    });

    it('should roll back optimistic deck and flashcard deletion on backend error', async () => {
      const errorMessage = 'Delete Deck Failed';
      (trpcClient.deck.delete.mutate as any).mockRejectedValueOnce(new Error(errorMessage));

      await expect(useFlashcardStore.getState().deleteDeck(deckToDelete.id))
            .rejects.toThrow(errorMessage);

      const errorState = useFlashcardStore.getState();
      expect(errorState.decks.find(d => d.id === deckToDelete.id)).toEqual(deckToDelete);
      expect(errorState.flashcards.length).toBe(associatedFlashcards.length);
      associatedFlashcards.forEach(fc => {
        expect(errorState.flashcards.find(f => f.id === fc.id)).toEqual(fc);
      });
      expect(errorState.isLoading).toBe(false);
      expect(errorState.pendingOperations[deckToDelete.id]).toBeUndefined();
      expect(errorState.error).toBe(errorMessage);
    });
  });

  // --- Test addFlashcard ---
  describe('addFlashcard', () => {
    const deckIdForCard = 'existing-deck-1';
    const initialDeck: Deck = { 
        id: deckIdForCard, name: 'Card Deck', cardCount: 0, 
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        description: '', tags: [], isPublic: false, userId: 'user1',
        subject: '', chapter: '', coverImage: '', isPremium: false, price: 0
    };
    const flashcardData = { deckId: deckIdForCard, front: 'New Q', back: 'New A', contentType: 'text' as ContentType, tags: ['new'], mediaUrls: [] };
    
    // Backend often returns a more complete object, including generated IDs and timestamps, and potentially userStatus
    const mockBackendFlashcard = {
      id: 'real-flashcard-id-456',
      ...flashcardData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // For flashcards, the backend might return a nested userStatus object
      // or the Flashcard type itself might have these fields directly from join.
      // Assuming Flashcard type has them directly from our store definition.
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0,
      dueDate: new Date().toISOString(), // Backend may generate this
      lastReviewed: null,
      isBookmarked: false,
      userStatus: { // Example if backend nests it
        id: 'status-1',
        userId: 'user1',
        flashcardId: 'real-flashcard-id-456',
        isBookmarked: false,
        isLearned: false,
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0,
        dueDate: new Date().toISOString(),
        lastReviewed: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    };

    beforeEach(() => {
      useFlashcardStore.setState({ decks: [initialDeck], flashcards: [] });
    });

    it('should optimistically add a flashcard and update deck, then confirm', async () => {
      (trpcClient.flashcards.create.mutate as any).mockResolvedValueOnce(mockBackendFlashcard);

      let tempId = '';
      const addFlashcardPromise = useFlashcardStore.getState().addFlashcard(flashcardData);
      
      const optimisticState = useFlashcardStore.getState();
      expect(optimisticState.flashcards.length).toBe(1);
      const optimisticCard = optimisticState.flashcards[0];
      tempId = optimisticCard.id;
      expect(optimisticCard.front).toBe(flashcardData.front);
      expect(optimisticCard.id).toMatch(/^flashcard-temp-/);
      expect(optimisticState.decks.find(d=>d.id === deckIdForCard)?.cardCount).toBe(1);
      expect(optimisticState.isLoading).toBe(true);
      expect(optimisticState.pendingOperations[tempId]).toBeDefined();

      const returnedId = await addFlashcardPromise;
      expect(returnedId).toBe(mockBackendFlashcard.id);

      const successState = useFlashcardStore.getState();
      expect(successState.flashcards.length).toBe(1);
      const confirmedCard = successState.flashcards[0];
      expect(confirmedCard.id).toBe(mockBackendFlashcard.id);
      expect(confirmedCard.front).toBe(mockBackendFlashcard.front);
      expect(confirmedCard.createdAt).toBe(new Date(mockBackendFlashcard.createdAt).getTime());
      // Check if SRS fields from userStatus were correctly mapped
      expect(confirmedCard.interval).toBe(mockBackendFlashcard.userStatus.interval);
      expect(confirmedCard.isBookmarked).toBe(mockBackendFlashcard.userStatus.isBookmarked);
      expect(successState.decks.find(d=>d.id === deckIdForCard)?.cardCount).toBe(1);
      expect(successState.isLoading).toBe(false);
      expect(successState.pendingOperations[tempId]).toBeUndefined();
      expect(successState.error).toBeNull();
    });

    it('should roll back optimistic flashcard add on backend error', async () => {
      const errorMessage = 'Add Flashcard Failed';
      (trpcClient.flashcards.create.mutate as any).mockRejectedValueOnce(new Error(errorMessage));
      
      let tempId = '';
      const unsub = useFlashcardStore.subscribe(state => {
        if (state.flashcards.length > 0 && state.flashcards[0].id.startsWith('flashcard-temp-')) {
             tempId = state.flashcards[0].id;
        }
      });

      await expect(useFlashcardStore.getState().addFlashcard(flashcardData)).rejects.toThrow(errorMessage);
      unsub();

      const errorState = useFlashcardStore.getState();
      expect(errorState.flashcards.length).toBe(0);
      expect(errorState.decks.find(d=>d.id === deckIdForCard)?.cardCount).toBe(0); // Deck count rolled back
      expect(errorState.isLoading).toBe(false);
      if(tempId) expect(errorState.pendingOperations[tempId]).toBeUndefined();
      expect(errorState.error).toBe(errorMessage);
    });
  });

  // --- Test updateFlashcard (content) ---
  describe('updateFlashcard (content)', () => {
    const initialFlashcard: Flashcard = {
      id: 'card-to-update-content', deckId: 'deck-for-card-update', front: 'Old Front', back: 'Old Back',
      contentType: 'text' as ContentType, createdAt: Date.now() - 20000, updatedAt: Date.now() - 10000,
      interval: 1, easeFactor: 2.5, repetitions: 0, dueDate: Date.now(), lastReviewed: null, isBookmarked: false,
      tags: ['initial'], mediaUrls: []
    };
    const flashcardUpdateData = { front: 'Updated Front Content', tags: ['content-update'] };
    // Mock backend response for updateContent (often includes full card with userStatus)
    const mockBackendUpdatedFlashcard = {
      ...initialFlashcard, // Start with original fields
      ...flashcardUpdateData, // Apply updates
      updatedAt: new Date().toISOString(), // Backend sets new updatedAt
      // Assume userStatus part of the response as per store logic
      userStatus: {
        id: 'status-for-card-to-update-content',
        userId: 'user-test',
        flashcardId: initialFlashcard.id,
        isBookmarked: initialFlashcard.isBookmarked, // Unchanged by this content update
        interval: initialFlashcard.interval,
        easeFactor: initialFlashcard.easeFactor,
        repetitions: initialFlashcard.repetitions,
        dueDate: new Date(initialFlashcard.dueDate).toISOString(),
        lastReviewed: initialFlashcard.lastReviewed ? new Date(initialFlashcard.lastReviewed).toISOString() : null,
        createdAt: new Date(initialFlashcard.createdAt).toISOString(), // UserStatus createdAt might be different
        updatedAt: new Date().toISOString(), // UserStatus also updated
      }
    };

    beforeEach(() => {
      useFlashcardStore.setState({ 
        flashcards: [initialFlashcard],
        decks: [{id: 'deck-for-card-update', name: 'Update Deck', cardCount: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), description:'', tags:[], isPublic:false, userId:'user1', isPremium: false, price: 0}]
      });
    });

    it('should optimistically update flashcard content and confirm', async () => {
      (trpcClient.flashcards.updateContent.mutate as any).mockResolvedValueOnce(mockBackendUpdatedFlashcard);

      const updatePromise = useFlashcardStore.getState().updateFlashcard(initialFlashcard.id, flashcardUpdateData);

      const optimisticState = useFlashcardStore.getState();
      const optiCard = optimisticState.flashcards.find(c => c.id === initialFlashcard.id)!;
      expect(optiCard.front).toBe(flashcardUpdateData.front);
      expect(optiCard.tags).toEqual(flashcardUpdateData.tags);
      expect(optiCard.updatedAt).not.toBe(initialFlashcard.updatedAt); // Optimistic timestamp
      expect(optimisticState.isLoading).toBe(true);
      expect(optimisticState.pendingOperations[initialFlashcard.id]).toBeDefined();

      await updatePromise;

      const successState = useFlashcardStore.getState();
      const confirmedCard = successState.flashcards.find(c => c.id === initialFlashcard.id)!;
      expect(confirmedCard.front).toBe(mockBackendUpdatedFlashcard.front);
      expect(confirmedCard.tags).toEqual(mockBackendUpdatedFlashcard.tags);
      expect(confirmedCard.updatedAt).toBe(new Date(mockBackendUpdatedFlashcard.updatedAt).getTime());
      // Check that userStatus fields were correctly mapped if provided by backend
      expect(confirmedCard.isBookmarked).toBe(mockBackendUpdatedFlashcard.userStatus.isBookmarked);
      expect(successState.isLoading).toBe(false);
      expect(successState.pendingOperations[initialFlashcard.id]).toBeUndefined();
    });

    it('should roll back optimistic flashcard content update on error', async () => {
      const errorMessage = 'Update Flashcard Content Failed';
      (trpcClient.flashcards.updateContent.mutate as any).mockRejectedValueOnce(new Error(errorMessage));

      await expect(useFlashcardStore.getState().updateFlashcard(initialFlashcard.id, flashcardUpdateData))
            .rejects.toThrow(errorMessage);

      const errorState = useFlashcardStore.getState();
      const rolledBackCard = errorState.flashcards.find(c => c.id === initialFlashcard.id)!;
      expect(rolledBackCard.front).toBe(initialFlashcard.front);
      expect(rolledBackCard.tags).toEqual(initialFlashcard.tags);
      expect(rolledBackCard.updatedAt).toBe(initialFlashcard.updatedAt);
      expect(errorState.isLoading).toBe(false);
      expect(errorState.pendingOperations[initialFlashcard.id]).toBeUndefined();
      expect(errorState.error).toBe(errorMessage);
    });
  });
  
  // --- Test toggleBookmark (uses updateFlashcard internally, calling flashcards.updateUserStatus) ---
  describe('toggleBookmark', () => {
    const cardIdToBookmark = 'card-to-bookmark';
    const initialFlashcard: Flashcard = {
      id: cardIdToBookmark, deckId: 'deck-bm', front: 'Q', back: 'A', contentType: 'text' as ContentType,
      createdAt: Date.now(), updatedAt: Date.now(), interval: 1, easeFactor: 2.5, repetitions: 0,
      dueDate: Date.now(), lastReviewed: null, isBookmarked: false, tags:[], mediaUrls:[]
    };
    // Mock what backend's updateUserStatus would return for a bookmark toggle
    const mockBackendUpdatedStatus = {
      id: 'status-id-for-bookmark', // This is UserFlashcardStatus ID
      flashcardId: cardIdToBookmark,
      userId: 'user-test',
      isBookmarked: true, // The new state
      updatedAt: new Date().toISOString(),
      // Other SRS fields might also be returned
      interval: initialFlashcard.interval,
      easeFactor: initialFlashcard.easeFactor,
      repetitions: initialFlashcard.repetitions,
      dueDate: new Date(initialFlashcard.dueDate).toISOString(),
      lastReviewed: initialFlashcard.lastReviewed ? new Date(initialFlashcard.lastReviewed).toISOString() : null,
      createdAt: new Date(initialFlashcard.createdAt).toISOString(), // UserStatus createdAt
    };

    beforeEach(() => {
      useFlashcardStore.setState({ flashcards: [initialFlashcard] });
    });

    it('should optimistically toggle bookmark and confirm with backend', async () => {
      (trpcClient.flashcards.updateUserStatus.mutate as any).mockResolvedValueOnce(mockBackendUpdatedStatus);

      const togglePromise = useFlashcardStore.getState().toggleBookmark(cardIdToBookmark);

      const optimisticState = useFlashcardStore.getState();
      const optiCard = optimisticState.flashcards.find(c => c.id === cardIdToBookmark)!;
      expect(optiCard.isBookmarked).toBe(true); // Toggled from false
      expect(optiCard.updatedAt).not.toBe(initialFlashcard.updatedAt); // Optimistic timestamp
      expect(optimisticState.isLoading).toBe(true);
      expect(optimisticState.pendingOperations[cardIdToBookmark]).toBeDefined();

      await togglePromise;

      const successState = useFlashcardStore.getState();
      const confirmedCard = successState.flashcards.find(c => c.id === cardIdToBookmark)!;
      expect(confirmedCard.isBookmarked).toBe(mockBackendUpdatedStatus.isBookmarked);
      expect(confirmedCard.updatedAt).toBe(new Date(mockBackendUpdatedStatus.updatedAt).getTime());
      expect(successState.isLoading).toBe(false);
      expect(successState.pendingOperations[cardIdToBookmark]).toBeUndefined();
    });

    it('should roll back bookmark toggle on backend error', async () => {
      const errorMessage = 'Toggle Bookmark Failed';
      (trpcClient.flashcards.updateUserStatus.mutate as any).mockRejectedValueOnce(new Error(errorMessage));

      await expect(useFlashcardStore.getState().toggleBookmark(cardIdToBookmark))
        .rejects.toThrow(errorMessage);

      const errorState = useFlashcardStore.getState();
      const rolledBackCard = errorState.flashcards.find(c => c.id === cardIdToBookmark)!;
      expect(rolledBackCard.isBookmarked).toBe(initialFlashcard.isBookmarked); // Rolled back to false
      expect(rolledBackCard.updatedAt).toBe(initialFlashcard.updatedAt);
      expect(errorState.isLoading).toBe(false);
      expect(errorState.pendingOperations[cardIdToBookmark]).toBeUndefined();
      expect(errorState.error).toBe(errorMessage);
    });
  });

  // --- Test deleteFlashcard ---
  describe('deleteFlashcard', () => {
    const deckIdForDeleteCard = 'deck-card-delete';
    const cardToDelete: Flashcard = {
      id: 'flashcard-to-delete', deckId: deckIdForDeleteCard, front: 'Delete Q', back: 'Delete A',
      contentType: 'text' as ContentType, createdAt: Date.now(), updatedAt: Date.now(),
      interval: 1, easeFactor: 2.5, repetitions: 0, dueDate: Date.now(), lastReviewed: null, isBookmarked: false,
      tags:[], mediaUrls:[]
    };
     const initialDeckState: Deck = {
      id: deckIdForDeleteCard, name: 'Deck With Card To Delete', cardCount: 1,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      description: '', tags: [], isPublic: false, userId: 'user1',
      subject: '', chapter: '', coverImage: '', isPremium: false, price: 0
    };


    beforeEach(() => {
      useFlashcardStore.setState({ 
        flashcards: [cardToDelete], 
        decks: [initialDeckState]
      });
    });

    it('should optimistically delete a flashcard, update deck, and confirm', async () => {
      (trpcClient.flashcards.delete.mutate as any).mockResolvedValueOnce({ success: true });

      const deletePromise = useFlashcardStore.getState().deleteFlashcard(cardToDelete.id);

      const optimisticState = useFlashcardStore.getState();
      expect(optimisticState.flashcards.find(f => f.id === cardToDelete.id)).toBeUndefined();
      expect(optimisticState.decks.find(d=>d.id === deckIdForDeleteCard)?.cardCount).toBe(0);
      expect(optimisticState.isLoading).toBe(true);
      expect(optimisticState.pendingOperations[cardToDelete.id]).toBeDefined();

      await deletePromise;

      const successState = useFlashcardStore.getState();
      expect(successState.flashcards.length).toBe(0);
      expect(successState.decks.find(d=>d.id === deckIdForDeleteCard)?.cardCount).toBe(0);
      expect(successState.isLoading).toBe(false);
      expect(successState.pendingOperations[cardToDelete.id]).toBeUndefined();
    });

    it('should roll back optimistic flashcard delete on error', async () => {
      const errorMessage = 'Delete Flashcard Failed';
      (trpcClient.flashcards.delete.mutate as any).mockRejectedValueOnce(new Error(errorMessage));
      
      await expect(useFlashcardStore.getState().deleteFlashcard(cardToDelete.id))
        .rejects.toThrow(errorMessage);

      const errorState = useFlashcardStore.getState();
      expect(errorState.flashcards.find(f => f.id === cardToDelete.id)).toEqual(cardToDelete);
      expect(errorState.decks.find(d=>d.id === deckIdForDeleteCard)?.cardCount).toBe(1); // Deck count restored
      expect(errorState.isLoading).toBe(false);
      expect(errorState.pendingOperations[cardToDelete.id]).toBeUndefined();
      expect(errorState.error).toBe(errorMessage);
    });
  });

  // --- Test rateCard ---
  describe('rateCard', () => {
    const cardToRateId = 'card-to-rate';
    const initialCardToRate: Flashcard = {
      id: cardToRateId, deckId: 'deck-rate', front: 'Rate Q', back: 'Rate A', contentType: 'text' as ContentType,
      createdAt: Date.now() - 100000, updatedAt: Date.now() - 50000,
      interval: 1, easeFactor: 2.5, repetitions: 0, dueDate: Date.now() - 10000, // Due
      lastReviewed: null, isBookmarked: false, tags:[], mediaUrls:[]
    };
    const rating: DifficultyRating = 'good';

    // Mock what backend's updateUserStatus would return for a rating update
    const mockBackendRatedStatus = {
      id: 'status-for-rated-card', // UserFlashcardStatus ID
      flashcardId: cardToRateId,
      userId: 'user-test',
      // SRS fields would be updated based on rating
      interval: 3, // Example new interval
      easeFactor: 2.6, // Example new easeFactor
      repetitions: 1, // Example new repetitions
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // Example new due date
      lastReviewed: new Date().toISOString(), // Should be current time
      isBookmarked: initialCardToRate.isBookmarked,
      updatedAt: new Date().toISOString(),
      createdAt: new Date(initialCardToRate.createdAt).toISOString(), // UserStatus createdAt
    };

    beforeEach(() => {
      useFlashcardStore.setState({ flashcards: [initialCardToRate] });
    });

    it('should optimistically rate a card (update SRS) and confirm with backend', async () => {
      (trpcClient.flashcards.updateUserStatus.mutate as any).mockResolvedValueOnce(mockBackendRatedStatus);

      const ratePromise = useFlashcardStore.getState().rateCard(cardToRateId, rating);

      const optimisticState = useFlashcardStore.getState();
      const optiRatedCard = optimisticState.flashcards.find(c => c.id === cardToRateId)!;
      // Check that SRS fields were optimistically updated
      expect(optiRatedCard.dueDate).greaterThan(initialCardToRate.dueDate);
      expect(optiRatedCard.lastReviewed).not.toBeNull();
      // repetitions should increment
      expect(optiRatedCard.repetitions).toBe(initialCardToRate.repetitions + 1);
      // interval might not change if repetitions was 0 and rating is 'good' (stays 1)
      // So, instead of expect(optiRatedCard.interval).not.toBe(initialCardToRate.interval);
      // we can be more specific if needed, or rely on dueDate/lastReviewed/repetitions changes.
      // For this test, we'll accept that interval may not change if it was 1 and stayed 1.
      expect(optiRatedCard.lastReviewed).toBeGreaterThanOrEqual(initialCardToRate.updatedAt);
      expect(optiRatedCard.updatedAt).toEqual(optiRatedCard.lastReviewed);
      expect(optimisticState.isLoading).toBe(false); 
      const pendingOpKey = Object.keys(optimisticState.pendingOperations).find(k => k.startsWith(`rate-${cardToRateId}`));
      expect(pendingOpKey).toBeDefined();

      await ratePromise;

      const successState = useFlashcardStore.getState();
      const confirmedRatedCard = successState.flashcards.find(c => c.id === cardToRateId)!;
      // Verify with backend confirmed data
      expect(confirmedRatedCard.interval).toBe(mockBackendRatedStatus.interval);
      expect(confirmedRatedCard.easeFactor).toBe(mockBackendRatedStatus.easeFactor);
      expect(confirmedRatedCard.repetitions).toBe(mockBackendRatedStatus.repetitions);
      expect(confirmedRatedCard.dueDate).toBe(new Date(mockBackendRatedStatus.dueDate).getTime());
      expect(confirmedRatedCard.lastReviewed).toBe(new Date(mockBackendRatedStatus.lastReviewed).getTime());
      expect(confirmedRatedCard.updatedAt).toBe(new Date(mockBackendRatedStatus.updatedAt).getTime());
      const successPendingOpKey = Object.keys(successState.pendingOperations).find(k => k.startsWith(`rate-${cardToRateId}`));
      expect(successPendingOpKey).toBeUndefined();
      expect(successState.error).toBeNull();
    });

    it('should roll back optimistic card rating on backend error', async () => {
      const errorMessage = 'Rate Card Sync Failed';
      (trpcClient.flashcards.updateUserStatus.mutate as any).mockRejectedValueOnce(new Error(errorMessage));

      const originalDueDate = initialCardToRate.dueDate;
      const originalInterval = initialCardToRate.interval;
      const originalLastReviewed = initialCardToRate.lastReviewed;
      const originalUpdatedAt = initialCardToRate.updatedAt;


      await expect(useFlashcardStore.getState().rateCard(cardToRateId, rating))
        .rejects.toThrow(errorMessage);

      const errorState = useFlashcardStore.getState();
      const rolledBackRatedCard = errorState.flashcards.find(c => c.id === cardToRateId)!;
      // Check that SRS fields are rolled back
      expect(rolledBackRatedCard.dueDate).toBe(originalDueDate);
      expect(rolledBackRatedCard.interval).toBe(originalInterval);
      expect(rolledBackRatedCard.lastReviewed).toBe(originalLastReviewed);
      expect(rolledBackRatedCard.updatedAt).toBe(originalUpdatedAt); // Rollback to original updatedAt
      
      const errorPendingOpKey = Object.keys(errorState.pendingOperations).find(k => k.startsWith(`rate-${cardToRateId}`));
      expect(errorPendingOpKey).toBeUndefined(); // Pending op should be cleared
      expect(errorState.error).toBe(errorMessage);
    });
  });
}); 