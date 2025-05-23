import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../utils/trpc'; // Reverted to correct path

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const signupMutation = trpc.auth.signup.useMutation();

  const handleSignup = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Email and password are required.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long.');
      return;
    }

    try {
      // Ensure isLoading is set before the async call
      // signupMutation.isLoading is automatically handled by react-query
      const result = await signupMutation.mutateAsync({
        email,
        password,
        name: name || undefined, // Send name only if provided
      });
      Alert.alert('Success', result.message + '\nPlease log in.');
      router.push('/(auth)/login'); 
    } catch (error: any) {
      console.error('Signup failed:', error);
      // Attempt to get a more specific error message from tRPC error
      const trpcErrorMessage = error.data?.zodError?.fieldErrors?.password?.[0] || 
                               error.data?.zodError?.fieldErrors?.email?.[0] || 
                               error.data?.message || 
                               error.message || 
                               'An unknown error occurred during signup.';
      Alert.alert('Signup Failed', trpcErrorMessage);
    }
  };

  if (signupMutation.isPending) { 
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
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
        placeholder="Password (min. 6 characters)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Name (Optional)"
        value={name}
        onChangeText={setName}
      />
      <Button title="Sign Up" onPress={handleSignup} disabled={signupMutation.isPending} />
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
    marginBottom: 24,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    height: 45,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 15,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  loader: {
    marginTop: 20,
  }
});
