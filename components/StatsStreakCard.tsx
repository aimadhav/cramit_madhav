import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from './AppText';
import { Flame, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface StatsStreakCardProps {
  streak: number;
}

export const StatsStreakCard: React.FC<StatsStreakCardProps> = ({ streak }) => {
  return (
    <TouchableOpacity style={styles.streakCard} activeOpacity={0.8}>
      <LinearGradient
        colors={['rgba(210, 153, 94, 0.15)', 'rgba(210, 153, 94, 0.05)']}
        style={styles.streakGradient}
      >
        <View style={styles.streakContent}>
          <View style={styles.streakIconContainer}>
            <Flame size={28} color="#d2995e" fill="#d2995e" />
          </View>
          <View>
            <Text style={styles.streakLabel}>CURRENT STREAK</Text>
            <Text style={styles.streakValue}>{streak} Days</Text>
            <Text style={styles.streakSubtext}>Consistency is the key to mastery!</Text>
          </View>
        </View>
        <ChevronRight size={20} color="#94969a" />
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  streakCard: {
    borderRadius: 24,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(210, 153, 94, 0.3)',
    overflow: 'hidden',
  },
  streakGradient: {
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(210, 153, 94, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  streakLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#d2995e',
    letterSpacing: 1,
    marginBottom: 4,
  },
  streakValue: {
    fontSize: 26,
    fontFamily: 'Outfit_700Bold',
    color: '#ECECEC',
    marginBottom: 2,
  },
  streakSubtext: {
    fontSize: 12,
    color: '#94969a',
    fontFamily: 'Outfit_500Medium',
  },
});
