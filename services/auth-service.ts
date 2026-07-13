import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';
import { AppUser, OFFLINE_MODE_TOKEN, useUserStore } from '@/store/user-store';

const PROFILE_FIELDS = 'id,email,name,phone,is_premium,total_cards_studied,total_time_studied,streak_days,last_study_date,created_at,updated_at,prep_focus';

export class AuthService {
  private static oauthCompletions = new Map<string, Promise<any>>();

  private static getAuthCodeFromUrl(urlOrCode: string) {
    if (!urlOrCode.includes('://') && !urlOrCode.includes('?')) return urlOrCode;

    const parsedUrl = new URL(urlOrCode);
    const errorDescription = parsedUrl.searchParams.get('error_description');
    if (errorDescription) throw new Error(errorDescription);

    const queryCode = parsedUrl.searchParams.get('code');
    if (queryCode) return queryCode;

    const hashParams = new URLSearchParams(parsedUrl.hash.substring(1));
    return hashParams.get('code');
  }

  static async restoreSession() {
    await useUserStore.getState().checkAuthStatus();
    if (useUserStore.getState().sessionToken === OFFLINE_MODE_TOKEN) return;

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      await useUserStore.getState().clearLocalSession();
      throw error;
    }

    if (!data.session) {
      await useUserStore.getState().clearLocalSession();
      return;
    }

    await this.establishSession(data.session, data.session.user);
  }

  static async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) throw error;
    if (!data.session || !data.user) throw new Error('No session returned');

    await this.establishSession(data.session, data.user);
    return data.user;
  }

  static async signInWithGoogle() {
    const redirectUri = makeRedirectUri({
      native: 'cramit://auth/callback',
      scheme: 'cramit',
      path: 'auth/callback',
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUri, skipBrowserRedirect: true },
    });

    if (error) throw error;
    if (!data?.url) throw new Error('No OAuth URL returned');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
    if (result.type === 'success' && result.url) {
      await this.completeOAuthCallback(result.url);
    }
    return result;
  }

  /** Safe to call from both the deep-link route and the in-app browser result. */
  static async completeOAuthCallback(urlOrCode: string) {
    const code = this.getAuthCodeFromUrl(urlOrCode);
    if (!code) throw new Error('Google sign-in did not return an authorization code.');

    const existing = this.oauthCompletions.get(code);
    if (existing) return existing;

    const completion = (async () => {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      if (!data.user || !data.session) throw new Error('Google sign-in did not create a session.');
      await this.establishSession(data.session, data.user);
      return data.user;
    })();

    this.oauthCompletions.set(code, completion);
    return completion;
  }

  static async signUp(email: string, password: string, name?: string, prepFocus?: string) {
    const metadata: Record<string, string> = {};
    if (name) metadata.name = name;
    if (prepFocus) metadata.prep_focus = prepFocus;

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: metadata },
    });

    if (error) throw error;
    return data;
  }

  static async continueOffline() {
    // Remove any previous cloud session before entering guest mode so a refresh
    // event cannot silently restore the previous account.
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
    await useUserStore.getState().loginOffline();
  }

  static async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.warn('[AuthService] Remote sign-out failed; clearing this device.', error);
    } finally {
      // Global sign-out can fail while offline; local scope still removes the
      // persisted Supabase refresh token so the account cannot reappear on restart.
      try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
      await useUserStore.getState().logout();
    }
  }

  static async updatePrepFocus(prepFocus: string) {
    const { data, error } = await supabase.auth.updateUser({
      data: { prep_focus: prepFocus },
    });
    if (error) throw error;

    await this.ensureProfile(data.user);
    const { data: updatedProfile, error: profileError } = await supabase
      .from('users')
      .update({ prep_focus: prepFocus, updated_at: new Date().toISOString() })
      .eq('id', data.user.id)
      .select('id')
      .maybeSingle();

    if (profileError) throw profileError;
    if (!updatedProfile) throw new Error('Your profile could not be updated. Please sign in again.');

    useUserStore.getState().updateUser({ prepFocus });
    return data.user;
  }

  private static mapUser(user: any, profile?: any): AppUser {
    const lastStudyDate = profile?.last_study_date
      ? new Date(profile.last_study_date).getTime()
      : null;

    return {
      id: user.id,
      email: profile?.email || user.email || '',
      name: profile?.name || user.user_metadata?.full_name || user.user_metadata?.name || null,
      isLoggedIn: true,
      isPremium: Boolean(profile?.is_premium),
      createdAt: new Date(profile?.created_at || user.created_at || Date.now()).getTime(),
      updatedAt: new Date(profile?.updated_at || Date.now()).getTime(),
      totalCardsStudied: Number(profile?.total_cards_studied) || 0,
      totalTimeStudied: Number(profile?.total_time_studied) || 0,
      streakDays: Number(profile?.streak_days) || 0,
      lastStudyDate: Number.isFinite(lastStudyDate) ? lastStudyDate : null,
      ownedDecks: [],
      phone: profile?.phone || user.phone || undefined,
      role: user.app_metadata?.role || 'student',
      prepFocus: profile?.prep_focus || user.user_metadata?.prep_focus || null,
    };
  }

  private static async ensureProfile(user: any) {
    const { data: existing, error: loadError } = await supabase
      .from('users')
      .select(PROFILE_FIELDS)
      .eq('id', user.id)
      .maybeSingle();

    if (loadError) throw loadError;
    if (existing) return existing;

    const now = new Date().toISOString();
    const fallbackName = user.user_metadata?.full_name || user.user_metadata?.name || null;
    const { data: created, error: createError } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email || '',
        name: fallbackName,
        prep_focus: user.user_metadata?.prep_focus || null,
        updated_at: now,
      }, { onConflict: 'id' })
      .select(PROFILE_FIELDS)
      .single();

    if (createError) throw createError;
    if (!created) throw new Error('Your profile could not be created.');
    return created;
  }

  static async establishSession(session: any, user: any) {
    const profile = await this.ensureProfile(user);
    const appUser = this.mapUser(user, profile);
    await useUserStore.getState().setSession(
      appUser,
      session.access_token,
      session.refresh_token,
      session.expires_at ? session.expires_at * 1000 : undefined,
    );
  }
}
