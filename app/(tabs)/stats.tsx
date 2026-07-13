import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
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
import { StudyService } from '@/services/study-service';
import { useFlashcardStore } from '@/store/flashcard-store';
import { OFFLINE_MODE_TOKEN, useUserStore } from '@/store/user-store';
import type { StatsDataSource, StatsRange, StatsSnapshot } from '@/types/stats';

export default function StatsScreen() {
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const sessionToken = useUserStore((state) => state.sessionToken);
  const logout = useUserStore((state) => state.logout);
  const decks = useFlashcardStore((state) => state.decks);
  const getStreak = useFlashcardStore((state) => state.getStreak);

  const [range, setRange] = useState<StatsRange>(30);
  const [snapshot, setSnapshot] = useState<StatsSnapshot | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const rangeRef = useRef<StatsRange>(30);
  const sourceRef = useRef<StatsDataSource>('local');

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
    const result = await StatsService.getSnapshot({
      userId,
      range: selectedRange,
      prepFocus: user?.prepFocus,
      availableSubjects,
      dataSource: source,
    });
    sourceRef.current = source;
    setSnapshot(result);
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
      console.error('[Stats] Failed to calculate analytics:', error);
      await loadSnapshot('cached');
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
        .from('room_memberships')
        .select('room_id, role, rooms!inner(id, name)')
        .eq('user_id', user.id);
      if (error) throw error;

      const memberships = (data ?? []) as Array<{
        room_id: string;
        role: string;
        rooms: { id: string; name: string } | { id: string; name: string }[] | null;
      }>;

      const rooms = await Promise.all(memberships.map(async (membership) => {
        const room = Array.isArray(membership.rooms) ? membership.rooms[0] : membership.rooms;
        if (!room) return null;
        const { count, error: countError } = await supabase
          .from('room_memberships')
          .select('user_id', { count: 'exact', head: true })
          .eq('room_id', room.id);
        if (countError) throw countError;
        return {
          id: room.id,
          name: room.name,
          role: membership.role,
          memberCount: count ?? 0,
        };
      }));

      setJoinedRooms(rooms.filter((room): room is JoinedClass => room !== null));
    } catch (error) {
      console.error('[Stats] Failed to load joined classes:', error);
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
        p_code: joinCode.trim(),
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
          onSignOut={async () => {
            await logout();
            router.replace('/login');
          }}
        />

        <ClassesSection
          joinedRooms={joinedRooms}
          isLoading={classesLoading}
          error={classesError}
          onRetry={fetchJoinedRooms}
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
});
