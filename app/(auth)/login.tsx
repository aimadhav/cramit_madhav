import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../utils/trpc';
import { useUserStore } from '../../store/user-store'; 
import type { AppUser } from '../../store/user-store'; 

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { setSession } = useUserStore.getState(); 

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      console.log('Login successful:', data);
      if (data.session && data.user && data.user.email) {
        const appUser: AppUser = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || null,
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

        setSession(appUser, data.session.access_token);
        Alert.alert('Login Successful', data.message || 'You are now logged in!');
        router.replace('/(tabs)'); 
      } else {
        console.error('Login error: Session or user data missing in response', data);
        Alert.alert('Login Failed', 'Received incomplete data from server.');
      }
    },
    onError: (error) => {
      console.error('Login error:', error);
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

  if (loginMutation.isPending) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Login" onPress={handleLogin} disabled={loginMutation.isPending} />
      <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
        <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  linkText: {
    marginTop: 20,
    color: '#007bff',
    textAlign: 'center',
    fontSize: 16,
  },
  loader: {
    marginTop: 20,
  },
});
