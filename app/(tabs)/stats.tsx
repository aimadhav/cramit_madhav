import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text } from '@/components/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookOpen, Atom, FlaskConical, FunctionSquare, Heart, Hash, Cpu } from 'lucide-react-native';
import { useRouter } from "expo-router";
import { useUserStore } from '@/store/user-store';
import { useFlashcardStore } from '@/store/flashcard-store';
import { supabase } from '@/lib/supabase';

import { HeatmapGrid } from '@/components/HeatmapGrid';
import { StatsHeader } from '@/components/StatsHeader';
import { ClassesSection } from '@/components/ClassesSection';
import { StatsSummaryCards } from '@/components/StatsSummaryCards';
import { StatsStreakCard } from '@/components/StatsStreakCard';
import { SubjectMasteryList } from '@/components/SubjectMasteryList';
import { JoinClassModal } from '@/components/JoinClassModal';
import { isSubjectAllowedForPrepFocus } from '@/constants/examSubjects';

type JoinedRoom = {
  id: string;
  name: string;
  role: string;
  memberCount: number;
};

const getSubjectIcon = (subject: string) => {
  const normalized = subject.toLowerCase();
  if (normalized.includes('phys')) return Atom;
  if (normalized.includes('chem')) return FlaskConical;
  if (normalized.includes('math')) return FunctionSquare;
  if (normalized.includes('bio')) return Heart;
  if (normalized.includes('dsa') || normalized.includes('dbms') || normalized.includes('operating') || normalized.includes('oop') || normalized.includes('network')) return Cpu;
  return BookOpen;
};

const getSubjectColor = (index: number) => ['#5e6ad2', '#3fb950', '#d25e5e', '#f59e0b', '#a855f7'][index % 5];

export default function StatsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, logout } = useUserStore();
  const { decks, getStreak, getDeckCompletionRate } = useFlashcardStore();

  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  
  // Real Local Stats State
  const [localStats, setLocalStats] = useState({
    totalReviews: 0,
    uniqueCards: 0,
    heatmap: Array.from({ length: 98 }, () => 0),
  });
  const [joinedRooms, setJoinedRooms] = useState<JoinedRoom[]>([]);
  const [roomsRefreshKey, setRoomsRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchJoinedRooms = async () => {
      if (!user?.id) {
        setJoinedRooms([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('room_memberships')
          .select('room_id, role, rooms!inner(id, name)')
          .eq('user_id', user.id);

        if (error) throw error;

        const memberships = (data ?? []) as Array<{
          room_id: string;
          role: string;
          rooms: { id: string; name: string }[] | null;
        }>;

        const rooms = await Promise.all(
          memberships
            .filter((membership) => membership.rooms?.length)
            .map(async (membership) => {
              const room = membership.rooms![0];
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
            })
        );

        if (!cancelled) setJoinedRooms(rooms);
      } catch (error) {
        console.error('[Stats] Failed to load joined classes:', error);
        if (!cancelled) setJoinedRooms([]);
      }
    };

    fetchJoinedRooms();

    return () => {
      cancelled = true;
    };
  }, [user?.id, roomsRefreshKey]);

  useEffect(() => {
    const fetchLocalStats = async () => {
      const { db, expoDb } = require('@/db');
      const { reviews, userFlashcardStatus } = require('@/db/schema');
      const { count, eq, and, gte } = require('drizzle-orm');
      
      try {
        // Quick check if tables exist to prevent early crash
   

        const activeUserId = user?.id || 'local';
        const revCount = await db.select({ value: count() }).from(reviews).where(eq(reviews.userId, activeUserId));
        const cardCount = await db.select({ value: count() }).from(userFlashcardStatus).where(eq(userFlashcardStatus.userId, activeUserId));

        const heatmapDays = 98;
        const dayInMs = 24 * 60 * 60 * 1000;
        const startOfWindow = new Date();
        startOfWindow.setHours(0, 0, 0, 0);
        startOfWindow.setTime(startOfWindow.getTime() - (heatmapDays - 1) * dayInMs);

        const reviewRows = await db
          .select({ reviewedAt: reviews.reviewedAt })
          .from(reviews)
          .where(
            and(
              eq(reviews.userId, activeUserId),
              gte(reviews.reviewedAt, startOfWindow.getTime())
            )
          );

        const reviewCounts = Array.from({ length: heatmapDays }, () => 0);
        for (const review of reviewRows) {
          const index = Math.floor((review.reviewedAt - startOfWindow.getTime()) / dayInMs);
          if (index >= 0 && index < heatmapDays) reviewCounts[index] += 1;
        }

        const maxReviewsInDay = Math.max(...reviewCounts, 1);
        const heatmap = reviewCounts.map((value) =>
          value === 0 ? 0 : Math.min(4, Math.ceil((value / maxReviewsInDay) * 4))
        );
        
        setLocalStats({
          totalReviews: revCount[0]?.value || 0,
          uniqueCards: cardCount[0]?.value || 0,
          heatmap,
        });
      } catch (e) {
        console.error('Stats calc failed:', e);
      }
    };
    fetchLocalStats();
  }, [user?.id]);

  const handleJoinRoom = async () => {
    if (joinCode.length !== 6) {
      Alert.alert('Error', 'Join code must be 6 characters.');
      return;
    }
    
    try {
      if (!user?.id) throw new Error('You must be signed in to join a class.');

      const { data: joinedRooms, error } = await supabase.rpc('join_room_by_code', {
        p_code: joinCode.trim(),
      });

      if (error) throw error;
      const data = Array.isArray(joinedRooms) ? joinedRooms[0] : joinedRooms;
      if (!data) throw new Error('Invalid room code');

      const { db } = require('@/db');
      const { rooms } = require('@/db/schema');
      
      // Save room locally
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
        set: { name: data.name, updatedAt: Date.now() }
      });

      Alert.alert('Success', `Joined ${data.name}!`);
      setIsJoinModalVisible(false);
      setJoinCode('');
      setRoomsRefreshKey((key) => key + 1);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const stats = useMemo(() => {
    const streak = getStreak();
    const totalStudied = localStats.totalReviews;
    const totalKnown = localStats.uniqueCards;
    
    const subjects = Array.from(new Set(
      decks
        .filter((deck) => isSubjectAllowedForPrepFocus(deck.subject, user?.prepFocus))
        .map((deck) => deck.subject?.trim())
        .filter(Boolean)
    )).map((name, index) => ({
      name: name as string,
      icon: getSubjectIcon(name as string),
      color: getSubjectColor(index),
    }));

    const masteryData = subjects.map(s => {
      const subjectDecks = decks.filter(d => d.subject?.trim().toLowerCase() === s.name.toLowerCase());
      let totalMastery = 0;
      let totalDecksWithCards = 0;
      
      subjectDecks.forEach(d => {
        if (d.cardCount > 0) {
          totalMastery += getDeckCompletionRate(d.id);
          totalDecksWithCards++;
        }
      });
      
      const avgMastery = totalDecksWithCards > 0 ? totalMastery / totalDecksWithCards : 0;
      return { ...s, mastery: Math.round(avgMastery) };
    });

    return {
      streak,
      totalStudied,
      totalKnown,
      masteryData,
      heatmap: localStats.heatmap,
    };
  }, [decks, user, getStreak, getDeckCompletionRate, localStats]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        <StatsHeader 
          streakDays={stats.streak} 
          onSignOut={() => {
            logout();
            router.replace('/login');
          }} 
        />

        <ClassesSection
          joinedRooms={joinedRooms}
          onJoinPress={() => setIsJoinModalVisible(true)}
          onRoomPress={(room) => {
            if (room.role === 'teacher') {
              router.push(`/teacher-portal/${room.id}`);
            }
          }}
        />

        <StatsSummaryCards 
          totalStudied={stats.totalStudied} 
          totalKnown={stats.totalKnown} 
        />

        {/* Heatmap Section */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardSectionLabel}>ACTIVITY HEATMAP</Text>
            <TouchableOpacity><Text style={styles.detailText}>Last 3 Months</Text></TouchableOpacity>
          </View>
          <HeatmapGrid heatmapData={stats.heatmap} />
        </View>

        <StatsStreakCard streak={stats.streak} />

        <SubjectMasteryList masteryData={stats.masteryData} />

        <View style={{ height: 40 }} />
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

const createStyles = (colors: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0C0E',
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#15171B',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardSectionLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#94969a',
    letterSpacing: 1.5,
  },
  detailText: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#5e6ad2',
  },
});

const stylesHeatmap = StyleSheet.create({
  container: {
    width: '100%',
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  column: {
    gap: 6,
  },
  cell: {
    width: 13,
    height: 13,
    borderRadius: 3,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  legendText: {
    fontSize: 10,
    color: '#94969a',
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.5,
  },
  legendColors: {
    flexDirection: 'row',
    gap: 5,
  }
});
