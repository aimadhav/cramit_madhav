import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Text } from '@/components/AppText';
import { AuthService } from '@/services/auth-service';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    access_token?: string;
    refresh_token?: string;
    error_description?: string;
  }>();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (params.error_description) throw new Error(params.error_description);
        await AuthService.completeRecoveryCallback({
          code: params.code,
          accessToken: params.access_token,
          refreshToken: params.refresh_token,
        });
        if (active) setReady(true);
      } catch (recoveryError: any) {
        if (active) setError(recoveryError?.message || 'This reset link is invalid or expired.');
      }
    })();
    return () => { active = false; };
  }, [params.code, params.access_token, params.refresh_token, params.error_description]);

  const save = async () => {
    if (password.length < 8) {
      Alert.alert('Use a stronger password', 'Your password must contain at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Enter the same password in both fields.');
      return;
    }
    try {
      setSaving(true);
      await AuthService.updatePassword(password);
      Alert.alert('Password updated', 'Your new password is ready to use.', [
        { text: 'Continue', onPress: () => router.replace('/') },
      ]);
    } catch (saveError: any) {
      Alert.alert('Could not update password', saveError?.message || 'Please request a new reset link.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.brand}><Text style={styles.mark}>✦</Text> Cramit<Text style={styles.mark}>.</Text></Text>
      {!ready && !error ? (
        <><ActivityIndicator color="#5e6ad2" /><Text style={styles.message}>Verifying your reset link…</Text></>
      ) : error ? (
        <>
          <Text style={styles.title}>Reset link unavailable</Text>
          <Text style={styles.message}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/forgot-password')}>
            <Text style={styles.buttonText}>Request another link</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.title}>Choose a new password</Text>
          <Text style={styles.message}>Use at least 8 characters and avoid a password you use elsewhere.</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="New password" placeholderTextColor="#666B78" style={styles.input} />
          <TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Confirm password" placeholderTextColor="#666B78" style={[styles.input, styles.secondInput]} />
          <TouchableOpacity style={[styles.button, saving && styles.disabled]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Update password</Text>}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: '#0A0B0F', paddingHorizontal: 24 },
  brand: { color: '#FFFFFF', fontSize: 28, fontFamily: 'Outfit_700Bold', marginBottom: 36 },
  mark: { color: '#5e6ad2' },
  title: { color: '#FFFFFF', fontSize: 25, fontFamily: 'Outfit_700Bold' },
  message: { color: '#9094A0', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 24 },
  input: { height: 54, borderRadius: 14, borderWidth: 1, borderColor: '#242733', backgroundColor: '#14161C', color: '#FFFFFF', paddingHorizontal: 16, fontSize: 15 },
  secondInput: { marginTop: 10 },
  button: { height: 52, borderRadius: 14, backgroundColor: '#5e6ad2', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Outfit_700Bold' },
  disabled: { opacity: 0.6 },
});
