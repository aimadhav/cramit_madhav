import { createTRPCReact, httpBatchLink, loggerLink } from '@trpc/react-query';
import type { AppRouter } from '../backend/trpc/app-router';
import { Platform } from 'react-native';
import { useUserStore, REFRESH_TOKEN_STORAGE_KEY, TOKEN_STORAGE_KEY, AppUser } from '../store/user-store';
import Constants from "expo-constants";
import * as SecureStore from 'expo-secure-store';
import { TRPCClientError, TRPCLink, Operation } from "@trpc/client";
import { observable, Observable } from "@trpc/server/observable";
import { TRPCResponse, TRPCErrorShape } from "@trpc/server/rpc";

// Note: We are NOT using superjson here due to previous issues with Expo API routes.

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (typeof window !== "undefined") return ""; // browser should use relative path
  // Assume local development if not on Vercel or other known prod environment
  const localhost = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';
  
  // Use EXPO_PUBLIC_API_URL if available (e.g. from .env)
  if (process.env.EXPO_PUBLIC_API_URL) {
    console.log('[TRPC Client] Using EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // Fallback for local development on native
  if (Platform.OS === "android" || Platform.OS === "ios") {
    // This is a common source of issues. Ensure your API is accessible from your device.
    // Using 10.0.2.2 for Android emulator, or your machine's local IP for physical devices/iOS simulator.
    // For Expo Go, the hostUri is usually correct if the server is on the same machine.
    const apiUrl = `http://${localhost}:8081`; // Default for local Expo dev server
    console.warn(
      `getBaseUrl in utils/trpc.ts is using ${apiUrl} for native. This will likely fail if your API is not running there or accessible. Replace with your machine's local IP address or ngrok URL for native development if needed.`
    );
    return apiUrl;
  }
  // Default for web/other platforms (could be http://localhost:3000 or similar)
  const webApiUrl = `http://${localhost}:8081`;
  console.log('[TRPC Client] Using base URL for API calls (web/other):', webApiUrl);
  return webApiUrl;
};

// Function to get the current access token
const getToken = async () => {
  try {
    return await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

// Function to get the current refresh token
const getRefreshToken = async () => {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
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
                    await logout();
                    throw new TRPCClientError('Token refresh failed: No session/user data');
                  }
                } catch (refreshError: any) {
                  console.error('[TRPC AuthLink] Error during token refresh process. Logging out.', refreshError);
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
        const token = await getToken();
        if (token) {
          return {
            Authorization: `Bearer ${token}`,
          };
        }
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