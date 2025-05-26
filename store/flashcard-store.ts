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
  // status: 'optimistic' for an operation that is proceeding (backend call made or about to be made for its own item),
  // 'pendingRealId' for an update/delete on an item that itself has a tempId and is waiting for that item's realId confirmation.
  // 'pendingDependency' for an 'add' operation of a child item that is waiting for its parent's realId.
  status: 'optimistic' | 'pendingRealId' | 'pendingDependency'; 
  itemType: 'deck' | 'flashcard';
  data: any; // For 'add', this is the creation DTO. For 'update', this is the optimistic object.
  originalData?: any; // For rollback of updates/deletes
  timestamp: number;
  operationSubType?: 'rateCard' | 'updateContent' | 'toggleBookmark';
  
  // For operations dependent on another item's real ID (status: 'pendingDependency')
  waitsForTempId?: string; 
  waitsForItemType?: 'deck' | 'flashcard';
}

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
    [key: string]: PendingOperation;
  };
  tempIdToRealIdMap?: { [tempId: string]: string }; // Made optional for initial state
  
  // Deck actions
  addDeck: (deck: Omit<Deck, 'id' | 'createdAt' | 'updatedAt' | 'cardCount' | 'userId'>, tempId: string) => Promise<string>;
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
  _processPendingOperationsForItem: (tempParentId: string, realParentId: string, parentItemType: 'deck' | 'flashcard') => Promise<void>;
  clearTempIdMapping: (tempId: string) => void;
}

// Helper function to execute a pending operation's tRPC call
// This will be defined outside or as a static part of the store if preferred,
// but for now, let's assume it can access trpcClient and 'set'/'get' if needed for error handling.
// For simplicity here, it's part of the store's context.
async function executePendingUpdateOperation(pendingOp: any, storeMethods: { set: any, get: any, trpcClient: any }) {
  const { data, originalData, type } = pendingOp;
  const { set, get, trpcClient } = storeMethods;

  if (type === 'update' && pendingOp.itemType === 'flashcard' && pendingOp.operationSubType === 'rateCard') {
    console.log(`[FlashcardStore] executePendingUpdateOperation: Processing deferred rating for ${data.id}`);
    try {
      const backendSrsData = {
        flashcardId: data.id, // Should be realId now
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
    pendingOperations: {},
    sessionJustCompletedDeckId: null,
    tempIdToRealIdMap: {},
      
    initializeStoreWithMocks: () => {
      console.log("[FlashcardStore] initializeStoreWithMocks called.");
      const now = Date.now();
      const initializedDecks = mockDecks.map(deck => ({
        ...deck,
        createdAt: new Date(deck.createdAt).toISOString(), 
        updatedAt: new Date(deck.updatedAt).toISOString(),
        cardCount: mockFlashcards.filter((fc: Flashcard) => fc.deckId === deck.id).length,
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
      const normalizedDecks = decks.map(deck => ({
          ...deck,
          createdAt: deck.createdAt ? new Date(deck.createdAt).toISOString() : new Date(now).toISOString(),
          updatedAt: deck.updatedAt ? new Date(deck.updatedAt).toISOString() : new Date(now).toISOString(),
          cardCount: flashcards.filter((fc: Flashcard) => fc.deckId === deck.id).length,
      }));
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
      set({
        decks: normalizedDecks,
        flashcards: normalizedFlashcards,
        isLoading: false,
        error: null,
        pendingOperations: {},
      });
    },

    addDeck: async (deckData, tempId) => {
      const optimisticDeck: Deck = {
        ...deckData,
        id: tempId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cardCount: 0,
        userId: 'temp-user-id',
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
            // It's a non-empty string, not a URL (local path) -> use placeholder
            finalCoverImageForBackend = 'https://via.placeholder.com/300x200.png?text=CramItDeck'; 
          } else {
            // It's a non-empty string that starts with http -> use it as is
            finalCoverImageForBackend = deckData.coverImage;
          }
        } // else, deckData.coverImage is null, undefined, empty string, or not a string -> finalCoverImageForBackend remains undefined

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
          const deckIndex = state.decks.findIndex((d: Deck) => d.id === tempId);
          if (deckIndex !== -1) {
            state.decks[deckIndex] = {
              ...newDeckFromBackend,
              cardCount: 0,
              createdAt: newDeckFromBackend.createdAt ? String(newDeckFromBackend.createdAt) : new Date().toISOString(), 
              updatedAt: newDeckFromBackend.updatedAt ? String(newDeckFromBackend.updatedAt) : new Date().toISOString(),
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
          // Keep the optimistic deck, but mark its pending operation as failed.
          if (state.pendingOperations[tempId]) {
            // @ts-ignore 
            state.pendingOperations[tempId].status = 'creation_failed'; 
            // @ts-ignore
            state.pendingOperations[tempId].error = error.message || 'Unknown TRPC error';
            console.warn(`[FlashcardStore] Deck ${tempId} remains optimistic due to backend failure.`);
          } else {
            state.decks = state.decks.filter((d: Deck) => d.id !== tempId);
            console.error(`[FlashcardStore] Pending operation for ${tempId} not found during error handling. Rolling back optimistic add.`);
          }
          state.isLoading = false;
          // Do not set global state.error here if we want the optimistic data to persist
        }));
        // Re-throw the error so the caller's .catch() block is triggered
        throw error; 
      }
    },

    updateDeck: async (id, deckUpdateData) => {
      const originalDeck = get().decks.find((d: Deck) => d.id === id);
      if (!originalDeck) {
        throw new Error("Deck not found for update.");
      }

      const optimisticDeck: Deck = {
        ...originalDeck,
        ...deckUpdateData,
        updatedAt: new Date().toISOString(),
      };

      set(produce((state: FlashcardState) => {
        const deckIndex = state.decks.findIndex((d: Deck) => d.id === id);
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
          const deckIndex = state.decks.findIndex((d: Deck) => d.id === id);
          if (deckIndex !== -1) {
             state.decks[deckIndex] = {
              ...updatedDeckFromBackend,
              cardCount: originalDeck.cardCount, 
              createdAt: String(updatedDeckFromBackend.createdAt), 
              updatedAt: String(updatedDeckFromBackend.updatedAt),
            };
          }
          delete state.pendingOperations[id];
          state.isLoading = false;
        }));
      } catch (error: any) {
        set(produce((state: FlashcardState) => {
          const deckIndex = state.decks.findIndex((d: Deck) => d.id === id);
          if (deckIndex !== -1 && state.pendingOperations[id]?.originalData) {
            state.decks[deckIndex] = state.pendingOperations[id].originalData as Deck;
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
      const originalDeck = get().decks.find((d: Deck) => d.id === id);
      const originalFlashcards = get().flashcards.filter((f: Flashcard) => f.deckId === id);
      if (!originalDeck) {
        throw new Error("Deck not found for deletion.");
      }

      set(produce((state: FlashcardState) => {
        state.decks = state.decks.filter((d: Deck) => d.id !== id);
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
      
      // Check if the provided deckId is temporary and if a realId mapping exists
      const tempIdMap = get().tempIdToRealIdMap || {};
      const isProvidedDeckIdTemporary = deckId.startsWith('deck-temp-');
      let finalDeckId = deckId;

      if (isProvidedDeckIdTemporary && tempIdMap[deckId]) {
        console.log(`[FlashcardStore] addFlashcard: Deck ID ${deckId} is temporary, but real ID ${tempIdMap[deckId]} found in map. Using real ID.`);
        finalDeckId = tempIdMap[deckId]; // Use the real deck ID
      }
      
      const isFinalDeckIdTemporary = finalDeckId.startsWith('deck-temp-'); // Re-check after potential mapping

      const optimisticFlashcard: Flashcard = {
        ...flashcardData,
        deckId: finalDeckId, // Use the finalDeckId (which might be the real one now)
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
        
      // Optimistic update to local state (always happens)
      set(produce((state: FlashcardState) => {
        state.flashcards.push(optimisticFlashcard);
        // Use finalDeckId to find the deck for cardCount update
        const deck = state.decks.find((d: Deck) => d.id === finalDeckId); 
        if (deck) {
          deck.cardCount = (deck.cardCount || 0) + 1;
          deck.updatedAt = new Date().toISOString();
        }
        state.isLoading = true;
        state.error = null;
        // Pending operation details depend on whether the deckId is temporary
      }));

      if (isFinalDeckIdTemporary) { // Check based on finalDeckId
        // Deck ID is still temporary, so this flashcard add must be deferred.
        set(produce((state: FlashcardState) => {
          state.pendingOperations[`deferred-add-${tempFlashcardId}`] = {
            type: 'add',
            status: 'pendingDependency',
            itemType: 'flashcard',
            data: optimisticFlashcard, 
            originalData: undefined, 
            timestamp: Date.now(),
            operationSubType: undefined, 
            waitsForTempId: finalDeckId, // It's waiting for this temp deck ID to become real   
            waitsForItemType: 'deck',
          };
        }));
        console.log(`[FlashcardStore] addFlashcard for temp deck ${finalDeckId} is deferred. Flashcard tempId: ${tempFlashcardId}`);
        return tempFlashcardId; 
      } else {
        // Deck ID is real, proceed with fully optimistic add and background backend call.
        set(produce((state: FlashcardState) => {
          // Ensure pending op for the flashcard itself is added before backend call
          state.pendingOperations[tempFlashcardId] = {
            type: 'add',
            status: 'optimistic',
            itemType: 'flashcard',
            data: optimisticFlashcard, // data is the optimistic card with temp ID
            originalData: undefined, 
            timestamp: Date.now(),
            operationSubType: undefined, 
            waitsForTempId: undefined, 
            waitsForItemType: undefined,
          };
          state.isLoading = false; // isLoading was set true earlier, reset if not globally managed for this
        }));

        // Perform backend operation in the background, don't await it here
        trpcClient.flashcards.create.mutate(
          { ...flashcardData, deckId: finalDeckId } // Ensure payload uses finalDeckId
        )
        .then(async (newFlashcardFromBackend) => {
          const realFlashcardId = newFlashcardFromBackend.id;
          const nowForUpdate = Date.now(); // Consistent timestamp for updates
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
                deckId: finalDeckId, // Should be the real deckId used in payload
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
            // Update currentSessionCardQueue if the tempId was in it
            const queueIndex = currentSessionCardQueue.indexOf(tempFlashcardId);
            if (queueIndex !== -1) {
              currentSessionCardQueue[queueIndex] = realFlashcardId;
            }
            delete state.pendingOperations[tempFlashcardId];
            state.isLoading = false;
          }));
          // Process operations dependent on this flashcard having its real ID
          await get()._processPendingOperationsForItem(tempFlashcardId, realFlashcardId, 'flashcard');
        })
        .catch((error: any) => {
          console.error(`[FlashcardStore] Error adding flashcard (real deckId ${finalDeckId}, tempFlashcardId ${tempFlashcardId}) in background:`, error);
          set(produce((state: FlashcardState) => {
            // Rollback optimistic add of flashcard
            state.flashcards = state.flashcards.filter((f: Flashcard) => f.id !== tempFlashcardId);
            const deck = state.decks.find((d: Deck) => d.id === finalDeckId);
            if (deck) {
              deck.cardCount = Math.max(0, (deck.cardCount || 0) - 1);
            }
            // Update pending operation to reflect failure
            if (state.pendingOperations[tempFlashcardId]) {
              // @ts-ignore adding custom error field or changing status
              state.pendingOperations[tempFlashcardId].status = 'creation_failed'; 
               // @ts-ignore
              state.pendingOperations[tempFlashcardId].error = error.message || 'Unknown TRPC error for flashcard creation';
            } else {
              // Fallback if pending op was somehow missed, though it should have been added.
              delete state.pendingOperations[tempFlashcardId]; 
            }
            state.isLoading = false;
            // Consider if a global error state needs to be set or a specific callback invoked
            // For now, error is logged, and optimistic data is rolled back.
          }));
        });

        return tempFlashcardId; // Return tempId immediately for UI responsiveness
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
        const deck = state.decks.find((d: Deck) => d.id === deckId);
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
            const deck = state.decks.find((d: Deck) => d.id === (op.originalData as Flashcard).deckId);
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
      const pendingOps = { ...get().pendingOperations }; // Shallow copy to iterate safely
      let processedOpKeys: string[] = []; // Keep track of ops processed in this run to avoid issues if recursive calls modify pendingOps

      for (const opKey in pendingOps) {
        if (processedOpKeys.includes(opKey)) continue; // Skip if already handled in this run (e.g. by a recursive call)

        const op = pendingOps[opKey];

        // Case 1: An 'update' or 'delete' operation was on an item that now has its real ID confirmed.
        // Example: A flashcard was rated (update) while its own ID was temp, and now its real ID is known.
        if ((op.type === 'update' || op.type === 'delete') && op.status === 'pendingRealId' && 
            op.data?.id === tempParentId && op.itemType === parentItemType) {
          
          console.log(`[FlashcardStore] Processing '${op.type}' (pendingRealId) operation ${opKey} for item ${realParentId}`);
          const operationDataWithRealId = { ...op.data, id: realParentId };
          const operationToExecute = { ...op, data: operationDataWithRealId };

          try {
            if (op.type === 'update' && op.itemType === 'flashcard' && op.operationSubType === 'rateCard') {
              // Specific handling for deferred rating
              await executePendingUpdateOperation(operationToExecute, { set, get, trpcClient });
            } else if (op.type === 'update' && op.itemType === 'flashcard') {
              // Generic flashcard content update (if we add such deferred updates)
              // await executePendingFlashcardContentUpdate(operationToExecute, { set, get, trpcClient });
               console.warn("[FlashcardStore] Generic deferred flashcard content update not yet implemented in _processPendingOperationsForItem");
            } else if (op.type === 'update' && op.itemType === 'deck') {
              // Generic deck update (if we add such deferred updates)
               console.warn("[FlashcardStore] Generic deferred deck update not yet implemented in _processPendingOperationsForItem");
            }
            // Add handlers for other deferred update/delete types as needed

            set(produce((state: FlashcardState) => {
              delete state.pendingOperations[opKey];
            }));
            processedOpKeys.push(opKey);
          } catch (error) {
            console.error(`[FlashcardStore] Error executing deferred ${op.type} op ${opKey} for ${realParentId}:`, error);
            // Rollback or error handling for this specific failed deferred op might be needed here
            // For now, it's logged, and the op might remain if executePending... doesn't clean up on its own errors.
          }
        }
        // Case 2: A child 'add' operation was waiting for this parent's real ID.
        // Example: A flashcard add was deferred because its deckId was temporary.
        else if (op.type === 'add' && op.status === 'pendingDependency' && 
                 op.waitsForTempId === tempParentId && op.waitsForItemType === parentItemType) {
          
          console.log(`[FlashcardStore] Processing deferred dependent 'add' operation ${opKey} (itemType: ${op.itemType}) for parent ${realParentId}`);
          
          // This is the optimistic child data that was stored, its own ID is temporary.
          const optimisticChildDataWithTempId = op.data;
          const tempChildId = optimisticChildDataWithTempId.id;

          // Prepare the payload for the backend, updating the parent foreign key.
          let backendPayload;
          if (op.itemType === 'flashcard') {
            backendPayload = { ...optimisticChildDataWithTempId, deckId: realParentId };
            delete backendPayload.id; // Backend create doesn't want the temp child ID
          } else {
            // Handle other child types if necessary (e.g., a sub-deck, though not in our current model)
            console.error("[FlashcardStore] Deferred add for unexpected itemType:", op.itemType);
            continue; // Skip this operation
          }

          try {
            let newChildFromBackend: any;
            if (op.itemType === 'flashcard') {
              newChildFromBackend = await trpcClient.flashcards.create.mutate(backendPayload as any);
            }
            // Add else if for other types like sub-decks if they become dependent adds

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
                      deckId: realParentId, // Ensure it has the real parent ID
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
                // Add similar update logic for other item types if needed
                delete state.pendingOperations[opKey]; // Remove this processed deferred add
              }));
              processedOpKeys.push(opKey);

              // RECURSIVE CALL: Now that this child item has its real ID, 
              // process any operations that might have been dependent on IT.
              await get()._processPendingOperationsForItem(tempChildId, realChildId, op.itemType);

            } else {
              throw new Error(`Backend creation for deferred ${op.itemType} did not return an object.`);
            }

          } catch (error) {
            console.error(`[FlashcardStore] Error processing deferred 'add' for ${op.itemType} ${tempChildId} (opKey: ${opKey}):`, error);
            set(produce((state: FlashcardState) => {
              if (op.itemType === 'flashcard') {
                state.flashcards = state.flashcards.filter(f => f.id !== tempChildId);
                const parentDeck = state.decks.find(d => d.id === realParentId); // Parent ID is real now
                if (parentDeck) parentDeck.cardCount = Math.max(0, (parentDeck.cardCount || 0) - 1);
              }
              // Add rollback for other item types if needed
              delete state.pendingOperations[opKey];
              state.error = `Failed to add dependent ${op.itemType}`;
            }));
            processedOpKeys.push(opKey); // Ensure it's marked as processed even on failure to prevent re-runs
          }
        }
      }
      // Final cleanup of any operations that might have been added by recursive calls and processed.
      // This is a bit tricky; the simple processedOpKeys might not be enough if new ops are added with keys that were already iterated over.
      // A more robust solution might involve re-fetching pendingOps if the map changes significantly during iteration.
      // For now, this handles the direct items in the initial pendingOps snapshot.
    },
});

export const useFlashcardStore = create<FlashcardState>()(
  persist(
    storeImplementation,
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