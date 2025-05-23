import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store'; 

export interface AppUser {
  id: string;
  name: string | null;
  email: string | null;
  isLoggedIn: boolean; 
  isPremium: boolean;
  createdAt: number;
  updatedAt: number;
  studyStats: {
    totalCardsStudied: number;
    totalTimeStudied: number;
    streakDays: number;
    lastStudyDate: number | null;
  };
  ownedDecks: string[];
  phone?: string; 
}

interface UserState {
  user: AppUser | null;
  sessionToken: string | null; 
  isLoading: boolean; 
  error: string | null;

  setSession: (userData: AppUser, token: string) => void; 
  logout: () => Promise<void>; 
  updateUser: (userData: Partial<AppUser>) => void;
  updateStudyStats: (studyTime: number, cardsStudied: number) => void;
  checkAuthStatus: () => Promise<void>; 
  clearError: () => void;
}

const defaultUserInitialState: AppUser = {
  id: 'guest-user',
  name: 'Guest User',
  email: 'guest@example.com',
  isLoggedIn: false,
  isPremium: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  studyStats: {
    totalCardsStudied: 0,
    totalTimeStudied: 0,
    streakDays: 0,
    lastStudyDate: null,
  },
  ownedDecks: [],
};

const TOKEN_STORAGE_KEY = 'sessionToken';

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: defaultUserInitialState,
      sessionToken: null, 
      isLoading: false,
      error: null,

      setSession: (userData, token) => {
        set({ 
          user: { ...userData, isLoggedIn: true }, 
          sessionToken: token, 
          isLoading: false, 
          error: null 
        });
        SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token); 
      },

      logout: async () => {
        set({ 
          user: { ...defaultUserInitialState, isLoggedIn: false }, 
          sessionToken: null, 
          isLoading: false, 
          error: null 
        });
        await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
      },
      
      checkAuthStatus: async () => {
        set({ isLoading: true });
        try {
          const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
          if (token) {
            const persistedUser = get().user; 
            set({ 
              sessionToken: token, 
              user: persistedUser && persistedUser.id !== 'guest-user' && persistedUser.isLoggedIn 
                    ? { ...persistedUser, isLoggedIn: true } 
                    : defaultUserInitialState, 
              isLoading: false 
            });
          } else {
            set({ user: defaultUserInitialState, sessionToken: null, isLoading: false });
          }
        } catch (e) {
          console.error("Failed to check auth status", e);
          set({ user: defaultUserInitialState, sessionToken: null, isLoading: false, error: 'Auth check failed' });
        }
      },

      updateUser: (userData: Partial<AppUser>) => {
        const currentUser = get().user;
        if (!currentUser) return;
        
        set(state => ({
          user: {
            ...state.user!, 
            ...userData,
            updatedAt: Date.now(),
          },
        }));
      },
      
      updateStudyStats: (studyTime: number, cardsStudied: number) => {
        const currentUser = get().user;
        if (!currentUser || !currentUser.isLoggedIn) return;

        const now = Date.now();
        let newStreakDays = currentUser.studyStats.streakDays;
        const lastStudy = currentUser.studyStats.lastStudyDate;

        if (lastStudy) {
          const oneDay = 24 * 60 * 60 * 1000;
          const diffDays = Math.round(Math.abs((now - lastStudy) / oneDay));
          if (diffDays === 1) {
            newStreakDays += 1;
          } else if (diffDays > 1) {
            newStreakDays = 1; 
          }
        } else {
          newStreakDays = 1; 
        }
        
        set(state => ({
          user: {
            ...state.user!,
            studyStats: {
              totalCardsStudied: (state.user!.studyStats.totalCardsStudied || 0) + cardsStudied,
              totalTimeStudied: (state.user!.studyStats.totalTimeStudied || 0) + studyTime,
              streakDays: newStreakDays,
              lastStudyDate: now,
            },
            updatedAt: now,
          },
        }));
      },
      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'flashcard-user-storage-v2', 
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ user: state.user }),
    }
  )
);