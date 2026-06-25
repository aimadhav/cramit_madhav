import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from '@/components/AppText';
import { useRouter } from 'expo-router';
import { AuthService } from '@/services/auth-service';
import { Ionicons } from '@expo/vector-icons';

const C = {
  bg: '#0A0B0F',
  surface: '#12141A',
  border: '#1E2130',
  primary: '#5e6ad2',
  primarySoft: 'rgba(94,106,210,0.12)',
  text: '#FFFFFF',
  textMuted: '#6B7280',
  textLink: '#5e6ad2',
};

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Email and password are required.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    try {
      setIsLoading(true);
      await AuthService.signUp(email, password, name);
      Alert.alert(
        'Account Created',
        'Check your email for a confirmation link.',
        [{ text: 'OK', onPress: () => router.replace('/login') }]
      );
    } catch (e: any) {
      Alert.alert('Signup Failed', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={s.container}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <TouchableOpacity onPress={() => router.replace('/login')} style={s.back}>
          <Ionicons name="arrow-back" size={16} color={C.textMuted} />
          <Text style={s.backText}>Back to Sign In</Text>
        </TouchableOpacity>

        {/* Logo — identical to login */}
       <View style={s.logoRow}>
              <Text style={s.logoText}>
            <Text style={{ color: '#5e6ad2' }}>✦ </Text>Cramit<Text style={{ color: '#5e6ad2' }}>.</Text>
          </Text>
          </View>
        <Text style={s.tagline}>
          Smart revision. <Text style={s.accent}>Better</Text> retention.
        </Text>

        {/* Heading */}
        <View style={s.headingBlock}>
          <Text style={s.heading}>Create your account</Text>
          <Text style={s.sub}>Join thousands of students cramming smarter.</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          <View style={s.inputRow}>
            <Ionicons name="person-outline" size={16} color={C.textMuted} style={s.icon} />
            <TextInput
              style={s.input}
              placeholder="Name (optional)"
              value={name}
              onChangeText={setName}
              placeholderTextColor={C.textMuted}
              editable={!isLoading}
            />
          </View>

          <View style={s.inputRow}>
            <Ionicons name="mail-outline" size={16} color={C.textMuted} style={s.icon} />
            <TextInput
              style={s.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={C.textMuted}
              editable={!isLoading}
            />
          </View>

          <View style={s.inputRow}>
            <Ionicons name="lock-closed-outline" size={16} color={C.textMuted} style={s.icon} />
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="Password (min. 6 characters)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              placeholderTextColor={C.textMuted}
              editable={!isLoading}
            />
            <TouchableOpacity onPress={() => setShowPw(v => !v)} style={s.eyeBtn}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={16} color={C.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.submitBtn, isLoading && s.disabled]}
            onPress={handleSignup}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading
              ? <ActivityIndicator color="#FFF" />
              : <Text style={s.submitText}>Create Account</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Security note — same light style as login */}
        <View style={s.secRow}>
          <Ionicons name="lock-closed" size={12} color={C.textMuted} />
          <Text style={s.secText}>
            We use <Text style={s.secLink}>secure encryption</Text> to keep your data private.
          </Text>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <View style={s.footerLine} />
          <TouchableOpacity onPress={() => router.replace('/login')}>
            <Text style={s.loginText}>
              Already have an account?{'  '}
              <Text style={s.loginBold}>Log In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 52, paddingBottom: 40 },

  back: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 28, alignSelf: 'flex-start' },
  backText: { fontSize: 13, color: C.textMuted },

  // Logo — mirrors login exactly
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  
  logoText: { fontSize: 36, fontFamily: 'Outfit_700Bold', color: C.text, letterSpacing: -0.5 },
  tagline: { textAlign: 'center', fontSize: 13, color: C.textMuted, marginBottom: 32 },
  accent: { color: C.primary, fontFamily: 'Outfit_600SemiBold' },

  headingBlock: { marginBottom: 22 },
  heading: { fontSize: 22, fontFamily: 'Outfit_700Bold', color: C.text, marginBottom: 4 },
  sub: { fontSize: 13, color: C.textMuted },

  // Form
  form: { gap: 10, marginBottom: 28 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    height: 52,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 14, color: C.text },
  eyeBtn: { padding: 4 },
  submitBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 2,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  submitText: { color: '#FFF', fontSize: 16, fontFamily: 'Outfit_700Bold' },
  disabled: { opacity: 0.6 },

  // Security — light inline row, no card
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 32 },
  secText: { flex: 1, fontSize: 12, color: C.textMuted },
  secLink: { color: C.textLink },

  // Footer
  footer: { alignItems: 'center', gap: 10 },
  footerLine: { width: '100%', height: 1, backgroundColor: C.border, marginBottom: 6 },
  loginText: { fontSize: 13, color: C.textMuted, textAlign: 'center' },
  loginBold: { fontFamily: 'Outfit_700Bold', color: C.primary },
});
