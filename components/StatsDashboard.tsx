import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Sparkles,
  Target,
} from 'lucide-react-native';

import { Text } from './AppText';
import { getSubjectAccentColor, SubjectIcon } from './SubjectIcon';
import type { StatsRange, StatsSnapshot } from '@/types/stats';

const RANGES: StatsRange[] = [7, 30, 90];

export function StatsRangeSelector({ value, onChange }: { value: StatsRange; onChange: (range: StatsRange) => void }) {
  return (
    <View style={styles.rangeSelector}>
      {RANGES.map((range) => {
        const active = range === value;
        return (
          <TouchableOpacity
            key={range}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.rangeButton, active && styles.rangeButtonActive]}
            onPress={() => onChange(range)}
          >
            <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{range}D</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function comparisonText(snapshot: StatsSnapshot) {
  if (snapshot.recallChangePoints !== null) {
    const value = snapshot.recallChangePoints;
    return `${value > 0 ? '+' : ''}${value} pts vs previous ${snapshot.range} days`;
  }
  if (snapshot.totalReviews > 0) return 'New activity in this period';
  return `No reviews in the last ${snapshot.range} days`;
}

export function StatsOverviewCard({ snapshot }: { snapshot: StatsSnapshot }) {
  const improved = (snapshot.recallChangePoints ?? 0) >= 0;
  const TrendIcon = improved ? ArrowUpRight : ArrowDownRight;
  const sourceLabel = snapshot.dataSource === 'cloud'
    ? 'Online data'
    : snapshot.dataSource === 'cached'
      ? 'Cached data'
      : 'On this device';

  return (
    <LinearGradient colors={['#202443', '#15171B']} style={styles.overviewCard}>
      <View style={styles.overviewTopRow}>
        <View style={styles.recallBlock}>
          <Text style={styles.eyebrow}>{snapshot.range}-DAY RECALL</Text>
          <Text style={styles.recallValue}>{snapshot.recallRate === null ? '—' : `${snapshot.recallRate}%`}</Text>
          {snapshot.totalReviews > 0 && (
            <View style={[styles.trendPill, !improved && styles.trendPillDown]}>
              <TrendIcon size={12} color={improved ? '#71d49d' : '#ef8b8b'} />
              <Text style={[styles.trendText, !improved && styles.trendTextDown]} numberOfLines={1}>
                {comparisonText(snapshot)}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.sourceBadge}>
          <View style={[styles.sourceDot, snapshot.dataSource === 'cached' && styles.sourceDotCached]} />
          <Text style={styles.sourceText}>{sourceLabel}</Text>
        </View>
      </View>

      <View style={styles.overviewMetrics}>
        <Metric value={snapshot.totalReviews} label="REVIEWS" />
        <View style={styles.metricDivider} />
        <Metric value={snapshot.uniqueCards} label="UNIQUE CARDS" />
        <View style={styles.metricDivider} />
        <Metric value={snapshot.activeDays} label="ACTIVE DAYS" />
      </View>
    </LinearGradient>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.overviewMetric}>
      <Text style={styles.overviewMetricValue}>{value}</Text>
      <Text style={styles.overviewMetricLabel}>{label}</Text>
    </View>
  );
}

export function FocusInsightCard({ snapshot }: { snapshot: StatsSnapshot }) {
  const insight = snapshot.focusInsight;
  const strong = insight.kind === 'strong';
  const Icon = strong ? CheckCircle2 : insight.kind === 'needs-attention' ? Target : Sparkles;
  return (
    <View style={[styles.focusCard, strong && styles.focusCardStrong]}>
      <View style={[styles.focusIcon, strong && styles.focusIconStrong]}>
        <Icon size={21} color={strong ? '#43c58a' : '#8e98ff'} />
      </View>
      <View style={styles.focusCopy}>
        <Text style={styles.focusLabel}>FOCUS NEXT</Text>
        <Text style={styles.focusTitle}>{insight.title}</Text>
        <Text style={styles.focusMessage}>{insight.message}</Text>
      </View>
    </View>
  );
}

function formatResponseTime(ms: number | null) {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

export function SecondaryStats({ snapshot }: { snapshot: StatsSnapshot }) {
  const momentum = snapshot.reviewChangePercent === null
    ? snapshot.totalReviews > 0 ? 'New' : '—'
    : `${snapshot.reviewChangePercent > 0 ? '+' : ''}${snapshot.reviewChangePercent}%`;

  return (
    <View style={styles.secondaryGrid}>
      <View style={styles.secondaryCard}>
        <Clock3 size={18} color="#e4a85c" />
        <Text style={styles.secondaryValue}>{formatResponseTime(snapshot.medianResponseTimeMs)}</Text>
        <Text style={styles.secondaryLabel}>MEDIAN ANSWER</Text>
      </View>
      <View style={styles.secondaryCard}>
        <BrainCircuit size={18} color="#8e98ff" />
        <Text style={styles.secondaryValue}>{momentum}</Text>
        <Text style={styles.secondaryLabel}>REVIEW MOMENTUM</Text>
      </View>
    </View>
  );
}

export function StatsActivityChart({ snapshot }: { snapshot: StatsSnapshot }) {
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, snapshot.activity.length - 1));
  useEffect(() => setSelectedIndex(Math.max(0, snapshot.activity.length - 1)), [snapshot.activity]);

  const max = Math.max(1, ...snapshot.activity.map((bucket) => bucket.count));
  const selected = snapshot.activity[selectedIndex];
  const labelIndexes = new Set([0, Math.floor((snapshot.activity.length - 1) / 2), snapshot.activity.length - 1]);

  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>ACTIVITY</Text>
          <Text style={styles.sectionTitle}>Review rhythm</Text>
        </View>
        <Text style={styles.selectedBucket}>{selected?.accessibilityLabel || 'No activity'}</Text>
      </View>
      <View style={styles.chart}>
        {snapshot.activity.map((bucket, index) => {
          const selectedBar = index === selectedIndex;
          const height = bucket.count === 0 ? 4 : Math.max(8, Math.round((bucket.count / max) * 82));
          return (
            <TouchableOpacity
              key={bucket.key}
              accessibilityRole="button"
              accessibilityLabel={bucket.accessibilityLabel}
              style={styles.barColumn}
              onPress={() => setSelectedIndex(index)}
              activeOpacity={0.8}
            >
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height }, selectedBar && styles.barSelected]} />
              </View>
              <Text style={[styles.barLabel, selectedBar && styles.barLabelSelected]} numberOfLines={1}>
                {labelIndexes.has(index) ? bucket.label : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function overdueLabel(oldestDueAt: number | null) {
  if (oldestDueAt === null) return 'Nothing overdue';
  const days = Math.max(0, Math.floor((Date.now() - oldestDueAt) / 86_400_000));
  if (days === 0) return 'Oldest card is due today';
  return `Oldest card is ${days} ${days === 1 ? 'day' : 'days'} overdue`;
}

export function BacklogCard({
  snapshot,
  onStartSubject,
}: {
  snapshot: StatsSnapshot;
  onStartSubject?: (subject: string) => void;
}) {
  const backlog = snapshot.backlog;
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>BACKLOG</Text>
          <Text style={styles.sectionTitle}>Cards waiting for review</Text>
        </View>
        <View style={[styles.backlogTotalBadge, backlog.total === 0 && styles.backlogTotalBadgeClear]}>
          <Text style={[styles.backlogTotal, backlog.total === 0 && styles.backlogTotalClear]}>{backlog.total}</Text>
        </View>
      </View>

      {backlog.total === 0 ? (
        <View style={styles.backlogClearState}>
          <CheckCircle2 size={21} color="#43c58a" />
          <View style={styles.backlogClearCopy}>
            <Text style={styles.backlogClearTitle}>You’re caught up</Text>
            <Text style={styles.backlogMeta}>No reviewed cards are currently overdue.</Text>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.backlogAgeRow}>
            <AlertTriangle size={14} color="#e4a85c" />
            <Text style={styles.backlogAge}>{overdueLabel(backlog.oldestDueAt)}</Text>
          </View>
          <View style={styles.backlogStack}>
            {backlog.subjects.map((subject) => {
              const accent = getSubjectAccentColor(subject.name);
              return (
              <TouchableOpacity
                key={subject.name}
                accessibilityRole="button"
                accessibilityLabel={`Review ${subject.count} overdue ${subject.name} cards`}
                style={styles.backlogRow}
                activeOpacity={onStartSubject ? 0.75 : 1}
                onPress={() => onStartSubject?.(subject.name)}
              >
                <View style={[styles.backlogSubjectIcon, { backgroundColor: `${accent}14` }]}>
                  <SubjectIcon subject={subject.name} size={17} color={accent} />
                </View>
                <View style={styles.backlogSubjectCopy}>
                  <Text style={styles.backlogSubject}>{subject.name}</Text>
                  <Text style={styles.backlogMeta}>{subject.count} overdue {subject.count === 1 ? 'card' : 'cards'}</Text>
                </View>
                {onStartSubject && <ChevronRight size={17} color="#686b74" />}
              </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

export function SubjectPerformanceList({ snapshot }: { snapshot: StatsSnapshot }) {
  return (
    <View style={styles.subjectSection}>
      <View style={styles.subjectHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>SUBJECT PERFORMANCE</Text>
          <Text style={styles.sectionTitle}>Recall by subject</Text>
        </View>
        <Text style={styles.minimumNote}>MIN. 5 REVIEWS</Text>
      </View>
      {snapshot.subjects.map((subject) => {
        const accent = getSubjectAccentColor(subject.name);
        return (
        <View key={subject.name} style={styles.subjectCard}>
          <View style={[styles.subjectIcon, { backgroundColor: `${accent}14` }]}>
            <SubjectIcon subject={subject.name} size={19} color={accent} />
          </View>
          <View style={styles.subjectCopy}>
            <View style={styles.subjectTitleRow}>
              <Text style={styles.subjectName}>{subject.name}</Text>
              {subject.needsAttention && <Text style={styles.attentionBadge}>NEEDS WORK</Text>}
            </View>
            <Text style={styles.subjectMeta}>{subject.reviews} reviews</Text>
          </View>
          <View style={styles.subjectResult}>
            <Text style={[styles.subjectRecall, !subject.hasEnoughData && styles.subjectRecallMuted]}>
              {subject.recallRate === null ? '—' : `${subject.recallRate}%`}
            </Text>
            <Text style={styles.subjectResultLabel}>{subject.hasEnoughData ? 'RECALL' : 'MORE DATA'}</Text>
          </View>
        </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rangeSelector: { flexDirection: 'row', alignSelf: 'flex-start', padding: 4, gap: 3, backgroundColor: '#15171B', borderRadius: 12, borderWidth: 1, borderColor: '#2A2C32', marginBottom: 16 },
  rangeButton: { minWidth: 48, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 9, alignItems: 'center' },
  rangeButtonActive: { backgroundColor: '#6c7bff' },
  rangeText: { color: '#7f828b', fontSize: 11, fontFamily: 'Outfit_700Bold' },
  rangeTextActive: { color: '#ffffff' },
  overviewCard: { borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#34395f', marginBottom: 14 },
  overviewTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  recallBlock: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#9da5ff', fontSize: 9, letterSpacing: 1.3, fontFamily: 'Outfit_700Bold' },
  recallValue: { color: '#ffffff', fontSize: 42, lineHeight: 48, marginTop: 5, fontFamily: 'Outfit_700Bold' },
  trendPill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: '#173126', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginTop: 4 },
  trendPillDown: { backgroundColor: '#351f24' },
  trendText: { flexShrink: 1, color: '#71d49d', fontSize: 9, fontFamily: 'Outfit_600SemiBold' },
  trendTextDown: { color: '#ef8b8b' },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffffff0a', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, marginLeft: 8 },
  sourceDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#43c58a' },
  sourceDotCached: { backgroundColor: '#e4a85c' },
  sourceText: { color: '#a8aab2', fontSize: 9, fontFamily: 'Outfit_600SemiBold' },
  overviewMetrics: { flexDirection: 'row', alignItems: 'center', marginTop: 22, paddingTop: 17, borderTopWidth: 1, borderTopColor: '#ffffff12' },
  overviewMetric: { flex: 1 },
  overviewMetricValue: { color: '#f2f2f4', fontSize: 18, fontFamily: 'Outfit_700Bold' },
  overviewMetricLabel: { color: '#777b87', fontSize: 8, letterSpacing: 0.9, marginTop: 2, fontFamily: 'Outfit_700Bold' },
  metricDivider: { width: 1, height: 26, backgroundColor: '#ffffff12', marginHorizontal: 10 },
  focusCard: { flexDirection: 'row', padding: 16, borderRadius: 18, backgroundColor: '#171a2a', borderWidth: 1, borderColor: '#30365c', marginBottom: 14 },
  focusCardStrong: { backgroundColor: '#13231d', borderColor: '#244a39' },
  focusIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#6c7bff18', alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  focusIconStrong: { backgroundColor: '#43c58a16' },
  focusCopy: { flex: 1 },
  focusLabel: { color: '#777fbb', fontSize: 8, letterSpacing: 1, fontFamily: 'Outfit_700Bold' },
  focusTitle: { color: '#f1f1f3', fontSize: 15, marginTop: 2, fontFamily: 'Outfit_700Bold' },
  focusMessage: { color: '#9699a3', fontSize: 11, lineHeight: 16, marginTop: 3, fontFamily: 'Outfit_500Medium' },
  secondaryGrid: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  secondaryCard: { flex: 1, borderRadius: 17, padding: 15, backgroundColor: '#15171B', borderWidth: 1, borderColor: '#2A2C32' },
  secondaryValue: { color: '#ececef', fontSize: 19, marginTop: 9, fontFamily: 'Outfit_700Bold' },
  secondaryLabel: { color: '#777b84', fontSize: 8, letterSpacing: 0.8, marginTop: 2, fontFamily: 'Outfit_700Bold' },
  sectionCard: { backgroundColor: '#15171B', borderRadius: 21, padding: 18, borderWidth: 1, borderColor: '#2A2C32', marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  sectionEyebrow: { color: '#777b84', fontSize: 8, letterSpacing: 1.2, fontFamily: 'Outfit_700Bold' },
  sectionTitle: { color: '#ececef', fontSize: 16, marginTop: 2, fontFamily: 'Outfit_700Bold' },
  selectedBucket: { maxWidth: 145, textAlign: 'right', color: '#8e98ff', fontSize: 9, fontFamily: 'Outfit_600SemiBold' },
  chart: { height: 116, flexDirection: 'row', alignItems: 'stretch', gap: 3 },
  barColumn: { flex: 1, minWidth: 2, alignItems: 'center' },
  barTrack: { height: 88, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '72%', minWidth: 3, maxWidth: 15, borderRadius: 4, backgroundColor: '#35394a' },
  barSelected: { backgroundColor: '#6c7bff' },
  barLabel: { color: '#5f626b', fontSize: 7, marginTop: 7, width: 34, textAlign: 'center', fontFamily: 'Outfit_600SemiBold' },
  barLabelSelected: { color: '#aab1ff' },
  backlogTotalBadge: { minWidth: 38, height: 29, paddingHorizontal: 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e4a85c18', borderWidth: 1, borderColor: '#e4a85c32' },
  backlogTotalBadgeClear: { backgroundColor: '#43c58a12', borderColor: '#43c58a28' },
  backlogTotal: { color: '#e4a85c', fontSize: 15, fontFamily: 'Outfit_700Bold' },
  backlogTotalClear: { color: '#43c58a' },
  backlogAgeRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#e4a85c0c', marginBottom: 10 },
  backlogAge: { color: '#bfa078', fontSize: 10, fontFamily: 'Outfit_600SemiBold' },
  backlogStack: { gap: 8 },
  backlogRow: { flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 13, backgroundColor: '#1a1c21', borderWidth: 1, borderColor: '#282b31' },
  backlogSubjectIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e4a85c12', marginRight: 10 },
  backlogSubjectCopy: { flex: 1 },
  backlogSubject: { color: '#ececef', fontSize: 13, fontFamily: 'Outfit_700Bold' },
  backlogMeta: { color: '#777b84', fontSize: 10, marginTop: 1, fontFamily: 'Outfit_500Medium' },
  backlogClearState: { flexDirection: 'row', alignItems: 'center', padding: 13, borderRadius: 13, backgroundColor: '#43c58a0d', borderWidth: 1, borderColor: '#43c58a1f' },
  backlogClearCopy: { flex: 1, marginLeft: 10 },
  backlogClearTitle: { color: '#dcebe3', fontSize: 13, fontFamily: 'Outfit_700Bold' },
  subjectSection: { marginTop: 5 },
  subjectHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 13 },
  minimumNote: { color: '#555861', fontSize: 7, letterSpacing: 0.8, fontFamily: 'Outfit_700Bold' },
  subjectCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#15171B', borderRadius: 17, padding: 14, borderWidth: 1, borderColor: '#2A2C32', marginBottom: 10 },
  subjectIcon: { width: 39, height: 39, borderRadius: 11, backgroundColor: '#6c7bff14', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  subjectCopy: { flex: 1 },
  subjectTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  subjectName: { color: '#ececef', fontSize: 14, fontFamily: 'Outfit_700Bold' },
  attentionBadge: { color: '#e4a85c', backgroundColor: '#e4a85c14', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, fontSize: 6, letterSpacing: 0.5, fontFamily: 'Outfit_700Bold' },
  subjectMeta: { color: '#72757e', fontSize: 10, marginTop: 2, fontFamily: 'Outfit_500Medium' },
  subjectResult: { alignItems: 'flex-end', marginLeft: 8 },
  subjectRecall: { color: '#8e98ff', fontSize: 18, fontFamily: 'Outfit_700Bold' },
  subjectRecallMuted: { color: '#5c5f67' },
  subjectResultLabel: { color: '#555861', fontSize: 6, letterSpacing: 0.6, fontFamily: 'Outfit_700Bold' },
});
