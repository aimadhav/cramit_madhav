import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './AppText';

interface TodayActivityCardProps {
  totalCardsStudied: number;
  totalTimeStudied: number;
  dailyGoal: number;
}

export const TodayActivityCard: React.FC<TodayActivityCardProps> = ({
  totalCardsStudied,
  totalTimeStudied,
  dailyGoal,
}) => {
  return (
    <View style={styles.activityCard}>
      <View style={styles.activityHeader}>
        <View>
          <Text style={styles.activityValue}>{totalCardsStudied}/{dailyGoal}</Text>
          <Text style={styles.activityGoalLabel}>DAILY RETENTION PROGRESS</Text>
        </View>
        <View style={styles.chart}>
          {Array.from({ length: 7 }).map((_, i) => (
            <View 
              key={i} 
              style={[
                styles.chartBar, 
                { 
                  height: i === 6 
                    ? `${Math.min(100, (totalCardsStudied / dailyGoal) * 100)}%` 
                    : `${Math.random() * 40 + 20}%`,
                  backgroundColor: i === 6 ? '#5e6ad2' : '#2a2c32',
                  opacity: i === 6 ? 1 : 0.5
                }
              ]} 
            />
          ))}
        </View>
      </View>

      <View style={styles.activityFooter}>
        <View>
          <Text style={styles.footerLabel}>COMPLETED STUDY TIME</Text>
          <Text style={[styles.footerValue, { color: '#5e6ad2' }]}>{totalTimeStudied} min</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  activityCard: {
    backgroundColor: '#15171b',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2c32',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  activityValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
  },
  activityGoalLabel: {
    color: '#5f6166',
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 40,
  },
  chartBar: {
    width: 8,
    backgroundColor: '#2a2c32',
    borderRadius: 2,
  },
  activityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2c32',
  },
  footerLabel: {
    color: '#5f6166',
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  footerValue: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  }
});
