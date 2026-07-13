import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

import { Text } from '@/components/AppText';
import { AuthService } from '@/services/auth-service';
import { useUserStore } from '@/store/user-store';

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function finishSignIn() {
      try {
        if (params.error_description) throw new Error(params.error_description);
        if (!params.code) throw new Error('Google did not return a sign-in code.');

        await AuthService.completeOAuthCallback(params.code);
        if (!active) return;
        router.replace(useUserStore.getState().user?.prepFocus ? '/' : ('/onboarding' as any));
      } catch (error: any) {
        if (active) setErrorMessage(error?.message || 'Google sign-in could not be completed.');
      }
    }

    void finishSignIn();
    return () => { active = false; };
  }, [params.code, params.error_description, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>
        <Text style={styles.brandMark}>✦</Text> Cramit<Text style={styles.brandMark}>.</Text>
      </Text>
      {errorMessage ? (
        <>
          <Text style={styles.title}>We couldn’t finish signing you in</Text>
          <Text style={styles.message}>{errorMessage}</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/login')}>
            <Text style={styles.buttonText}>Back to sign in</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color="#6C7BFF" />
          <Text style={styles.title}>Finishing your sign-in…</Text>
          <Text style={styles.message}>Just a moment while we prepare your study space.</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0B0F', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  brand: { position: 'absolute', top: 72, color: '#FFFFFF', fontSize: 28, fontFamily: 'Outfit_700Bold' },
  brandMark: { color: '#6C7BFF' },
  title: { color: '#FFFFFF', fontSize: 20, fontFamily: 'Outfit_700Bold', textAlign: 'center', marginTop: 22 },
  message: { color: '#8B91A5', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  button: { marginTop: 24, minHeight: 50, paddingHorizontal: 24, borderRadius: 15, backgroundColor: '#6C7BFF', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Outfit_700Bold' },
});
