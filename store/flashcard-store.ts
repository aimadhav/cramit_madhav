import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Flashcard, Deck, DifficultyRating, StudyProgress } from '@/types';
import { mockFlashcards } from '@/mocks/flashcards';
import { mockDecks } from '@/mocks/decks';
import { calculateNextReview, getDueCards } from '@/utils/spaced-repetition';
import { produce } from 'immer';

// Temporary store for the current session's card queue (IDs)
let currentSessionCardQueue: string[] = [];

interface FlashcardState {
  decks: Deck[];
  flashcards: Flashcard[];
  currentDeckId: string | null;
  studyProgress: StudyProgress | null; // Uses the defined StudyProgress type
  isLoading: boolean;
  error: string | null;
  sessionJustCompletedDeckId: string | null; // New state
  
  // Deck actions
  addDeck: (deck: Omit<Deck, 'id' | 'createdAt' | 'updatedAt' | 'cardCount'>) => string;
  updateDeck: (id: string, deckData: Partial<Deck>) => void;
  deleteDeck: (id: string) => void;
  setCurrentDeck: (deckId: string | null) => void;
  
  // Flashcard actions
  addFlashcard: (card: Omit<Flashcard, 'id' | 'createdAt' | 'updatedAt' | 'interval' | 'easeFactor' | 'repetitions' | 'dueDate' | 'lastReviewed'>) => string;
  updateFlashcard: (id: string, cardData: Partial<Flashcard>) => void;
  deleteFlashcard: (id: string) => void;
  toggleBookmark: (cardId: string) => void;
  
  // Study session actions
  startStudySession: (deckId: string) => void;
  rateCard: (cardId: string, rating: DifficultyRating) => void;
  endStudySession: () => void;
  
  // Utility functions
  getFlashcardsForDeck: (deckId: string) => Flashcard[];
  getDueFlashcardsForDeck: (deckId: string) => Flashcard[];
  getCurrentCard: () => Flashcard | null;
  getNextCard: () => Flashcard | null;
  
  // New actions
  loadInitialData: (decks: Deck[], flashcards: Flashcard[]) => void;
  getTotalCardsStudied: () => number;
  getAverageEaseFactor: () => number;
  getDeckCompletionRate: (deckId: string) => number;
  getStreak: () => number;
  resetAllProgress: () => void;
  initializeStoreWithMocks: () => void;
  markSessionAsCompleted: (deckId: string) => void; // New action
  clearSessionJustCompleted: () => void; // New action
}

export const useFlashcardStore = create<FlashcardState>()(
  persist(
    (set, get) => ({
      decks: [],
      flashcards: [],
      currentDeckId: null,
      studyProgress: null,
      isLoading: false,
      error: null,
      sessionJustCompletedDeckId: null, // Initialize new state
      
      initializeStoreWithMocks: () => {
        if (get().decks.length === 0 && get().flashcards.length === 0) {
          set({
            decks: mockDecks.map(deck => ({...deck})), // Ensure clean copies
            flashcards: mockFlashcards.map(card => ({...card, isBookmarked: card.isBookmarked || false })),
          });
          console.log('[FlashcardStore] Initialized with mock data.');
        }
      },

      loadInitialData: (decks, flashcards) => {
        set({ decks, flashcards });
      },
      
      addDeck: (deckData) => {
        const id = `deck-${Date.now()}`;
        const newDeck: Deck = {
          ...deckData,
          id,
          cardCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        
        set(state => ({
          decks: [...state.decks, newDeck]
        }));
        
        return id;
      },
      
      updateDeck: (id, deckData) => {
        set(state => ({
          decks: state.decks.map(deck => 
            deck.id === id 
              ? { ...deck, ...deckData, updatedAt: Date.now() } 
              : deck
          )
        }));
      },
      
      deleteDeck: (id) => {
        set(state => ({
          decks: state.decks.filter(deck => deck.id !== id),
          // Also delete all flashcards in this deck
          flashcards: state.flashcards.filter(card => card.deckId !== id)
        }));
      },
      
      setCurrentDeck: (deckId) => {
        set({ currentDeckId: deckId });
      },
      
      addFlashcard: (cardData: Omit<Flashcard, 'id' | 'createdAt' | 'updatedAt' | 'interval' | 'easeFactor' | 'repetitions' | 'dueDate' | 'lastReviewed'>) => {
        const id = `card-${Date.now()}`;
        const newCard: Flashcard = {
          ...cardData,
          id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          interval: 1,
          easeFactor: 2.5,
          repetitions: 0,
          dueDate: Date.now(), // Due immediately
          lastReviewed: null,
          isBookmarked: false, // Initialize isBookmarked
        };
        
        set(state => {
          // Update the card count in the deck
          const updatedDecks = state.decks.map(deck => 
            deck.id === cardData.deckId 
              ? { ...deck, cardCount: deck.cardCount + 1, updatedAt: Date.now() } 
              : deck
          );
          
          return {
            flashcards: [...state.flashcards, newCard],
            decks: updatedDecks
          };
        });
        
        return id;
      },
      
      updateFlashcard: (id, cardData) => {
        set(state => ({
          flashcards: state.flashcards.map(card => 
            card.id === id 
              ? { ...card, ...cardData, updatedAt: Date.now() } 
              : card
          )
        }));
      },
      
      deleteFlashcard: (id) => {
        set(state => {
          const cardToDelete = state.flashcards.find(card => card.id === id);
          if (!cardToDelete) return state;
          
          // Update the card count in the deck
          const updatedDecks = state.decks.map(deck => 
            deck.id === cardToDelete.deckId 
              ? { ...deck, cardCount: Math.max(0, deck.cardCount - 1), updatedAt: Date.now() } 
              : deck
          );
          
          return {
            flashcards: state.flashcards.filter(card => card.id !== id),
            decks: updatedDecks
          };
        });
      },
      
      toggleBookmark: (cardId: string) => {
        set(produce((state: FlashcardState) => {
          const card = state.flashcards.find(c => c.id === cardId);
          if (card) {
            card.isBookmarked = !card.isBookmarked;
          }
        }));
      },
      
      startStudySession: (deckId) => {
        // If starting a new session for a deck different from the one just completed, clear the flag.
        if (get().sessionJustCompletedDeckId && get().sessionJustCompletedDeckId !== deckId) {
          get().clearSessionJustCompleted();
        }
        // If starting the same deck that was just marked completed (e.g. user re-enters quickly),
        // we should probably clear the flag too, so it doesn't immediately show 'completed'.
        // Or, the UI component should handle this. For now, let's clear if it's any deck different than current, or if it's same but we are explicitly starting.
        if (get().sessionJustCompletedDeckId === deckId) {
            get().clearSessionJustCompleted();
        }

        const dueCards = get().getDueFlashcardsForDeck(deckId);
        
        if (dueCards.length === 0) {
          console.warn(`[FlashcardStore] startStudySession: No cards due for deck ${deckId}.`);
          currentSessionCardQueue = []; // Clear any old queue
          set({ 
            currentDeckId: deckId,
            studyProgress: null, 
            error: "No cards due for review." 
          });
          return;
        }
        
        currentSessionCardQueue = dueCards.map(card => card.id);
        console.log(`[FlashcardStore] startStudySession: Deck ${deckId}, ${dueCards.length} due cards. Queue: [${currentSessionCardQueue.join(', ')}]`);
        set({
          currentDeckId: deckId,
          studyProgress: {
            deckId,
            currentCardIndex: 0,
            cardsStudied: 0,
            cardsLeft: currentSessionCardQueue.length,
          },
          error: null
        });
      },
      
      rateCard: (cardId, rating) => {
        set(produce((state: FlashcardState) => {
          const cardIndex = state.flashcards.findIndex(card => card.id === cardId);
          if (cardIndex === -1) {
            state.error = "Card not found for rating.";
            console.error("[FlashcardStore] rateCard: Card ID not found:", cardId);
            return;
          }
          
          const card = state.flashcards[cardIndex];
          const updatedCardData = calculateNextReview(card, rating);
          state.flashcards[cardIndex] = { ...card, ...updatedCardData, updatedAt: Date.now() };
          console.log(`[FlashcardStore] Card ${cardId} rated. New due date: ${new Date(state.flashcards[cardIndex].dueDate).toLocaleDateString()}`);
        }));
      },
      
      endStudySession: () => {
        console.log("[FlashcardStore] endStudySession called.");
        currentSessionCardQueue = []; // Clear session queue
        get().clearSessionJustCompleted(); // Clear the flag here as well
        set({
          currentDeckId: null,
          studyProgress: null
        });
      },
      
      getFlashcardsForDeck: (deckId) => {
        return get().flashcards.filter(card => card.deckId === deckId);
      },
      
      getDueFlashcardsForDeck: (deckId) => {
        const cards = get().flashcards.filter(f => f.deckId === deckId);
        return getDueCards(cards);
      },
      
      getCurrentCard: () => {
        const { studyProgress, flashcards } = get();
        
        if (!studyProgress || currentSessionCardQueue.length === 0 || studyProgress.currentCardIndex >= currentSessionCardQueue.length) {
          return null;
        }
        
        const currentCardId = currentSessionCardQueue[studyProgress.currentCardIndex];
        const card = flashcards.find(f => f.id === currentCardId);
        
        if (!card) {
            console.warn(`[FlashcardStore] getCurrentCard: Card ID ${currentCardId} from session queue not found in main flashcards list.`);
            return null;
        }
        return card;
      },
      
      getNextCard: () => {
        const { studyProgress, flashcards } = get();
        if (!studyProgress || currentSessionCardQueue.length === 0) {
          console.log("[FlashcardStore] getNextCard: No study progress or empty session queue.");
          return null;
        }
        
        const newIndex = studyProgress.currentCardIndex + 1;
        
        if (newIndex >= currentSessionCardQueue.length) {
          console.log("[FlashcardStore] getNextCard: Reached end of session queue.");
          // When the queue ends, update studyProgress to reflect completion for this batch
          set(produce((state: FlashcardState) => {
            if (state.studyProgress) {
              state.studyProgress.cardsStudied += state.studyProgress.cardsLeft;
              state.studyProgress.cardsLeft = 0;
              state.studyProgress.currentCardIndex = currentSessionCardQueue.length; // Mark index as past the end
            }
          }));
          return null; 
        }
        
        set(produce((state: FlashcardState) => {
          if (state.studyProgress) {
            state.studyProgress.currentCardIndex = newIndex;
            state.studyProgress.cardsStudied += 1;
            state.studyProgress.cardsLeft -=1;
          }
        }));
        
        const nextCardId = currentSessionCardQueue[newIndex];
        const card = flashcards.find(f => f.id === nextCardId);

        if (!card) {
            console.warn(`[FlashcardStore] getNextCard: Next card ID ${nextCardId} from session queue not found.`);
            return null; // Should ideally not happen if queue is synced
        }
        return card;
      },
      
      getTotalCardsStudied: () => {
        return get().flashcards.reduce((sum, card) => sum + card.repetitions, 0);
      },
      
      getAverageEaseFactor: () => {
        const reviewedCards = get().flashcards.filter(f => f.lastReviewed !== null);
        if (reviewedCards.length === 0) return 2.5;
        const sumEase = reviewedCards.reduce((sum, card) => sum + card.easeFactor, 0);
        return sumEase / reviewedCards.length;
      },
      
      getDeckCompletionRate: (deckId) => {
        const deckCards = get().flashcards.filter(f => f.deckId === deckId);
        if (deckCards.length === 0) return 0;
        const completedCards = deckCards.filter(f => f.interval > 10);
        return (completedCards.length / deckCards.length) * 100;
      },
      
      getStreak: () => {
        return 0;
      },
      
      resetAllProgress: () => {
        set(produce((state: FlashcardState) => {
          state.flashcards.forEach(card => {
            card.interval = 1;
            card.easeFactor = 2.5;
            card.repetitions = 0;
            card.dueDate = Date.now();
            card.lastReviewed = null;
          });
        }));
      },
      
      // New action implementations
      markSessionAsCompleted: (deckId: string) => {
        console.log(`[FlashcardStore] markSessionAsCompleted for deck: ${deckId}`);
        set({ sessionJustCompletedDeckId: deckId });
      },

      clearSessionJustCompleted: () => {
        console.log('[FlashcardStore] clearSessionJustCompleted');
        set({ sessionJustCompletedDeckId: null });
      },
    }),
    {
      name: 'flashcard-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        decks: state.decks,
        flashcards: state.flashcards,
      }),
    }
  )
);

const unsub = useFlashcardStore.persist.onFinishHydration((state: FlashcardState | undefined) => {
  if (state) {
    // Ensure all flashcards have isBookmarked initialized
    const updatedFlashcards = state.flashcards.map(card => ({
      ...card,
      isBookmarked: card.isBookmarked || false,
    }));
    useFlashcardStore.setState({ flashcards: updatedFlashcards });
  }
  if (state && (!state.decks || state.decks.length === 0)) {
    console.log("[FlashcardStore] Persisted state is empty or has no decks. Initializing with mocks.");
    useFlashcardStore.getState().initializeStoreWithMocks();
  }
  unsub();
});