import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from './AppText';
import { Flame, LogOut } from 'lucide-react-native';

interface StatsHeaderProps {
  streakDays: number;
  onSignOut: () => void;
}

export const StatsHeader: React.FC<StatsHeaderProps> = ({
  streakDays,
  onSignOut,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logoText}><Text style={{ color: '#5e6ad2' }}>✦</Text> Cramit.</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={styles.streakPill}>
            <Flame size={16} color="#d2995e" fill="#d2995e" />
            <Text style={styles.streakText}>{streakDays}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.streakPill, { backgroundColor: '#2a1a1a', borderColor: '#4a2a2a' }]} 
            activeOpacity={0.7}
            onPress={onSignOut}
          >
            <LogOut size={16} color="#ff5f57" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.titleSection}>
        <Text style={styles.headerTitle}>Learning Stats</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.headerSubtitle}>Visualize your growth over time</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 25,
  },
  logoText: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#ececec',
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15171B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  streakText: {
    color: '#ECECEC',
    fontFamily: 'Outfit_700Bold',
    marginLeft: 6,
    fontSize: 14,
  },
  titleSection: {
    marginBottom: 25,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#ECECEC',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94969a',
    fontFamily: 'Outfit_500Medium',
  },
});
