import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Text } from "@/components/AppText";
import { useRouter } from 'expo-router';
import { useUserStore } from '../../store/user-store';
import { AuthService } from '@/services/auth-service';
import * as WebBrowser from 'expo-web-browser';
import { useThemeColors } from '@/hooks/useThemeColors';
import Toast from 'react-native-toast-message';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Validation Error', 'Email and password are required.');
      return;
    }
    
    try {
      setIsLoading(true);
      await AuthService.signIn(email, password);
      
      Toast.show({
        type: 'success',
        text1: 'Login Successful',
        text2: 'Welcome back!',
      });
      
      router.replace('/');
    } catch (error: any) {
      console.error('Login failed:', error);
      Alert.alert('Login Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      const result = await AuthService.signInWithGoogle();
      
      console.log('🏁 [GoogleSignIn] Result type:', result?.type);
      
      if (result?.type === 'success') {
        // The AuthService already established the session
        router.replace('/');
      } else if (result?.type === 'cancel') {
        Toast.show({
          type: 'info',
          text1: 'Sign-In Cancelled',
        });
      }
    } catch (error: any) {
      console.error('❌ [GoogleSignIn] Error:', error);
      Alert.alert('Google Sign-In Error', error.message || 'Failed to sign in with Google');
    } finally {
      setIsGoogleLoading(false);
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

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={colors.textLight}
            editable={!isLoading && !isGoogleLoading}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={colors.textLight}
            editable={!isLoading && !isGoogleLoading}
          />

          <TouchableOpacity
            style={[styles.button, (isLoading || isGoogleLoading) && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading || isGoogleLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity 
            style={[styles.googleButton, (isGoogleLoading || isLoading) && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
          >
            {isGoogleLoading ? (
                 <ActivityIndicator color={colors.textDark} />
            ) : (
                <Text style={styles.googleButtonText}>Continue with Google</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.offlineButton}
            onPress={() => {
              const { loginOffline } = useUserStore.getState();
              loginOffline();
              router.replace('/');
            }}
          >
            <Text style={styles.offlineButtonText}>Continue Offline</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/signup')} style={styles.signupContainer}>
            <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkBold}>Sign Up</Text></Text>
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
    paddingVertical: 10,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  logoText: {
    fontSize: 48,
    fontFamily: 'Outfit_700Bold',
    color: '#5e6ad2',
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: -1,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textDark,
    textAlign: 'center',
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 17,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '500',
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
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 16,
    color: colors.textLight,
    fontWeight: '600',
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: colors.background,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  googleButtonText: {
    color: colors.textDark,
    fontSize: 17,
    fontWeight: '600',
  },
  offlineButton: {
    backgroundColor: colors.background,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  offlineButtonText: {
    color: colors.textDark,
    fontSize: 17,
    fontWeight: '600',
  },
  signupContainer: {
    marginTop: 16,
    paddingVertical: 8,
  },
  linkText: {
    textAlign: 'center',
    fontSize: 15,
    color: colors.textLight,
  },
  linkBold: {
    fontWeight: '700',
    color: colors.primary,
  },
  quickAccessContainer: {
    marginTop: 30,
    alignItems: 'center',
    paddingBottom: 20,
  },
  quickAccessLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#5f6166',
    letterSpacing: 2,
    marginBottom: 15,
  },
  quickAccessRow: {
    flexDirection: 'row',
    gap: 15,
  },
  quickAccessButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5e6ad220',
    backgroundColor: '#15171B',
  },
  quickAccessButtonText: {
    color: '#5e6ad2',
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
  }
});
