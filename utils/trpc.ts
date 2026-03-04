import { createTRPCReact, httpBatchLink, loggerLink } from '@trpc/react-query';
import { createTRPCClient } from '@trpc/client';
import type { AppRouter } from '../backend/trpc/app-router';
import { Platform, Alert } from 'react-native';
import { useUserStore, REFRESH_TOKEN_STORAGE_KEY, TOKEN_STORAGE_KEY, OFFLINE_MODE_TOKEN, AppUser } from '../store/user-store';
import Constants from "expo-constants";
import * as SecureStore from 'expo-secure-store';
import { TRPCClientError, TRPCLink, Operation } from "@trpc/client";
import { observable, Observable } from "@trpc/server/observable";
import { TRPCResponse, TRPCErrorShape } from "@trpc/server/rpc";

// Note: We are NOT using superjson here due to previous issues with Expo API routes.

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  // Always prioritize EXPO_PUBLIC_API_URL if available
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Browser-specific relative path if no EXPO_PUBLIC_API_URL
  if (typeof window !== "undefined") {
    return ""; // browser should use relative path
  }

  // Native-specific fallbacks (Expo Go)
  const localhost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (localhost) {
    const apiUrl = `http://${localhost}:8081`;
    console.log(`[TRPC Client] Detected Expo Go host: ${apiUrl}`);
    return apiUrl;
  }

  // Last resort fallback
  const fallbackUrl = 'http://localhost:8081';
  console.warn(
    `[TRPC Client] Could not detect Expo Go hostUri. Falling back to ${fallbackUrl}. Ensure EXPO_PUBLIC_API_URL is set if this is incorrect.`
  );
  return fallbackUrl;
};

// Function to get the current access token
const getToken = async () => {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } else {
      return await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
    }
  } catch (e) {
    console.error("Error getting token:", e);
    return null;
  }
};

// Function to get the current refresh token
const getRefreshToken = async () => {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    } else {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY);
    }
  } catch (e) {
    console.error("Error getting refresh token:", e);
    return null;
  }
};

let isRefreshingToken = false;
let refreshTokenPromise: Promise<void> | null = null;
let tokenRefreshTimeout: ReturnType<typeof setTimeout> | null = null;

// Function to schedule token refresh
const scheduleTokenRefresh = (expiresAt: number) => {
  if (tokenRefreshTimeout) {
    clearTimeout(tokenRefreshTimeout);
  }

  const FIVE_MINUTES = 5 * 60 * 1000;
  const refreshTime = expiresAt - FIVE_MINUTES - Date.now();
  
  if (refreshTime > 0) {
    tokenRefreshTimeout = setTimeout(async () => {
      const { shouldRefreshToken, logout } = useUserStore.getState();
      if (shouldRefreshToken()) {
        try {
          const refreshToken = await getRefreshToken();
          if (!refreshToken) {
  
            await logout();
            return;
          }


          const freshSessionData = await trpcClient.auth.refreshSession.mutate({
            refreshToken,
          });

          if (freshSessionData.session && freshSessionData.user) {
            const { setSession, user } = useUserStore.getState();
            const currentUserData = user || ({} as Partial<AppUser>);
            const updatedAppUser: AppUser = {
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
              studyStats: currentUserData.studyStats ?? {
                totalCardsStudied: 0,
                totalTimeStudied: 0,
                streakDays: 0,
                lastStudyDate: null,
              },
              ownedDecks: currentUserData.ownedDecks ?? [],
              phone: freshSessionData.user.phone ?? currentUserData.phone ?? undefined,
            };

            setSession(
              updatedAppUser,
              freshSessionData.session.access_token,
              freshSessionData.session.refresh_token,
              freshSessionData.session.expires_at
            );

            // Schedule next refresh
            if (freshSessionData.session.expires_at) {
              scheduleTokenRefresh(freshSessionData.session.expires_at);
            }
          }
        } catch (error) {
          console.error('[Token Refresh] Failed to refresh token:', error);
          await logout();
        }
      }
    }, refreshTime);
  }
};

// Update the auth link to handle token refresh
const authLink: TRPCLink<AppRouter> = () => {
  return (opts: { op: Operation; next: (op: Operation) => Observable<any, TRPCClientError<AppRouter>> }) => {
    const { op, next } = opts;
    return observable((observer) => {
      const unsubscribe = next(op).subscribe({
        next: (result) => {
          // Check if this is a login or refresh response
          if (result.data?.session?.expires_at) {
            scheduleTokenRefresh(result.data.session.expires_at);
          }
          observer.next(result);
        },
        error: async (err: TRPCClientError<AppRouter>) => {
          const { logout, setSession, user, shouldRefreshToken, sessionToken } = useUserStore.getState();

          if (sessionToken === OFFLINE_MODE_TOKEN) {
            observer.error(err);
            return;
          }

          if (err instanceof TRPCClientError && err.data?.code === 'UNAUTHORIZED') {
            console.warn('[TRPC AuthLink] Unauthorized error detected:', err.message);

            if (err.message === 'Invalid login credentials') {
              observer.error(err);
              return;
            }

            if (!isRefreshingToken) {
              isRefreshingToken = true;
              refreshTokenPromise = (async () => {
                try {
                  const currentRefreshToken = await getRefreshToken();
                  if (!currentRefreshToken) {

                    Alert.alert(
                      "Session Expired",
                      "Your session has expired. Please log in again.",
                      [{ text: "OK" }]
                    );
                    await logout();
                    throw new TRPCClientError('No refresh token available');
                  }


                  const freshSessionData = await trpcClient.auth.refreshSession.mutate({
                    refreshToken: currentRefreshToken,
                  });

                  if (freshSessionData.session && freshSessionData.user) {

                    const currentUserData = user || ({} as Partial<AppUser>);
                    const updatedAppUser: AppUser = {
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
                      studyStats: currentUserData.studyStats ?? {
                        totalCardsStudied: 0,
                        totalTimeStudied: 0,
                        streakDays: 0,
                        lastStudyDate: null,
                      },
                      ownedDecks: currentUserData.ownedDecks ?? [],
                      phone: freshSessionData.user.phone ?? currentUserData.phone ?? undefined,
                    };

                    setSession(
                      updatedAppUser,
                      freshSessionData.session.access_token,
                      freshSessionData.session.refresh_token,
                      freshSessionData.session.expires_at
                    );

                    // Schedule next refresh
                    if (freshSessionData.session.expires_at) {
                      scheduleTokenRefresh(freshSessionData.session.expires_at);
                    }
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

                }
              })();
            }

            if (refreshTokenPromise) {
              try {
                await refreshTokenPromise;

                next(op).subscribe(observer);
                return;
              } catch (retryError: any) {
                observer.error(retryError as TRPCClientError<AppRouter>);
                return;
              }
            }
          }
          observer.error(err);
        },
        complete: () => observer.complete(),
      });
      return unsubscribe;
    });
  };
};

export const trpcClient = createTRPCClient<AppRouter>({
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
        if (token && token !== OFFLINE_MODE_TOKEN) {
          return {
            Authorization: `Bearer ${token}`,
          };
        }
        return {};
      },
    }),
  ],
});
