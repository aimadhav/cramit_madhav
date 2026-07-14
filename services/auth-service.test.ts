import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from './auth-service';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store/user-store';
import { useFlashcardStore } from '@/store/flashcard-store';

const { mockProfileMaybeSingle, mockProfileSingle, mockProfileUpsert } = vi.hoisted(() => ({
  mockProfileMaybeSingle: vi.fn(),
  mockProfileSingle: vi.fn(),
  mockProfileUpsert: vi.fn(),
}));

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      setSession: vi.fn(),
      getSession: vi.fn(),
      signOut: vi.fn(),
      exchangeCodeForSession: vi.fn(),
      updateUser: vi.fn(),
    },
    from: vi.fn(() => {
      const query: any = {};
      query.select = vi.fn(() => query);
      query.eq = vi.fn(() => query);
      query.upsert = mockProfileUpsert.mockImplementation(() => query);
      query.maybeSingle = mockProfileMaybeSingle;
      query.single = mockProfileSingle;
      return query;
    }),
  },
}));

// Mock Stores
const mockUserStore = {
  setSession: vi.fn(),
  user: null,
};

const mockFlashcardStore = {
  clearStore: vi.fn(),
};

vi.mock('@/store/user-store', () => ({
  useUserStore: {
    getState: vi.fn(() => mockUserStore),
  },
}));

vi.mock('@/store/flashcard-store', () => ({
  useFlashcardStore: {
    getState: vi.fn(() => mockFlashcardStore),
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfileMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockProfileSingle.mockResolvedValue({
      data: { id: '123', email: 'test@example.com', name: null },
      error: null,
    });
  });

  describe('signIn', () => {
    it('should successfully sign in and establish a session', async () => {
      const mockUser = { id: '123', email: 'test@example.com', created_at: new Date().toISOString() };
      const mockSession = { access_token: 'abc', refresh_token: 'def', expires_at: 123456789 };
      
      (supabase.auth.signInWithPassword as any).mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      await AuthService.signIn('TEST@example.com ', 'password123');

      // Check email normalization (trimmed and lowercased)
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });

      // Check session establishment
      expect(mockUserStore.setSession).toHaveBeenCalledWith(
        expect.objectContaining({ id: '123', email: 'test@example.com' }),
        'abc',
        'def',
        123456789000 // expires_at * 1000
      );
      expect(mockProfileUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ id: '123', email: 'test@example.com' }),
        { onConflict: 'id' },
      );
    });

    it('should throw an error if Supabase returns an error', async () => {
      const mockError = { message: 'Invalid login credentials' };
      
      (supabase.auth.signInWithPassword as any).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: mockError,
      });

      await expect(AuthService.signIn('test@example.com', 'wrongpass'))
        .rejects.toThrow('Invalid login credentials');
    });

    it('should throw an error if no session is returned', async () => {
      (supabase.auth.signInWithPassword as any).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: null,
      });

      await expect(AuthService.signIn('test@example.com', 'pass'))
        .rejects.toThrow('No session returned');
    });

    it('restores profile counters when establishing a fresh session', async () => {
      const mockUser = { id: '123', email: 'test@example.com', created_at: new Date().toISOString() };
      const mockSession = { access_token: 'abc', refresh_token: 'def', expires_at: 123456789 };
      mockProfileMaybeSingle.mockResolvedValueOnce({
        data: {
          id: '123',
          email: 'test@example.com',
          name: 'Profile Name',
          total_cards_studied: 84,
          total_time_studied: 31,
          streak_days: 6,
          last_study_date: '2026-07-13T08:00:00.000Z',
        },
        error: null,
      });
      (supabase.auth.signInWithPassword as any).mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      await AuthService.signIn('test@example.com', 'password123');

      expect(mockUserStore.setSession).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Profile Name',
          totalCardsStudied: 84,
          totalTimeStudied: 31,
          streakDays: 6,
        }),
        'abc',
        'def',
        123456789000
      );
    });
  });

  describe('signUp', () => {
    it('should successfully sign up a new user', async () => {
      const mockData = { user: { id: '456' } };
      
      (supabase.auth.signUp as any).mockResolvedValueOnce({
        data: mockData,
        error: null,
      });

      const result = await AuthService.signUp(' NewUser@example.com', 'password123', 'John Doe');

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'password123',
        options: {
          emailRedirectTo: 'myapp://redirect',
          data: {
            name: 'John Doe',
          },
        },
      });
      expect(result).toEqual(mockData);
    });

    it('should throw an error if signup fails', async () => {
      const mockError = { message: 'User already exists' };
      
      (supabase.auth.signUp as any).mockResolvedValueOnce({
        data: { user: null },
        error: mockError,
      });

      await expect(AuthService.signUp('test@example.com', 'pass'))
        .rejects.toThrow('User already exists');
    });
  });
});
