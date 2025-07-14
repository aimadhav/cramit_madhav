import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, View } from 'react-native';
import { OfflineStatusBar } from '../components/OfflineStatusBar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Ensure no useColorScheme references remain
import { trpc, trpcClient } from '../utils/trpc';
import { useUserStore } from '../store/user-store';
import { useFlashcardStore } from '../store/flashcard-store';
import { Deck, Flashcard, ContentType } from '@/types';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// This new component will handle data fetching and navigation logic,
// and will be rendered inside the providers.
function AppNavigatorAndDataHandler() {
  const segments = useSegments();
  const router = useRouter();
  const sessionToken = useUserStore((state) => state.sessionToken);
  const isLoadingAuth = useUserStore((state) => state.isLoading);
  const user = useUserStore((state) => state.user);
  const { loadInitialData, decks: decksFromStore, flashcards: flashcardsFromStore } = useFlashcardStore();
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false); // Cleanup on unmount
  }, []);

  const { data: userDecksResult, isLoading: isLoadingUserDecks, refetch: refetchUserDecks } = 
    trpc.deck.listUserDecks.useQuery(
    undefined,
    { enabled: !!sessionToken && !!user && user.isLoggedIn && !isLoadingAuth }
  );

  const { data: publicDecksResult, isLoading: isLoadingPublicDecks, refetch: refetchPublicDecks } = 
    trpc.deck.listPublic.useQuery(
    undefined, 
    { enabled: true } 
  );
  
  // Effect for navigation based on auth state
  useEffect(() => {
    if (!isMounted || isLoadingAuth) {
      console.log("[AppNavigatorAndDataHandler] Navigation deferred: component not yet fully mounted or auth is loading.");
      return;
    }

    const currentSegment = segments[0] || null;
    console.log(`[AppNavigatorAndDataHandler] Navigation check: sessionToken: ${!!sessionToken}, currentSegment: ${currentSegment}, isLoadingAuth: ${isLoadingAuth}`);

    // If no session token, and we are not already in the auth flow, redirect to login.
    if (!sessionToken && currentSegment !== '(auth)') {
      console.log("[AppNavigatorAndDataHandler] No session, not in auth flow. Redirecting to login.");
      router.replace('/(auth)/login');
    } 
    // If there IS a session token, and we are currently in the auth flow (e.g. on login screen after logging in),
    // redirect to the main app (tabs).
    else if (sessionToken && currentSegment === '(auth)') {
      console.log("[AppNavigatorAndDataHandler] Session exists, currently in auth flow. Redirecting to (tabs).");
      router.replace('/(tabs)');
    }
    // Optional: If there IS a session token, but we are on some undefined root route (e.g. segments is empty or not (auth)/(tabs))
    // This case might be needed if your app can land in a state outside of defined groups after login 
    // but before this effect correctly redirects. For many setups, the above two are sufficient.
    // else if (sessionToken && !currentSegment && currentSegment !== '(tabs)') {
    //   console.log("[AppNavigatorAndDataHandler] Session exists, no specific segment or not in tabs. Redirecting to (tabs).");
    //   router.replace('/(tabs)');
    // }
    
    console.log("[AppNavigatorAndDataHandler] Navigation check complete.");
  }, [sessionToken, segments, router, isLoadingAuth, isMounted]);

  // Effect for fetching DECK data after login or on app start if already logged in
  useEffect(() => {
    const fetchDeckData = async () => {
      if (!user || !user.isLoggedIn || isLoadingAuth) {
        if (!user || !user.isLoggedIn) {
          // Use getState to avoid making decksFromStore/flashcardsFromStore dependencies
          const { decks: currentDecks, flashcards: currentFlashcards } = useFlashcardStore.getState();
          if(currentDecks.length > 0 || currentFlashcards.length > 0) {
            console.log("[AppNavigatorAndDataHandler] User logged out or not present, clearing flashcard store (from fetchDeckData initial check).");
            loadInitialData([], []);
          }
        }
        setIsDataLoading(false); // Ensure loading is false if no user
        return;
      }

      console.log("[AppNavigatorAndDataHandler] User is logged in. Starting DECK data fetch sequence.");
      setIsDataLoading(true);

      try {
        const userDecksResponse = await refetchUserDecks();
        const fetchedUserDecksInput = userDecksResponse?.data || [];
        const processedUserDecks: Deck[] = fetchedUserDecksInput.map(deck => ({
            ...deck, 
            createdAt: deck.createdAt ? new Date(deck.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: deck.updatedAt ? new Date(deck.updatedAt).toISOString() : new Date().toISOString(),
            cardCount: deck._count?.flashcards ?? 0
        }));
        
        // Use publicDecksResult directly, which is a dependency of this effect
        const fetchedPublicDecksInput = publicDecksResult || [];
        const processedPublicDecks: Deck[] = fetchedPublicDecksInput.map(deck => ({
            ...deck,
            createdAt: deck.createdAt ? new Date(deck.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: deck.updatedAt ? new Date(deck.updatedAt).toISOString() : new Date().toISOString(),
            cardCount: deck._count?.flashcards ?? 0
        }));

        console.log("[AppNavigatorAndDataHandler] Processed user decks:", processedUserDecks.length);
        console.log("[AppNavigatorAndDataHandler] Processed public decks:", processedPublicDecks.length);

        let combinedDecks: Deck[] = [...processedUserDecks];
        processedPublicDecks.forEach(pDeck => {
          if (!combinedDecks.find(d => d.id === pDeck.id)) {
            combinedDecks.push(pDeck);
          }
        });
        
        console.log("[AppNavigatorAndDataHandler] Combined unique decks:", combinedDecks.length);
        useFlashcardStore.getState().setDecks(combinedDecks);
        console.log("[AppNavigatorAndDataHandler] DECK data loaded into flashcard store. Flashcards will be loaded on demand.");

      } catch (error) {
        console.error('[AppNavigatorAndDataHandler] Error fetching and processing DECK data:', error);
        // Display an alert if there's an error
        Alert.alert(
          "Connection Error",
          "Failed to load data. Please check your internet connection and try again.",
          [{ text: "OK" }]
        );
        loadInitialData([], []); 
      } finally {
        setIsDataLoading(false);
        console.log("[AppNavigatorAndDataHandler] DECK data fetch sequence complete. isDataLoading: false");
      }
    };

    if (user && user.isLoggedIn && !isLoadingAuth) {
        fetchDeckData();
    } else if (!user || !user.isLoggedIn) {
        const { decks: currentDecks, flashcards: currentFlashcards } = useFlashcardStore.getState();
        if (currentDecks.length > 0 || currentFlashcards.length > 0) {
            console.log("[AppNavigatorAndDataHandler] User logged out, clearing data from main effect body.");
            loadInitialData([], []);
        }
        setIsDataLoading(false);
    }
  // refetchUserDecks is a stable function from useQuery.
  // publicDecksResult is data from useQuery; effect should run if this data changes.
  // user.id and user.isLoggedIn make the effect sensitive to user state changes.
  // isLoadingAuth ensures we wait for auth to resolve.
  // loadInitialData is removed as a dep; it's an action taken within the effect.
  }, [user?.id, user?.isLoggedIn, isLoadingAuth, publicDecksResult, refetchUserDecks, loadInitialData]); 
  // Re-added loadInitialData as it's used in the effect and should be stable from Zustand.
  // The main culprits (decksFromStore, flashcardsFromStore) are removed.

  useEffect(() => {
    if (!isLoadingAuth && !isDataLoading && isMounted) { // ensure mounted before hiding splash
      console.log("[AppNavigatorAndDataHandler] Attempting to hide splash screen. isLoadingAuth:", isLoadingAuth, "isDataLoading:", isDataLoading);
      SplashScreen.hideAsync();
    }
  }, [isLoadingAuth, isDataLoading, isMounted]); // ensure mounted

  // If data is loading (specifically after login), show null or a spinner
  // isLoadingAuth is handled by RootLayout's conditional rendering of this component
  if (isDataLoading && user && user.isLoggedIn) {
    return null; 
  }

  // Render the main navigation stack
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [loadedFonts, fontError] = useFonts({
    // SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'), // Commented out for now
    // Add other fonts here if you have them
  });
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
        console.error("Auth check failed during prepareAuth:", e);
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