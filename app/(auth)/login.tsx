import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../utils/trpc';
import { useUserStore } from '../../store/user-store';
import type { AppUser } from '../../store/user-store';
import { Image } from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { setSession } = useUserStore.getState();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      if (data.session && data.user && data.user.email) {
        const appUser: AppUser = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name || null,
          isLoggedIn: true,
          isPremium: false,
          createdAt: new Date(data.user.created_at || Date.now()).getTime(),
          updatedAt: new Date(data.user.updated_at || Date.now()).getTime(),
          studyStats: {
            totalCardsStudied: 0,
            totalTimeStudied: 0,
            streakDays: 0,
            lastStudyDate: null,
          },
          ownedDecks: [],
          phone: data.user.phone || undefined,
        };

        setSession(appUser, data.session.access_token, data.session.refresh_token);
        Alert.alert('Login Successful', data.message || 'You are now logged in!');
        router.replace('/');
      } else {
        Alert.alert('Login Failed', 'Received incomplete data from server.');
      }
    },
    onError: (error) => {
      Alert.alert('Login Failed', error.message || 'An unexpected error occurred.');
    },
  });

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Validation Error', 'Email and password are required.');
      return;
    }
    loginMutation.mutate({ email, password });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.innerContainer}>
        <Image
          source={require('../../assets/images/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Welcome to Cramit</Text>
        <Text style={styles.subtitle}>Your flashcards, supercharged.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#999"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor="#999"
        />

        <TouchableOpacity
          style={[styles.button, loginMutation.isPending && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
          <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkBold}>Sign Up</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    padding: 20,
    paddingTop: 10, // adjust as needed
    backgroundColor: '#f5f5f5',
  },
  innerContainer: {
    gap: 16,
    paddingVertical: 32,
  },
  logo: {
    width: 300,
    height: 120,
    alignSelf: 'center',
    marginBottom: 16,
    marginTop: 8, // Optional: adjust as needed
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    height: 52,
    backgroundColor: '#f1f1f1',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  linkText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 15,
    color: '#444',
  },
  linkBold: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
