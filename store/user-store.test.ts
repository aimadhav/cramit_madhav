import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies BEFORE importing the store
vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(() => Promise.resolve()),
  getItemAsync: vi.fn(() => Promise.resolve(null)),
  deleteItemAsync: vi.fn(() => Promise.resolve()),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
  },
}));

// Mock flashcard-store and ensure it's available via require
const mockFlashcardStore = {
  getState: vi.fn(() => ({
    clearStore: vi.fn(),
  })),
};
vi.mock('./flashcard-store', () => ({
  useFlashcardStore: mockFlashcardStore,
}));

// Mock Platform and localStorage
vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: vi.fn((obj) => obj.ios),
  },
}));

// Mock global localStorage for web branch testing
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
} as any;


import { useUserStore, AppUser, OFFLINE_MODE_TOKEN } from './user-store';
import * as SecureStore from 'expo-secure-store';

describe('UserStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Zustand state
    useUserStore.setState({
      user: {
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
      },
      sessionToken: null,
      tokenExpiry: null,
      isLoading: false,
      error: null,
    });
  });

  it('should set session correctly', async () => {
    const userData: AppUser = {
      id: '123',
      name: 'Test User',
      email: 'test@example.com',
      isLoggedIn: true,
      isPremium: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalCardsStudied: 0,
      totalTimeStudied: 0,
      streakDays: 0,
      lastStudyDate: null,
      ownedDecks: [],
    };

    await useUserStore.getState().setSession(userData, 'access-token', 'refresh-token', 123456789);

    const state = useUserStore.getState();
    expect(state.user?.id).toBe('123');
    expect(state.sessionToken).toBe('access-token');
    expect(state.tokenExpiry).toBe(123456789);
    
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('sessionToken', 'access-token');
  });

  it('should handle logout', async () => {
    useUserStore.setState({
      sessionToken: 'active-token',
      user: { id: '123', isLoggedIn: true } as any,
    });

    await useUserStore.getState().logout();

    const state = useUserStore.getState();
    expect(state.sessionToken).toBe(null);
    expect(state.user?.isLoggedIn).toBe(false);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('sessionToken');
  });

  it('should handle offline login', async () => {
    await useUserStore.getState().loginOffline();

    const state = useUserStore.getState();
    expect(state.sessionToken).toBe(OFFLINE_MODE_TOKEN);
    expect(state.user?.name).toBe('Offline User');
    expect(state.user?.isLoggedIn).toBe(true);
  });
});

