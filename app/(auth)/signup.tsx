import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, ScrollView } from "react-native";
import { Text } from "@/components/AppText";;
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Image } from 'react-native';

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');

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
      // 1. Signup the user DIRECTLY with Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || undefined,
          }
        }
      });

      if (error) throw error;

      Alert.alert(
        'Account Created', 
        'Success! Please check your email for a confirmation link before logging in.',
        [{ text: 'OK', onPress: () => router.replace('/login') }]
      );
    } catch (error: any) {
      console.error('Signup failed:', error);
      Alert.alert('Signup Failed', error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.logoText}>cramit</Text>
      <Text style={styles.title}>Create Account</Text>
      
      <View style={styles.innerContainer}>
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
          style={styles.button}
          onPress={handleSignup}
        >
          <Text style={styles.buttonText}>Sign Up</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/login')}>
          <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Log In</Text></Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  innerContainer: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    marginTop: 5,
    fontWeight: '600',
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
  classGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  classCard: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: 80,
    alignItems: 'center',
  },
  classCardSelected: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  classCardText: {
    color: '#333',
    fontWeight: '500',
  },
  classCardTextSelected: {
    color: '#fff',
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
  },
  logoText: {
    fontSize: 48,
    fontFamily: 'Outfit_700Bold',
    color: '#5e6ad2',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
    letterSpacing: -1,
  },
});

