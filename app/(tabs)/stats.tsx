import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { ClassesSection, JoinedClass } from '@/components/ClassesSection';
import { JoinClassModal } from '@/components/JoinClassModal';
import {
  FocusInsightCard,
  BacklogCard,
  SecondaryStats,
  StatsActivityChart,
  StatsOverviewCard,
  StatsRangeSelector,
  SubjectPerformanceList,
} from '@/components/StatsDashboard';
import { StatsHeader } from '@/components/StatsHeader';
import { Text } from '@/components/AppText';
import { isSubjectAllowedForPrepFocus } from '@/constants/examSubjects';
import { supabase } from '@/lib/supabase';
import { StatsService } from '@/services/stats-service';
import { AuthService } from '@/services/auth-service';
import { StudyService } from '@/services/study-service';
import { useFlashcardStore } from '@/store/flashcard-store';
import { OFFLINE_MODE_TOKEN, useUserStore } from '@/store/user-store';
import type { StatsDataSource, StatsRange, StatsSnapshot } from '@/types/stats';
import { reportError } from '@/lib/monitoring';

export default function StatsScreen() {
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const sessionToken = useUserStore((state) => state.sessionToken);
  const decks = useFlashcardStore((state) => state.decks);
  const getStreak = useFlashcardStore((state) => state.getStreak);

  const [range, setRange] = useState<StatsRange>(30);
  const [snapshot, setSnapshot] = useState<StatsSnapshot | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const rangeRef = useRef<StatsRange>(30);
  const sourceRef = useRef<StatsDataSource>('local');
  const snapshotRequestIdRef = useRef(0);

  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinedRooms, setJoinedRooms] = useState<JoinedClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState(false);
  const [roomsRefreshKey, setRoomsRefreshKey] = useState(0);

  const userId = user?.id || 'local';
  const isCloudUser = Boolean(sessionToken && sessionToken !== OFFLINE_MODE_TOKEN && user?.id);
  const availableSubjects = useMemo(() => Array.from(new Set(
    decks
      .filter((deck) => isSubjectAllowedForPrepFocus(deck.subject, user?.prepFocus))
      .map((deck) => deck.subject?.trim())
      .filter((subject): subject is string => Boolean(subject))
  )), [decks, user?.prepFocus]);
  const subjectsKey = availableSubjects.join('|');

  const loadSnapshot = useCallback(async (source: StatsDataSource, selectedRange = rangeRef.current) => {
    const requestId = ++snapshotRequestIdRef.current;
    const result = await StatsService.getSnapshot({
      userId,
      range: selectedRange,
      prepFocus: user?.prepFocus,
      availableSubjects,
      dataSource: source,
    });
    if (requestId !== snapshotRequestIdRef.current) return;
    sourceRef.current = source;
    setSnapshot(result);
    setStatsError(null);
  }, [userId, user?.prepFocus, subjectsKey]);

  const refreshStats = useCallback(async (showPullRefresh = false) => {
    if (showPullRefresh) setIsRefreshing(true);
    else setIsStatsLoading(true);

    try {
      const source = isCloudUser
        ? await StatsService.refreshCloudHistory(userId)
        : 'local';
      await loadSnapshot(source);
    } catch (error) {
      reportError(error, { operation: 'stats-refresh' });
      console.error('[Stats] Failed to calculate analytics');
      try {
        await loadSnapshot('cached');
      } catch (cachedError) {
        reportError(cachedError, { operation: 'stats-cached-fallback' });
        console.error('[Stats] Cached analytics also failed');
        setStatsError('Your progress could not be loaded right now.');
      }
    } finally {
      setIsStatsLoading(false);
      setIsRefreshing(false);
    }
  }, [isCloudUser, userId, loadSnapshot]);

  useFocusEffect(
    useCallback(() => {
      refreshStats();
    }, [refreshStats])
  );

  useEffect(() => {
    rangeRef.current = range;
    if (!snapshot) return;
    loadSnapshot(sourceRef.current, range).catch((error) => {
      console.error('[Stats] Failed to switch analytics range:', error);
      setStatsError('This time range could not be loaded.');
    });
  }, [range, loadSnapshot]);

  const fetchJoinedRooms = useCallback(async () => {
    if (!user?.id || !isCloudUser) {
      setJoinedRooms([]);
      setClassesLoading(false);
      setClassesError(false);
      return;
    }

    setClassesLoading(true);
    setClassesError(false);
    try {
      const { data, error } = await supabase
        .rpc('get_my_rooms');
      if (error) throw error;

      const rooms = (data ?? []) as Array<{
        room_id: string;
        name: string;
        role: string;
        member_count: number;
      }>;

      setJoinedRooms(rooms.map((room) => ({
        id: room.room_id,
        name: room.name,
        role: room.role,
        memberCount: Number(room.member_count) || 0,
      })));
    } catch (error) {
      reportError(error, { operation: 'load-joined-classes' });
      console.error('[Stats] Failed to load joined classes');
      setClassesError(true);
    } finally {
      setClassesLoading(false);
    }
  }, [user?.id, isCloudUser, roomsRefreshKey]);

  useEffect(() => {
    fetchJoinedRooms();
  }, [fetchJoinedRooms]);

  const handleJoinRoom = async () => {
    if (joinCode.trim().length !== 6) {
      Alert.alert('Error', 'Join code must be 6 characters.');
      return;
    }

    try {
      if (!user?.id || !isCloudUser) throw new Error('You must be signed in to join a class.');
      const { data: joinedData, error } = await supabase.rpc('join_room_by_code', {
        p_code: joinCode.trim().toUpperCase(),
      });
      if (error) throw error;
      const data = Array.isArray(joinedData) ? joinedData[0] : joinedData;
      if (!data) throw new Error('Invalid room code');

      const { db } = require('@/db');
      const { rooms } = require('@/db/schema');
      await db.insert(rooms).values({
        id: data.room_id,
        code: data.code,
        name: data.name,
        description: data.description,
        createdBy: data.created_by,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }).onConflictDoUpdate({
        target: rooms.id,
        set: { name: data.name, updatedAt: Date.now() },
      });

      Alert.alert('Success', `Joined ${data.name}!`);
      setIsJoinModalVisible(false);
      setJoinCode('');
      setRoomsRefreshKey((key) => key + 1);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleStartBacklog = async (subject: string) => {
    try {
      const queue = await StudyService.getBacklogQueue(subject, 30);
      if (queue.length === 0) {
        Alert.alert('All caught up', `There are no overdue ${subject} cards right now.`);
        await loadSnapshot(sourceRef.current);
        return;
      }
      await useFlashcardStore.getState().startStudySession(subject, false, queue);
      router.push(`/study/${subject}`);
    } catch (error) {
      console.error('[Stats] Failed to start backlog session:', error);
      Alert.alert('Session error', 'Could not start the backlog session. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => refreshStats(true)}
            tintColor="#6c7bff"
            colors={['#6c7bff']}
            progressBackgroundColor="#15171B"
          />
        }
      >
        <StatsHeader
          streakDays={getStreak()}
          onOpenSettings={() => router.push('/settings')}
          onSignOut={async () => {
            await AuthService.signOut();
            router.replace('/login');
          }}
        />

        <ClassesSection
          joinedRooms={joinedRooms}
          isLoading={classesLoading}
          error={classesError}
          onRetry={fetchJoinedRooms}
          canJoin={isCloudUser}
          onJoinPress={() => setIsJoinModalVisible(true)}
          onRoomPress={(room) => {
            if (room.role === 'teacher') router.push(`/teacher-portal/${room.id}`);
          }}
        />

        <StatsRangeSelector value={range} onChange={setRange} />

        {snapshot ? (
          <>
            <StatsOverviewCard snapshot={snapshot} />
            <FocusInsightCard snapshot={snapshot} />
            <SecondaryStats snapshot={snapshot} />
            <StatsActivityChart snapshot={snapshot} />
            <BacklogCard snapshot={snapshot} onStartSubject={handleStartBacklog} />
            <SubjectPerformanceList snapshot={snapshot} />
          </>
        ) : statsError ? (
          <View style={styles.loadingCard}>
            <Text style={styles.errorTitle}>Progress unavailable</Text>
            <Text style={styles.loadingText}>{statsError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => void refreshStats()}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#6c7bff" />
            <Text style={styles.loadingText}>{isStatsLoading ? 'Building your progress view…' : 'No analytics available'}</Text>
          </View>
        )}
      </ScrollView>

      <JoinClassModal
        visible={isJoinModalVisible}
        joinCode={joinCode}
        onClose={() => setIsJoinModalVisible(false)}
        onChangeJoinCode={setJoinCode}
        onJoin={handleJoinRoom}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B0C0E' },
  container: { paddingHorizontal: 20, paddingBottom: 112 },
  loadingCard: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#15171B', borderRadius: 21, borderWidth: 1, borderColor: '#2A2C32' },
  loadingText: { color: '#858891', fontSize: 12, fontFamily: 'Outfit_500Medium' },
  errorTitle: { color: '#FFFFFF', fontSize: 17, fontFamily: 'Outfit_700Bold' },
  retryButton: { backgroundColor: '#6c7bff', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  retryButtonText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Outfit_700Bold' },
});
