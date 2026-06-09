import React, { useMemo, useEffect } from "react";
import { StyleSheet, View, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { Text } from "@/components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Flame, Play, FlaskConical, FunctionSquare, Brain, Clock, CreditCard as Cards, LogOut, Atom, Activity, Check } from "lucide-react-native";

import { useThemeColors } from "@/hooks/useThemeColors";
import { useUserStore } from "@/store/user-store";
import { useFlashcardStore } from "@/store/flashcard-store";
import { MOCK_USER_STATS } from "@/constants/mockData";

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { logout, user } = useUserStore();
  const { decks, getCardsToStudyCount } = useFlashcardStore();

  // Diagnostics
  useEffect(() => {
    console.log(`🏠 [Home] Total Decks in Store: ${decks.length}`);
    if (decks.length > 0) {
      decks.forEach(d => {
        console.log(`🏠 [Home] Deck: ${d.name} | Subj: ${d.subject} | Due: ${(d as any).dueCount}`);
      });
    }
  }, [decks]);

  // Calculate real stats
  const stats = useMemo(() => {
    const subjects = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
    const subjectData = subjects.map(name => {
      // Find decks that belong to this subject (with fallback for broken "subject" string)
      const subjectDecks = decks.filter(d => 
        d.subject === name || 
        (d.subject === 'subject' && d.name.toLowerCase().includes(name.toLowerCase()))
      );
      
      let totalToStudy = 0;
      subjectDecks.forEach(d => {
        totalToStudy += getCardsToStudyCount(d.id);
      });
      return { name, totalToStudy, deckId: subjectDecks[0]?.id };
    });

    const totalToStudy = subjectData.reduce((acc, curr) => acc + curr.totalToStudy, 0);

    return {
      subjectData,
      totalToStudy,
      streak: user?.streakDays || 0,
      totalStudied: user?.totalCardsStudied || 0,
      dailyGoal: 50, // Hardcoded goal for now
    };
  }, [decks, user, getCardsToStudyCount]);

  const physicsData = stats.subjectData.find(s => s.name === 'Physics');
  const chemData = stats.subjectData.find(s => s.name === 'Chemistry');
  const mathData = stats.subjectData.find(s => s.name === 'Mathematics');
  const bioData = stats.subjectData.find(s => s.name === 'Biology');

  const handleStartRevision = async (deckId: string) => {
    const { useFlashcardStore } = require('@/store/flashcard-store');
    const { SyncService } = require('@/services/sync-service');
    
    const store = useFlashcardStore.getState();
    const deck = store.decks.find((d: any) => d.id === deckId);
    
    if (!deck) return;

    // If deck has 0 cards locally, it needs a "Stage C" download
    if (deck.cardCount === 0) {
      console.log(`📡 [Home] Deck ${deckId} is empty. Starting Stage C pull...`);
      await SyncService.downloadDeckContent(deckId);
      await store.initializeStore(); // Refresh everything
    }

    router.push(`/study/${deckId}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logoText}><Text style={{ color: '#5e6ad2' }}>✦</Text> Cramit.</Text>
            <Text style={styles.welcomeSub}>Ready to revise, {user?.name || 'Scholar'}?</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.streakPill} activeOpacity={0.7}>
              <Flame size={16} color="#d2995e" fill="#d2995e" />
              <Text style={styles.streakText}>{stats.streak} Days</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recommended Now */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RECOMMENDED NOW</Text>
          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={() => physicsData?.deckId && handleStartRevision(physicsData.deckId)}
            disabled={!physicsData?.deckId}
          >
            <View style={styles.recommendedCard}>
              <View style={styles.recommendedHeader}>
                <View style={[styles.priorityBadge, physicsData?.totalToStudy === 0 && { backgroundColor: '#1F2125', borderColor: '#2A2C32' }]}>
                  <Text style={[styles.priorityBadgeText, physicsData?.totalToStudy === 0 && { color: '#5F6166' }]}>
                    {physicsData?.totalToStudy === 0 ? 'ALL CAUGHT UP' : 'CRITICAL RETENTION'}
                  </Text>
                </View>
                <View style={styles.priorityLabel}>
                  <Brain size={12} color="#5f6166" />
                  <Text style={styles.priorityLabelText}>High Priority</Text>
                </View>
              </View>

              <View style={styles.recommendedMain}>
                <View>
                  <Text style={styles.recommendedTitle}>Physics</Text>
                  <Text style={styles.recommendedSubtitle}>Mechanics & Core Concepts</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>AVAILABLE</Text>
                  <View style={styles.statValueContainer}>
                    <Cards size={14} color={physicsData?.totalToStudy === 0 ? "#5F6166" : "#5e6ad2"} fill={physicsData?.totalToStudy === 0 ? "none" : "#5e6ad2"} />
                    <Text style={[styles.statValue, physicsData?.totalToStudy === 0 && { color: '#5F6166' }]}>{physicsData?.totalToStudy || 0}</Text>
                  </View>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>EST. TIME</Text>
                  <View style={styles.statValueContainer}>
                    <Clock size={14} color={physicsData?.totalToStudy === 0 ? "#5F6166" : "#5e6ad2"} fill={physicsData?.totalToStudy === 0 ? "none" : "#5e6ad2"} />
                    <Text style={[styles.statValue, physicsData?.totalToStudy === 0 && { color: '#5F6166' }]}>~{Math.ceil((physicsData?.totalToStudy || 0) * 0.5)}m</Text>
                  </View>
                </View>
              </View>
              
              <View style={[
                styles.startButton, 
                (!physicsData?.deckId) && { backgroundColor: '#1F2125', shadowOpacity: 0, elevation: 0 }
              ]}>
                {physicsData?.totalToStudy === 0 ? (
                  <Check size={16} color="#5F6166" />
                ) : (
                  <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
                )}
                <Text style={[styles.startButtonText, (physicsData?.totalToStudy === 0 || !physicsData?.deckId) && { color: '#5F6166' }]}>
                  {physicsData?.totalToStudy === 0 ? 'Done for Today' : 'Start Revision'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Subject Queues */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>OTHER SUBJECT QUEUES</Text>
          <View style={styles.grid}>
            {/* Chemistry */}
            <TouchableOpacity 
              style={styles.gridItem} 
              onPress={() => chemData?.deckId && handleStartRevision(chemData.deckId)}
              disabled={!chemData?.deckId}
            >
              <View style={[styles.gridIcon, { backgroundColor: '#1A1F1C', borderColor: '#232925' }]}>
                <FlaskConical size={18} color="#4CD964" />
              </View>
              <Text style={styles.gridTitle}>Chemistry</Text>
              <View style={styles.gridStats}>
                <Text style={styles.gridDue}>{chemData?.totalToStudy || 0} Study</Text>
                <Text style={styles.gridTime}>~{Math.ceil((chemData?.totalToStudy || 0) * 0.5)}m</Text>
              </View>
              <View style={[styles.gridButton, !chemData?.deckId && { opacity: 0.5 }]}>
                <Text style={styles.gridButtonText}>{chemData?.totalToStudy ? 'Revise' : 'Explore'}</Text>
              </View>
            </TouchableOpacity>

            {/* Maths */}
            <TouchableOpacity 
              style={styles.gridItem}
              onPress={() => mathData?.deckId && handleStartRevision(mathData.deckId)}
              disabled={!mathData?.deckId}
            >
              <View style={[styles.gridIcon, { backgroundColor: '#1F1A1B', borderColor: '#2E2324' }]}>
                <FunctionSquare size={18} color="#FF5F57" />
              </View>
              <Text style={styles.gridTitle}>Maths</Text>
              <View style={styles.gridStats}>
                <Text style={styles.gridDue}>{mathData?.totalToStudy || 0} Study</Text>
                <Text style={styles.gridTime}>~{Math.ceil((mathData?.totalToStudy || 0) * 0.5)}m</Text>
              </View>
              <View style={[styles.gridButton, !mathData?.deckId && { opacity: 0.5 }]}>
                <Text style={styles.gridButtonText}>{mathData?.totalToStudy ? 'Revise' : 'Explore'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TODAY'S ACTIVITY</Text>
          <View style={styles.activityCard}>
            <View style={styles.activityHeader}>
              <View>
                <Text style={styles.activityValue}>{user?.totalCardsStudied || 0}/{stats.dailyGoal}</Text>
                <Text style={styles.activityGoalLabel}>DAILY PROGRESS</Text>
              </View>
              <View style={styles.chart}>
                {/* Visual representation of progress */}
                {Array.from({ length: 7 }).map((_, i) => (
                  <View 
                    key={i} 
                    style={[
                      styles.chartBar, 
                      { 
                        height: i === 6 
                          ? `${Math.min(100, ((user?.totalCardsStudied || 0) / stats.dailyGoal) * 100)}%` 
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
                <Text style={styles.footerLabel}>CARDS AVAILABLE</Text>
                <Text style={[styles.footerValue, { color: '#d2995e' }]}>{stats.totalToStudy} Cards</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.footerLabel}>TIME SPENT</Text>
                <Text style={[styles.footerValue, { color: '#5e6ad2' }]}>{user?.totalTimeStudied || 0} min</Text>
              </View>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0c0e',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 100,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 25,
  },
  logoText: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#ececec',
  },
  welcomeSub: {
    fontSize: 12,
    color: '#94969a',
    fontFamily: 'Outfit_500Medium',
    marginTop: 2,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15171b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2c32',
  },
  streakText: {
    color: '#ececec',
    fontFamily: 'Outfit_600SemiBold',
    marginLeft: 6,
    fontSize: 13,
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    color: '#94969a',
    letterSpacing: 1,
    marginBottom: 12,
  },
  recommendedCard: {
    backgroundColor: '#15171b',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2a2c32',
  },
  recommendedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  priorityBadge: {
    backgroundColor: '#2D2B4A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3E3C66',
  },
  priorityBadgeText: {
    color: '#8E96FF',
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.5,
  },
  priorityLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priorityLabelText: {
    color: '#5f6166',
    fontSize: 9,
    fontFamily: 'Outfit_600SemiBold',
  },
  recommendedMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  recommendedTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    marginBottom: 2,
  },
  recommendedSubtitle: {
    color: '#94969a',
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  statItem: {
    flexDirection: 'column',
  },
  statLabel: {
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    color: '#5f6166',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: '#FFFFFF',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#2a2c32',
  },
  startButton: {
    backgroundColor: '#5e6ad2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#5e6ad2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
  },
  grid: {
    flexDirection: 'row',
    gap: 15,
  },
  gridItem: {
    flex: 1,
    backgroundColor: '#15171b',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2c32',
  },
  gridIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gridTitle: {
    color: '#ececec',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    marginBottom: 12,
  },
  gridStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridDue: {
    color: '#94969a',
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  gridTime: {
    color: '#5f6166',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  gridWaitlist: {
    color: '#5f6166',
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  gridDone: {
    color: '#3fb950',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  gridButton: {
    backgroundColor: '#2a2c32',
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridButtonText: {
    color: '#94969a',
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
  },
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
