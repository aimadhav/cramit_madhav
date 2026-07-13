import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Flame, LogOut } from 'lucide-react-native';

import { Text } from './AppText';

interface StatsHeaderProps {
  streakDays: number;
  onSignOut: () => void;
}

export const StatsHeader: React.FC<StatsHeaderProps> = ({ streakDays, onSignOut }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logoText}>
          <Text style={styles.logoMark}>✦</Text> Cramit<Text style={styles.logoMark}>.</Text>
        </Text>
        <View style={styles.actions}>
          <View style={styles.streakPill}>
            <Flame size={16} color="#d2995e" fill="#d2995e" />
            <Text style={styles.streakText}>{streakDays}</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={styles.logoutButton}
            activeOpacity={0.7}
            onPress={onSignOut}
          >
            <LogOut size={16} color="#df7773" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.titleSection}>
        <Text style={styles.headerTitle}>Your Progress</Text>
        <Text style={styles.headerSubtitle}>See what’s sticking and what needs work.</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, paddingBottom: 22 },
  logoText: { fontSize: 24, fontFamily: 'Outfit_700Bold', color: '#ececec' },
  logoMark: { color: '#6c7bff' },
  actions: { flexDirection: 'row', gap: 9 },
  streakPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#15171B', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 18, borderWidth: 1, borderColor: '#2A2C32' },
  streakText: { color: '#ECECEC', fontFamily: 'Outfit_700Bold', marginLeft: 5, fontSize: 13 },
  logoutButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15171B', borderWidth: 1, borderColor: '#2A2C32' },
  titleSection: { marginBottom: 19 },
  headerTitle: { fontSize: 24, fontFamily: 'Outfit_700Bold', color: '#ECECEC' },
  headerSubtitle: { fontSize: 12, color: '#94969a', fontFamily: 'Outfit_500Medium', marginTop: 2 },
});
