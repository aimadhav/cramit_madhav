import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store'; 
import { Platform } from 'react-native';
import { getSafeStorage } from '@/utils/safe-storage';
import { useFlashcardStore } from './flashcard-store';

export interface AppUser {
  id: string;
  name: string | null;
  email: string | null;
  isLoggedIn: boolean; 
  isPremium: boolean;
  createdAt: number;
  updatedAt: number;
  totalCardsStudied: number;
  totalTimeStudied: number;
  streakDays: number;
  lastStudyDate: number | null;
  ownedDecks: string[];
  phone?: string; 
  role?: 'student' | 'teacher';
  prepFocus?: string | null;
}

export type ThemePreference = 'system' | 'light' | 'dark';

interface UserState {
  user: AppUser | null;
  sessionToken: string | null;
  tokenExpiry: number | null;
  isLoading: boolean;
  error: string | null;
  themePreference: ThemePreference;

  setSession: (userData: AppUser, accessToken: string, refreshToken?: string, expiresAt?: number) => Promise<void>;
  logout: () => Promise<void>;
  clearLocalSession: () => Promise<void>;
  loginOffline: () => Promise<void>;
  updateUser: (userData: Partial<AppUser>) => void;
  updateStudyStats: (studyTime: number, cardsStudied: number) => Promise<void>;
  resetUserProgress: () => void;
  checkAuthStatus: () => Promise<void>;
  clearError: () => void;
  shouldRefreshToken: () => boolean;
  setThemePreference: (theme: ThemePreference) => void;
}

const defaultUserInitialState: AppUser = {
  id: 'guest-user',
  name: 'Guest User',
  email: 'guest@example.com',
  isLoggedIn: false,
  isPremium: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  totalCardsStudied: 0,
  totalTimeStudied: 0,
  streakDays: 0,
  lastStudyDate: null,
  ownedDecks: [],
  role: 'student',
  prepFocus: null,
};

function localCalendarDayNumber(timestamp: number) {
  const date = new Date(timestamp);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export const TOKEN_STORAGE_KEY = 'sessionToken';
export const REFRESH_TOKEN_STORAGE_KEY = 'sessionRefreshToken';
export const OFFLINE_MODE_TOKEN = 'offline-mode-token';

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: defaultUserInitialState,
      sessionToken: null,
      tokenExpiry: null,
      isLoading: false,
      error: null,
      themePreference: 'system',

      setSession: async (userData: AppUser, accessToken: string, refreshToken?: string, expiresAt?: number) => {
        console.log('🔑 [UserStore] Setting active session');
        
        // Clear flashcard store if this is a new user login
        const currentUser = get().user;
        if (currentUser && currentUser.id !== userData.id) {
          console.log('🧹 [UserStore] New user ID detected, clearing flashcard store');
          try {
            useFlashcardStore.getState().clearStore();
          } catch (e) {
            console.error('Failed to clear FlashcardStore during user switch:', e);
          }
        }

        set({
          user: { ...userData, isLoggedIn: true },
          sessionToken: accessToken,
          tokenExpiry: expiresAt || null,
          isLoading: false,
          error: null
        });

        if (typeof window === 'undefined') return;

        if (Platform.OS === 'web') {
          localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
          if (expiresAt) {
            localStorage.setItem('tokenExpiry', expiresAt.toString());
          }
          if (refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
          } else {
            localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
          }
        } else {
          await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, accessToken);
          if (expiresAt) {
            await SecureStore.setItemAsync('tokenExpiry', expiresAt.toString());
          }
          if (refreshToken) {
            await SecureStore.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
          } else {
            await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY);
          }
        }
      },

      shouldRefreshToken: () => {
        const state = get();
        if (!state.tokenExpiry || !state.sessionToken) return false;
        
        const FIVE_MINUTES = 5 * 60 * 1000;
        return Date.now() + FIVE_MINUTES >= state.tokenExpiry;
      },

      clearLocalSession: async () => {
        try {
          useFlashcardStore.getState().clearStore();
        } catch (error) {
          console.error('Failed to clear FlashcardStore during session cleanup:', error);
        }

        set({
          user: { ...defaultUserInitialState, isLoggedIn: false },
          sessionToken: null,
          tokenExpiry: null,
          isLoading: false,
          error: null,
        });

        if (typeof window === 'undefined') return;
        if (Platform.OS === 'web') {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
          localStorage.removeItem('tokenExpiry');
        } else {
          await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
          await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY);
          await SecureStore.deleteItemAsync('tokenExpiry');
        }
      },

      logout: async () => {
        console.log('🚪 [UserStore] Logging out...');
        
        // Clear FlashcardStore as well!
        try {
          useFlashcardStore.getState().clearStore();
        } catch (e) {
          console.error('Failed to clear FlashcardStore during logout:', e);
        }

        set({ 
          user: { ...defaultUserInitialState, isLoggedIn: false }, 
          sessionToken: null, 
          tokenExpiry: null,
          isLoading: false, 
          error: null 
        });

        if (typeof window === 'undefined') return;

        if (Platform.OS === 'web') {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
          localStorage.removeItem('tokenExpiry');
        } else {
          await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
          await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY);
          await SecureStore.deleteItemAsync('tokenExpiry');
        }
      },
      
      loginOffline: async () => {
        console.log('📶 [UserStore] Logging in as offline user...');
        
        // Clear flashcard store for clean offline session
        try {
          useFlashcardStore.getState().clearStore();
        } catch (e) {
          console.error('Failed to clear FlashcardStore during offline login:', e);
        }

        set({
          user: { ...defaultUserInitialState, name: 'Offline User', isLoggedIn: true },
          sessionToken: OFFLINE_MODE_TOKEN,
          isLoading: false,
          error: null
        });

        if (typeof window === 'undefined') return;

        if (Platform.OS === 'web') {
          localStorage.setItem(TOKEN_STORAGE_KEY, OFFLINE_MODE_TOKEN);
        } else {
          await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, OFFLINE_MODE_TOKEN);
        }
      },
      
      checkAuthStatus: async () => {
        if (typeof window === 'undefined') return;
        set({ isLoading: true });
        try {
          let accessToken: string | null = null;
          if (Platform.OS === 'web') {
            accessToken = localStorage.getItem(TOKEN_STORAGE_KEY);
          } else {
            accessToken = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
          }

          // Supabase owns cloud session restoration. This copied key only remembers
          // that the user explicitly selected offline mode.
          if (accessToken === OFFLINE_MODE_TOKEN) {
            set({ 
              sessionToken: OFFLINE_MODE_TOKEN,
              user: { ...defaultUserInitialState, name: 'Offline User', isLoggedIn: true },
              isLoading: false 
            });
          } else {
            set({ user: defaultUserInitialState, sessionToken: null, tokenExpiry: null, isLoading: false });
            if (Platform.OS === 'web') {
              localStorage.removeItem(TOKEN_STORAGE_KEY);
              localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
              localStorage.removeItem('tokenExpiry');
            } else {
              await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
              await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY);
              await SecureStore.deleteItemAsync('tokenExpiry');
            }
          }
        } catch (e) {
          console.error("Failed to check auth status", e);
          set({ user: defaultUserInitialState, sessionToken: null, tokenExpiry: null, isLoading: false, error: 'Auth check failed' });
          if (Platform.OS === 'web') {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
          } else {
            await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
            await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY);
          }
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
      
      updateStudyStats: async (studyTime: number, cardsStudied: number) => {
        const currentUser = get().user;
        if (!currentUser || !currentUser.isLoggedIn) return;

        const safeCardsStudied = Math.max(0, Math.floor(cardsStudied));
        const safeStudyTime = Math.max(0, Math.floor(studyTime));

        // Opening/closing a session without completing a card is not study activity.
        if (safeCardsStudied === 0) return;

        const now = Date.now();
        let newStreakDays = currentUser.streakDays;
        const lastStudy = currentUser.lastStudyDate;

        if (lastStudy) {
          const diffDays = localCalendarDayNumber(now) - localCalendarDayNumber(lastStudy);
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
            totalCardsStudied: (state.user!.totalCardsStudied || 0) + safeCardsStudied,
            totalTimeStudied: (state.user!.totalTimeStudied || 0) + safeStudyTime,
            streakDays: newStreakDays,
            lastStudyDate: now,
            updatedAt: now,
          },
        }));

        // Sync to Supabase directly if online
        if (get().sessionToken !== OFFLINE_MODE_TOKEN && get().sessionToken !== null) {
          try {
            const { supabase } = require('@/lib/supabase');
            const { error } = await supabase
              .from('users')
              .update({
                total_cards_studied: (currentUser.totalCardsStudied || 0) + safeCardsStudied,
                total_time_studied: (currentUser.totalTimeStudied || 0) + safeStudyTime,
                streak_days: newStreakDays,
                last_study_date: new Date(now).toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', currentUser.id);

            if (error) throw error;
          } catch (error) {
            console.error('[UserStore] Failed to sync study stats:', error);
          }
        }
      },
      resetUserProgress: () => {
        set(state => ({
          user: state.user ? {
            ...state.user,
            totalCardsStudied: 0,
            totalTimeStudied: 0,
            streakDays: 0,
            lastStudyDate: null,
            updatedAt: Date.now(),
          } : state.user,
        }));
        console.log("[UserStore] User progress has been reset.");
      },
      clearError: () => {
        set({ error: null });
      },
      setThemePreference: (theme: ThemePreference) => {
        set({ themePreference: theme });
      }
    }),
    {
      name: 'flashcard-user-storage-v2', 
      storage: createJSONStorage(() => getSafeStorage()),
      partialize: (state) => ({ user: state.user, themePreference: state.themePreference as any }),
    }
  )
);
