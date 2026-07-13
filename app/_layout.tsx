import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, useFonts } from '@expo-google-fonts/outfit';
import NetInfo from '@react-native-community/netinfo';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OfflineStatusBar } from '../components/OfflineStatusBar';
import { DatabaseProvider } from '../db/DatabaseProvider';
import { supabase } from '../lib/supabase';
import { AuthService } from '../services/auth-service';
import { SyncService } from '../services/sync-service';
import { useFlashcardStore } from '../store/flashcard-store';
import { OFFLINE_MODE_TOKEN, useUserStore } from '../store/user-store';

void SplashScreen.preventAutoHideAsync();

function AppNavigatorAndDataHandler() {
  const segments = useSegments();
  const router = useRouter();
  const sessionToken = useUserStore((state) => state.sessionToken);
  const isLoadingAuth = useUserStore((state) => state.isLoading);
  const user = useUserStore((state) => state.user);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    if (isMounted) void useFlashcardStore.getState().initializeStore();
  }, [isMounted, sessionToken]);

  useEffect(() => {
    // This callback must remain synchronous. Awaiting another Supabase request
    // here can deadlock behind the auth client's internal state lock.
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        if (useUserStore.getState().sessionToken !== OFFLINE_MODE_TOKEN) {
          void useUserStore.getState().clearLocalSession();
        }
        return;
      }

      if (event === 'TOKEN_REFRESHED' && session) {
        const state = useUserStore.getState();
        if (state.user?.id === session.user.id && state.sessionToken !== OFFLINE_MODE_TOKEN) {
          void state.setSession(
            state.user,
            session.access_token,
            session.refresh_token,
            session.expires_at ? session.expires_at * 1000 : undefined,
          );
        }
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const current = useUserStore.getState();
      const hasCloudAccess = state.isConnected && state.isInternetReachable !== false;
      if (
        hasCloudAccess &&
        current.sessionToken &&
        current.sessionToken !== OFFLINE_MODE_TOKEN &&
        current.user?.id
      ) {
        void SyncService.pushChanges(current.user.id);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!sessionToken || sessionToken === OFFLINE_MODE_TOKEN || !user?.id) return;
    void NetInfo.fetch().then((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void SyncService.pushChanges(user.id);
      }
    });
  }, [sessionToken, user?.id]);

  useEffect(() => {
    if (!isMounted || isLoadingAuth) return;

    const routeSegments = segments as string[];
    const currentSegment = routeSegments[0] || null;
    const isOnboarding = currentSegment === '(auth)' && routeSegments[1] === 'onboarding';
    const isAuthCallback = currentSegment === 'auth' && routeSegments[1] === 'callback';
    const isCloudSession = Boolean(sessionToken && sessionToken !== OFFLINE_MODE_TOKEN);

    if (isAuthCallback) return;

    if (sessionToken) {
      if (isCloudSession && !user?.prepFocus && !isOnboarding) {
        router.replace('/onboarding' as any);
      } else if (currentSegment === '(auth)' && !isOnboarding) {
        router.replace('/');
      }
    } else if (currentSegment !== '(auth)') {
      useFlashcardStore.getState().clearStore();
      router.replace('/login');
    }
  }, [sessionToken, user?.prepFocus, segments, router, isLoadingAuth, isMounted]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    void AuthService.restoreSession()
      .catch((error) => console.error('[RootLayout] Session restore failed:', error))
      .finally(() => setIsAuthChecked(true));
  }, []);

  useEffect(() => {
    if (fontsLoaded && isAuthChecked) void SplashScreen.hideAsync();
  }, [fontsLoaded, isAuthChecked]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <DatabaseProvider>
          <View style={{ flex: 1 }}>
            <OfflineStatusBar />
            {isAuthChecked ? <AppNavigatorAndDataHandler /> : null}
          </View>
        </DatabaseProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
