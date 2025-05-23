import { createTRPCReact, httpBatchLink, loggerLink } from '@trpc/react-query';
import type { AppRouter } from '../backend/trpc/app-router';
import { Platform } from 'react-native';
import { useUserStore } from '../store/user-store';

// Note: We are NOT using superjson here due to previous issues with Expo API routes.

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  // For web development with `npx expo start --web`, localhost usually works.
  if (Platform.OS === 'web') {
    // Assuming API is at /api/trpc relative to the host serving the web app
    // Expo Router handles this for web if API is on same domain
    // For production web, you'd use your actual domain.
    return '/api/trpc'; // Relative path for web
  }

  // For native mobile (iOS/Android), you need your machine's local IP or a tunnel (e.g., ngrok).
  // Replace 'YOUR_LOCAL_IP_ADDRESS_HERE' with the actual IP/URL.
  // Example: 'http://192.168.1.100:8081/api/trpc' (replace port if different)
  // IMPORTANT: This will NOT work with 'localhost' on native emulators/devices.
  // !!! REPLACE 'YOUR_LOCAL_IP_ADDRESS_HERE' AND PORT IF NECESSARY !!!
  const localDevUrl = 'http://192.168.29.96:8081/api/trpc'; // Placeholder - MUST BE REPLACED FOR NATIVE
  console.warn(
    'getBaseUrl in utils/trpc.ts is using localhost for native. ' +
    'This will likely fail. Replace with your machine\'s local IP address or ngrok URL for native development.'
  );
  return localDevUrl; 
};

// Function to get the token, replace with your actual token storage mechanism
// e.g., from expo-secure-store
async function getToken(): Promise<string | null> {
  try {
    const token = useUserStore.getState().sessionToken;
    if (token) {
      return token;
    }
    // console.warn('getToken: No token found in user store.'); // Optional: for debugging
    return null;
  } catch (e) {
    console.error('getToken: Failed to get token from user store', e);
    return null;
  }
}

export const trpcClient = trpc.createClient({
  links: [
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === 'development' ||
        (opts.direction === 'down' && opts.result instanceof Error),
      colorMode: 'ansi',
    }),
    httpBatchLink({
      url: getBaseUrl(),
      async headers() {
        const token = await getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
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