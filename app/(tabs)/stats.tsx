import React, { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text } from '@/components/AppText';
import { useThemeColors } from '@/hooks/useThemeColors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Atom, FlaskConical, FunctionSquare, BookOpen } from 'lucide-react-native';
import { useRouter } from "expo-router";
import { useUserStore } from '@/store/user-store';
import { useFlashcardStore } from '@/store/flashcard-store';
import { supabase } from '@/lib/supabase';
import { MOCK_USER_STATS } from '@/constants/mockData';

import { HeatmapGrid } from '@/components/HeatmapGrid';
import { StatsHeader } from '@/components/StatsHeader';
import { ClassesSection } from '@/components/ClassesSection';
import { StatsSummaryCards } from '@/components/StatsSummaryCards';
import { StatsStreakCard } from '@/components/StatsStreakCard';
import { SubjectMasteryList } from '@/components/SubjectMasteryList';
import { DevAndAccountSettings } from '@/components/DevAndAccountSettings';
import { JoinClassModal } from '@/components/JoinClassModal';

export default function StatsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, logout } = useUserStore();
  const { decks, getStreak, getDeckCompletionRate } = useFlashcardStore();

  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  
  // Real Local Stats State
  const [localStats, setLocalStats] = useState({ totalReviews: 0, uniqueCards: 0 });
  const [joinedRooms, setJoinedRooms] = useState<any[]>([]);

  useEffect(() => {
    const fetchLocalStats = async () => {
      const { db, expoDb } = require('@/db');
      const { reviews, userFlashcardStatus } = require('@/db/schema');
      const { count, eq } = require('drizzle-orm');
      
      try {
        // Quick check if tables exist to prevent early crash
   

        const revCount = await db.select({ value: count() }).from(reviews).where(eq(reviews.userId, user?.id || 'local'));
        const cardCount = await db.select({ value: count() }).from(userFlashcardStatus).where(eq(userFlashcardStatus.userId, user?.id || 'local'));
        
        setLocalStats({
          totalReviews: revCount[0]?.value || 0,
          uniqueCards: cardCount[0]?.value || 0
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
      // Direct Supabase call for joining room logic
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', joinCode)
        .single();
      
      if (error || !data) throw new Error('Invalid room code');

      const { db } = require('@/db');
      const { rooms } = require('@/db/schema');
      
      // Save room locally
      await db.insert(rooms).values({
        id: data.id,
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
      // Trigger re-fetch
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const stats = useMemo(() => {
    const streak = getStreak();
    const totalStudied = localStats.totalReviews;
    const totalKnown = localStats.uniqueCards;
    
    const subjects = [
      { name: 'Physics', icon: Atom, color: '#5e6ad2' },
      { name: 'Chemistry', icon: FlaskConical, color: '#3fb950' },
      { name: 'Mathematics', icon: FunctionSquare, color: '#d25e5e' },
      { name: 'Biology', icon: BookOpen, color: '#f59e0b' }
    ];

    const masteryData = subjects.map(s => {
      const subjectDecks = decks.filter(d => d.subject === s.name);
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
      heatmap: MOCK_USER_STATS.heatmap, // Keep mock heatmap for now until we track daily counts in store
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

        <DevAndAccountSettings
          userEmail={user?.email || 'Account'}
          onOpenSqlDebugger={() => router.push("/debug-sqlite")}
          onOpenCardInspector={() => router.push("/debug-cards")}
          onSignOut={() => {
            logout();
            router.replace('/login');
          }}
        />

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
