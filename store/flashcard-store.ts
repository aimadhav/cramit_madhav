import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Flashcard, Deck, DifficultyRating, StudyProgress, ContentType } from '@/types';
import { mockFlashcards } from '@/mocks/flashcards';
import { mockDecks } from '@/mocks/decks';
import { calculateNextReview, getDueCards } from '@/utils/spaced-repetition';
import { produce } from 'immer';
import { trpcClient } from '@/lib/trpc';

interface PendingOperation {
  type: 'add' | 'update' | 'delete';
  status: 'optimistic' | 'pendingRealId' | 'pendingDependency' | 'creation_failed' | 'update_failed' | 'delete_failed';
  itemType: 'deck' | 'flashcard';
  data: any; 
  originalData?: any; 
  timestamp: number;
  operationSubType?: 'rateCard' | 'updateContent' | 'toggleBookmark';
  waitsForTempId?: string; 
  waitsForItemType?: 'deck' | 'flashcard';
  error?: string;
}

let currentSessionCardQueue: string[] = [];

interface StoreDeck extends Deck {
  areCardsLoaded?: boolean;
}

interface LocalUserFlashcardStatus {
  flashcardId: string;
  interval?: number;
  easeFactor?: number;
  repetitions?: number;
  dueDate?: string | Date | number;
  lastReviewed?: string | Date | number | null;
  isBookmarked?: boolean;
  updatedAt?: string | Date | number;
}

interface FetchedFlashcardData {
  id: string;
  deckId: string;
  front: string;
  back: string;
  contentType?: ContentType | string;
  mediaUrls?: string[];
  tags?: string[];
  createdAt: string | Date | number;
  updatedAt: string | Date | number;
  userStatus?: Partial<LocalUserFlashcardStatus>;
}

interface ListByDeckResponse {
  items: FetchedFlashcardData[];
  userStatuses?: LocalUserFlashcardStatus[];
  nextCursor?: string;
}

interface FlashcardState {
  decks: StoreDeck[];
  flashcards: Flashcard[];
  currentDeckId: string | null;
  studyProgress: StudyProgress | null; 
  isLoading: boolean;
  error: string | null;
  sessionJustCompletedDeckId: string | null; 
  pendingOperations: {
    [key: string]: PendingOperation;
  };
  tempIdToRealIdMap?: { [tempId: string]: string };
  loadingFlashcardsForDeckId: string | null;
  
  addDeck: (deck: Omit<Deck, 'id' | 'createdAt' | 'updatedAt' | 'cardCount' | 'userId'>, tempId: string) => Promise<string>;
  updateDeck: (id: string, deckData: Partial<Omit<Deck, 'id' | 'createdAt' | 'updatedAt' | 'cardCount' | 'userId'>>) => Promise<void>;
  deleteDeck: (id: string) => Promise<void>;
  setCurrentDeck: (deckId: string | null) => void;
  fetchFlashcardsForDeck: (deckId: string) => Promise<void>; 
  
  addFlashcard: (card: Omit<Flashcard, 'id' | 'createdAt' | 'updatedAt' | 'interval' | 'easeFactor' | 'repetitions' | 'dueDate' | 'lastReviewed' | 'isBookmarked'>) => Promise<string>;
  updateFlashcard: (id: string, cardData: Partial<Omit<Flashcard, 'id' | 'createdAt' | 'updatedAt' | 'deckId' | 'interval' | 'easeFactor' | 'repetitions' | 'dueDate' | 'lastReviewed'>>) => Promise<void>;
  deleteFlashcard: (id: string) => Promise<void>;
  toggleBookmark: (cardId: string) => Promise<void>;
  
  startStudySession: (deckId: string) => void;
  rateCard: (cardId: string, rating: DifficultyRating) => Promise<void>;
  endStudySession: () => void;
  
  getFlashcardsForDeck: (deckId: string) => Flashcard[];
  getDueFlashcardsForDeck: (deckId: string) => Flashcard[];
  getCurrentCard: () => Flashcard | null;
  getNextCard: () => Flashcard | null;
  
  loadInitialData: (decks: Deck[], flashcards: Flashcard[]) => void;
  getTotalCardsStudied: () => number;
  getAverageEaseFactor: () => number;
  getDeckCompletionRate: (deckId: string) => number;
  getStreak: () => number;
  resetAllProgress: () => void;
  initializeStoreWithMocks: () => void;
  markSessionAsCompleted: (deckId: string) => void;
  clearSessionJustCompleted: () => void;
  _processPendingOperationsForItem: (tempParentId: string, realParentId: string, parentItemType: 'deck' | 'flashcard') => Promise<void>;
  clearTempIdMapping: (tempId: string) => void;
  setDecks: (decks: StoreDeck[]) => void;
}

async function executePendingUpdateOperation(pendingOp: any, storeMethods: { set: any, get: any, trpcClient: any }) {
  const { data, originalData, type } = pendingOp;
  const { set, get, trpcClient } = storeMethods;

  if (type === 'update' && pendingOp.itemType === 'flashcard' && pendingOp.operationSubType === 'rateCard') {
    console.log(`[FlashcardStore] executePendingUpdateOperation: Processing deferred rating for ${data.id}`);
    try {
      const backendSrsData = {
        flashcardId: data.id,
        interval: data.interval,
        easeFactor: data.easeFactor,
        repetitions: data.repetitions,
        dueDate: new Date(data.dueDate).toISOString(),
        lastReviewed: data.lastReviewed ? new Date(data.lastReviewed).toISOString() : undefined,
      };
      const updatedStatus = await trpcClient.flashcards.updateUserStatus.mutate(backendSrsData);
      
      set(produce((state: FlashcardState) => {
        const cardIndex = state.flashcards.findIndex((c: Flashcard) => c.id === data.id);
        if (cardIndex !== -1) {
            state.flashcards[cardIndex].updatedAt = updatedStatus.updatedAt ? new Date(updatedStatus.updatedAt).getTime() : data.updatedAt;
        }
      }));
    } catch (error: any) {
      console.error(`[FlashcardStore] Error in deferred rating for ${data.id}:`, error);
      set(produce((state: FlashcardState) => {
        const cardIndex = state.flashcards.findIndex((c: Flashcard) => c.id === data.id);
        if (cardIndex !== -1 && originalData) {
            state.flashcards[cardIndex] = originalData as Flashcard;
        }
        state.error = error.message || "Failed to sync deferred card rating";
      }));
    }
  }
}

const storeImplementation = (set: any, get: any): FlashcardState => ({
    decks: [],
    flashcards: [],
    currentDeckId: null,
    studyProgress: null,
    isLoading: false,
    error: null,
    sessionJustCompletedDeckId: null,
    pendingOperations: {},
    tempIdToRealIdMap: {},
    loadingFlashcardsForDeckId: null,
      
    initializeStoreWithMocks: () => {
      console.log("[FlashcardStore] initializeStoreWithMocks called.");
      const now = Date.now();
      const initializedDecks = mockDecks.map(deck => ({
        ...deck,
        createdAt: new Date(deck.createdAt).toISOString(), 
        updatedAt: new Date(deck.updatedAt).toISOString(),
        cardCount: mockFlashcards.filter((fc: Flashcard) => fc.deckId === deck.id).length,
        areCardsLoaded: false,
      }));
      const initializedFlashcards = mockFlashcards.map(card => ({
        ...card,
        createdAt: new Date(card.createdAt).getTime(),
        updatedAt: new Date(card.updatedAt).getTime(),
        dueDate: new Date(card.dueDate).getTime(),
        lastReviewed: card.lastReviewed ? new Date(card.lastReviewed).getTime() : null,
      }));
      set({
        decks: initializedDecks,
        flashcards: initializedFlashcards,
        isLoading: false,
        error: null,
        pendingOperations: {},
      });
      console.log("[FlashcardStore] Store initialized with mock data.");
    },

    loadInitialData: (decks, flashcards) => {
      const now = Date.now();
      // Preserve existing loaded states
      const existingLoadedDecks = new Map(
        get().decks
          .filter((d: StoreDeck) => d.areCardsLoaded)
          .map((d: StoreDeck) => [d.id, { areCardsLoaded: d.areCardsLoaded, cardCount: d.cardCount } as { areCardsLoaded: boolean, cardCount: number }])
      );

      const normalizedDecks: StoreDeck[] = decks.map(deck => {
        const existingState = existingLoadedDecks.get(deck.id);
        if (existingState) {
          return {
            ...deck,
            createdAt: deck.createdAt ? new Date(deck.createdAt).toISOString() : new Date(now).toISOString(),
            updatedAt: deck.updatedAt ? new Date(deck.updatedAt).toISOString() : new Date(now).toISOString(),
            areCardsLoaded: existingState.areCardsLoaded,
            cardCount: existingState.cardCount
          };
        }
        return {
          ...deck,
          createdAt: deck.createdAt ? new Date(deck.createdAt).toISOString() : new Date(now).toISOString(),
          updatedAt: deck.updatedAt ? new Date(deck.updatedAt).toISOString() : new Date(now).toISOString(),
          areCardsLoaded: flashcards.some((fc: Flashcard) => fc.deckId === deck.id),
        };
      });

      const normalizedFlashcards = flashcards.map(card => ({
        ...card,
        createdAt: card.createdAt ? new Date(card.createdAt).getTime() : now,
        updatedAt: card.updatedAt ? new Date(card.updatedAt).getTime() : now,
        dueDate: card.dueDate ? new Date(card.dueDate).getTime() : now,
        lastReviewed: card.lastReviewed ? new Date(card.lastReviewed).getTime() : null,
        isBookmarked: card.isBookmarked ?? false,
        contentType: card.contentType ?? 'text',
        interval: card.interval ?? 1,
        easeFactor: card.easeFactor ?? 2.5,
        repetitions: card.repetitions ?? 0,
      }));

      set(produce((state: FlashcardState) => {
        state.decks = normalizedDecks;
        // Only update flashcards if new ones are provided
        if (flashcards.length > 0) {
          state.flashcards = normalizedFlashcards;
        }
        state.isLoading = false;
        state.error = null;
        state.pendingOperations = {};
      }));
    },

    addDeck: async (deckData, tempId) => {
      const optimisticDeck: StoreDeck = {
        ...deckData,
        id: tempId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cardCount: 0,
        userId: 'temp-user-id',
        areCardsLoaded: false,
      };

      set(produce((state: FlashcardState) => {
        state.decks.push(optimisticDeck);
        state.isLoading = true;
        state.error = null;
        state.pendingOperations[tempId] = {
          type: 'add',
          status: 'optimistic',
          itemType: 'deck',
          data: optimisticDeck,
          timestamp: Date.now(),
          originalData: undefined,
          operationSubType: undefined,
          waitsForTempId: undefined,
          waitsForItemType: undefined,
        };
      })); 
      
      try {
        let finalCoverImageForBackend: string | undefined = undefined;

        if (deckData.coverImage && typeof deckData.coverImage === 'string' && deckData.coverImage.trim() !== '') {
          if (!deckData.coverImage.startsWith('http')) {
            finalCoverImageForBackend = 'https://via.placeholder.com/300x200.png?text=CramItDeck'; 
          } else {
            finalCoverImageForBackend = deckData.coverImage;
          }
        }

        const payload = {
          ...deckData,
          description: deckData.description == null ? undefined : deckData.description,
          price: deckData.price == null ? undefined : deckData.price,
          coverImage: finalCoverImageForBackend,
          subject: deckData.subject == null ? undefined : deckData.subject,
          chapter: deckData.chapter == null ? undefined : deckData.chapter,
        };
        const newDeckFromBackend = await trpcClient.deck.create.mutate(payload);
        set(produce((state: FlashcardState) => {
          const deckIndex = state.decks.findIndex((d: StoreDeck) => d.id === tempId);
          if (deckIndex !== -1) {
            state.decks[deckIndex] = {
              ...newDeckFromBackend,
              cardCount: 0,
              createdAt: newDeckFromBackend.createdAt ? String(newDeckFromBackend.createdAt) : new Date().toISOString(), 
              updatedAt: newDeckFromBackend.updatedAt ? String(newDeckFromBackend.updatedAt) : new Date().toISOString(),
              areCardsLoaded: false,
            };
          }
          if (!state.tempIdToRealIdMap) {
            state.tempIdToRealIdMap = {};
          }
          state.tempIdToRealIdMap[tempId] = newDeckFromBackend.id;
          
          delete state.pendingOperations[tempId];
          state.isLoading = false;
        }));
        await get()._processPendingOperationsForItem(tempId, newDeckFromBackend.id, 'deck');
        return newDeckFromBackend.id;
      } catch (error: any) {
        console.error(`[FlashcardStore] Error during addDeck backend operation for tempId ${tempId}:`, error);
        set(produce((state: FlashcardState) => {
          if (state.pendingOperations[tempId]) {
            state.pendingOperations[tempId].status = 'creation_failed'; 
            state.pendingOperations[tempId].error = error.message || 'Unknown TRPC error';
            console.warn(`[FlashcardStore] Deck ${tempId} remains optimistic due to backend failure.`);
          } else {
            state.decks = state.decks.filter((d: StoreDeck) => d.id !== tempId);
            console.error(`[FlashcardStore] Pending operation for ${tempId} not found during error handling. Rolling back optimistic add.`);
          }
          state.isLoading = false;
        }));
        throw error; 
      }
    },

    updateDeck: async (id, deckUpdateData) => {
      const originalDeck = get().decks.find((d: StoreDeck) => d.id === id);
      if (!originalDeck) {
        throw new Error("Deck not found for update.");
      }

      const optimisticDeck: StoreDeck = {
        ...originalDeck,
        ...deckUpdateData,
        updatedAt: new Date().toISOString(),
      };

      set(produce((state: FlashcardState) => {
        const deckIndex = state.decks.findIndex((d: StoreDeck) => d.id === id);
        if (deckIndex !== -1) {
          state.decks[deckIndex] = optimisticDeck;
        }
        state.isLoading = true;
        state.error = null;
        state.pendingOperations[id] = {
          type: 'update',
          status: 'optimistic',
          itemType: 'deck',
          data: optimisticDeck,
          originalData: originalDeck,
          timestamp: Date.now(),
          operationSubType: undefined,
          waitsForTempId: undefined,
          waitsForItemType: undefined,
        };
      }));

      try {
        const payload = {
            ...deckUpdateData,
            id,
            description: deckUpdateData.description === null ? undefined : deckUpdateData.description,
            coverImage: deckUpdateData.coverImage === null ? undefined : deckUpdateData.coverImage,
            subject: deckUpdateData.subject === null ? undefined : deckUpdateData.subject,
        };
        const updatedDeckFromBackend = await trpcClient.deck.update.mutate(payload as any);
        set(produce((state: FlashcardState) => {
          const deckIndex = state.decks.findIndex((d: StoreDeck) => d.id === id);
          if (deckIndex !== -1) {
             state.decks[deckIndex] = {
              ...updatedDeckFromBackend,
              cardCount: originalDeck.cardCount, 
              createdAt: String(updatedDeckFromBackend.createdAt), 
              updatedAt: String(updatedDeckFromBackend.updatedAt),
              areCardsLoaded: originalDeck.areCardsLoaded,
            };
          }
          delete state.pendingOperations[id];
          state.isLoading = false;
        }));
      } catch (error: any) {
        set(produce((state: FlashcardState) => {
          const deckIndex = state.decks.findIndex((d: StoreDeck) => d.id === id);
          if (deckIndex !== -1 && state.pendingOperations[id]?.originalData) {
            state.decks[deckIndex] = state.pendingOperations[id].originalData as StoreDeck;
          }
          delete state.pendingOperations[id];
          state.isLoading = false;
          state.error = error.message || "Failed to update deck";
        }));
        console.error("Error updating deck:", error);
        throw error;
      }
    },

    deleteDeck: async (id) => {
      const originalDeck = get().decks.find((d: StoreDeck) => d.id === id);
      const originalFlashcards = get().flashcards.filter((f: Flashcard) => f.deckId === id);
      if (!originalDeck) {
        throw new Error("Deck not found for deletion.");
      }

      set(produce((state: FlashcardState) => {
        state.decks = state.decks.filter((d: StoreDeck) => d.id !== id);
        state.flashcards = state.flashcards.filter((f: Flashcard) => f.deckId !== id);
        state.isLoading = true;
        state.error = null;
        state.pendingOperations[id] = {
          type: 'delete',
          status: 'optimistic',
          itemType: 'deck',
          data: { id },
          originalData: { deck: originalDeck, flashcards: originalFlashcards },
          timestamp: Date.now(),
          operationSubType: undefined,
          waitsForTempId: undefined,
          waitsForItemType: undefined,
        };
        if (state.currentDeckId === id) {
          state.currentDeckId = null;
          state.studyProgress = null;
        }
      }));

      try {
        await trpcClient.deck.delete.mutate({ id });
        set(produce((state: FlashcardState) => {
          delete state.pendingOperations[id];
          state.isLoading = false;
        }));
      } catch (error: any) {
        set(produce((state: FlashcardState) => {
          const op = state.pendingOperations[id];
          if (op && op.originalData) {
            state.decks.push(op.originalData.deck);
            state.flashcards.push(...op.originalData.flashcards);
          }
          delete state.pendingOperations[id];
          state.isLoading = false;
          state.error = error.message || "Failed to delete deck";
        }));
        console.error("Error deleting deck:", error);
        throw error;
      }
    },
      
    setCurrentDeck: (deckId) => {
      console.log("[FlashcardStore] setCurrentDeck called with deckId:", deckId);
      set(produce((state: FlashcardState) => {
          state.currentDeckId = deckId;
          if (!deckId) {
              state.studyProgress = null;
              currentSessionCardQueue = [];
          }
      }));
    },

    addFlashcard: async (flashcardData) => {
      let { deckId } = flashcardData;
      const tempFlashcardId = `flashcard-temp-${Date.now()}`;
      const now = Date.now();
      
      const tempIdMap = get().tempIdToRealIdMap || {};
      const isProvidedDeckIdTemporary = deckId.startsWith('deck-temp-');
      let finalDeckId = deckId;

      if (isProvidedDeckIdTemporary && tempIdMap[deckId]) {
        console.log(`[FlashcardStore] addFlashcard: Deck ID ${deckId} is temporary, but real ID ${tempIdMap[deckId]} found in map. Using real ID.`);
        finalDeckId = tempIdMap[deckId];
      }
      
      const isFinalDeckIdTemporary = finalDeckId.startsWith('deck-temp-');

      const optimisticFlashcard: Flashcard = {
        ...flashcardData,
        deckId: finalDeckId,
        id: tempFlashcardId,
        createdAt: now,
        updatedAt: now,
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0,
        dueDate: now,
        lastReviewed: null,
        isBookmarked: false,
        contentType: flashcardData.contentType || 'text',
      };
        
      set(produce((state: FlashcardState) => {
        state.flashcards.push(optimisticFlashcard);
        const deck = state.decks.find((d: StoreDeck) => d.id === finalDeckId); 
        if (deck) {
          deck.cardCount = (deck.cardCount || 0) + 1;
          deck.updatedAt = new Date().toISOString();
        }
        state.isLoading = true;
        state.error = null;
      }));

      if (isFinalDeckIdTemporary) {
        set(produce((state: FlashcardState) => {
          state.pendingOperations[`deferred-add-${tempFlashcardId}`] = {
            type: 'add',
            status: 'pendingDependency',
            itemType: 'flashcard',
            data: optimisticFlashcard, 
            originalData: undefined, 
            timestamp: Date.now(),
            operationSubType: undefined, 
            waitsForTempId: finalDeckId,
            waitsForItemType: 'deck',
          };
        }));
        console.log(`[FlashcardStore] addFlashcard for temp deck ${finalDeckId} is deferred. Flashcard tempId: ${tempFlashcardId}`);
        return tempFlashcardId; 
      } else {
        set(produce((state: FlashcardState) => {
          state.pendingOperations[tempFlashcardId] = {
            type: 'add',
            status: 'optimistic',
            itemType: 'flashcard',
            data: optimisticFlashcard,
            originalData: undefined, 
            timestamp: Date.now(),
            operationSubType: undefined, 
            waitsForTempId: undefined, 
            waitsForItemType: undefined,
          };
          state.isLoading = false;
        }));

        trpcClient.flashcards.create.mutate(
          { ...flashcardData, deckId: finalDeckId }
        )
        .then(async (newFlashcardFromBackend) => {
          const realFlashcardId = newFlashcardFromBackend.id;
          const nowForUpdate = Date.now();
          set(produce((state: FlashcardState) => {
            const cardIndex = state.flashcards.findIndex((f: Flashcard) => f.id === tempFlashcardId);
            if (cardIndex !== -1) {
              const userStatus = (newFlashcardFromBackend as any).userStatus;
              state.flashcards[cardIndex] = {
                id: realFlashcardId,
                front: newFlashcardFromBackend.front,
                back: newFlashcardFromBackend.back,
                contentType: (newFlashcardFromBackend.contentType as ContentType) || 'text',
                mediaUrls: newFlashcardFromBackend.mediaUrls || [],
                tags: newFlashcardFromBackend.tags || [],
                deckId: finalDeckId,
                createdAt: newFlashcardFromBackend.createdAt ? new Date(newFlashcardFromBackend.createdAt).getTime() : nowForUpdate,
                updatedAt: newFlashcardFromBackend.updatedAt ? new Date(newFlashcardFromBackend.updatedAt).getTime() : nowForUpdate,
                interval: userStatus?.interval ?? 1,
                easeFactor: userStatus?.easeFactor ?? 2.5,
                repetitions: userStatus?.repetitions ?? 0,
                dueDate: userStatus?.dueDate ? new Date(userStatus.dueDate).getTime() : nowForUpdate,
                lastReviewed: userStatus?.lastReviewed ? new Date(userStatus.lastReviewed).getTime() : null,
                isBookmarked: userStatus?.isBookmarked ?? false,
              };
            }
            const queueIndex = currentSessionCardQueue.indexOf(tempFlashcardId);
            if (queueIndex !== -1) {
              currentSessionCardQueue[queueIndex] = realFlashcardId;
            }
            delete state.pendingOperations[tempFlashcardId];
            state.isLoading = false;
          }));
          await get()._processPendingOperationsForItem(tempFlashcardId, realFlashcardId, 'flashcard');
        })
        .catch((error: any) => {
          console.error(`[FlashcardStore] Error adding flashcard (real deckId ${finalDeckId}, tempFlashcardId ${tempFlashcardId}) in background:`, error);
          set(produce((state: FlashcardState) => {
            state.flashcards = state.flashcards.filter((f: Flashcard) => f.id !== tempFlashcardId);
            const deck = state.decks.find((d: StoreDeck) => d.id === finalDeckId);
            if (deck) {
              deck.cardCount = Math.max(0, (deck.cardCount || 0) - 1);
            }
            if (state.pendingOperations[tempFlashcardId]) {
              state.pendingOperations[tempFlashcardId].status = 'creation_failed'; 
              state.pendingOperations[tempFlashcardId].error = error.message || 'Unknown TRPC error for flashcard creation';
            } else {
              delete state.pendingOperations[tempFlashcardId]; 
            }
            state.isLoading = false;
          }));
        });

        return tempFlashcardId;
      }
    },

    updateFlashcard: async (id, cardUpdateData) => {
      const originalCard = get().flashcards.find((f: Flashcard) => f.id === id);
      if (!originalCard) {
        throw new Error("Flashcard not found for update.");
      }

      const optimisticTimestamp = Date.now();
      const optimisticCard: Flashcard = {
        ...originalCard,
        ...cardUpdateData,
        updatedAt: optimisticTimestamp,
      };

      set(produce((state: FlashcardState) => {
        const cardIndex = state.flashcards.findIndex((f: Flashcard) => f.id === id);
        if (cardIndex !== -1) {
          state.flashcards[cardIndex] = optimisticCard;
        }
        state.isLoading = true;
        state.error = null;
        state.pendingOperations[id] = {
          type: 'update',
          status: 'optimistic',
          itemType: 'flashcard',
          data: optimisticCard,
          originalData: originalCard,
          timestamp: Date.now(),
          operationSubType: 'updateContent',
          waitsForTempId: undefined,
          waitsForItemType: undefined,
        };
      }));

      try {
        let updatedFlashcardReponse: any; 
        if (cardUpdateData.hasOwnProperty('isBookmarked') && Object.keys(cardUpdateData).length === 1) {
          updatedFlashcardReponse = await trpcClient.flashcards.updateUserStatus.mutate({
            flashcardId: id,
            isBookmarked: cardUpdateData.isBookmarked,
          });
        } else {
           updatedFlashcardReponse = await trpcClient.flashcards.updateContent.mutate({
            flashcardId: id,
            front: cardUpdateData.front,
            back: cardUpdateData.back,
            contentType: cardUpdateData.contentType as ContentType | undefined,
            mediaUrls: cardUpdateData.mediaUrls,
            tags: cardUpdateData.tags,
          });
        }

        set(produce((state: FlashcardState) => {
          const cardIndex = state.flashcards.findIndex((f: Flashcard) => f.id === id);
          if (cardIndex !== -1) {
            const cardInState = state.flashcards[cardIndex];
            if (updatedFlashcardReponse.hasOwnProperty('isBookmarked') && !updatedFlashcardReponse.hasOwnProperty('front')) { 
              cardInState.isBookmarked = updatedFlashcardReponse.isBookmarked ?? cardInState.isBookmarked;
              cardInState.updatedAt = updatedFlashcardReponse.updatedAt ? new Date(updatedFlashcardReponse.updatedAt).getTime() : optimisticTimestamp;
              if (updatedFlashcardReponse.interval !== undefined) cardInState.interval = updatedFlashcardReponse.interval;
              if (updatedFlashcardReponse.easeFactor !== undefined) cardInState.easeFactor = updatedFlashcardReponse.easeFactor;
              if (updatedFlashcardReponse.repetitions !== undefined) cardInState.repetitions = updatedFlashcardReponse.repetitions;
              if (updatedFlashcardReponse.dueDate !== undefined) cardInState.dueDate = new Date(updatedFlashcardReponse.dueDate).getTime();
              if (updatedFlashcardReponse.lastReviewed !== undefined) cardInState.lastReviewed = updatedFlashcardReponse.lastReviewed ? new Date(updatedFlashcardReponse.lastReviewed).getTime() : null;
            } else { 
              cardInState.front = updatedFlashcardReponse.front ?? cardInState.front;
              cardInState.back = updatedFlashcardReponse.back ?? cardInState.back;
              cardInState.contentType = (updatedFlashcardReponse.contentType as ContentType) ?? cardInState.contentType;
              cardInState.mediaUrls = updatedFlashcardReponse.mediaUrls ?? cardInState.mediaUrls;
              cardInState.tags = updatedFlashcardReponse.tags ?? cardInState.tags;
              cardInState.updatedAt = updatedFlashcardReponse.updatedAt ? new Date(updatedFlashcardReponse.updatedAt).getTime() : optimisticTimestamp;
              if (updatedFlashcardReponse.userStatus) {
                  cardInState.isBookmarked = updatedFlashcardReponse.userStatus.isBookmarked ?? cardInState.isBookmarked;
                  cardInState.interval = updatedFlashcardReponse.userStatus.interval ?? cardInState.interval;
                  cardInState.easeFactor = updatedFlashcardReponse.userStatus.easeFactor ?? cardInState.easeFactor;
                  cardInState.repetitions = updatedFlashcardReponse.userStatus.repetitions ?? cardInState.repetitions;
                  cardInState.dueDate = updatedFlashcardReponse.userStatus.dueDate ? new Date(updatedFlashcardReponse.userStatus.dueDate).getTime() : cardInState.dueDate;
                  cardInState.lastReviewed = updatedFlashcardReponse.userStatus.lastReviewed ? new Date(updatedFlashcardReponse.userStatus.lastReviewed).getTime() : null;
              }
            }
          }
          delete state.pendingOperations[id];
          state.isLoading = false;
        }));
      } catch (error: any) {
        set(produce((state: FlashcardState) => {
          const cardIndex = state.flashcards.findIndex((f: Flashcard) => f.id === id);
          if (cardIndex !== -1 && state.pendingOperations[id]?.originalData) {
            state.flashcards[cardIndex] = state.pendingOperations[id].originalData as Flashcard;
          }
          delete state.pendingOperations[id];
          state.isLoading = false;
          state.error = error.message || "Failed to update flashcard";
        }));
        console.error("Error updating flashcard:", error);
        throw error;
      }
    },

    deleteFlashcard: async (id) => {
      const originalCard = get().flashcards.find((f: Flashcard) => f.id === id);
      if (!originalCard) {
        throw new Error("Flashcard not found for deletion.");
      }
      const { deckId } = originalCard;

      set(produce((state: FlashcardState) => {
        state.flashcards = state.flashcards.filter((f: Flashcard) => f.id !== id);
        const deck = state.decks.find((d: StoreDeck) => d.id === deckId);
        if (deck) {
          deck.cardCount = Math.max(0, (deck.cardCount || 0) - 1);
          deck.updatedAt = new Date().toISOString();
        }
        state.isLoading = true;
        state.error = null;
        state.pendingOperations[id] = {
          type: 'delete',
          status: 'optimistic',
          itemType: 'flashcard',
          data: { id },
          originalData: originalCard,
          timestamp: Date.now(),
          operationSubType: undefined,
          waitsForTempId: undefined,
          waitsForItemType: undefined,
        };
      }));

      try {
        await trpcClient.flashcards.delete.mutate({ flashcardId: id });
        set(produce((state: FlashcardState) => {
          delete state.pendingOperations[id];
          state.isLoading = false;
        }));
      } catch (error: any) {
        set(produce((state: FlashcardState) => {
          const op = state.pendingOperations[id];
          if (op && op.originalData) {
            state.flashcards.push(op.originalData as Flashcard);
            const deck = state.decks.find((d: StoreDeck) => d.id === (op.originalData as Flashcard).deckId);
            if (deck) {
              deck.cardCount = (deck.cardCount || 0) + 1;
            }
          }
          delete state.pendingOperations[id];
          state.isLoading = false;
          state.error = error.message || "Failed to delete flashcard";
        }));
        console.error("Error deleting flashcard:", error);
        throw error;
      }
    },
    
    toggleBookmark: async (cardId: string) => {
      const card = get().flashcards.find((c: Flashcard) => c.id === cardId);
      if (!card) throw new Error("Card not found");
      return get().updateFlashcard(cardId, { isBookmarked: !card.isBookmarked });
    },

    startStudySession: (deckId) => {
      console.log("[FlashcardStore] startStudySession for deckId:", deckId);
      const allCardsForDeck = get().flashcards.filter((f: Flashcard) => f.deckId === deckId);
      const dueCards = getDueCards(allCardsForDeck).sort((a:Flashcard,b:Flashcard) => {
          if(a.dueDate !== b.dueDate) return a.dueDate - b.dueDate;
          return a.createdAt - b.createdAt;
      }); 

      currentSessionCardQueue = dueCards.map(c => c.id);
      console.log("[FlashcardStore] currentSessionCardQueue set:", currentSessionCardQueue);

      if (currentSessionCardQueue.length > 0) {
          set({ 
            currentDeckId: deckId,
              studyProgress: {
                  deckId: deckId,
                  cardsLeft: currentSessionCardQueue.length,
                  cardsStudied: 0,
                  currentCardIndex: 0,
              },
              sessionJustCompletedDeckId: null, 
          });
          console.log("[FlashcardStore] Study session started with progress:", get().studyProgress);
      } else {
          console.log("[FlashcardStore] No due cards to study in deck:", deckId);
        set({
          currentDeckId: deckId,
          studyProgress: {
                  deckId: deckId,
                  cardsLeft: 0,
                  cardsStudied: allCardsForDeck.length, 
            currentCardIndex: 0,
              },
              sessionJustCompletedDeckId: deckId, 
          });
      }
    },
    
    rateCard: async (cardId, rating) => {
      const originalCard = get().flashcards.find((c: Flashcard) => c.id === cardId);
      if(!originalCard) {
          console.error("[FlashcardStore] Card not found for rating:", cardId);
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
          const cardIndex = state.flashcards.findIndex((card: Flashcard) => card.id === cardId);
          if (cardIndex !== -1) {
              state.flashcards[cardIndex] = optimisticallyRatedCard;
          }
          state.pendingOperations[tempOpId] = {
              type: 'update',
              status: cardId.startsWith('flashcard-temp-') ? 'pendingRealId' : 'optimistic',
              itemType: 'flashcard',
              data: optimisticallyRatedCard,
              originalData: originalCard,
              timestamp: Date.now(),
              operationSubType: 'rateCard',
              waitsForTempId: undefined,
              waitsForItemType: undefined,
          };
          console.log(`[FlashcardStore] Card ${cardId} rated (optimistically).`);
      }));

      try {
        const isTempCardId = cardId.startsWith('flashcard-temp-');
        if (isTempCardId) {
          console.log(`[FlashcardStore] Rating for temporary card ${cardId} will be deferred until card is confirmed by its addFlashcard operation.`);
        } else {
          const pendingOp = get().pendingOperations[tempOpId];
          if (pendingOp) {
            await executePendingUpdateOperation(pendingOp, { set, get, trpcClient });
            set(produce((state: FlashcardState) => {
                delete state.pendingOperations[tempOpId]; 
            }));
          } else {
            console.warn(`[FlashcardStore] rateCard: Could not find pending operation for ${tempOpId} to execute immediately for real card ID ${cardId}. This shouldn't happen.`);
          }
        }
      } catch (error: any) {
        set(produce((state: FlashcardState) => {
            const cardIndex = state.flashcards.findIndex((card: Flashcard) => card.id === cardId);
            if (cardIndex !== -1 && originalCard) {
                state.flashcards[cardIndex] = originalCard; 
            }
            delete state.pendingOperations[tempOpId]; 
            state.error = error.message || "Failed to sync card rating";
        }));
        console.error("[FlashcardStore] Error syncing card rating:", error);
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
      return get().flashcards.filter((card: Flashcard) => card.deckId === deckId);
    },
    
    getDueFlashcardsForDeck: (deckId) => {
      const cardsInDeck = get().flashcards.filter((f: Flashcard) => f.deckId === deckId);
      return getDueCards(cardsInDeck);
    },
    
    getCurrentCard: () => {
      const { studyProgress, flashcards, currentDeckId, sessionJustCompletedDeckId } = get();
      console.log('[FlashcardStore] getCurrentCard called. studyProgress:', JSON.stringify(studyProgress), 'queueLength:', currentSessionCardQueue.length);

      if (!studyProgress || currentSessionCardQueue.length === 0 || studyProgress.currentCardIndex >= currentSessionCardQueue.length) {
        console.log('[FlashcardStore] getCurrentCard: Condition met to return null. Index:', studyProgress?.currentCardIndex, 'Queue length:', currentSessionCardQueue.length);
        if (studyProgress && studyProgress.cardsStudied > 0 && studyProgress.cardsLeft === 0 && studyProgress.deckId) {
          if (sessionJustCompletedDeckId !== studyProgress.deckId) { 
            console.log('[FlashcardStore] getCurrentCard: Marking session as completed because no current card and session was finished.');
            get().markSessionAsCompleted(studyProgress.deckId);
          }
        }
        return null;
      }
      const currentCardId = currentSessionCardQueue[studyProgress.currentCardIndex];
      console.log('[FlashcardStore] getCurrentCard: Returning cardId:', currentCardId);
      return flashcards.find((f: Flashcard) => f.id === currentCardId) || null;
    },
    
    getNextCard: () => {
      const { studyProgress, currentDeckId } = get();
      console.log('[FlashcardStore] getNextCard called. studyProgress before update:', JSON.stringify(studyProgress), 'queueLength:', currentSessionCardQueue.length);

      if (!studyProgress || !currentDeckId) {
        console.log("[FlashcardStore] getNextCard: No study progress or currentDeckId.");
        return null;
      }
      
      const currentIdx = studyProgress.currentCardIndex;
      const queueLength = currentSessionCardQueue.length;

      if (currentIdx < queueLength - 1) {
        const newIndex = currentIdx + 1;
        console.log(`[FlashcardStore] getNextCard: Advancing to index ${newIndex} in queue of length ${queueLength}`);
        set(produce((state: FlashcardState) => {
          if (state.studyProgress) {
            state.studyProgress.currentCardIndex = newIndex;
            state.studyProgress.cardsStudied += 1;
            state.studyProgress.cardsLeft -=1;
            console.log('[FlashcardStore] getNextCard: studyProgress after update (advancing):', JSON.stringify(state.studyProgress));
          }
        }));
        const nextCardId = currentSessionCardQueue[newIndex];
        return get().flashcards.find((f: Flashcard) => f.id === nextCardId) || null;
      } else {
        console.log(`[FlashcardStore] getNextCard: Reached end of queue. Current index: ${currentIdx}, Queue length: ${queueLength}`);
        set(produce((state: FlashcardState) => {
          if (state.studyProgress) {
            state.studyProgress.cardsStudied += 1;
            state.studyProgress.cardsLeft = 0;
            state.studyProgress.currentCardIndex = queueLength; 
            console.log('[FlashcardStore] getNextCard: studyProgress after update (end of queue):', JSON.stringify(state.studyProgress));
          }
        }));
        if (currentDeckId) {
          console.log('[FlashcardStore] getNextCard: Marking session as completed because end of queue reached.');
          get().markSessionAsCompleted(currentDeckId!);
        }
        return null;
      }
    },
      
    getTotalCardsStudied: () => {
      return get().flashcards.filter((card: Flashcard) => card.repetitions > 0).length;
    },
      
    getAverageEaseFactor: () => {
      const reviewedCards = get().flashcards.filter((card: Flashcard) => card.repetitions > 0);
      if (reviewedCards.length === 0) return 2.5;
      const totalEase = reviewedCards.reduce((sum: number, card: Flashcard) => sum + card.easeFactor, 0);
      return totalEase / reviewedCards.length;
    },
      
    getDeckCompletionRate: (deckId) => {
      const deckCards = get().flashcards.filter((f: Flashcard) => f.deckId === deckId);
      if (deckCards.length === 0) return 0;
      const completedCards = deckCards.filter((f: Flashcard) => f.interval > 21); 
      return (completedCards.length / deckCards.length) * 100;
    },
      
    getStreak: () => {
      return 0;
    },
      
    resetAllProgress: () => {
      const currentTimestamp = Date.now();
      set(produce((state: FlashcardState) => {
      state.flashcards.forEach((card: Flashcard) => {
          card.interval = 1;
          card.easeFactor = 2.5;
          card.repetitions = 0;
        card.dueDate = currentTimestamp; 
          card.lastReviewed = null;
        card.updatedAt = currentTimestamp; 
        });
      state.studyProgress = null;
      state.currentDeckId = null;
      currentSessionCardQueue = [];
      state.sessionJustCompletedDeckId = null;
      }));
      console.log("[FlashcardStore] All flashcard progress has been reset.");
    },
      
    markSessionAsCompleted: (deckId: string) => {
      console.log(`[FlashcardStore] markSessionAsCompleted for deck: ${deckId}`);
      set({ sessionJustCompletedDeckId: deckId });
    },

    clearSessionJustCompleted: () => {
      console.log('[FlashcardStore] clearSessionJustCompleted');
      set({ sessionJustCompletedDeckId: null });
    },

    clearTempIdMapping: (tempId: string) => {
      set(produce((state: FlashcardState) => {
        if (state.tempIdToRealIdMap && state.tempIdToRealIdMap[tempId]) {
          delete state.tempIdToRealIdMap[tempId];
          console.log(`[FlashcardStore] Cleared tempId mapping for ${tempId}`);
        } else {
          console.warn(`[FlashcardStore] clearTempIdMapping: No mapping found for tempId ${tempId}`);
        }
      }));
    },

    _processPendingOperationsForItem: async (tempParentId, realParentId, parentItemType) => {
      console.log(`[FlashcardStore] _processPendingOperationsForItem called for parent ${parentItemType}: ${tempParentId} -> ${realParentId}`);
      const pendingOps = { ...get().pendingOperations };
      let processedOpKeys: string[] = [];

      for (const opKey in pendingOps) {
        if (processedOpKeys.includes(opKey)) continue;

        const op = pendingOps[opKey];

        if ((op.type === 'update' || op.type === 'delete') && op.status === 'pendingRealId' && 
            op.data?.id === tempParentId && op.itemType === parentItemType) {
          
          console.log(`[FlashcardStore] Processing '${op.type}' (pendingRealId) operation ${opKey} for item ${realParentId}`);
          const operationDataWithRealId = { ...op.data, id: realParentId };
          const operationToExecute = { ...op, data: operationDataWithRealId };

          try {
            if (op.type === 'update' && op.itemType === 'flashcard' && op.operationSubType === 'rateCard') {
              await executePendingUpdateOperation(operationToExecute, { set, get, trpcClient });
            } else if (op.type === 'update' && op.itemType === 'flashcard') {
               console.warn("[FlashcardStore] Generic deferred flashcard content update not yet implemented in _processPendingOperationsForItem");
            } else if (op.type === 'update' && op.itemType === 'deck') {
               console.warn("[FlashcardStore] Generic deferred deck update not yet implemented in _processPendingOperationsForItem");
            }

            set(produce((state: FlashcardState) => {
              delete state.pendingOperations[opKey];
            }));
            processedOpKeys.push(opKey);
          } catch (error) {
            console.error(`[FlashcardStore] Error executing deferred ${op.type} op ${opKey} for ${realParentId}:`, error);
          }
        }
        else if (op.type === 'add' && op.status === 'pendingDependency' && 
                 op.waitsForTempId === tempParentId && op.waitsForItemType === parentItemType) {
          
          console.log(`[FlashcardStore] Processing deferred dependent 'add' operation ${opKey} (itemType: ${op.itemType}) for parent ${realParentId}`);
          
          const optimisticChildDataWithTempId = op.data;
          const tempChildId = optimisticChildDataWithTempId.id;

          let backendPayload;
          if (op.itemType === 'flashcard') {
            backendPayload = { ...optimisticChildDataWithTempId, deckId: realParentId };
            delete backendPayload.id;
          } else {
            console.error("[FlashcardStore] Deferred add for unexpected itemType:", op.itemType);
            continue;
          }

          try {
            let newChildFromBackend: any;
            if (op.itemType === 'flashcard') {
              newChildFromBackend = await trpcClient.flashcards.create.mutate(backendPayload as any);
            }

            if (newChildFromBackend) {
              const realChildId = newChildFromBackend.id;
              console.log(`[FlashcardStore] Dependent ${op.itemType} ${tempChildId} created successfully with real ID ${realChildId}`);

              set(produce((state: FlashcardState) => {
                if (op.itemType === 'flashcard') {
                  const cardIndex = state.flashcards.findIndex((f: Flashcard) => f.id === tempChildId);
                  if (cardIndex !== -1) {
                    const userStatus = (newChildFromBackend as any).userStatus;
                    state.flashcards[cardIndex] = {
                      id: realChildId,
                      front: newChildFromBackend.front,
                      back: newChildFromBackend.back,
                      contentType: (newChildFromBackend.contentType as ContentType) || 'text',
                      mediaUrls: newChildFromBackend.mediaUrls || [],
                      tags: newChildFromBackend.tags || [],
                      deckId: realParentId,
                      createdAt: newChildFromBackend.createdAt ? new Date(newChildFromBackend.createdAt).getTime() : Date.now(),
                      updatedAt: newChildFromBackend.updatedAt ? new Date(newChildFromBackend.updatedAt).getTime() : Date.now(),
                      interval: userStatus?.interval ?? 1,
                      easeFactor: userStatus?.easeFactor ?? 2.5,
                      repetitions: userStatus?.repetitions ?? 0,
                      dueDate: userStatus?.dueDate ? new Date(userStatus.dueDate).getTime() : Date.now(),
                      lastReviewed: userStatus?.lastReviewed ? new Date(userStatus.lastReviewed).getTime() : null,
                      isBookmarked: userStatus?.isBookmarked ?? false,
                    };
                  }
                  const queueIndex = currentSessionCardQueue.indexOf(tempChildId);
                  if (queueIndex !== -1) currentSessionCardQueue[queueIndex] = realChildId;
                }
                delete state.pendingOperations[opKey];
              }));
              processedOpKeys.push(opKey);

              await get()._processPendingOperationsForItem(tempChildId, realChildId, op.itemType);

            } else {
              throw new Error(`Backend creation for deferred ${op.itemType} did not return an object.`);
            }

          } catch (error) {
            console.error(`[FlashcardStore] Error processing deferred 'add' for ${op.itemType} ${tempChildId} (opKey: ${opKey}):`, error);
            set(produce((state: FlashcardState) => {
              if (op.itemType === 'flashcard') {
                state.flashcards = state.flashcards.filter(f => f.id !== tempChildId);
                const parentDeck = state.decks.find(d => d.id === realParentId);
                if (parentDeck) parentDeck.cardCount = Math.max(0, (parentDeck.cardCount || 0) - 1);
              }
              delete state.pendingOperations[opKey];
              state.error = `Failed to add dependent ${op.itemType}`;
            }));
            processedOpKeys.push(opKey);
          }
        }
      }
    },

    fetchFlashcardsForDeck: async (deckId: string) => {
      console.log(`[FlashcardStore] Fetching flashcards for deck: ${deckId}`);
      console.log('[FlashcardStore] Current store state before fetch:', {
        totalFlashcards: get().flashcards.length,
        deckFlashcards: get().flashcards.filter(f => f.deckId === deckId).length,
        isDeckLoaded: get().decks.find(d => d.id === deckId)?.areCardsLoaded
      });

      set(produce((state: FlashcardState) => {
        state.loadingFlashcardsForDeckId = deckId;
        state.error = null;
      }));

      let currentDeckId = deckId;
      if (currentDeckId.startsWith('deck-temp-')) {
        console.log(`[FlashcardStore] Detected temporary ID: ${currentDeckId}. Waiting for real ID.`);
        const maxAttempts = 30;
        let attempt = 0;
        let realId = get().tempIdToRealIdMap?.[currentDeckId];

        while (!realId && attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
          realId = get().tempIdToRealIdMap?.[currentDeckId];
          attempt++;
          if (!realId) {
             console.log(`[FlashcardStore] Waiting for real ID for ${deckId}, attempt ${attempt}. Real ID not yet found.`);
          }
        }

        if (realId) {
          console.log(`[FlashcardStore] Real ID found for ${deckId}: ${realId}. Proceeding with fetch.`);
          currentDeckId = realId;
          set(produce((state: FlashcardState) => {
             if(state.loadingFlashcardsForDeckId === deckId) {
                state.loadingFlashcardsForDeckId = realId;
             }
          }));
        } else {
          console.error(`[FlashcardStore] Timed out waiting for real ID for temporary deck ID: ${deckId}`);
          set(produce((state: FlashcardState) => {
            state.loadingFlashcardsForDeckId = null;
            state.error = `Could not load deck. Temporary ID ${deckId} was not resolved to a real ID after ${maxAttempts} attempts.`;
          }));
          return;
        }
      }

      try {
        set(produce((state: FlashcardState) => {
             if(!state.loadingFlashcardsForDeckId) {
                state.loadingFlashcardsForDeckId = currentDeckId;
             }
          }));

        const response = await trpcClient.flashcards.listByDeck.query({ deckId: currentDeckId }) as ListByDeckResponse;
        const fetchedCards = response.items;
        const userStatuses = response.userStatuses || [];
        console.log(`[FlashcardStore] Fetched ${fetchedCards.length} cards from server for deck ${currentDeckId}`);

        set(produce((state: FlashcardState) => {
          const now = Date.now();
          const normalizedFetchedFlashcards: Flashcard[] = fetchedCards.map((fc: FetchedFlashcardData): Flashcard => {
            const userStatus: LocalUserFlashcardStatus | undefined = userStatuses.find((us: LocalUserFlashcardStatus) => us.flashcardId === fc.id);
            return {
              id: fc.id,
              deckId: fc.deckId,
              front: fc.front,
              back: fc.back,
              contentType: (fc.contentType as ContentType) ?? 'text',
              mediaUrls: fc.mediaUrls ?? [],
              tags: fc.tags ?? [],
              createdAt: fc.createdAt ? new Date(fc.createdAt).getTime() : now,
              updatedAt: fc.updatedAt ? new Date(fc.updatedAt).getTime() : now,
              interval: userStatus?.interval ?? 1,
              easeFactor: userStatus?.easeFactor ?? 2.5,
              repetitions: userStatus?.repetitions ?? 0,
              dueDate: userStatus?.dueDate ? new Date(userStatus.dueDate).getTime() : now,
              lastReviewed: userStatus?.lastReviewed ? new Date(userStatus.lastReviewed).getTime() : null,
              isBookmarked: userStatus?.isBookmarked ?? false,
            };
          });

          const existingFlashcardIds = new Set(state.flashcards.map(f => f.id));
          const newFlashcardsToMerge = normalizedFetchedFlashcards.filter((fc: Flashcard) => !existingFlashcardIds.has(fc.id));
          
          console.log('[FlashcardStore] Merging flashcards:', {
            existingCount: state.flashcards.length,
            newCardsCount: newFlashcardsToMerge.length,
            duplicateCount: normalizedFetchedFlashcards.length - newFlashcardsToMerge.length
          });

          state.flashcards.push(...newFlashcardsToMerge);

          const deckIndexToUpdate = state.decks.findIndex((d: StoreDeck) => d.id === currentDeckId);
          if (deckIndexToUpdate !== -1) {
            state.decks[deckIndexToUpdate].cardCount = state.flashcards.filter((fc: Flashcard) => fc.deckId === currentDeckId).length;
            state.decks[deckIndexToUpdate].areCardsLoaded = true;
            console.log(`[FlashcardStore] Updated deck ${currentDeckId} status:`, {
              cardCount: state.decks[deckIndexToUpdate].cardCount,
              areCardsLoaded: state.decks[deckIndexToUpdate].areCardsLoaded
            });
          }

          state.loadingFlashcardsForDeckId = null;
          state.error = null;
        }));

      } catch (e: any) {
        console.error(`[FlashcardStore] Error fetching flashcards for deck ${currentDeckId}:`, e);
        set(produce((state: FlashcardState) => {
          state.loadingFlashcardsForDeckId = null;
          state.error = e.message || `Failed to fetch flashcards for deck ${currentDeckId}`;
        }));
      }
    },

    setDecks: (decks: StoreDeck[]) => {
      set((state: FlashcardState) => {
        // Preserve existing flashcards and loaded states
        const existingFlashcards = state.flashcards;
        const existingLoadedDecks = new Map(
          state.decks
            .filter((d: StoreDeck) => d.areCardsLoaded)
            .map((d: StoreDeck) => [d.id, { areCardsLoaded: d.areCardsLoaded, cardCount: d.cardCount }])
        );

        // Update decks while preserving loaded states
        const updatedDecks = decks.map(deck => {
          const existingState = existingLoadedDecks.get(deck.id);
          if (existingState) {
            return {
              ...deck,
              areCardsLoaded: existingState.areCardsLoaded,
              cardCount: existingState.cardCount
            };
          }
          return deck;
        });

        console.log('[FlashcardStore] Updating decks while preserving loaded states:', {
          newDeckCount: updatedDecks.length,
          preservedFlashcards: existingFlashcards.length,
          preservedLoadedDecks: Array.from(existingLoadedDecks.keys())
        });

        return {
          ...state,
          decks: updatedDecks,
          flashcards: existingFlashcards
        };
      });
    },
});

export const useFlashcardStore = create<FlashcardState>()(
  persist(
    storeImplementation,
    {
      name: 'flashcard-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => {
        console.log('[FlashcardStore] Persisting state to AsyncStorage:', {
          decksCount: state.decks.length,
          flashcardsCount: state.flashcards.length,
          loadedDecks: state.decks.filter((d: StoreDeck) => d.areCardsLoaded).map((d: StoreDeck) => ({ id: d.id, name: d.name }))
        });
        return {
          decks: state.decks,
          flashcards: state.flashcards,
        };
      },
      onRehydrateStorage: () => (state) => {
        console.log('[FlashcardStore] Rehydrated state from AsyncStorage:', {
          decksCount: state?.decks.length,
          flashcardsCount: state?.flashcards.length,
          loadedDecks: state?.decks.filter((d: StoreDeck) => d.areCardsLoaded).map((d: StoreDeck) => ({ id: d.id, name: d.name }))
        });
        
        // Ensure loaded decks are properly marked
        if (state) {
          const loadedDeckIds = new Set(state.flashcards.map((f: Flashcard) => f.deckId));
          state.decks.forEach((deck: StoreDeck) => {
            if (loadedDeckIds.has(deck.id)) {
              deck.areCardsLoaded = true;
              deck.cardCount = state.flashcards.filter((f: Flashcard) => f.deckId === deck.id).length;
            }
          });
          console.log('[FlashcardStore] Updated deck loading states after rehydration:', {
            loadedDecks: state.decks.filter((d: StoreDeck) => d.areCardsLoaded).map((d: StoreDeck) => ({ id: d.id, name: d.name, cardCount: d.cardCount }))
          });
        }
      }
    }
  )
);