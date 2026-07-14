import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/components/AppText';
import { AuthService } from '@/services/auth-service';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim()) {
      Alert.alert('Email required', 'Enter the email address used for your Cramit account.');
      return;
    }
    try {
      setLoading(true);
      await AuthService.requestPasswordReset(email);
      Alert.alert(
        'Check your email',
        'If an account exists for that address, a password reset link is on its way.',
        [{ text: 'Back to sign in', onPress: () => router.replace('/login') }],
      );
    } catch {
      // Keep the response generic so this screen cannot be used to enumerate accounts.
      Alert.alert('Could not send the link', 'Please wait a moment and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.brand}><Text style={styles.mark}>✦</Text> Cramit<Text style={styles.mark}>.</Text></Text>
      <Text style={styles.title}>Reset your password</Text>
      <Text style={styles.message}>We’ll email you a secure link to choose a new password.</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        editable={!loading}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        placeholder="Email address"
        placeholderTextColor="#666B78"
        style={styles.input}
      />
      <TouchableOpacity style={[styles.button, loading && styles.disabled]} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Send reset link</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.replace('/login')} style={styles.secondaryButton}>
        <Text style={styles.secondaryText}>Back to sign in</Text>
      </TouchableOpacity>
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
  button: { height: 52, borderRadius: 14, backgroundColor: '#5e6ad2', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Outfit_700Bold' },
  secondaryButton: { alignItems: 'center', paddingVertical: 16 },
  secondaryText: { color: '#8E98FF', fontSize: 14, fontFamily: 'Outfit_600SemiBold' },
  disabled: { opacity: 0.6 },
});
