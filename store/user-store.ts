import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types';

interface UserState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (phone: string) => Promise<void>;
  verifyOtp: (otp: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  updateStudyStats: (studyTime: number, cardsStudied: number) => void;
}

const defaultUser: User = {
  id: 'guest-user',
  name: 'Guest User',
  email: 'guest@example.com',
  isLoggedIn: false,
  isPremium: false,
  createdAt: Date.now(),
  studyStats: {
    totalCardsStudied: 0,
    totalTimeStudied: 0,
    streakDays: 0,
    lastStudyDate: null,
  },
  ownedDecks: [],
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: defaultUser,
      isLoading: false,
      error: null,
      
      login: async (phone: string) => {
        set({ isLoading: true, error: null });
        try {
          // Mock API call
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // In a real app, this would send an OTP to the phone number
          // For now, we'll just set a loading state
          set({ isLoading: false });
          return Promise.resolve();
        } catch (error) {
          set({ isLoading: false, error: 'Failed to send OTP' });
          return Promise.reject(error);
        }
      },
      
      verifyOtp: async (otp: string) => {
        set({ isLoading: true, error: null });
        try {
          // Mock API call
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // For demo purposes, any 6-digit OTP is valid
          if (otp.length !== 6 || !/^\d+$/.test(otp)) {
            throw new Error('Invalid OTP');
          }
          
          // Create a mock user
          const user: User = {
            ...defaultUser,
            id: 'user-' + Date.now(),
            name: 'Test User',
            phone: '9876543210',
            isLoggedIn: true,
            createdAt: Date.now(),
          };
          
          set({ user, isLoading: false });
          return Promise.resolve();
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'Failed to verify OTP' 
          });
          return Promise.reject(error);
        }
      },
      
      logout: () => {
        set({ user: { ...defaultUser } });
      },
      
      updateUser: (userData: Partial<User>) => {
        const currentUser = get().user;
        if (!currentUser) return;
        
        set({
          user: {
            ...currentUser,
            ...userData,
            updatedAt: Date.now(),
          }
        });
      },
      
      updateStudyStats: (studyTime: number, cardsStudied: number) => {
        const currentUser = get().user;
        if (!currentUser) return;
        
        const now = Date.now();
        const lastDate = currentUser.studyStats.lastStudyDate;
        
        // Check if we need to update streak
        const isNewDay = lastDate === null || 
          new Date(now).toDateString() !== new Date(lastDate).toDateString();
        
        const isConsecutiveDay = lastDate === null || 
          (now - lastDate < 48 * 60 * 60 * 1000 && isNewDay);
        
        const streakDays = isConsecutiveDay 
          ? (isNewDay ? currentUser.studyStats.streakDays + 1 : currentUser.studyStats.streakDays)
          : (isNewDay ? 1 : 0);
        
        set({
          user: {
            ...currentUser,
            studyStats: {
              totalCardsStudied: currentUser.studyStats.totalCardsStudied + cardsStudied,
              totalTimeStudied: currentUser.studyStats.totalTimeStudied + studyTime,
              streakDays,
              lastStudyDate: now,
            }
          }
        });
      }
    }),
    {
      name: 'flashcard-user-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);