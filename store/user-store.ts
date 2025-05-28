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

  setSession: (userData: AppUser, accessToken: string, refreshToken?: string) => void; 
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

export const TOKEN_STORAGE_KEY = 'sessionToken';
export const REFRESH_TOKEN_STORAGE_KEY = 'sessionRefreshToken';

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: defaultUserInitialState,
      sessionToken: null, 
      isLoading: false,
      error: null,

      setSession: (userData: AppUser, accessToken: string, refreshToken?: string) => {
        set({ 
          user: { ...userData, isLoggedIn: true }, 
          sessionToken: accessToken, 
          isLoading: false, 
          error: null 
        });
        SecureStore.setItemAsync(TOKEN_STORAGE_KEY, accessToken);
        if (refreshToken) {
          SecureStore.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
        } else {
          SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY);
        }
      },

      logout: async () => {
        set({ 
          user: { ...defaultUserInitialState, isLoggedIn: false }, 
          sessionToken: null, 
          isLoading: false, 
          error: null 
        });
        await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY);
      },
      
      checkAuthStatus: async () => {
        set({ isLoading: true });
        try {
          const accessToken = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
          const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY);

          if (accessToken && refreshToken) {
            const persistedUser = get().user; 
            set({ 
              sessionToken: accessToken, 
              user: persistedUser && persistedUser.id !== 'guest-user' && persistedUser.isLoggedIn 
                    ? { ...persistedUser, isLoggedIn: true } 
                    : defaultUserInitialState, 
              isLoading: false 
            });
          } else {
            set({ user: defaultUserInitialState, sessionToken: null, isLoading: false });
            await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
            await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY);
          }
        } catch (e) {
          console.error("Failed to check auth status", e);
          set({ user: defaultUserInitialState, sessionToken: null, isLoading: false, error: 'Auth check failed' });
          await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
          await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY);
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