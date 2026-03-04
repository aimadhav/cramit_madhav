import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View } from 'react-native';
import { OfflineStatusBar } from '../components/OfflineStatusBar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { 
  useFonts, 
  Outfit_400Regular, 
  Outfit_500Medium, 
  Outfit_600SemiBold, 
  Outfit_700Bold 
} from '@expo-google-fonts/outfit';

import { trpc, trpcClient } from '../utils/trpc';
import { useUserStore, OFFLINE_MODE_TOKEN } from '../store/user-store';
import { useFlashcardStore } from '../store/flashcard-store';
import NetInfo from '@react-native-community/netinfo';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Main app navigator with data handling
function AppNavigatorAndDataHandler() {
  const segments = useSegments();
  const router = useRouter();
  const sessionToken = useUserStore((state) => state.sessionToken);
  const isLoadingAuth = useUserStore((state) => state.isLoading);
  const user = useUserStore((state) => state.user);
  const setDecks = useFlashcardStore((state) => state.setDecks);
  const [isMounted, setIsMounted] = useState(false);

  // Load custom fonts
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  useEffect(() => {
    setIsMounted(true);
    useFlashcardStore.getState().loadDefaultDecks();
    return () => setIsMounted(false);
  }, []);

  // Fetch public decks
  const { data: publicDecks, isLoading: isLoadingDecks } = trpc.deck.listPublic.useQuery(
    undefined,
    { 
      enabled: sessionToken !== OFFLINE_MODE_TOKEN && sessionToken !== null,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1, // Minimize retries if offline
    }
  );

  // Sync offline ratings when online
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        const ratings = useFlashcardStore.getState().sessionRatings;
        if (Object.keys(ratings).length > 0) {
          console.log('[AppLayout] Network restored, syncing session progress...');
          useFlashcardStore.getState().syncSessionProgress();
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Update store when decks are fetched
  useEffect(() => {
    if (publicDecks && publicDecks.length > 0) {
      console.log('[AppLayout] Setting', publicDecks.length, 'public decks in store');
      setDecks(publicDecks);
    }
  }, [publicDecks, setDecks]);

  // Navigation based on auth state
  useEffect(() => {
    if (!isMounted || isLoadingAuth) {
      return;
    }

    const currentSegment = segments[0] || null;

    // If no session token and not in auth flow, redirect to login
    if (!sessionToken && currentSegment !== '(auth)') {
      console.log('[AppLayout] No session, redirecting to login');
      router.replace('/login');
    }
    // If session exists and in auth flow, redirect to main app
    else if (sessionToken && currentSegment === '(auth)') {
      console.log('[AppLayout] Session exists, redirecting to home');
      router.replace('/');
    }
  }, [sessionToken, segments, router, isLoadingAuth, isMounted]);

  // Hide splash when ready
  useEffect(() => {
    // If in offline mode, don't wait for isLoadingDecks since the query is disabled
    const decksReady = sessionToken === OFFLINE_MODE_TOKEN ? true : !isLoadingDecks;
    
    if (!isLoadingAuth && decksReady && isMounted && fontsLoaded) {
      console.log('[AppLayout] Ready, hiding splash screen');
      SplashScreen.hideAsync();
    }
  }, [isLoadingAuth, isLoadingDecks, isMounted, sessionToken, fontsLoaded]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [loadedFonts, fontError] = useFonts({});
  const { checkAuthStatus } = useUserStore.getState();
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    async function prepareAuth() {
      try {
        await checkAuthStatus();
      } catch (e) {
        console.error('[RootLayout] Auth check failed:', e);
      } finally {
        setIsAuthChecked(true);
      }
    }
    prepareAuth();
  }, [checkAuthStatus]);

  useEffect(() => {
    if (loadedFonts && isAuthChecked) {
      SplashScreen.hideAsync();
    }
  }, [loadedFonts, isAuthChecked]);

  if (!loadedFonts) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <View style={{ flex: 1 }}>
              <OfflineStatusBar />
              {isAuthChecked ? <AppNavigatorAndDataHandler /> : null}
            </View>
          </QueryClientProvider>
        </trpc.Provider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}