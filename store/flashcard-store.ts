import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Flashcard, Deck, DifficultyRating, StudyProgress } from '@/types';
import { getSafeStorage } from '@/utils/safe-storage';
import defaultDecksData from '@/assets/data/default-decks.json';

import { DatabaseService } from '@/services/database-service';
import { StudyService } from '@/services/study-service';
import { SyncService } from '@/services/sync-service';

interface FlashcardState {
  decks: Deck[];
  currentFlashcards: Flashcard[];
  flashcards: Flashcard[]; 
  isLoading: boolean;
  error: string | null;
  currentDeckId: string | null;
  sessionQueue: string[];
  studyProgress: StudyProgress | null;

  // Actions
  initializeStore: () => Promise<void>;
  loadDecks: () => Promise<void>;
  loadDeckWithCards: (deckId: string) => Promise<void>;
  startStudySession: (deckId: string) => Promise<void>;
  rateCard: (cardId: string, rating: DifficultyRating) => Promise<void>;
  getNextCard: () => void;
  toggleBookmark: (cardId: string) => Promise<void>;
  syncSessionProgress: () => Promise<void>;
  endStudySession: () => Promise<void>;
  updateCardNote: (cardId: string, note: string) => Promise<void>;
  clearStore: () => void;
  syncData: () => Promise<void>;
  setDecks: (decks: any[]) => void;
  resetAllProgress: () => void;

  // Getters
  getCardsToStudyCount: (deckId: string) => number;
  getDeckCompletionRate: (deckId: string) => number;
  getTotalCardsStudied: () => number;
  getStreak: () => number;
}

export const useFlashcardStore = create<FlashcardState>()(
  persist(
    (set, get) => ({
      decks: [],
      currentFlashcards: [],
      flashcards: [],
      isLoading: false,
      error: null,
      currentDeckId: null,
      sessionQueue: [],
      studyProgress: null,

      initializeStore: async () => {
        const { DatabaseService } = require('@/services/database-service');
        const { useUserStore } = require('./user-store');
        const user = useUserStore.getState().user;
        const userId = user?.id || 'local';
        
        console.log('📦 [FlashcardStore] Initializing for user:', user?.email || 'guest');
        set({ isLoading: true });

        try {
          const decks = await DatabaseService.getAllDecks(userId);
          
          // Only seed if we have 0 decks AND tables are confirmed to exist
          if (decks.length === 0) {
            console.log('📦 [FlashcardStore] SQLite empty. Attempting to seed default decks...');
            for (const deck of defaultDecksData.decks) {
              try {
                await DatabaseService.upsertDeck(deck, deck.flashcards);
              } catch (e: any) {
                if (e.message.includes('no such table')) {
                   console.log('⚠️ [Store] Seeding deferred: Tables missing.');
                   break; 
                }
                throw e;
              }
            }
          }
          
          const refreshedDecks = await DatabaseService.getAllDecks(userId);
          set({ decks: refreshedDecks as any });
        } catch (error: any) {
          if (!error.message.includes('no such table')) {
            console.error('❌ [FlashcardStore] Initialization failed:', error);
          }
        } finally {
          set({ isLoading: false });
        }
      },

      loadDecks: async () => {
        const { useUserStore } = require('./user-store');
        const userId = useUserStore.getState().user?.id || 'local';
        const localDecks = await DatabaseService.getAllDecks(userId);
        set({ decks: localDecks as any });
      },

      loadDeckWithCards: async (deckId: string) => {
        const { useUserStore } = require('./user-store');
        const userId = useUserStore.getState().user?.id || 'local';
        
        set({ isLoading: true, currentDeckId: deckId });
        try {
          const cardsWithStatus = await DatabaseService.getDeckWithCards(deckId, userId);
          
          const normalized = cardsWithStatus.map(({ card, status }: any) => {
            let front = '';
            let back = '';
            try {
               const f = JSON.parse(card.frontContent);
               const b = JSON.parse(card.backContent);
               front = f[0]?.value || '';
               back = b[0]?.value || '';
            } catch (e) {
               front = card.frontContent;
               back = card.backContent;
            }

            return {
              ...card,
              front,
              back,
              mediaUrls: card.mediaUrls ? JSON.parse(card.mediaUrls) : [],
              ...status,
              dueDate: status?.due_date || card.createdAt,
              isBookmarked: !!status?.isBookmarked,
            };
          });

          set({ currentFlashcards: normalized as any, flashcards: normalized as any });
        } finally {
          set({ isLoading: false });
        }
      },

      startStudySession: async (deckId: string) => {
        const queue = await StudyService.getSessionQueue(deckId);
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
          await get().loadDeckWithCards(deckId);
        }
      },

      rateCard: async (cardId: string, rating: DifficultyRating) => {
        const { StudyService } = require('@/services/study-service');
        const { SyncService } = require('@/services/sync-service');
        const { useUserStore } = require('./user-store');
        const { db } = require('@/db');
        const { syncQueue } = require('@/db/schema');
        const { count, eq } = require('drizzle-orm');

        const user = useUserStore.getState().user;
        const userId = user?.id || 'local';
        const state = get();
        
        const card = state.currentFlashcards.find(c => c.id === cardId);
        if (!card) return;

        await StudyService.rateCard({
          card,
          status: card,
          rating,
          userId,
        });

        // BATCH SYNC LOGIC: Only push if queue is >= 3 items
        const pendingTasks = await db.select({ value: count() }).from(syncQueue).where(eq(syncQueue.status, 'pending'));
        const queueSize = pendingTasks[0]?.value || 0;

        if (queueSize >= 3) {
          console.log(`📦 [Store] Queue size is ${queueSize}. Triggering batch sync...`);
          SyncService.pushChanges(userId);
        } else {
          console.log(`📦 [Store] ${3 - queueSize} more reviews needed for batch sync.`);
        }
      },

      getNextCard: () => {
        const state = get();
        const nextIndex = (state.studyProgress?.currentCardIndex || 0) + 1;
        set(state => ({
          studyProgress: state.studyProgress ? {
            ...state.studyProgress,
            currentCardIndex: nextIndex,
            cardsStudied: state.studyProgress.cardsStudied + 1,
            cardsLeft: state.studyProgress.cardsLeft - 1,
          } : null
        }));
      },

      toggleBookmark: async (cardId: string) => {
        const { useUserStore } = require('./user-store');
        const userId = useUserStore.getState().user?.id || 'local';
        const card = get().currentFlashcards.find(c => c.id === cardId);
        if (!card) return;

        const newState = !card.isBookmarked;
        await DatabaseService.toggleBookmark(cardId, userId, newState);

        set(state => ({
          currentFlashcards: state.currentFlashcards.map(c => 
            c.id === cardId ? { ...c, isBookmarked: newState } : c
          ),
          flashcards: state.flashcards.map(c => 
            c.id === cardId ? { ...c, isBookmarked: newState } : c
          )
        }));
      },

      syncSessionProgress: async () => {
         const { useUserStore } = require('./user-store');
         const userId = useUserStore.getState().user?.id;
         if (userId) await SyncService.pushChanges(userId);
      },

      endStudySession: async () => {
         set({
            currentDeckId: null,
            studyProgress: null,
            sessionQueue: [],
            currentFlashcards: [],
            flashcards: []
         });
         await get().loadDecks();
      },

      updateCardNote: async (cardId: string, note: string) => {
         const { useUserStore } = require('./user-store');
         const userId = useUserStore.getState().user?.id || 'local';
         
         await DatabaseService.updateNote(cardId, userId, note);

         set(state => ({
           currentFlashcards: state.currentFlashcards.map(c => 
             c.id === cardId ? { ...c, notes: note } : c
           ),
           flashcards: state.flashcards.map(c => 
             c.id === cardId ? { ...c, notes: note } : c
           )
         }));
      },

      getCardsToStudyCount: (deckId: string) => {
        const deck = get().decks.find(d => d.id === deckId);
        return (deck as any)?.dueCount || 0;
      },

      getDeckCompletionRate: (deckId: string) => {
        const deck = get().decks.find(d => d.id === deckId);
        if (!deck || deck.cardCount === 0) return 0;
        return 0; 
      },

      getTotalCardsStudied: () => {
        return get().decks.reduce((acc, d) => acc + (d.cardCount - ((d as any).dueCount || 0)), 0);
      },

      getStreak: () => {
        const { useUserStore } = require('./user-store');
        return useUserStore.getState().user?.streakDays || 0;
      },

      syncData: async () => {
        const { useUserStore } = require('./user-store');
        const userId = useUserStore.getState().user?.id;
        if (userId) {
          await SyncService.fullSync(userId);
        }
        await get().loadDecks();
      },

      setDecks: (decks: any[]) => {},

      resetAllProgress: async () => {
        const { useUserStore } = require('./user-store');
        const userId = useUserStore.getState().user?.id || 'local';
        const { db } = require('@/db');
        const { userFlashcardStatus, reviews } = require('@/db/schema');
        const { eq } = require('drizzle-orm');

        try {
          await db.delete(userFlashcardStatus).where(eq(userFlashcardStatus.userId, userId));
          await db.delete(reviews).where(eq(reviews.userId, userId));
          await get().initializeStore();
        } catch (e) {
          console.error('Failed to reset progress:', e);
        }
      },

      clearStore: () => {
        set({
          decks: [],
          currentFlashcards: [],
          flashcards: [],
          currentDeckId: null,
          sessionQueue: [],
          studyProgress: null,
        });
      },
    }),
    {
      name: 'flashcard-storage-v2',
      storage: createJSONStorage(() => getSafeStorage()),
      partialize: (state) => ({
        currentDeckId: state.currentDeckId,
      }),
    }
  )
);


