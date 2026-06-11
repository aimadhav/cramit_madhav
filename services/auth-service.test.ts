import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from './auth-service';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store/user-store';
import { useFlashcardStore } from '@/store/flashcard-store';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      setSession: vi.fn(),
    },
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
      expect(mockFlashcardStore.clearStore).toHaveBeenCalled();
      expect(mockUserStore.setSession).toHaveBeenCalledWith(
        expect.objectContaining({ id: '123', email: 'test@example.com' }),
        'abc',
        'def',
        123456789000 // expires_at * 1000
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
