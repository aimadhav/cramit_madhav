import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Ensure no useColorScheme references remain
import { trpc, trpcClient } from '../utils/trpc';
import { useUserStore } from '../store/user-store';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    // SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'), // Commented out for now
    // Add other fonts here if you have them
  });
  const { checkAuthStatus } = useUserStore.getState();
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

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
    // If SpaceMono or other critical fonts were loaded, 'loaded' would gate this.
    // Since we commented out SpaceMono, we might need to adjust logic if no fonts are loaded.
    // For now, assuming 'loaded' becomes true even with an empty fonts object or if other fonts exist.
    // If 'useFonts' with an empty object makes 'loaded' false, this needs adjustment.
    // However, typical behavior is 'loaded' becomes true quickly if the object is empty.
    if (loaded && isAuthChecked) { 
      SplashScreen.hideAsync();
    }
  }, [loaded, isAuthChecked]);

  // If no fonts are being loaded, 'loaded' might be true immediately.
  // So, the splash screen might hide very quickly or before auth check is done.
  // Consider if !isAuthChecked should be enough to show null if no fonts are critical for initial render.
  if (!isAuthChecked) { // Changed: primarily wait for auth check if fonts are not critical or empty
    return null;
  }
  // If you add fonts back, revert to: if (!loaded || !isAuthChecked)

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const segments = useSegments();
  const router = useRouter();
  const sessionToken = useUserStore((state) => state.sessionToken);
  const isLoadingAuth = useUserStore((state) => state.isLoading);

  useEffect(() => {
    if (isLoadingAuth) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (!sessionToken && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (sessionToken && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [sessionToken, segments, router, isLoadingAuth]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}