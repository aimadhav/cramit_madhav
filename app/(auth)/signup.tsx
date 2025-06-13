import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../utils/trpc';
import { Image } from 'react-native';


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
      const result = await signupMutation.mutateAsync({
        email,
        password,
        name: name || undefined,
      });

      Alert.alert('Success', result.message + '\nPlease log in.');
      router.push('/(auth)/login');
    } catch (error: any) {
      console.error('Signup failed:', error);
      const trpcErrorMessage =
        error.data?.zodError?.fieldErrors?.password?.[0] ||
        error.data?.zodError?.fieldErrors?.email?.[0] ||
        error.data?.message ||
        error.message ||
        'An unknown error occurred during signup.';
      Alert.alert('Signup Failed', trpcErrorMessage);
    }
  };

  return (
    
    <View style={styles.container}>
      <Image  source={require('../../assets/images/icon.png')}
      style={{ width: 300, height: 120, marginBottom: 50,marginTop: 10, alignSelf: 'center' }}
      resizeMode="contain" />
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
        placeholder="Password"
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
      <TouchableOpacity
        style={[
          styles.button,
          signupMutation.isPending && styles.buttonDisabled,
        ]}
        onPress={handleSignup}
        disabled={signupMutation.isPending}
      >
        {signupMutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign Up</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
        <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Log In</Text></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start', // <-- align content to the top
    padding: 20,
    paddingTop: 40, // or a value you like (try 20, 30, 40)
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
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    backgroundColor: '#99c9ff',
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
  },logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginBottom: 10,
  },
  
});
