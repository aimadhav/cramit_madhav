import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn('Supabase env vars are missing; using a placeholder client so the app can bundle.');
}

const resolvedSupabaseUrl = supabaseUrl ?? 'https://example.com';
const resolvedSupabaseAnonKey = supabaseAnonKey ?? 'placeholder-anon-key';

// Create Supabase client for frontend use
const isServer = typeof window === 'undefined';

export const supabase = createClient(resolvedSupabaseUrl, resolvedSupabaseAnonKey, {
  auth: {
    // Only use AsyncStorage if we are not on the server
    storage: isServer ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    flowType: 'pkce',
    detectSessionInUrl: true,
  },
});
