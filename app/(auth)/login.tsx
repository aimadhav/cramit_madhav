import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ScrollView } from "react-native";
import { Text } from "@/components/AppText";;
import { useRouter } from 'expo-router';
import { useUserStore } from '../../store/user-store';
import type { AppUser } from '../../store/user-store';
import { supabase } from '../../lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { useThemeColors } from '@/hooks/useThemeColors';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { setSession } = useUserStore.getState();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Validation Error', 'Email and password are required.');
      return;
    }
    
    try {
      const { data: sessionData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!sessionData.session || !sessionData.user) throw new Error('No session returned');

      const appUser: AppUser = {
        id: sessionData.user.id,
        email: sessionData.user.email || '',
        name: sessionData.user.user_metadata?.full_name || sessionData.user.user_metadata?.name || null,
        isLoggedIn: true,
        isPremium: false,
        createdAt: new Date(sessionData.user.created_at || Date.now()).getTime(),
        updatedAt: Date.now(),
        totalCardsStudied: 0,
        totalTimeStudied: 0,
        streakDays: 0,
        lastStudyDate: null,
        ownedDecks: [],
        phone: sessionData.user.phone || undefined,
      };

      setSession(appUser, sessionData.session.access_token, sessionData.session.refresh_token);
      Alert.alert('Login Successful', 'Welcome back!');
      router.replace('/');
    } catch (error: any) {
      console.error('Login failed:', error);
      Alert.alert('Login Failed', error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      // Use a simpler redirect URI for better compatibility
      const redirectUri = makeRedirectUri({
        scheme: 'myapp',
        preferLocalhost: false,
      });

      console.log('🔗 [OAuth] Requesting Login with Redirect:', redirectUri);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No OAuth URL returned');

      console.log('🌍 [OAuth] Opening WebBrowser...');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

      if (result.type === 'success' && result.url) {
        console.log('✅ [OAuth] Browser returned success. URL:', result.url);
        
        const url = new URL(result.url);
        // Supabase returns tokens in the hash (#)
        const params = new URLSearchParams(url.hash.substring(1));
        
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (!access_token) {
          console.error('❌ [OAuth] Access token missing in hash. Full URL:', result.url);
          // Try query params as a fallback
          const queryParams = new URLSearchParams(url.search);
          const q_access = queryParams.get('access_token');
          if (q_access) {
             console.log('ℹ️ [OAuth] Found token in query params instead of hash');
             await completeLogin(q_access, queryParams.get('refresh_token') || '');
             return;
          }
          throw new Error('Could not retrieve tokens from Google Sign-In.');
        }

        await completeLogin(access_token, refresh_token || '');
      } else {
        console.log('ℹ️ [OAuth] Browser session closed or cancelled. Type:', result.type);
      }
    } catch (error: any) {
      console.error('❌ [OAuth] Error:', error);
      Alert.alert('Google Sign-In Error', error.message || 'Failed to sign in with Google');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const completeLogin = async (access_token: string, refresh_token: string) => {
    console.log('🚀 [OAuth] Completing login with tokens...');
    
    // ENSURE CLEAN SLATE: Clear old user's flashcards/sync queue
    const { useFlashcardStore } = require('../../store/flashcard-store');
    useFlashcardStore.getState().clearStore();

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (sessionError) throw sessionError;

    if (sessionData.user && sessionData.session) {
      console.log('🎉 [OAuth] Session established for:', sessionData.user.email);
      const appUser: AppUser = {
        id: sessionData.user.id,
        email: sessionData.user.email || '',
        name: sessionData.user.user_metadata?.full_name || sessionData.user.user_metadata?.name || null,
        isLoggedIn: true,
        isPremium: false,
        createdAt: new Date(sessionData.user.created_at || Date.now()).getTime(),
        updatedAt: Date.now(),
        totalCardsStudied: 0,
        totalTimeStudied: 0,
        streakDays: 0,
        lastStudyDate: null,
        ownedDecks: [],
        phone: sessionData.user.phone || undefined,
      };

      setSession(appUser, sessionData.session.access_token, sessionData.session.refresh_token);
      Alert.alert('Login Successful', 'Welcome back!');
      router.replace('/');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.innerContainer}>
          <Text style={styles.logoText}>cramit</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholderTextColor={colors.textLight}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={colors.textLight}
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
          >
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity 
            style={[styles.googleButton, isGoogleLoading && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={isGoogleLoading}
          >
            {isGoogleLoading ? (
                 <ActivityIndicator color={colors.textDark} />
            ) : (
                <Text style={styles.googleButtonText}>Continue with Google</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.offlineButton}
            onPress={() => {
              const { loginOffline } = useUserStore.getState();
              loginOffline();
              router.replace('/');
            }}
          >
            <Text style={styles.offlineButtonText}>Continue Offline</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/signup')} style={styles.signupContainer}>
            <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkBold}>Sign Up</Text></Text>
          </TouchableOpacity>

          {/* Quick Access Buttons */}
          <View style={styles.quickAccessContainer}>
            <Text style={styles.quickAccessLabel}>DEMO ACCESS</Text>
            <View style={styles.quickAccessRow}>
              <TouchableOpacity 
                style={styles.quickAccessButton}
                onPress={() => {
                  setEmail('arjun@test.com');
                  setPassword('password123');
                }}
              >
                <Text style={styles.quickAccessButtonText}>ARJUN</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.quickAccessButton, { borderColor: '#10B98120' }]}
                onPress={() => {
                  setEmail('beta@cramit.com');
                  setPassword('password123');
                }}
              >
                <Text style={[styles.quickAccessButtonText, { color: '#10B981' }]}>BETA</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  innerContainer: {
    gap: 12,
    paddingVertical: 10,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  logoText: {
    fontSize: 48,
    fontFamily: 'Outfit_700Bold',
    color: '#5e6ad2',
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: -1,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textDark,
    textAlign: 'center',
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 17,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '500',
  },
  input: {
    height: 56,
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 16,
    color: colors.textLight,
    fontWeight: '600',
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: colors.background,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  googleButtonText: {
    color: colors.textDark,
    fontSize: 17,
    fontWeight: '600',
  },
  offlineButton: {
    backgroundColor: colors.background,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  offlineButtonText: {
    color: colors.textDark,
    fontSize: 17,
    fontWeight: '600',
  },
  signupContainer: {
    marginTop: 16,
    paddingVertical: 8,
  },
  linkText: {
    textAlign: 'center',
    fontSize: 15,
    color: colors.textLight,
  },
  linkBold: {
    fontWeight: '700',
    color: colors.primary,
  },
  quickAccessContainer: {
    marginTop: 30,
    alignItems: 'center',
    paddingBottom: 20,
  },
  quickAccessLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#5f6166',
    letterSpacing: 2,
    marginBottom: 15,
  },
  quickAccessRow: {
    flexDirection: 'row',
    gap: 15,
  },
  quickAccessButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5e6ad220',
    backgroundColor: '#15171B',
  },
  quickAccessButtonText: {
    color: '#5e6ad2',
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
  }
});
