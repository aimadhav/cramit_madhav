import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Flashcard, Deck, DifficultyRating, StudyProgress } from '@/types';
import { mockFlashcards } from '@/mocks/flashcards';
import { mockDecks } from '@/mocks/decks';
import { calculateNextReview, getDueCards } from '@/utils/spaced-repetition';

interface FlashcardState {
  decks: Deck[];
  flashcards: Flashcard[];
  currentDeckId: string | null;
  studyProgress: StudyProgress | null;
  isLoading: boolean;
  error: string | null;
  
  // Deck actions
  addDeck: (deck: Omit<Deck, 'id' | 'createdAt' | 'updatedAt' | 'cardCount'>) => string;
  updateDeck: (id: string, deckData: Partial<Deck>) => void;
  deleteDeck: (id: string) => void;
  setCurrentDeck: (deckId: string | null) => void;
  
  // Flashcard actions
  addFlashcard: (card: Omit<Flashcard, 'id' | 'createdAt' | 'updatedAt' | 'interval' | 'easeFactor' | 'repetitions' | 'dueDate' | 'lastReviewed'>) => string;
  updateFlashcard: (id: string, cardData: Partial<Flashcard>) => void;
  deleteFlashcard: (id: string) => void;
  
  // Study session actions
  startStudySession: (deckId: string) => void;
  rateCard: (cardId: string, rating: DifficultyRating) => void;
  endStudySession: () => void;
  
  // Utility functions
  getFlashcardsForDeck: (deckId: string) => Flashcard[];
  getDueFlashcardsForDeck: (deckId: string) => Flashcard[];
  getCurrentCard: () => Flashcard | null;
  getNextCard: () => Flashcard | null;
}

export const useFlashcardStore = create<FlashcardState>()(
  persist(
    (set, get) => ({
      decks: mockDecks,
      flashcards: mockFlashcards,
      currentDeckId: null,
      studyProgress: null,
      isLoading: false,
      error: null,
      
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
      
      addFlashcard: (cardData) => {
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
      
      startStudySession: (deckId) => {
        const dueCards = get().getDueFlashcardsForDeck(deckId);
        
        if (dueCards.length === 0) {
          set({ error: "No cards due for review" });
          return;
        }
        
        set({
          currentDeckId: deckId,
          studyProgress: {
            deckId,
            cardsLeft: dueCards.length,
            cardsStudied: 0,
            currentCardIndex: 0
          },
          error: null
        });
      },
      
      rateCard: (cardId, rating) => {
        const { flashcards, studyProgress } = get();
        
        if (!studyProgress) {
          set({ error: "No active study session" });
          return;
        }
        
        const cardIndex = flashcards.findIndex(card => card.id === cardId);
        if (cardIndex === -1) {
          set({ error: "Card not found" });
          return;
        }
        
        // Calculate new spaced repetition values
        const card = flashcards[cardIndex];
        const updatedCardData = calculateNextReview(card, rating);
        
        // Update the card
        const updatedFlashcards = [...flashcards];
        updatedFlashcards[cardIndex] = {
          ...card,
          ...updatedCardData
        };
        
        // Update study progress
        const updatedProgress = {
          ...studyProgress,
          cardsStudied: studyProgress.cardsStudied + 1,
          cardsLeft: studyProgress.cardsLeft - 1,
          currentCardIndex: studyProgress.currentCardIndex + 1
        };
        
        set({
          flashcards: updatedFlashcards,
          studyProgress: updatedProgress
        });
      },
      
      endStudySession: () => {
        set({
          currentDeckId: null,
          studyProgress: null
        });
      },
      
      getFlashcardsForDeck: (deckId) => {
        return get().flashcards.filter(card => card.deckId === deckId);
      },
      
      getDueFlashcardsForDeck: (deckId) => {
        const cards = get().getFlashcardsForDeck(deckId);
        return getDueCards(cards);
      },
      
      getCurrentCard: () => {
        const { flashcards, studyProgress, currentDeckId } = get();
        
        if (!studyProgress || !currentDeckId) return null;
        
        const dueCards = get().getDueFlashcardsForDeck(currentDeckId);
        
        if (dueCards.length === 0 || studyProgress.currentCardIndex >= dueCards.length) {
          return null;
        }
        
        return dueCards[studyProgress.currentCardIndex];
      },
      
      getNextCard: () => {
        const { studyProgress, currentDeckId } = get();
        
        if (!studyProgress || !currentDeckId) return null;
        
        const dueCards = get().getDueFlashcardsForDeck(currentDeckId);
        
        if (dueCards.length === 0 || studyProgress.currentCardIndex + 1 >= dueCards.length) {
          return null;
        }
        
        return dueCards[studyProgress.currentCardIndex + 1];
      }
    }),
    {
      name: 'flashcard-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        decks: state.decks,
        flashcards: state.flashcards,
        // Don't persist these ephemeral states
        // currentDeckId: state.currentDeckId,
        // studyProgress: state.studyProgress,
        // isLoading: state.isLoading,
        // error: state.error,
      }),
    }
  )
);