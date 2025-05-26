import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Flashcard, Deck, DifficultyRating, StudyProgress, ContentType } from '@/types';
import { mockFlashcards } from '@/mocks/flashcards';
import { mockDecks } from '@/mocks/decks';
import { calculateNextReview, getDueCards } from '@/utils/spaced-repetition';
import { produce } from 'immer';
import { trpcClient } from '@/lib/trpc';

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
  pendingOperations: {
    [key: string]: {
      type: 'add' | 'update' | 'delete';
      data: any;
      originalData?: any; // For delete/update rollback
      timestamp: number;
    };
  };
  
  // Deck actions
  addDeck: (deck: Omit<Deck, 'id' | 'createdAt' | 'updatedAt' | 'cardCount' | 'userId'>) => Promise<string>;
  updateDeck: (id: string, deckData: Partial<Omit<Deck, 'id' | 'createdAt' | 'updatedAt' | 'cardCount' | 'userId'>>) => Promise<void>;
  deleteDeck: (id: string) => Promise<void>;
  setCurrentDeck: (deckId: string | null) => void;
  
  // Flashcard actions
  addFlashcard: (card: Omit<Flashcard, 'id' | 'createdAt' | 'updatedAt' | 'interval' | 'easeFactor' | 'repetitions' | 'dueDate' | 'lastReviewed' | 'isBookmarked'>) => Promise<string>;
  updateFlashcard: (id: string, cardData: Partial<Omit<Flashcard, 'id' | 'createdAt' | 'updatedAt' | 'deckId' | 'interval' | 'easeFactor' | 'repetitions' | 'dueDate' | 'lastReviewed'>>) => Promise<void>;
  deleteFlashcard: (id: string) => Promise<void>;
  toggleBookmark: (cardId: string) => Promise<void>;
  
  // Study session actions
  startStudySession: (deckId: string) => void;
  rateCard: (cardId: string, rating: DifficultyRating) => Promise<void>;
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
  markSessionAsCompleted: (deckId: string) => void;
  clearSessionJustCompleted: () => void;
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
      sessionJustCompletedDeckId: null,
      pendingOperations: {},
      
      initializeStoreWithMocks: () => {
        if (get().decks.length === 0 && get().flashcards.length === 0) {
          set({
            decks: mockDecks.map(deck => ({...deck, createdAt: String(deck.createdAt), updatedAt: String(deck.updatedAt) })),
            flashcards: mockFlashcards.map(card => ({
                ...card, 
                isBookmarked: card.isBookmarked || false, 
                createdAt: Number(card.createdAt), 
                updatedAt: Number(card.updatedAt), 
                dueDate: Number(card.dueDate), 
                lastReviewed: card.lastReviewed ? Number(card.lastReviewed) : null,
                contentType: card.contentType as ContentType || 'text',
            })),
          });
          console.log('[FlashcardStore] Initialized with mock data.');
        }
      },

      loadInitialData: (decks, flashcards) => {
        set({ 
          decks: decks.map(d => ({...d, createdAt: String(d.createdAt), updatedAt: String(d.updatedAt) })), 
          flashcards: flashcards.map(f => ({
              ...f, 
              createdAt: Number(f.createdAt), 
              updatedAt: Number(f.updatedAt), 
              dueDate: Number(f.dueDate), 
              lastReviewed: f.lastReviewed ? Number(f.lastReviewed) : null,
              isBookmarked: f.isBookmarked || false,
              contentType: f.contentType as ContentType || 'text',
            })) 
        });
      },
      
      addDeck: async (deckData) => {
        const tempId = `deck-temp-${Date.now()}`;
        const optimisticDeck: Deck = {
          ...deckData,
          id: tempId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cardCount: 0,
          userId: 'temp-user-id',
          isPublic: deckData.isPublic || false, 
        };

        set(produce((state: FlashcardState) => {
          state.decks.push(optimisticDeck);
          state.pendingOperations[tempId] = {
            type: 'add',
            data: optimisticDeck,
            timestamp: Date.now(),
          };
          state.isLoading = true;
          state.error = null;
        }));

        try {
          const payload = {
            name: deckData.name,
            description: deckData.description === null ? undefined : deckData.description,
            tags: deckData.tags || [],
            isPublic: deckData.isPublic || false,
            isPremium: deckData.isPremium || false,
            price: deckData.price === null ? undefined : deckData.price,
            coverImage: deckData.coverImage === null ? undefined : deckData.coverImage,
            subject: deckData.subject === null ? undefined : deckData.subject,
            chapter: deckData.chapter === null ? undefined : deckData.chapter,
          };

          const newDeckFromBackend = await trpcClient.deck.create.mutate(payload);
          
          set(produce((state: FlashcardState) => {
            const deckIndex = state.decks.findIndex(d => d.id === tempId);
            if (deckIndex !== -1) {
              state.decks[deckIndex] = {
                ...newDeckFromBackend,
                cardCount: state.decks[deckIndex].cardCount, 
                createdAt: String(newDeckFromBackend.createdAt),
                updatedAt: String(newDeckFromBackend.updatedAt),
              };
            }
            delete state.pendingOperations[tempId];
            state.isLoading = false;
          }));
          return newDeckFromBackend.id;
        } catch (error: any) {
          set(produce((state: FlashcardState) => {
            state.decks = state.decks.filter(deck => deck.id !== tempId);
            delete state.pendingOperations[tempId];
            state.isLoading = false;
            state.error = error.message || 'Failed to add deck';
          }));
          console.error("Error adding deck:", error);
          throw error;
        }
      },
      
      updateDeck: async (id, deckData) => {
        const originalDeck = get().decks.find(d => d.id === id);
        if (!originalDeck) {
          console.error('Deck not found for update:', id);
          throw new Error('Deck not found');
        }

        const optimisticUpdateTimestamp = new Date().toISOString();
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, userId: _userId, cardCount: _cardCount, ...validDeckData } = deckData as any;
        const optimisticDeck: Deck = { 
            ...originalDeck, 
            ...validDeckData, 
            updatedAt: optimisticUpdateTimestamp 
        };

        set(produce((state: FlashcardState) => {
          const deckIndex = state.decks.findIndex(d => d.id === id);
          if (deckIndex !== -1) {
            state.decks[deckIndex] = optimisticDeck;
          }
          state.pendingOperations[id] = {
            type: 'update',
            data: optimisticDeck, 
            originalData: originalDeck, 
            timestamp: Date.now(),
          };
           state.isLoading = true;
           state.error = null;
        }));

        try {
          const payload: Partial<Deck> & { id: string } = { id };
          if (validDeckData.name !== undefined) payload.name = validDeckData.name;
          if (validDeckData.description !== undefined) payload.description = validDeckData.description;
          if (validDeckData.tags !== undefined) payload.tags = validDeckData.tags;
          if (validDeckData.isPublic !== undefined) payload.isPublic = validDeckData.isPublic;
          if (validDeckData.isPremium !== undefined) payload.isPremium = validDeckData.isPremium;
          if (validDeckData.price !== undefined) payload.price = validDeckData.price;
          if (validDeckData.coverImage !== undefined) payload.coverImage = validDeckData.coverImage;
          if (validDeckData.subject !== undefined) payload.subject = validDeckData.subject;
          if (validDeckData.chapter !== undefined) payload.chapter = validDeckData.chapter;

          const updatedDeckFromBackend = await trpcClient.deck.update.mutate(payload as any);
          
          set(produce((state: FlashcardState) => {
            const deckIndex = state.decks.findIndex(d => d.id === id);
            if (deckIndex !== -1) {
                 state.decks[deckIndex] = {
                    ...state.decks[deckIndex], 
                    ...updatedDeckFromBackend,
                    createdAt: String(updatedDeckFromBackend.createdAt),
                    updatedAt: String(updatedDeckFromBackend.updatedAt),
                 };
            }
            delete state.pendingOperations[id];
            state.isLoading = false;
          }));
        } catch (error: any) {
          set(produce((state: FlashcardState) => {
            const deckIndex = state.decks.findIndex(d => d.id === id);
            if (deckIndex !== -1 && state.pendingOperations[id]?.originalData) {
              state.decks[deckIndex] = state.pendingOperations[id].originalData as Deck;
            } else if (deckIndex !== -1) { 
                state.decks[deckIndex] = originalDeck;
            }
            delete state.pendingOperations[id];
            state.isLoading = false;
            state.error = error.message || 'Failed to update deck';
          }));
          console.error("Error updating deck:", error);
          throw error;
        }
      },
      
      deleteDeck: async (id) => {
        const deckToDelete = get().decks.find(d => d.id === id);
        if (!deckToDelete) {
          console.error('Deck not found for delete:', id);
          throw new Error('Deck not found');
        }
        const associatedFlashcards = get().flashcards.filter(card => card.deckId === id);

        set(produce((state: FlashcardState) => {
          state.pendingOperations[id] = {
            type: 'delete',
            data: deckToDelete, 
            originalData: { deck: deckToDelete, flashcards: associatedFlashcards }, 
            timestamp: Date.now(),
          };
          state.decks = state.decks.filter(deck => deck.id !== id);
          state.flashcards = state.flashcards.filter(card => card.deckId !== id);
          state.isLoading = true;
          state.error = null;
        }));

        try {
          await trpcClient.deck.delete.mutate({ id });
          
          set(produce((state: FlashcardState) => {
            delete state.pendingOperations[id];
            state.isLoading = false;
          }));
        } catch (error: any) {
          set(produce((state: FlashcardState) => {
            const opData = state.pendingOperations[id]?.originalData;
            if (opData && opData.deck) {
                if (!state.decks.find(d => d.id === opData.deck.id)) {
                    state.decks.push(opData.deck);
                }
                opData.flashcards.forEach((fc: Flashcard) => {
                    if (!state.flashcards.find(f => f.id === fc.id)) {
                        state.flashcards.push(fc);
                    }
                });
            }
            delete state.pendingOperations[id];
            state.isLoading = false;
            state.error = error.message || 'Failed to delete deck';
          }));
          console.error("Error deleting deck:", error);
          throw error;
        }
      },
      
      setCurrentDeck: (deckId) => {
        set({ currentDeckId: deckId });
      },
      
      addFlashcard: async (cardData) => {
        const tempId = `flashcard-temp-${Date.now()}`;
        const currentTimestamp = Date.now();
        const optimisticFlashcard: Flashcard = {
          ...cardData,
          id: tempId,
          createdAt: currentTimestamp,
          updatedAt: currentTimestamp,
          interval: 1,
          easeFactor: 2.5,
          repetitions: 0,
          dueDate: currentTimestamp,
          lastReviewed: null,
          isBookmarked: false,
          contentType: cardData.contentType as ContentType || 'text',
        };

        set(produce((state: FlashcardState) => {
          state.flashcards.push(optimisticFlashcard);
          const deckIndex = state.decks.findIndex(d => d.id === cardData.deckId);
          if (deckIndex !== -1) {
            state.decks[deckIndex].cardCount += 1;
            state.decks[deckIndex].updatedAt = new Date().toISOString();
          }
          state.pendingOperations[tempId] = {
            type: 'add',
            data: optimisticFlashcard,
            timestamp: Date.now(),
          };
          state.isLoading = true;
          state.error = null;
        }));

        try {
          const payload = {
            deckId: cardData.deckId,
            front: cardData.front,
            back: cardData.back,
            contentType: cardData.contentType as string,
            mediaUrls: cardData.mediaUrls || [],
            tags: cardData.tags || [],
          };
          const newCardFromBackend = await trpcClient.flashcards.create.mutate(payload as any);
          
          set(produce((state: FlashcardState) => {
            const cardIndex = state.flashcards.findIndex(c => c.id === tempId);
            if (cardIndex !== -1) {
              const existingOptimisticCard = state.flashcards[cardIndex];
              state.flashcards[cardIndex] = {
                ...existingOptimisticCard,
                ...newCardFromBackend,
                id: newCardFromBackend.id,
                createdAt: newCardFromBackend.createdAt ? new Date(newCardFromBackend.createdAt).getTime() : existingOptimisticCard.createdAt,
                updatedAt: newCardFromBackend.updatedAt ? new Date(newCardFromBackend.updatedAt).getTime() : existingOptimisticCard.updatedAt,
                contentType: (newCardFromBackend as any).contentType as ContentType || existingOptimisticCard.contentType,
                interval: (newCardFromBackend as any).userStatus?.interval ?? existingOptimisticCard.interval,
                easeFactor: (newCardFromBackend as any).userStatus?.easeFactor ?? existingOptimisticCard.easeFactor,
                repetitions: (newCardFromBackend as any).userStatus?.repetitions ?? existingOptimisticCard.repetitions,
                dueDate: (newCardFromBackend as any).userStatus?.dueDate ? new Date((newCardFromBackend as any).userStatus.dueDate).getTime() : existingOptimisticCard.dueDate,
                lastReviewed: (newCardFromBackend as any).userStatus?.lastReviewed ? new Date((newCardFromBackend as any).userStatus.lastReviewed).getTime() : existingOptimisticCard.lastReviewed,
                isBookmarked: (newCardFromBackend as any).userStatus?.isBookmarked ?? existingOptimisticCard.isBookmarked,
              };
            }
            delete state.pendingOperations[tempId];
            state.isLoading = false;
          }));
          return newCardFromBackend.id;
        } catch (error: any) {
          set(produce((state: FlashcardState) => {
            state.flashcards = state.flashcards.filter(card => card.id !== tempId);
            const deckIndex = state.decks.findIndex(d => d.id === cardData.deckId);
            if (deckIndex !== -1) {
              state.decks[deckIndex].cardCount = Math.max(0, state.decks[deckIndex].cardCount - 1);
            }
            delete state.pendingOperations[tempId];
            state.isLoading = false;
            state.error = error.message || 'Failed to add flashcard';
          }));
          console.error("Error adding flashcard:", error);
          throw error;
        }
      },
      
      updateFlashcard: async (id, cardData) => {
        const originalCard = get().flashcards.find(c => c.id === id);
        if (!originalCard) {
            console.error('Flashcard not found for update:', id);
            throw new Error('Flashcard not found');
        }
        
        const optimisticUpdateTimestamp = Date.now();
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, deckId: _deckId, ...validCardData } = cardData as any;

        const optimisticFlashcard: Flashcard = { 
            ...originalCard, 
            ...validCardData, 
            updatedAt: optimisticUpdateTimestamp,
            isBookmarked: validCardData.isBookmarked !== undefined ? validCardData.isBookmarked : originalCard.isBookmarked,
            contentType: validCardData.contentType !== undefined ? validCardData.contentType as ContentType : originalCard.contentType,
        };

        set(produce((state: FlashcardState) => {
          const cardIndex = state.flashcards.findIndex(c => c.id === id);
          if (cardIndex !== -1) {
            state.flashcards[cardIndex] = optimisticFlashcard;
          }
          state.pendingOperations[id] = {
            type: 'update',
            data: optimisticFlashcard,
            originalData: originalCard,
            timestamp: Date.now(),
          };
          state.isLoading = true;
          state.error = null;
        }));

        try {
          let updatedCardFromBackend: any;

          const isOnlyStatusUpdate = Object.keys(validCardData).every(key => 
            ['isBookmarked', 'interval', 'easeFactor', 'repetitions', 'dueDate', 'lastReviewed'].includes(key)
          );
          const hasStatusFields = Object.keys(validCardData).some(key => 
            ['isBookmarked', 'interval', 'easeFactor', 'repetitions', 'dueDate', 'lastReviewed'].includes(key)
          );
           const hasContentFields = Object.keys(validCardData).some(key => 
            ['front', 'back', 'contentType', 'mediaUrls', 'tags'].includes(key)
          );

          if (hasStatusFields && !hasContentFields) {
            const statusPayload: any = { flashcardId: id };
            if (validCardData.isBookmarked !== undefined) statusPayload.isBookmarked = validCardData.isBookmarked;
            if (validCardData.interval !== undefined) statusPayload.interval = validCardData.interval;
            if (validCardData.easeFactor !== undefined) statusPayload.easeFactor = validCardData.easeFactor;
            if (validCardData.repetitions !== undefined) statusPayload.repetitions = validCardData.repetitions;
            if (validCardData.dueDate !== undefined) statusPayload.dueDate = new Date(validCardData.dueDate);
            if (validCardData.lastReviewed !== undefined) statusPayload.lastReviewed = new Date(validCardData.lastReviewed);
            
            updatedCardFromBackend = await trpcClient.flashcards.updateUserStatus.mutate(statusPayload);
          } else {
            const contentPayload: any = { flashcardId: id }; 
            if (validCardData.front !== undefined) contentPayload.front = validCardData.front;
            if (validCardData.back !== undefined) contentPayload.back = validCardData.back;
            if (validCardData.contentType !== undefined) contentPayload.contentType = validCardData.contentType as string;
            if (validCardData.mediaUrls !== undefined) contentPayload.mediaUrls = validCardData.mediaUrls;
            if (validCardData.tags !== undefined) contentPayload.tags = validCardData.tags;
            updatedCardFromBackend = await trpcClient.flashcards.updateContent.mutate(contentPayload);
          }
          
          set(produce((state: FlashcardState) => {
            const cardIndex = state.flashcards.findIndex(c => c.id === id);
            if (cardIndex !== -1) {
              const existingCard = state.flashcards[cardIndex];
              
              let finalCardData: Partial<Flashcard> = {};
              if (updatedCardFromBackend.flashcardId && !updatedCardFromBackend.front) {
                finalCardData = {
                    ...updatedCardFromBackend,
                    isBookmarked: updatedCardFromBackend.isBookmarked,
                };
              } else {
                finalCardData = {
                    ...updatedCardFromBackend,
                    contentType: updatedCardFromBackend.contentType as ContentType || existingCard.contentType,
                    isBookmarked: updatedCardFromBackend.userStatus?.isBookmarked ?? existingCard.isBookmarked,
                    interval: updatedCardFromBackend.userStatus?.interval ?? existingCard.interval,
                    easeFactor: updatedCardFromBackend.userStatus?.easeFactor ?? existingCard.easeFactor,
                    repetitions: updatedCardFromBackend.userStatus?.repetitions ?? existingCard.repetitions,
                    dueDate: updatedCardFromBackend.userStatus?.dueDate ? new Date(updatedCardFromBackend.userStatus.dueDate).getTime() : existingCard.dueDate,
                    lastReviewed: updatedCardFromBackend.userStatus?.lastReviewed ? new Date(updatedCardFromBackend.userStatus.lastReviewed).getTime() : existingCard.lastReviewed,
                };
              }

              state.flashcards[cardIndex] = {
                ...existingCard, 
                ...finalCardData,
                id: (updatedCardFromBackend.id || (updatedCardFromBackend as any).flashcardId) || existingCard.id,
                createdAt: finalCardData.createdAt ? new Date(finalCardData.createdAt).getTime() : existingCard.createdAt,
                updatedAt: finalCardData.updatedAt ? new Date(finalCardData.updatedAt).getTime() : optimisticUpdateTimestamp,
              };
            }
            delete state.pendingOperations[id];
            state.isLoading = false;
          }));
        } catch (error: any) {
          set(produce((state: FlashcardState) => {
            const cardIndex = state.flashcards.findIndex(c => c.id === id);
            if (cardIndex !== -1 && state.pendingOperations[id]?.originalData) {
              state.flashcards[cardIndex] = state.pendingOperations[id].originalData as Flashcard;
            } else if (cardIndex !== -1) { 
                state.flashcards[cardIndex] = originalCard;
            }
            delete state.pendingOperations[id];
            state.isLoading = false;
            state.error = error.message || 'Failed to update flashcard';
          }));
          console.error("Error updating flashcard:", error);
          throw error;
        }
      },
      
      deleteFlashcard: async (id) => {
        const cardToDelete = get().flashcards.find(c => c.id === id);
        if (!cardToDelete) {
            console.error('Flashcard not found for delete:', id);
            throw new Error('Flashcard not found');
        }

        set(produce((state: FlashcardState) => {
          state.pendingOperations[id] = {
            type: 'delete',
            data: cardToDelete,
            originalData: cardToDelete, 
            timestamp: Date.now(),
          };
          state.flashcards = state.flashcards.filter(card => card.id !== id);
          const deckIndex = state.decks.findIndex(d => d.id === cardToDelete.deckId);
          if (deckIndex !== -1) {
            state.decks[deckIndex].cardCount = Math.max(0, state.decks[deckIndex].cardCount - 1);
            state.decks[deckIndex].updatedAt = new Date().toISOString();
          }
           state.isLoading = true;
           state.error = null;
        }));

        try {
          await trpcClient.flashcards.delete.mutate({ flashcardId: id }); 
          
          set(produce((state: FlashcardState) => {
            delete state.pendingOperations[id];
            state.isLoading = false;
          }));
        } catch (error: any) {
          set(produce((state: FlashcardState) => {
            const opData = state.pendingOperations[id]?.originalData as Flashcard | undefined;
            if (opData) {
                if(!state.flashcards.find(f => f.id === opData.id)) {
                    state.flashcards.push(opData);
                }
                const deckIndex = state.decks.findIndex(d => d.id === opData.deckId);
                if (deckIndex !== -1) {
                    const currentDeckCardCount = state.flashcards.filter(f => f.deckId === opData.deckId).length;
                    state.decks[deckIndex].cardCount = currentDeckCardCount; 
                }
            }
            delete state.pendingOperations[id];
            state.isLoading = false;
            state.error = error.message || 'Failed to delete flashcard';
          }));
          console.error("Error deleting flashcard:", error);
          throw error;
        }
      },
      
      toggleBookmark: async (cardId) => {
        const originalCard = get().flashcards.find(c => c.id === cardId);
        if (!originalCard) {
            console.error('Flashcard not found for toggleBookmark:', cardId);
            throw new Error('Flashcard not found');
        }

        const newBookmarkState = !originalCard.isBookmarked;
        const optimisticUpdateTimestamp = Date.now();
        const optimisticFlashcard: Flashcard = { 
            ...originalCard, 
            isBookmarked: newBookmarkState, 
            updatedAt: optimisticUpdateTimestamp 
        };

        set(produce((state: FlashcardState) => {
          const cardIndex = state.flashcards.findIndex(c => c.id === cardId);
          if (cardIndex !== -1) {
            state.flashcards[cardIndex] = optimisticFlashcard;
          }
          state.pendingOperations[cardId] = {
            type: 'update',
            data: optimisticFlashcard,
            originalData: originalCard,
            timestamp: Date.now(),
          };
           state.isLoading = true;
           state.error = null;
        }));

        try {
          const updatedStatus = await trpcClient.flashcards.updateUserStatus.mutate({ 
            flashcardId: cardId, 
            isBookmarked: newBookmarkState 
          });
          
          set(produce((state: FlashcardState) => {
            const cardIndex = state.flashcards.findIndex(c => c.id === cardId);
            if (cardIndex !== -1) {
                 const existingCard = state.flashcards[cardIndex];
                 state.flashcards[cardIndex] = {
                    ...existingCard, 
                    isBookmarked: updatedStatus.isBookmarked,
                    updatedAt: updatedStatus.updatedAt ? new Date(updatedStatus.updatedAt).getTime() : optimisticUpdateTimestamp,
                    interval: updatedStatus.interval ?? existingCard.interval,
                    easeFactor: updatedStatus.easeFactor ?? existingCard.easeFactor,
                    repetitions: updatedStatus.repetitions ?? existingCard.repetitions,
                    dueDate: updatedStatus.dueDate ? new Date(updatedStatus.dueDate).getTime() : existingCard.dueDate,
                    lastReviewed: updatedStatus.lastReviewed ? new Date(updatedStatus.lastReviewed).getTime() : existingCard.lastReviewed,
                 };
            }
            delete state.pendingOperations[cardId];
            state.isLoading = false;
          }));
        } catch (error: any) {
          set(produce((state: FlashcardState) => {
            const cardIndex = state.flashcards.findIndex(c => c.id === cardId);
             if (cardIndex !== -1 && state.pendingOperations[cardId]?.originalData) {
              state.flashcards[cardIndex] = state.pendingOperations[cardId].originalData as Flashcard;
            } else if (cardIndex !== -1) { 
                state.flashcards[cardIndex] = originalCard;
            }
            delete state.pendingOperations[cardId];
            state.isLoading = false;
            state.error = error.message || 'Failed to toggle bookmark';
          }));
          console.error("Error toggling bookmark:", error);
          throw error;
        }
      },
      
      startStudySession: (deckId) => {
        if (get().sessionJustCompletedDeckId && get().sessionJustCompletedDeckId !== deckId) {
          get().clearSessionJustCompleted();
        }
        if (get().sessionJustCompletedDeckId === deckId) {
            get().clearSessionJustCompleted();
        }

        const dueCards = get().getDueFlashcardsForDeck(deckId);
        
        if (dueCards.length === 0) {
          console.warn(`[FlashcardStore] startStudySession: No cards due for deck ${deckId}.`);
          currentSessionCardQueue = []; 
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
      
      rateCard: async (cardId, rating) => {
        const originalCard = get().flashcards.find(c => c.id === cardId);
        if(!originalCard) {
            console.error("Card not found for rating:", cardId);
            throw new Error("Card not found for rating.");
        }

        const updatedSrsData = calculateNextReview(originalCard, rating);
        const optimisticTimestamp = Date.now();
        const optimisticallyRatedCard: Flashcard = {
            ...originalCard,
            ...updatedSrsData,
            updatedAt: optimisticTimestamp,
            lastReviewed: optimisticTimestamp 
        };
        
        const tempOpId = `rate-${cardId}-${Date.now()}`;

        set(produce((state: FlashcardState) => {
            const cardIndex = state.flashcards.findIndex(card => card.id === cardId);
            if (cardIndex !== -1) {
                state.flashcards[cardIndex] = optimisticallyRatedCard;
            }
            state.pendingOperations[tempOpId] = {
                type: 'update',
                data: optimisticallyRatedCard,
                originalData: originalCard,
                timestamp: Date.now(),
            };
            console.log(`[FlashcardStore] Card ${cardId} rated (optimistically).`);
        }));

        try {
          const backendSrsData = {
            flashcardId: cardId,
            interval: optimisticallyRatedCard.interval,
            easeFactor: optimisticallyRatedCard.easeFactor,
            repetitions: optimisticallyRatedCard.repetitions,
            dueDate: new Date(optimisticallyRatedCard.dueDate),
            lastReviewed: new Date(optimisticallyRatedCard.lastReviewed!),
          };
          const updatedStatus = await trpcClient.flashcards.updateUserStatus.mutate(backendSrsData);
          
          set(produce((state: FlashcardState) => {
            const cardIndex = state.flashcards.findIndex(c => c.id === cardId);
            if (cardIndex !== -1) {
                state.flashcards[cardIndex].updatedAt = updatedStatus.updatedAt ? new Date(updatedStatus.updatedAt).getTime() : optimisticTimestamp;
                state.flashcards[cardIndex].interval = updatedStatus.interval ?? state.flashcards[cardIndex].interval;
                state.flashcards[cardIndex].easeFactor = updatedStatus.easeFactor ?? state.flashcards[cardIndex].easeFactor;
                state.flashcards[cardIndex].repetitions = updatedStatus.repetitions ?? state.flashcards[cardIndex].repetitions;
                state.flashcards[cardIndex].dueDate = updatedStatus.dueDate ? new Date(updatedStatus.dueDate).getTime() : state.flashcards[cardIndex].dueDate;
                state.flashcards[cardIndex].lastReviewed = updatedStatus.lastReviewed ? new Date(updatedStatus.lastReviewed).getTime() : state.flashcards[cardIndex].lastReviewed;
            }
            delete state.pendingOperations[tempOpId];
          }));
        } catch (error: any) {
          set(produce((state: FlashcardState) => {
            const cardIndex = state.flashcards.findIndex(c => c.id === cardId);
            if (cardIndex !== -1) state.flashcards[cardIndex] = originalCard; 
            delete state.pendingOperations[tempOpId];
            state.error = error.message || "Failed to sync card rating";
          }));
          console.error("Error syncing card rating:", error);
          throw error;
        }
      },
      
      endStudySession: () => {
        console.log("[FlashcardStore] endStudySession called.");
        currentSessionCardQueue = [];
        get().clearSessionJustCompleted(); 
        set({
          currentDeckId: null,
          studyProgress: null
        });
      },
      
      getFlashcardsForDeck: (deckId) => {
        return get().flashcards.filter(card => card.deckId === deckId);
      },
      
      getDueFlashcardsForDeck: (deckId) => {
        const cardsInDeck = get().flashcards.filter(f => f.deckId === deckId);
        return getDueCards(cardsInDeck);
      },
      
      getCurrentCard: () => {
        const { studyProgress, flashcards } = get();
        if (!studyProgress || currentSessionCardQueue.length === 0 || studyProgress.currentCardIndex >= currentSessionCardQueue.length) {
          return null;
        }
        const currentCardId = currentSessionCardQueue[studyProgress.currentCardIndex];
        return flashcards.find(f => f.id === currentCardId) || null;
      },
      
      getNextCard: () => {
        const { studyProgress } = get(); 
        if (!studyProgress || currentSessionCardQueue.length === 0) {
          console.log("[FlashcardStore] getNextCard: No study progress or empty session queue.");
          return null;
        }
        
        const newIndex = studyProgress.currentCardIndex + 1;
        
        if (newIndex >= currentSessionCardQueue.length) {
          console.log("[FlashcardStore] getNextCard: Reached end of session queue.");
          set(produce((state: FlashcardState) => {
            if (state.studyProgress) {
              state.studyProgress.cardsStudied = state.studyProgress.cardsStudied + (currentSessionCardQueue.length - state.studyProgress.currentCardIndex) -1;
              state.studyProgress.cardsLeft = 0;
              state.studyProgress.currentCardIndex = currentSessionCardQueue.length;
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
        return get().flashcards.find(f => f.id === nextCardId) || null;
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
        const completedCards = deckCards.filter(f => f.interval > 21); 
        return (completedCards.length / deckCards.length) * 100;
      },
      
      getStreak: () => {
        return 0;
      },
      
      resetAllProgress: () => {
        const currentTimestamp = Date.now();
        set(produce((state: FlashcardState) => {
          state.flashcards.forEach(card => {
            card.interval = 1;
            card.easeFactor = 2.5;
            card.repetitions = 0;
            card.dueDate = currentTimestamp; 
            card.lastReviewed = null;
            card.updatedAt = currentTimestamp; 
          });
        }));
      },
      
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
      onRehydrateStorage: () => {
        console.log('[FlashcardStore] Hydration process starting.');
        return (hydratedState, error) => {
          if (error) {
            console.error('[FlashcardStore] Hydration error:', error);
            useFlashcardStore.setState({ isLoading: false, error: "Failed to load saved data.", pendingOperations: {} });
          } else if (hydratedState) {
            console.log('[FlashcardStore] Hydration successful.');
            useFlashcardStore.setState(produce((draft: FlashcardState) => {
                draft.isLoading = false;
                draft.error = null;
                draft.pendingOperations = {};
                draft.currentDeckId = null;
                draft.studyProgress = null;
                draft.sessionJustCompletedDeckId = null;

                draft.decks = (hydratedState.decks || []).map(d => ({...d, createdAt: String(d.createdAt), updatedAt: String(d.updatedAt)}));
                draft.flashcards = (hydratedState.flashcards || []).map(f => ({
                    ...f, 
                    createdAt: Number(f.createdAt), 
                    updatedAt: Number(f.updatedAt), 
                    dueDate: Number(f.dueDate),
                    lastReviewed: f.lastReviewed ? Number(f.lastReviewed) : null,
                    isBookmarked: f.isBookmarked || false,
                    contentType: f.contentType as ContentType || 'text',
                }));
            }));
          } else {
             console.log('[FlashcardStore] Hydration complete, but no persisted state found. Initializing defaults.');
             useFlashcardStore.setState({
                isLoading: false, 
                error: null, 
                pendingOperations: {}, 
                currentDeckId: null, 
                studyProgress: null, 
                sessionJustCompletedDeckId: null,
                decks: [], 
                flashcards: [] 
            });
          }
        };
      },
    }
  )
);

let hydrationDone = false;
const unsubHydration = useFlashcardStore.persist.onFinishHydration(() => {
  if (!hydrationDone) {
    hydrationDone = true; 
    const state = useFlashcardStore.getState();
    
    console.log('[FlashcardStore] onFinishHydration triggered.');

    const flashcardsNeedNormalization = state.flashcards.some(
        (card: Flashcard) => typeof card.isBookmarked === 'undefined' || 
                             typeof card.createdAt !== 'number' || 
                             typeof card.updatedAt !== 'number' ||
                             typeof card.dueDate !== 'number' ||
                             (card.lastReviewed !== null && typeof card.lastReviewed !== 'number') ||
                             !['text', 'image', 'audio', 'video', 'mixed', 'equation'].includes(card.contentType)
    );
    const decksNeedNormalization = state.decks.some(
        (deck: Deck) => typeof deck.createdAt !== 'string' || typeof deck.updatedAt !== 'string'
    );

    if (flashcardsNeedNormalization || decksNeedNormalization) {
        useFlashcardStore.setState(produce((draft: FlashcardState) => {
            draft.flashcards.forEach(card => {
                card.isBookmarked = card.isBookmarked || false;
                card.createdAt = Number(card.createdAt);
                card.updatedAt = Number(card.updatedAt);
                card.dueDate = Number(card.dueDate);
                card.lastReviewed = card.lastReviewed ? Number(card.lastReviewed) : null;
                if (!['text', 'image', 'audio', 'video', 'mixed', 'equation'].includes(card.contentType)) {
                    card.contentType = 'text';
                }
            });
            draft.decks.forEach(deck => {
                deck.createdAt = String(deck.createdAt);
                deck.updatedAt = String(deck.updatedAt);
            });
        }), true); 
        console.log('[FlashcardStore] Post-hydration data normalization applied via onFinishHydration.');
    }

    if ((!state.decks || state.decks.length === 0) && (!state.flashcards || state.flashcards.length === 0)) {
      console.log("[FlashcardStore] Persisted state is empty post-hydration. Initializing with mocks.");
      useFlashcardStore.getState().initializeStoreWithMocks();
    }
    unsubHydration(); 
  }
});

useFlashcardStore.setState({
    isLoading: false, 
    error: null, 
    pendingOperations: {}, 
    currentDeckId: null,
    studyProgress: null,
    sessionJustCompletedDeckId: null,
});