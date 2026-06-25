import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  
} from 'react-native';
import { Text } from '@/components/AppText';
import { useRouter } from 'expo-router';
import { useUserStore } from '../../store/user-store';
import { AuthService } from '@/services/auth-service';
import * as WebBrowser from 'expo-web-browser';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import Svg2, { Path as P, G, ClipPath, Rect, Defs } from 'react-native-svg';

WebBrowser.maybeCompleteAuthSession();

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

const FEATURES = [
  { icon: 'sync-outline' as const, label: 'Sync across\ndevices' },
  { icon: 'shield-checkmark-outline' as const, label: 'Your data is\nalways safe' },
  { icon: 'cloud-upload-outline' as const, label: 'Access anytime,\nanywhere' },
];

// Coloured Google G logo via SVG
function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg2 width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <ClipPath id="clip">
          <Rect width="48" height="48" rx="24" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#clip)">
        <P fill="#4285F4" d="M47.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h13.2c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.3-10.6 7.3-17.2z" />
        <P fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.9-6c-2.1 1.4-4.9 2.3-8 2.3-6.1 0-11.3-4.1-13.2-9.7H2.7v6.2C6.7 42.9 14.8 48 24 48z" />
        <P fill="#FBBC05" d="M10.8 28.8A14.8 14.8 0 0 1 10 24c0-1.7.3-3.3.8-4.8v-6.2H2.7A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.7 10.8l8.1-6z" />
        <P fill="#EA4335" d="M24 9.5c3.4 0 6.5 1.2 8.9 3.5l6.7-6.7C35.9 2.4 30.4 0 24 0 14.8 0 6.7 5.1 2.7 13.2l8.1 6.2c1.9-5.6 7.1-9.9 13.2-9.9z" />
      </G>
    </Svg2>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const busy = isLoading || isGoogleLoading;

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Email and password are required.');
      return;
    }
    try {
      setIsLoading(true);
      await AuthService.signIn(email, password);
      Toast.show({ type: 'success', text1: 'Welcome back!' });
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Login Failed', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      const result = await AuthService.signInWithGoogle();
      if (result?.type === 'success') router.replace('/');
      else if (result?.type === 'cancel') Toast.show({ type: 'info', text1: 'Cancelled' });
    } catch (e: any) {
      Alert.alert('Google Sign-In Error', e.message);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGuest = () => {
    useUserStore.getState().loginOffline();
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={s.logoRow}>
          <Text style={s.logoText}>
            <Text style={{ color: '#5e6ad2' }}>✦ </Text>Cramit<Text style={{ color: '#5e6ad2' }}>.</Text>
          </Text>
        </View>
        <Text style={s.tagline}>Smart revision. <Text style={s.accent}>Better</Text> retention.</Text>

        {/* Feature pills */}
        <View style={s.pills}>
          {FEATURES.map((f) => (
            <View key={f.label} style={s.pill}>
              <Ionicons name={f.icon} size={18} color={C.primary} />
              <Text style={s.pillLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* Sign-in section */}
        <Text style={s.heading}>Sign in to continue</Text>
        <Text style={s.sub}>Save your progress and pick up where you left off.</Text>

        {/* Google */}
        <TouchableOpacity style={[s.googleBtn, busy && s.disabled]} onPress={handleGoogleSignIn} disabled={busy} activeOpacity={0.85}>
          {isGoogleLoading ? <ActivityIndicator color="#FFF" /> : (
            <>
              <GoogleLogo size={22} />
              <Text style={s.googleBtnText}>Continue with Google</Text>
              <View style={s.badge}>
                <Ionicons name="sparkles" size={9} color={C.primary} />
                <Text style={s.badgeText}>Recommended</Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={s.divider}>
          <View style={s.divLine} />
          <Text style={s.divText}>OR</Text>
          <View style={s.divLine} />
        </View>

        {/* Email */}
        {!showEmailForm ? (
          <TouchableOpacity style={[s.emailBtn, busy && s.disabled]} onPress={() => setShowEmailForm(true)} disabled={busy} activeOpacity={0.85}>
            <Ionicons name="mail-outline" size={18} color={C.text} />
            <Text style={s.emailBtnText}>Continue with Email</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.form}>
            <TextInput style={s.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={C.textMuted} autoFocus editable={!busy} />
            <TextInput style={s.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor={C.textMuted} editable={!busy} />
            <TouchableOpacity style={[s.submitBtn, busy && s.disabled]} onPress={handleLogin} disabled={busy} activeOpacity={0.85}>
              {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={s.submitText}>Log In</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowEmailForm(false)} style={s.backBtn}>
              <Text style={s.backText}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Security note */}
        <View style={s.secRow}>
          <Ionicons name="lock-closed" size={13} color={C.textMuted} />
          <Text style={s.secText}>We use <Text style={s.secLink}>secure encryption</Text> to keep your data private.</Text>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <View style={s.footerLine} />
          <Text style={s.footerCaption}>Not ready to sign in?</Text>
          <TouchableOpacity onPress={handleGuest}>
            <Text style={s.guestText}>Continue as Guest <Text>›</Text></Text>
          </TouchableOpacity>
          <Text style={s.guestNote}>You can sign in anytime to back up your data.</Text>
          <TouchableOpacity onPress={() => router.push('/signup')} style={{ marginTop: 14 }}>
            <Text style={s.signupText}>Don't have an account? <Text style={s.signupBold}>Sign Up</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 48, paddingBottom: 40 },

  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  logoIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  logoText: { fontSize: 36, fontFamily: 'Outfit_700Bold', color: C.text, letterSpacing: -0.5 },
  tagline: { textAlign: 'center', fontSize: 13, color: C.textMuted, marginBottom: 24 },
  accent: { color: C.primary, fontFamily: 'Outfit_600SemiBold' },

  pills: { flexDirection: 'row', gap: 6, marginBottom: 28 },
  pill: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  pillLabel: { fontSize: 10, color: C.textMuted, textAlign: 'center', lineHeight: 14 },

  heading: { fontSize: 20, fontFamily: 'Outfit_700Bold', color: C.text, marginBottom: 4 },
  sub: { fontSize: 12, color: C.textMuted, marginBottom: 18 },

  googleBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, marginBottom: 4 },
  googleBtnText: { flex: 1, fontSize: 15, fontFamily: 'Outfit_600SemiBold', color: '#FFF' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3, position: 'absolute', top: -10, right: 10 },
  badgeText: { fontSize: 10, color: C.primary, fontFamily: 'Outfit_600SemiBold' },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  divLine: { flex: 1, height: 1, backgroundColor: C.border },
  divText: { marginHorizontal: 14, fontSize: 11, color: C.textMuted, fontFamily: 'Outfit_600SemiBold' },

  emailBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: C.border },
  emailBtnText: { fontSize: 15, fontFamily: 'Outfit_600SemiBold', color: C.text },

  form: { gap: 9 },
  input: { height: 50, backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 14, fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.border },
  submitBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 2 },
  submitText: { color: '#FFF', fontSize: 15, fontFamily: 'Outfit_700Bold' },
  backBtn: { alignItems: 'center', paddingVertical: 6 },
  backText: { color: C.textMuted, fontSize: 13 },

  disabled: { opacity: 0.6 },

  secRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18, marginBottom: 24 },
  secText: { flex: 1, fontSize: 12, color: C.textMuted },
  secLink: { color: C.textLink },

  footer: { alignItems: 'center', gap: 5 },
  footerLine: { width: '100%', height: 1, backgroundColor: C.border, marginBottom: 14 },
  footerCaption: { fontSize: 13, color: C.textMuted },
  guestText: { fontSize: 15, fontFamily: 'Outfit_600SemiBold', color: C.textLink, paddingVertical: 2 },
  guestNote: { fontSize: 11, color: C.textMuted },
  signupText: { fontSize: 13, color: C.textMuted },
  signupBold: { fontFamily: 'Outfit_700Bold', color: C.primary },
});
