import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ScrollView } from "react-native";
import { Text } from "@/components/AppText";;
import { useRouter } from 'expo-router';
import { trpc } from '../../utils/trpc';
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

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      if (data.session && data.user && data.user.email) {
        const appUser: AppUser = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || null,
          isLoggedIn: true,
          isPremium: false,
          createdAt: new Date(data.user.created_at || Date.now()).getTime(),
          updatedAt: Date.now(),
          studyStats: {
            totalCardsStudied: 0,
            totalTimeStudied: 0,
            streakDays: 0,
            lastStudyDate: null,
          },
          ownedDecks: [],
          phone: data.user.phone || undefined,
        };

        setSession(appUser, data.session.access_token, data.session.refresh_token);
        Alert.alert('Login Successful', data.message || 'You are now logged in!');
        router.replace('/');
      } else {
        Alert.alert('Login Failed', 'Received incomplete data from server.');
      }
    },
    onError: (error) => {
      if (error.message === 'Invalid login credentials' || error.message.includes('Invalid login credentials')) {
        Alert.alert('Login Failed', 'Invalid email or password. Please try again.');
        return;
      } else if (error.message.includes('Invalid email')) {
        Alert.alert('Invalid Email', 'Please enter a valid email address.');
      } else if (error.message.includes('No refresh token available') && !error.message.includes('Invalid login credentials')) {
        Alert.alert('Session Expired', 'Please try logging in again.');
      } else {
        Alert.alert('Login Failed', 'An unexpected error occurred. Please try again later.');
      }
    },
  });

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Validation Error', 'Email and password are required.');
      return;
    }
    loginMutation.mutate({ email, password });
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      const redirectUri = makeRedirectUri({
        scheme: 'myapp',
        path: 'auth/callback', // Optional, matches Supabase redirect usually
      });

      console.log('Google OAuth Redirect URI:', redirectUri);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No OAuth URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

      if (result.type === 'success' && result.url) {
        // Extract tokens from the URL fragment (hash) or query params
        // Supabase returns tokens in the hash like #access_token=...&refresh_token=...
        const url = new URL(result.url);
        let params = new URLSearchParams(url.hash.substring(1)); // Try hash first
        
        if (!params.get('access_token')) {
            // Fallback to query params if hash is empty (sometimes happens)
            params = new URLSearchParams(url.search);
        }

        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (!access_token || !refresh_token) {
          throw new Error('Could not retrieve tokens from Google Sign-In.');
        }

        // Set the session in Supabase client
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (sessionError) throw sessionError;

        if (sessionData.user && sessionData.session) {
             const appUser: AppUser = {
              id: sessionData.user.id,
              email: sessionData.user.email || '',
              name: sessionData.user.user_metadata?.full_name || sessionData.user.user_metadata?.name || null,
              isLoggedIn: true,
              isPremium: false, // Default
              createdAt: new Date(sessionData.user.created_at || Date.now()).getTime(),
              updatedAt: Date.now(),
              studyStats: {
                totalCardsStudied: 0,
                totalTimeStudied: 0,
                streakDays: 0,
                lastStudyDate: null,
              },
              ownedDecks: [],
              phone: sessionData.user.phone || undefined,
            };

            setSession(appUser, sessionData.session.access_token, sessionData.session.refresh_token);
            Alert.alert('Login Successful', 'Welcome back!');
            router.replace('/');
        }
      }
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      Alert.alert('Google Sign-In Error', error.message || 'Failed to sign in with Google');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.innerContainer}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />

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
            style={[styles.button, loginMutation.isPending && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
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
  logo: {
    width: 120,
    height: 60,
    alignSelf: 'center',
    marginBottom: 20,
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
});
