import { supabase } from '@/lib/supabase';
import { useUserStore, AppUser } from '@/store/user-store';
import { useFlashcardStore } from '@/store/flashcard-store';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

export class AuthService {
  /**
   * Standard Email/Password Login
   */
  static async signIn(email: string, password: string) {
    const cleanEmail = email.trim().toLowerCase();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) throw error;
    if (!data.session || !data.user) throw new Error('No session returned');

    await this.establishSession(data.session, data.user);
    return data.user;
  }

  /**
   * Google OAuth Login
   */
  static async signInWithGoogle() {
    // 1. Generate the Redirect URI
    // For Expo Go, we use a simpler approach that works better with Supabase validation
    const redirectUri = makeRedirectUri({
      scheme: 'myapp',
      path: 'auth/callback',
    });

    // If we are in Expo Go, the actual URI might look like exp://...
    // But we want to tell Supabase to send it back to our custom scheme if possible
    console.log('🔗 [OAuth] Generated Redirect URI:', redirectUri);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data?.url) throw new Error('No OAuth URL returned');

    console.log('🌍 [OAuth] Opening Browser...');
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

    if (result.type === 'success' && result.url) {
      console.log('✅ [OAuth] Browser returned success.');
      const url = new URL(result.url);
      
      // Some browsers return params in the hash (#) and others in the search (?)
      // We parse both and merge them
      const hashParams = new URLSearchParams(url.hash.substring(1));
      const queryParams = new URLSearchParams(url.search);
      
      const access_token = hashParams.get('access_token') || queryParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token') || queryParams.get('refresh_token');

      if (!access_token) {
        console.error('❌ [OAuth] Access token missing in return URL');
        throw new Error('Could not retrieve tokens from Google.');
      }

      console.log('🚀 [OAuth] Setting Supabase session...');
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token: refresh_token || '',
      });

      if (sessionError) {
        console.error('❌ [OAuth] setSession error:', sessionError.message);
        throw sessionError;
      }
      
      if (sessionData.user && sessionData.session) {
        console.log('🎉 [OAuth] Session verified for:', sessionData.user.email);
        await this.establishSession(sessionData.session, sessionData.user);
      }
    } else {
      console.log('ℹ️ [OAuth] Browser session result:', result.type);
    }
    return result;
  }

  /**
   * User Signup
   */
  static async signUp(email: string, password: string, name?: string, prepFocus?: string) {
    const cleanEmail = email.trim().toLowerCase();
    
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          name: name || undefined,
          prep_focus: prepFocus || undefined,
        }
      }
    });

    if (error) throw error;
    return data;
  }

  /**
   * Helper to map Supabase User to our AppUser type
   */
  private static mapUser(user: any): AppUser {
    return {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      isLoggedIn: true,
      isPremium: false,
      createdAt: new Date(user.created_at || Date.now()).getTime(),
      updatedAt: Date.now(),
      totalCardsStudied: 0,
      totalTimeStudied: 0,
      streakDays: 0,
      lastStudyDate: null,
      ownedDecks: [],
      phone: user.phone || undefined,
      role: user.user_metadata?.role || 'student', // Fallback, real sync handles it
      prepFocus: user.user_metadata?.prep_focus || null,
    };
  }

  /**
   * Unified session establishment logic
   */
  static async establishSession(session: any, user: any) {
    // 1. Clear state for safety
    useFlashcardStore.getState().clearStore();
    
    // 2. Map and set session
    const appUser = this.mapUser(user);
    useUserStore.getState().setSession(
      appUser, 
      session.access_token, 
      session.refresh_token,
      session.expires_at ? session.expires_at * 1000 : undefined // Convert to ms
    );
  }
}
