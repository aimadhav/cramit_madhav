import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/AppText';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '@/services/auth-service';
import { EXAM_OPTIONS } from '@/constants/examSubjects';

const C = {
  bg: '#0A0B0F',
  surface: '#12141A',
  border: '#24283A',
  primary: '#6C7BFF',
  text: '#FFFFFF',
  muted: '#8B91A5',
};

export default function OnboardingScreen() {
  const router = useRouter();
  const [selectedFocus, setSelectedFocus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleContinue = async () => {
    if (!selectedFocus || isSaving) return;

    try {
      setIsSaving(true);
      await AuthService.updatePrepFocus(selectedFocus);
      router.replace('/');
    } catch (error: any) {
      setIsSaving(false);
      console.error('[Onboarding] Failed to save preparation focus:', error);
      Alert.alert('Could not save that yet', 'Please check your connection and try again.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.eyebrowRow}>
          <View style={styles.logoDot} />
          <Text style={styles.eyebrow}>A LITTLE ABOUT YOU</Text>
        </View>

        <Text style={styles.title}>Let’s make your revision feel personal.</Text>
        <Text style={styles.subtitle}>
          What are you preparing for? We’ll shape your subjects and study queue around it.
        </Text>

        <View style={styles.cards}>
          {EXAM_OPTIONS.map((option) => {
            const isSelected = selectedFocus === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                activeOpacity={0.88}
                onPress={() => setSelectedFocus(option.id)}
                style={[
                  styles.option,
                  isSelected && { borderColor: option.accent, backgroundColor: `${option.accent}18` },
                ]}
              >
                <View style={[styles.iconBox, { backgroundColor: `${option.accent}20` }]}>
                  <Ionicons name={option.icon} size={25} color={option.accent} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                </View>
                <View style={[styles.radio, isSelected && { borderColor: option.accent }]}>
                  {isSelected && <View style={[styles.radioDot, { backgroundColor: option.accent }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.reassurance}>
          <Ionicons name="sparkles-outline" size={17} color="#B7BEFF" />
          <Text style={styles.reassuranceText}>
            You can change this later. No pressure—just a better starting point.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.continueButton, (!selectedFocus || isSaving) && styles.disabled]}
          onPress={handleContinue}
          disabled={!selectedFocus || isSaving}
          activeOpacity={0.88}
        >
          {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.continueText}>Continue</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 78, paddingBottom: 42 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 22 },
  logoDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  eyebrow: { color: '#A7AEFF', fontSize: 11, letterSpacing: 1.7, fontFamily: 'Outfit_700Bold' },
  title: { color: C.text, fontSize: 31, lineHeight: 38, fontFamily: 'Outfit_700Bold', letterSpacing: -0.5 },
  subtitle: { color: C.muted, fontSize: 15, lineHeight: 23, marginTop: 13, maxWidth: 360 },
  cards: { gap: 12, marginTop: 34 },
  option: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 19, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  iconBox: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  optionCopy: { flex: 1 },
  optionTitle: { color: C.text, fontSize: 17, fontFamily: 'Outfit_700Bold', marginBottom: 3 },
  optionSubtitle: { color: C.muted, fontSize: 12, lineHeight: 17 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#555B72', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  reassurance: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 24, paddingHorizontal: 3 },
  reassuranceText: { flex: 1, color: C.muted, fontSize: 12, lineHeight: 18 },
  continueButton: { backgroundColor: C.primary, borderRadius: 16, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 30, shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 13, elevation: 6 },
  continueText: { color: '#FFF', fontSize: 16, fontFamily: 'Outfit_700Bold' },
  disabled: { opacity: 0.45 },
});
