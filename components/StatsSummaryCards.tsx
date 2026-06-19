import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './AppText';
import { BarChart3, Target } from 'lucide-react-native';

interface StatsSummaryCardsProps {
  totalStudied: number;
  totalKnown: number;
}

export const StatsSummaryCards: React.FC<StatsSummaryCardsProps> = ({
  totalStudied,
  totalKnown,
}) => {
  return (
    <View style={styles.summaryGrid}>
      <View style={styles.summaryCard}>
        <BarChart3 size={20} color="#5e6ad2" />
        <Text style={styles.summaryValue}>{totalStudied.toLocaleString()}</Text>
        <Text style={styles.summaryLabel}>TOTAL REVIEWS</Text>
      </View>
      <View style={styles.summaryCard}>
        <Target size={20} color="#3fb950" />
        <Text style={styles.summaryValue}>{totalKnown.toLocaleString()}</Text>
        <Text style={styles.summaryLabel}>UNIQUE CARDS</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  summaryGrid: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 25,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#15171B',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2C32',
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: '#ECECEC',
    marginTop: 8,
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 8,
    fontFamily: 'Outfit_700Bold',
    color: '#94969a',
    letterSpacing: 1,
  },
});
