import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { TodayActivitySnapshot } from '@/types/stats';
import { Text } from './AppText';

interface TodayActivityCardProps {
  snapshot: TodayActivitySnapshot;
  dailyGoal: number;
}

function formatFocusedTime(milliseconds: number) {
  if (milliseconds <= 0) return '0 min';
  if (milliseconds < 60_000) return '<1 min';
  return `${Math.max(1, Math.round(milliseconds / 60_000))} min`;
}

export const TodayActivityCard: React.FC<TodayActivityCardProps> = ({ snapshot, dailyGoal }) => {
  const chartMax = Math.max(dailyGoal, ...snapshot.activity.map((bucket) => bucket.count), 1);
  const sourceLabel = snapshot.dataSource === 'cloud'
    ? 'ONLINE'
    : snapshot.dataSource === 'cached'
      ? 'OFFLINE CACHE'
      : 'ON DEVICE';

  return (
    <View style={styles.activityCard}>
      <View style={styles.activityHeader}>
        <View>
          <Text style={styles.activityValue}>{snapshot.reviewsToday}/{dailyGoal}</Text>
          <Text style={styles.activityGoalLabel}>TODAY&apos;S RETENTION PROGRESS</Text>
        </View>
        <View style={styles.sourceBadge}>
          <View style={[styles.sourceDot, snapshot.dataSource === 'cached' && styles.sourceDotCached]} />
          <Text style={styles.sourceText}>{sourceLabel}</Text>
        </View>
      </View>

      <View style={styles.chart}>
        {snapshot.activity.map((bucket, index) => {
          const isToday = index === snapshot.activity.length - 1;
          const height = bucket.count === 0 ? 4 : Math.max(7, Math.round((bucket.count / chartMax) * 54));
          return (
            <View key={bucket.key} style={styles.chartColumn}>
              <View style={styles.chartTrack}>
                <View style={[styles.chartBar, { height }, isToday && styles.chartBarToday]} />
              </View>
              <Text style={[styles.chartLabel, isToday && styles.chartLabelToday]}>{bucket.label}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.activityFooter}>
        <View>
          <Text style={styles.footerLabel}>FOCUSED REVIEW TIME TODAY</Text>
          <Text style={styles.footerValue}>{formatFocusedTime(snapshot.focusedReviewTimeMs)}</Text>
        </View>
        <View style={styles.footerRight}>
          <Text style={styles.footerLabel}>LAST 7 DAYS</Text>
          <Text style={styles.weekTotal}>
            {snapshot.activity.reduce((total, bucket) => total + bucket.count, 0)} reviews
          </Text>
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
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  activityValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
  },
  activityGoalLabel: {
    color: '#696c74',
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.9,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: '#ffffff08',
  },
  sourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#43c58a',
  },
  sourceDotCached: {
    backgroundColor: '#e4a85c',
  },
  sourceText: {
    color: '#7d8088',
    fontSize: 8,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.5,
  },
  chart: {
    height: 76,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 17,
  },
  chartColumn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartTrack: {
    height: 56,
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: 16,
    borderRadius: 5,
    backgroundColor: '#363941',
  },
  chartBarToday: {
    backgroundColor: '#6c7bff',
  },
  chartLabel: {
    marginTop: 6,
    color: '#62656e',
    fontSize: 9,
    fontFamily: 'Outfit_600SemiBold',
  },
  chartLabelToday: {
    color: '#9da5ff',
  },
  activityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2c32',
  },
  footerLabel: {
    color: '#62656e',
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  footerValue: {
    color: '#8e98ff',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  footerRight: {
    alignItems: 'flex-end',
  },
  weekTotal: {
    color: '#d8d9dc',
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
});
