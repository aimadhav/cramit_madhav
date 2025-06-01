import { createTRPCReact, httpBatchLink, loggerLink } from '@trpc/react-query';
import type { AppRouter } from '../backend/trpc/app-router';
import { Platform, Alert } from 'react-native';
import { useUserStore, REFRESH_TOKEN_STORAGE_KEY, TOKEN_STORAGE_KEY, AppUser } from '../store/user-store';
import Constants from "expo-constants";
import * as SecureStore from 'expo-secure-store';
import { TRPCClientError, TRPCLink, Operation } from "@trpc/client";
import { observable, Observable } from "@trpc/server/observable";
import { TRPCResponse, TRPCErrorShape } from "@trpc/server/rpc";

// Note: We are NOT using superjson here due to previous issues with Expo API routes.

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  // 1. Always prioritize EXPO_PUBLIC_API_URL if available
  if (process.env.EXPO_PUBLIC_API_URL) {
    console.log('[TRPC Client] Using EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Browser-specific relative path if no EXPO_PUBLIC_API_URL
  if (typeof window !== "undefined") {
    console.log('[TRPC Client] Web environment, EXPO_PUBLIC_API_URL not set. Using relative path for API.');
    return ""; // browser should use relative path
  }

  // 3. Native-specific fallbacks
  const localhost = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';
  
  if (Platform.OS === "android" || Platform.OS === "ios") {
    const apiUrl = `http://${localhost}:8081`; 
  console.warn(
      `[TRPC Client] Native environment, EXPO_PUBLIC_API_URL not set. Using guessed API URL: ${apiUrl}. Ensure this is correct or set EXPO_PUBLIC_API_URL.`
    );
    return apiUrl;
  }
  
  // 4. Default for other platforms (should ideally not be reached if web/native handled)
  const defaultApiUrl = `http://${localhost}:8081`;
  console.log('[TRPC Client] Other platform/environment, EXPO_PUBLIC_API_URL not set. Using default API URL:', defaultApiUrl);
  return defaultApiUrl;
};

// Function to get the current access token
const getToken = async () => {
  try {
    if (Platform.OS === 'web') {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      console.log(`[TRPC Client] getToken (web): localStorage.getItem(${TOKEN_STORAGE_KEY}) returned:`, token ? "token_found_not_empty" : token);
      return token;
    } else {
      return await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
    }
  } catch (e) { // Catch potential errors from localStorage or SecureStore
    console.error("Error getting token:", e);
    return null;
  }
};

// Function to get the current refresh token
const getRefreshToken = async () => {
  try {
    if (Platform.OS === 'web') {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
      console.log(`[TRPC Client] getRefreshToken (web): localStorage.getItem(${REFRESH_TOKEN_STORAGE_KEY}) returned:`, refreshToken ? "token_found_not_empty" : refreshToken);
      return refreshToken;
    } else {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY);
    }
  } catch (e) { // Catch potential errors
    console.error("Error getting refresh token:", e);
    return null;
  }
};

let isRefreshingToken = false;
let refreshTokenPromise: Promise<void> | null = null;

// Simpler type for the link function argument for broader compatibility
// TRPCLink is a function that takes Operation and returns an Observable
const authLink: TRPCLink<AppRouter> = () => {
  // This function is an OperationLink<AppRouter>
  return (opts: { op: Operation; next: (op: Operation) => Observable<any, TRPCClientError<AppRouter>> }) => {
    const { op, next } = opts;
    return observable((observer) => {
      const unsubscribe = next(op).subscribe({
        error: async (err: TRPCClientError<AppRouter>) => {
          const { logout, setSession, user } = useUserStore.getState();

          if (err instanceof TRPCClientError && err.data?.code === 'UNAUTHORIZED') {
            console.warn('[TRPC AuthLink] Unauthorized error detected:', err.message);

            if (!isRefreshingToken) {
              isRefreshingToken = true;
              refreshTokenPromise = (async () => {
                try {
                  const currentRefreshToken = await getRefreshToken();
                  if (!currentRefreshToken) {
                    console.log('[TRPC AuthLink] No refresh token found. Logging out.');
                    Alert.alert(
                      "Session Expired",
                      "Your session has expired. Please log in again.",
                      [{ text: "OK" }]
                    );
                    await logout();
                    throw new TRPCClientError('No refresh token available');
                  }

                  console.log('[TRPC AuthLink] Attempting to refresh token...');
                  const freshSessionData = await trpcClient.auth.refreshSession.mutate({
                    refreshToken: currentRefreshToken,
                  });

                  if (freshSessionData.session && freshSessionData.user) {
                    console.log('[TRPC AuthLink] Token refresh successful. Updating session.');
                    const currentUserData = user || ({} as Partial<AppUser>); // User from store might be null
                    const updatedAppUser: AppUser = {
                        // It's crucial to ensure all fields of AppUser are correctly populated.
                        // Start with defaults or ensure currentUserData has them.
                        id: freshSessionData.user.id,
                        email: freshSessionData.user.email ?? null,
                        isLoggedIn: true, 
                        name: freshSessionData.user.user_metadata?.full_name ?? 
                              freshSessionData.user.user_metadata?.name ?? 
                              currentUserData.name ?? 
                              null,
                        isPremium: currentUserData.isPremium ?? false,
                        createdAt: currentUserData.createdAt ?? Date.now(),
                        updatedAt: Date.now(), 
                        studyStats: currentUserData.studyStats ?? { totalCardsStudied: 0, totalTimeStudied: 0, streakDays: 0, lastStudyDate: null },
                        ownedDecks: currentUserData.ownedDecks ?? [],
                        phone: freshSessionData.user.phone ?? currentUserData.phone ?? undefined,
                    };
                    setSession(
                        updatedAppUser,
                        freshSessionData.session.access_token,
                        freshSessionData.session.refresh_token
                    );
                    console.log('[TRPC AuthLink] Session updated with new tokens.');
                  } else {
                    console.error('[TRPC AuthLink] Token refresh failed: No session or user in response. Logging out.');
                    Alert.alert(
                      "Session Expired",
                      "Could not refresh your session. Please log in again.",
                      [{ text: "OK" }]
                    );
                    await logout();
                    throw new TRPCClientError('Token refresh failed: No session/user data');
                  }
                } catch (refreshError: any) {
                  console.error('[TRPC AuthLink] Error during token refresh process. Logging out.', refreshError);
                  Alert.alert(
                    "Session Expired",
                    "An error occurred while refreshing your session. Please log in again.",
                    [{ text: "OK" }]
                  );
                  await logout();
                  throw new TRPCClientError(refreshError.message || 'Failed to refresh token and was logged out');
                } finally {
                  isRefreshingToken = false;
                  refreshTokenPromise = null;
                  console.log('[TRPC AuthLink] Token refresh process finished.');
                }
              })();
            }

            if (refreshTokenPromise) {
              try {
                await refreshTokenPromise;
                console.log('[TRPC AuthLink] Retrying operation after token refresh:', op.path);
                // Retry the original operation by re-subscribing
                // The observer from the outer observable is passed to the new subscription
                next(op).subscribe(observer);
                return; 
              } catch (retryError: any) {
                observer.error(retryError as TRPCClientError<AppRouter>);
                return;
              }
            }
          }
          observer.error(err); // Forward other errors or if refresh fails to handle
        },
        // Use `any` for result if specific shape causes issues, 
        // but ideally it should align with what `next(op)` emits.
        next: (result: any) => observer.next(result),
        complete: () => observer.complete(),
      });
      return unsubscribe;
    });
  };
};

export const trpcClient = trpc.createClient({
  links: [
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === 'development' ||
        (opts.direction === 'down' && opts.result instanceof Error),
      colorMode: 'ansi',
    }),
    authLink,
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      async headers() {
        console.log('[TRPC Client] httpBatchLink: headers function called.');
        const token = await getToken();
        if (token) {
          console.log('[TRPC Client] httpBatchLink: Token found, adding Authorization header.');
          return {
            Authorization: `Bearer ${token}`,
          };
        }
        console.warn('[TRPC Client] httpBatchLink: No token found. Authorization header will be missing.');
        return {};
      },
    }),
  ],
});

// The TRPCProvider component will be used in your _app.tsx or root layout
// Example for app/_layout.tsx:
// import { trpc, trpcClient } from '../utils/trpc';
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// ...
// const [queryClient] = useState(() => new QueryClient());
// ...
// return (
//   <trpc.Provider client={trpcClient} queryClient={queryClient}>
//     <QueryClientProvider client={queryClient}>
//       {/* Your app's navigation stack */}
//     </QueryClientProvider>
//   </trpc.Provider>
// );