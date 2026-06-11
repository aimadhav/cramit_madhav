import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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

import { useUserStore, OFFLINE_MODE_TOKEN } from '../store/user-store';
import { useFlashcardStore } from '../store/flashcard-store';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';

SplashScreen.preventAutoHideAsync();

import { SyncService } from '../services/sync-service';

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
    return () => setIsMounted(false);
  }, []);

  // Initialize SQLite Store when session changes
  useEffect(() => {
    if (isMounted) {
      console.log('🔄 [AppLayout] Auth state changed or mounted. Initializing SQLite Store...');
      useFlashcardStore.getState().initializeStore();
    }
  }, [isMounted, sessionToken]);

  // Auth State Listener (Supabase)
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔔 [AuthListener] Event: ${event}`);
      
      if (event === 'SIGNED_IN' && session) {
        // Only update if the store doesn't already have this session
        const currentToken = useUserStore.getState().sessionToken;
        if (currentToken !== session.access_token && currentToken !== OFFLINE_MODE_TOKEN) {
          const { AuthService } = require('../services/auth-service');
          await AuthService.establishSession(session, session.user);
        }
      } else if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        if (!session && useUserStore.getState().sessionToken !== OFFLINE_MODE_TOKEN) {
          useUserStore.getState().logout();
        }
      } else if (event === 'TOKEN_REFRESHED' && session) {
        useUserStore.getState().setSession(
          useUserStore.getState().user!, 
          session.access_token, 
          session.refresh_token
        );
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Sync offline data when cloud connectivity is restored
  useEffect(() => {
    // We use a listener for network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      const { user, sessionToken } = useUserStore.getState();
      
      // REAL connectivity check:
      // isConnected = connected to a network (Wi-Fi/Cellular)
      // isInternetReachable = can actually reach the public internet (Supabase)
      const hasCloudAccess = state.isConnected && state.isInternetReachable !== false;

      if (hasCloudAccess && sessionToken && user?.id) {
        console.log('📡 [SyncEngine] Cloud access confirmed. Pushing local changes...');
        SyncService.pushChanges(user.id);
      }
    });

    return () => unsubscribe();
  }, []); // Listener remains active for the app lifecycle

  // Trigger sync immediately when user logs in if we have internet
  useEffect(() => {
    if (sessionToken && user?.id) {
      NetInfo.fetch().then(state => {
        if (state.isConnected && state.isInternetReachable !== false) {
          SyncService.pushChanges(user.id!);
        }
      });
    }
  }, [sessionToken, user?.id]);

  // Update store when decks are fetched
  useEffect(() => {
    // This is now handled by loadDecks in initializeStore
  }, []);

  // Navigation and data cleanup based on auth state
  useEffect(() => {
    if (!isMounted || isLoadingAuth) {
      return;
    }

    const currentSegment = segments[0] || null;

    if (sessionToken) {
      // If we are logged in, make sure we are not in (auth)
      if (currentSegment === '(auth)') {
        console.log('[AppLayout] Session exists, redirecting to home');
        router.replace('/');
      }
    } else {
      // If no session token and not in auth flow, redirect to login
      if (currentSegment !== '(auth)') {
        console.log('[AppLayout] No session, clearing store and redirecting to login');
        useFlashcardStore.getState().clearStore();
        router.replace('/login');
      }
    }
  }, [sessionToken, segments, router, isLoadingAuth, isMounted]);

  // Hide splash when ready
  useEffect(() => {
    if (!isLoadingAuth && isMounted && fontsLoaded) {
      console.log('[AppLayout] Ready, hiding splash screen');
      SplashScreen.hideAsync();
    }
  }, [isLoadingAuth, isMounted, fontsLoaded]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

import { DatabaseProvider } from '../db/DatabaseProvider';

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