import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import Constants from "expo-constants";
import { Platform } from "react-native";
import * as SecureStore from 'expo-secure-store';

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  // Get the localhost URL for the appropriate platform
  const localhost = Platform.OS === "android" ? "10.0.2.2" : "localhost";

  // Default development URL (will be overridden by env vars if present)
  let urlToUse = `http://${localhost}:8081`;

  // Check for Expo environment variables first
  if (process.env.EXPO_PUBLIC_API_URL) {
    urlToUse = process.env.EXPO_PUBLIC_API_URL;
  } else if (Constants.expoConfig?.extra?.apiUrl) { // For development in Expo Go via app.json extra
    urlToUse = Constants.expoConfig.extra.apiUrl;
  }

  console.log('[TRPC Client] Using base URL for API calls:', urlToUse); // Added for debugging
  return urlToUse;
};

// Basic identity transformer for standard JSON behavior
const identityTransformer = {
  serialize: (object: any) => object,
  deserialize: (object: any) => object,
};

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      // transformer: identityTransformer, // Try removing explicit transformer again
      // Attempting to rely on tRPC default JSON handling if no transformer is specified
      // And if the backend also specifies no transformer.
      // If 'transformer' is truly required by type, this might error.
      async headers() {
        let token: string | null = null;
        try {
          console.log('[TRPC Headers] Attempting to retrieve auth token from SecureStore...');
          token = await SecureStore.getItemAsync('sessionToken'); 
        } catch (e) {
          console.error("[TRPC Headers] Error retrieving auth token from SecureStore:", e);
        }

        if (token) {
          console.log("[TRPC Headers] Token found, adding Authorization header.");
          return {
            authorization: `Bearer ${token}`,
          };
        }
        console.log("[TRPC Headers] No token found in SecureStore.");
        return {};
      },
    }),
  ],
});