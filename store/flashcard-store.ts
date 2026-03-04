import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
// import AsyncStorage from '@react-native-async-storage/async-storage';
import { Flashcard, Deck, DifficultyRating, StudyProgress, ContentType } from '@/types';
import { calculateNextReview, getDueCards, getNewCards } from '@/utils/spaced-repetition';
import { trpcClient } from '@/utils/trpc';
import { getSafeStorage } from '@/utils/safe-storage';
import defaultDecksData from '@/assets/data/default-decks.json';

// Extended Deck type with loading state
interface StoreDeck extends Deck {
  areCardsLoaded?: boolean;
}

// User flashcard status from backend
interface UserFlashcardStatus {
  flashcardId: string;
  interval: number;
  stability: number;
  difficulty: number;
  repetitions: number;
  dueDate: string | Date;
  lastReviewed: string | Date | null;
  isBookmarked: boolean;
}

interface FlashcardState {
  // Data
  decks: StoreDeck[];
  flashcards: Flashcard[];
  
  // Loading states
  isLoading: boolean;
  loadingDeckId: string | null;
  error: string | null;
  
  // Study session
  currentDeckId: string | null;
  studyProgress: StudyProgress | null;
  sessionQueue: string[]; // Card IDs for current session
  sessionRatings: Record<string, any>; // Buffered ratings to sync after session
  
  // Actions - Data
  setDecks: (decks: any[]) => void;
  loadDeckWithCards: (deckId: string) => Promise<void>;
  clearError: () => void;
  loadDefaultDecks: () => void;
  
  // Actions - Study session
  startStudySession: (deckId: string, mode?: 'due' | 'all') => void;
  rateCard: (cardId: string, rating: DifficultyRating) => Promise<void>;
  syncSessionProgress: () => Promise<void>;
  endStudySession: () => Promise<void>;
  toggleBookmark: (cardId: string) => Promise<void>;
  resetAllProgress: () => void;
  
  // Getters
  getCurrentCard: () => Flashcard | null;
  getNextCard: () => Flashcard | null;
  getFlashcardsForDeck: (deckId: string) => Flashcard[];
  getDueFlashcardsForDeck: (deckId: string) => Flashcard[];
  getNewFlashcardsForDeck: (deckId: string) => Flashcard[];
  hasIncompleteSession: (deckId: string) => boolean;
  
  // Stats
  getTotalCardsStudied: () => number;
  getDeckCompletionRate: (deckId: string) => number;
  getStreak: () => number;
  
  // For backward compatibility with old code
  loadInitialData: (decks: Deck[], flashcards: Flashcard[]) => void;
  fetchFlashcardsForDeck: (deckId: string) => Promise<void>;
  loadingFlashcardsForDeckId: string | null;
}

// Helper to normalize flashcard data from backend
function normalizeFlashcard(
  fc: any, 
  userStatus?: UserFlashcardStatus
): Flashcard {
  const now = Date.now();
  
  // Safe date parsing helper
  const safeTime = (dateInput: any) => {
    if (!dateInput) return null;
    const date = new Date(dateInput);
    const time = date.getTime();
    return isNaN(time) ? null : time;
  };

  // Safe JSON parsing helper
  const safeParse = (json: string | null) => {
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch (e) {
      return [];
    }
  };

  return {
    id: fc.id,
    deckId: fc.deckId,
    front: fc.front,
    back: fc.back,
    contentType: (fc.contentType as ContentType) ?? 'text',
    mediaUrls: Array.isArray(fc.mediaUrls) ? fc.mediaUrls : safeParse(fc.mediaUrlsJson),
    tags: Array.isArray(fc.tags) ? fc.tags : safeParse(fc.tagsJson),
    createdAt: safeTime(fc.createdAt) ?? now,
    updatedAt: safeTime(fc.updatedAt) ?? now,
    // SRS fields from user status or defaults
    interval: userStatus?.interval ?? 1,
    stability: userStatus?.stability ?? 0,
    difficulty: userStatus?.difficulty ?? 0,
    repetitions: userStatus?.repetitions ?? 0,
    dueDate: safeTime(userStatus?.dueDate) ?? now,
    lastReviewed: safeTime(userStatus?.lastReviewed),
    isBookmarked: userStatus?.isBookmarked ?? false,
  };
}

// Helper to normalize deck data from backend
function normalizeDeck(deck: any): StoreDeck {
  const now = Date.now();
  const safeParse = (json: string | null) => {
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch (e) {
      return [];
    }
  };
  
  return {
    id: deck.id,
    name: deck.name || 'Untitled Deck',
    description: deck.description || '',
    tags: Array.isArray(deck.tags) ? deck.tags : safeParse(deck.tagsJson),
    isPremium: !!deck.isPremium,
    isPublic: !!deck.isPublic,
    price: deck.price || 0,
    coverImage: deck.coverImage || null,
    subject: deck.subject || null,
    chapter: deck.chapter || null,
    createdAt: deck.createdAt ? new Date(deck.createdAt).getTime() : Date.now(),
    updatedAt: deck.updatedAt ? new Date(deck.updatedAt).getTime() : Date.now(),
    cardCount: deck.cardCount ?? deck._count?.flashcards ?? 0,
    userId: deck.userId ?? '',
    areCardsLoaded: deck.areCardsLoaded !== undefined ? deck.areCardsLoaded : false,
  };
}

export const useFlashcardStore = create<FlashcardState>()(
  persist(
    (set, get) => ({
      // Initial state
      decks: [],
      flashcards: [],
      isLoading: false,
      loadingDeckId: null,
      error: null,
      currentDeckId: null,
      studyProgress: null,
      sessionQueue: [],
      sessionRatings: {},
      loadingFlashcardsForDeckId: null,

      // Set decks from external source (e.g., tRPC query in layout)
      setDecks: (decks: StoreDeck[]) => {
        console.log('[FlashcardStore] setDecks called with', decks.length, 'decks');
        
        // Preserve existing loaded states and flashcards
        const currentState = get();
        const existingLoadedDecks = new Map(
          currentState.decks
            .filter(d => d.areCardsLoaded)
            .map(d => [d.id, d])
        );

        const updatedDecks = decks.map(deck => {
          const normalized = normalizeDeck(deck);
          const existing = existingLoadedDecks.get(deck.id);
          if (existing) {
            // Preserve loaded state
            normalized.areCardsLoaded = true;
            normalized.cardCount = existing.cardCount;
          }
          return normalized;
        });

        // Add any local-only downloaded decks
        const serverDeckIds = new Set(updatedDecks.map(d => d.id));
        const localOnlyDecks = currentState.decks.filter(
          d => d.areCardsLoaded && !serverDeckIds.has(d.id)
        );

        set({ decks: [...updatedDecks, ...localOnlyDecks] });
      },

      // Pre-download initial decks for offline usage
      loadDefaultDecks: () => {
        const state = get();
        
        const defaultDecks = defaultDecksData.decks.map(deck => normalizeDeck({
          ...deck, 
          areCardsLoaded: true, 
          cardCount: deck.flashcards.length
        }));
        
        const defaultFlashcards = defaultDecksData.decks.flatMap(deck => 
          deck.flashcards.map(fc => normalizeFlashcard({ ...fc, deckId: deck.id }))
        );
        
        // Merge into existing state without mutating user's own setups
        const newDecks = [...state.decks];
        let decksChanged = false;
        
        for (const defaultDeck of defaultDecks) {
          const existingIdx = newDecks.findIndex(d => d.id === defaultDeck.id);
          if (existingIdx === -1) {
            newDecks.push(defaultDeck);
            decksChanged = true;
          } else {
            // Hot-Patch cover images retroactively for clients that already saved the default DB
            if (defaultDeck.coverImage && !newDecks[existingIdx].coverImage) {
              newDecks[existingIdx] = { ...newDecks[existingIdx], coverImage: defaultDeck.coverImage };
              decksChanged = true;
            }
          }
        }
        
        let cardsChanged = false;
        const newFlashcards = [...state.flashcards];
        for (const defaultCard of defaultFlashcards) {
          if (!newFlashcards.find(c => c.id === defaultCard.id)) {
            newFlashcards.push(defaultCard);
            cardsChanged = true;
          }
        }
        
        if (decksChanged || cardsChanged) {
          set({ decks: newDecks, flashcards: newFlashcards });
          console.log('[FlashcardStore] Successfully loaded pre-downloaded default decks into local storage!');
        }
      },

      // Load deck with all its flashcards
      loadDeckWithCards: async (deckId: string) => {
        console.log('[FlashcardStore] loadDeckWithCards called for', deckId);
        
        const currentState = get();
        const existingDeck = currentState.decks.find(d => d.id === deckId);
        
        // If already loaded, skip
        if (existingDeck?.areCardsLoaded) {
          console.log('[FlashcardStore] Deck already loaded, skipping fetch');
          return;
        }

        set({ 
          isLoading: true, 
          loadingDeckId: deckId,
          loadingFlashcardsForDeckId: deckId,
          error: null 
        });

        try {
          const result = await trpcClient.deck.getByIdWithCards.query({ id: deckId });
          
          console.log('[FlashcardStore] Fetched deck with', result.flashcards.length, 'cards');

          // Create a map of user statuses by flashcard ID
          const statusMap = new Map(
            result.userStatuses.map((s: UserFlashcardStatus) => [s.flashcardId, s])
          );

          // Normalize flashcards with user status
          const normalizedFlashcards = result.flashcards.map((fc: any) => 
            normalizeFlashcard(fc, statusMap.get(fc.id))
          );

          // Update state
          set(state => {
            // Merge flashcards - replace existing ones for this deck, keep others
            const otherFlashcards = state.flashcards.filter(f => f.deckId !== deckId);
            const newFlashcards = [...otherFlashcards, ...normalizedFlashcards];

            // Update deck to mark as loaded
            const updatedDecks = state.decks.map(d => {
              if (d.id === deckId) {
                return {
                  ...normalizeDeck(result.deck),
                  areCardsLoaded: true,
                  cardCount: normalizedFlashcards.length,
                };
              }
              return d;
            });

            // Add deck if it doesn't exist
            if (!updatedDecks.find(d => d.id === deckId)) {
              updatedDecks.push({
                ...normalizeDeck(result.deck),
                areCardsLoaded: true,
                cardCount: normalizedFlashcards.length,
              });
            }

            return {
              decks: updatedDecks,
              flashcards: newFlashcards,
              isLoading: false,
              loadingDeckId: null,
              loadingFlashcardsForDeckId: null,
            };
          });

          console.log('[FlashcardStore] Deck loaded successfully');
        } catch (error: any) {
          console.error('[FlashcardStore] Error loading deck:', error);
          set({ 
            isLoading: false, 
            loadingDeckId: null,
            loadingFlashcardsForDeckId: null,
            error: error.message || 'Failed to load deck' 
          });
          throw error;
        }
      },

      clearError: () => set({ error: null }),

      // Start a study session for a deck
      startStudySession: (deckId: string, mode: 'due' | 'all' = 'due') => {
        console.log('[FlashcardStore] startStudySession for', deckId, 'mode:', mode);
        
        const allCards = get().flashcards.filter(f => f.deckId === deckId);
        let cardsToStudy: Flashcard[] = [];

        if (mode === 'all') {
          // Study everything (Retake)
          cardsToStudy = [...allCards].sort((a, b) => a.createdAt - b.createdAt);
          console.log('[FlashcardStore] Retake mode: studying all', cardsToStudy.length, 'cards');
        } else {
          // Normal SRS mode
          const dueCards = getDueCards(allCards).sort((a, b) => {
            if (a.dueDate !== b.dueDate) return a.dueDate - b.dueDate;
            return a.createdAt - b.createdAt;
          });

          cardsToStudy = dueCards;
          
          // If no due cards, include new cards
          if (dueCards.length === 0) {
            const newCards = getNewCards(allCards).sort((a, b) => a.createdAt - b.createdAt);
            cardsToStudy = newCards;
            console.log('[FlashcardStore] No due cards, using', newCards.length, 'new cards');
          }
        }

        const queue = cardsToStudy.map(c => c.id);
        
        if (queue.length > 0) {
          set({
            currentDeckId: deckId,
            sessionQueue: queue,
            studyProgress: {
              deckId,
              cardsLeft: queue.length,
              cardsStudied: 0,
              currentCardIndex: 0,
            },
          });
          console.log('[FlashcardStore] Session started with', queue.length, 'cards');
        } else {
          console.log('[FlashcardStore] No cards to study');
          set({
            currentDeckId: deckId,
            sessionQueue: [],
            studyProgress: {
              deckId,
              cardsLeft: 0,
              cardsStudied: allCards.length,
              currentCardIndex: 0,
            },
          });
        }
      },

      // Rate a card and get the next one
      rateCard: async (cardId: string, rating: DifficultyRating) => {
        console.log('[FlashcardStore] rateCard', cardId, 'with', rating);
        
        const state = get();
        const card = state.flashcards.find(c => c.id === cardId);
        
        if (!card) {
          console.error('[FlashcardStore] Card not found:', cardId);
          throw new Error('Card not found');
        }

        // Calculate new SRS values
        const srsData = calculateNextReview(card, rating);
        const now = Date.now();
        
        // Update local state immediately
        set(state => ({
          flashcards: state.flashcards.map(c => {
            if (c.id === cardId) {
              return {
                ...c,
                ...srsData,
                lastReviewed: now,
                updatedAt: now,
              };
            }
            return c;
          }),
          // Add to session buffer for batch sync later
          sessionRatings: {
            ...state.sessionRatings,
            [cardId]: {
              flashcardId: cardId,
              interval: srsData.interval,
              stability: srsData.stability,
              difficulty: srsData.difficulty,
              repetitions: srsData.repetitions,
              dueDate: new Date(srsData.dueDate || now).toISOString(),
              lastReviewed: new Date(now).toISOString(),
            }
          }
        }));
        
        console.log('[FlashcardStore] Card rated locally, added to session buffer');
      },

      // Sync buffered ratings to backend
      syncSessionProgress: async () => {
        const { sessionRatings } = get();
        const ratingsArray = Object.values(sessionRatings);
        
        if (ratingsArray.length === 0) return;

        // Skip network call if offline mode
        const { useUserStore, OFFLINE_MODE_TOKEN } = require('./user-store');
        if (useUserStore.getState().sessionToken === OFFLINE_MODE_TOKEN) {
          console.log('[FlashcardStore] Offline mode: keeping ratings in local buffer');
          return;
        }
        
        console.log('[FlashcardStore] Syncing session progress to backend:', ratingsArray.length, 'cards');
        
        try {
          await trpcClient.flashcards.batchUpdateUserStatus.mutate({
            ratings: ratingsArray
          });
          
          // Clear buffer on success
          set({ sessionRatings: {} });
          console.log('[FlashcardStore] Session progress synced successfully');
        } catch (error) {
          console.error('[FlashcardStore] Failed to sync session progress:', error);
        }
      },

      endStudySession: async () => {
        console.log('[FlashcardStore] endStudySession');
        const state = get();
        
        // Final sync of any pending ratings
        await state.syncSessionProgress();
        
        set({
          currentDeckId: null,
          studyProgress: null,
          sessionQueue: [],
          sessionRatings: {}, // Clear any remaining buffered ratings
        });
      },

      toggleBookmark: async (cardId: string) => {
        console.log('[FlashcardStore] toggleBookmark', cardId);
        
        const card = get().flashcards.find(c => c.id === cardId);
        if (!card) return;

        const newBookmarkState = !card.isBookmarked;

        // Update local state immediately
        set(state => ({
          flashcards: state.flashcards.map(c => {
            if (c.id === cardId) {
              return { ...c, isBookmarked: newBookmarkState };
            }
            return c;
          }),
        }));

        // Sync to backend if not strictly offline
        const { useUserStore, OFFLINE_MODE_TOKEN } = require('./user-store');
        if (useUserStore.getState().sessionToken === OFFLINE_MODE_TOKEN) {
          return; // Successful local bookmark
        }

        try {
          await trpcClient.flashcards.updateUserStatus.mutate({
            flashcardId: cardId,
            isBookmarked: newBookmarkState,
          });
        } catch (error) {
          console.error('[FlashcardStore] Failed to sync bookmark:', error);
          // Revert on error
          set(state => ({
            flashcards: state.flashcards.map(c => {
              if (c.id === cardId) {
                return { ...c, isBookmarked: !newBookmarkState };
              }
              return c;
            }),
          }));
          throw error;
        }
      },

      // Get current card in session
      getCurrentCard: () => {
        const { studyProgress, sessionQueue, flashcards } = get();
        
        if (!studyProgress || sessionQueue.length === 0) {
          return null;
        }
        
        if (studyProgress.currentCardIndex >= sessionQueue.length) {
          return null;
        }

        const cardId = sessionQueue[studyProgress.currentCardIndex];
        return flashcards.find(f => f.id === cardId) || null;
      },

      // Move to next card and return it
      getNextCard: () => {
        const { studyProgress, sessionQueue, flashcards } = get();
        
        if (!studyProgress) return null;

        const currentIdx = studyProgress.currentCardIndex;
        const queueLength = sessionQueue.length;

        if (currentIdx < queueLength - 1) {
          // Move to next card
          const newIndex = currentIdx + 1;
          set({
            studyProgress: {
              ...studyProgress,
              currentCardIndex: newIndex,
              cardsStudied: studyProgress.cardsStudied + 1,
              cardsLeft: studyProgress.cardsLeft - 1,
            },
          });
          
          const nextCardId = sessionQueue[newIndex];
          return flashcards.find(f => f.id === nextCardId) || null;
        } else {
          // End of session
          set({
            studyProgress: {
              ...studyProgress,
              currentCardIndex: queueLength,
              cardsStudied: studyProgress.cardsStudied + 1,
              cardsLeft: 0,
            },
          });
          return null;
        }
      },

      getFlashcardsForDeck: (deckId: string) => {
        return get().flashcards.filter(f => f.deckId === deckId);
      },

      getDueFlashcardsForDeck: (deckId: string) => {
        const cards = get().flashcards.filter(f => f.deckId === deckId);
        return getDueCards(cards);
      },

      getNewFlashcardsForDeck: (deckId: string) => {
        const cards = get().flashcards.filter(f => f.deckId === deckId);
        return getNewCards(cards);
      },

      // Stats
      getTotalCardsStudied: () => {
        return get().flashcards.filter(c => c.repetitions > 0).length;
      },

      getDeckCompletionRate: (deckId: string) => {
        const deckCards = get().flashcards.filter(f => f.deckId === deckId);
        if (deckCards.length === 0) return 0;
        const completed = deckCards.filter(f => f.interval > 21);
        return (completed.length / deckCards.length) * 100;
      },

      hasIncompleteSession: (deckId: string) => {
        const { studyProgress, currentDeckId, sessionQueue } = get();
        return !!(
          studyProgress &&
          currentDeckId === deckId &&
          studyProgress.deckId === deckId &&
          studyProgress.cardsLeft > 0 &&
          sessionQueue.length > 0 &&
          studyProgress.currentCardIndex < sessionQueue.length
        );
      },

      resetAllProgress: () => {
        console.log('[FlashcardStore] Resetting all progress');
        const now = Date.now();
        set(state => ({
          flashcards: state.flashcards.map(card => ({
            ...card,
            interval: 1,
            repetitions: 0,
            dueDate: now,
            lastReviewed: null,
            updatedAt: now,
          })),
          studyProgress: null,
          currentDeckId: null,
          sessionQueue: [],
          sessionRatings: {},
        }));
      },

      getStreak: () => {
        // userStore needs to be imported or tracked at call time to avoid circular deps
        const { useUserStore } = require('./user-store');
        const user = useUserStore.getState().user;
        if (!user || user.studyStats.streakDays === 0) return 0;
        
        const lastStudyTime = user.studyStats.lastStudyDate;
        if (!lastStudyTime) return 0;
        
        const now = Date.now();
        const diffMs = now - lastStudyTime;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        
        // If more than 2 days have passed (approx 48 hours), streak is broken
        // (Allows for a 1-day grace period effectively depending on strictly when they studied)
        if (diffDays > 2) {
          return 0; // Streak broken, ideally this would also sync a reset to DB
        }
        
        return user.studyStats.streakDays;
      },

      // Backward compatibility methods
      loadInitialData: (decks: Deck[], flashcards: Flashcard[]) => {
        console.log('[FlashcardStore] loadInitialData called');
        
        const normalizedDecks: StoreDeck[] = decks.map(d => ({
          ...normalizeDeck(d),
          areCardsLoaded: flashcards.some(f => f.deckId === d.id),
        }));

        const normalizedFlashcards = flashcards.map(f => normalizeFlashcard(f));

        set({
          decks: normalizedDecks,
          flashcards: normalizedFlashcards,
          isLoading: false,
          error: null,
        });
      },

      // Alias for loadDeckWithCards for backward compatibility
      fetchFlashcardsForDeck: async (deckId: string) => {
        return get().loadDeckWithCards(deckId);
      },
    }),
    {
      name: 'flashcard-storage',
      storage: createJSONStorage(() => getSafeStorage()),
      partialize: (state) => ({
        decks: state.decks,
        flashcards: state.flashcards,
        sessionRatings: state.sessionRatings,
      }),
      onRehydrateStorage: () => (state) => {
        console.log('[FlashcardStore] Rehydrated from storage');
        if (state) {
          // Mark decks as loaded if we have their flashcards
          const loadedDeckIds = new Set(state.flashcards.map(f => f.deckId));
          state.decks.forEach(deck => {
            if (loadedDeckIds.has(deck.id)) {
              deck.areCardsLoaded = true;
              deck.cardCount = state.flashcards.filter(f => f.deckId === deck.id).length;
            }
          });
        }
      },
    }
  )
);