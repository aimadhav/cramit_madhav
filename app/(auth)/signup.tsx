import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Text } from "@/components/AppText";
import { useRouter } from 'expo-router';
import { AuthService } from '@/services/auth-service';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function SignupScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [prepFocus, setPrepFocus] = useState('JEE'); // Default
  const [isLoading, setIsLoading] = useState(false);

  const PREP_OPTIONS = ['JEE', 'NEET', 'CS'];

  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Email and password are required.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long.');
      return;
    }

    try {
      setIsLoading(true);
      await AuthService.signUp(email, password, name, prepFocus);

      Alert.alert(
        'Account Created', 
        'Success! Please check your email for a confirmation link before logging in.',
        [{ text: 'OK', onPress: () => router.replace('/login') }]
      );
    } catch (error: any) {
      console.error('Signup failed:', error);
      Alert.alert('Signup Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.innerContainer}>
          <Text style={styles.logoText}>cramit</Text>
          <Text style={styles.title}>Create Account</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Name (Optional)"
            value={name}
            onChangeText={setName}
            placeholderTextColor={colors.textLight}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={colors.textLight}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={colors.textLight}
            editable={!isLoading}
          />

          <View style={styles.prepContainer}>
            <Text style={styles.prepLabel}>What are you preparing for?</Text>
            <View style={styles.prepButtons}>
              {PREP_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.prepButton,
                    prepFocus === option && styles.prepButtonActive
                  ]}
                  onPress={() => setPrepFocus(option)}
                  disabled={isLoading}
                >
                  <Text style={[
                    styles.prepButtonText,
                    prepFocus === option && styles.prepButtonTextActive
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/login')} style={styles.loginLink}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Log In</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  innerContainer: {
    gap: 12,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  logoText: {
    fontSize: 48,
    fontFamily: 'Outfit_700Bold',
    color: '#5e6ad2',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -1,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Outfit_700Bold',
    color: colors.textDark,
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    height: 56,
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  loginLink: {
    marginTop: 20,
    paddingVertical: 8,
  },
  linkText: {
    textAlign: 'center',
    fontSize: 15,
    color: colors.textLight,
  },
  linkBold: {
    fontFamily: 'Outfit_700Bold',
    color: colors.primary,
  },
  prepContainer: {
    marginTop: 10,
    marginBottom: 10,
  },
  prepLabel: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    color: colors.textLight,
    marginBottom: 8,
  },
  prepButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  prepButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  prepButtonActive: {
    backgroundColor: 'rgba(94, 106, 210, 0.15)',
    borderColor: '#5e6ad2',
  },
  prepButtonText: {
    fontFamily: 'Outfit_600SemiBold',
    color: colors.textLight,
  },
  prepButtonTextActive: {
    color: colors.primary,
  },
});

