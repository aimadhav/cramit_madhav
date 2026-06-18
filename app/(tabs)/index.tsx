import React, { useMemo, useEffect , useState } from "react";
import { StyleSheet, View, ScrollView, TouchableOpacity, Dimensions ,ActivityIndicator} from "react-native";
import { Text } from "@/components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Flame, Play, FlaskConical, FunctionSquare, Brain, Clock, CreditCard as Cards, LogOut, Atom, Activity, Check, BookOpen } from "lucide-react-native";

import { useThemeColors } from "@/hooks/useThemeColors";
import { useUserStore } from "@/store/user-store";
import { useFlashcardStore } from "@/store/flashcard-store";

const { width } = Dimensions.get('window');

const getSubjectIcon = (subject: string, size: number = 18, color: string = "#5e6ad2") => {
  if (!subject) return <BookOpen size={size} color={color} />;
  const s = subject.toLowerCase();
  if (s.includes('phys')) return <Atom size={size} color={color} />;
  if (s.includes('chem')) return <FlaskConical size={size} color={color} />;
  if (s.includes('math')) return <FunctionSquare size={size} color={color} />;
  if (s.includes('bio')) return <Activity size={size} color={color} />;
  if (s.includes('cs') || s.includes('dsa') || s.includes('os') || s.includes('network')) return <Brain size={size} color={color} />;
  return <BookOpen size={size} color={color} />;
};

export default function HomeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { logout, user } = useUserStore();
  const { decks, getCardsToStudyCount } = useFlashcardStore();
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [isDownloadingDeck, setIsDownloadingDeck] = useState(false);

  // Trigger sync on mount
  useEffect(() => {
    const { SyncService } = require('@/services/sync-service');
    const { user: stateUser } = useUserStore.getState();
    if (stateUser?.id) {
      setIsFetchingMetadata(true);
      SyncService.pullDecks()
        .then(() => {
          const { useFlashcardStore: store } = require('@/store/flashcard-store');
          return store.getState().loadDecks();
        })
        .finally(() => setIsFetchingMetadata(false));
    }
  }, []);

  // Diagnostics
  useEffect(() => {
    console.log(`🏠 [Home] Total Decks currently in Local SQLite Store: ${decks.length}`);
    if (decks.length > 0) {
      decks.forEach((d: any) => {
        console.log(`🏠 [Home] Deck: "${d.name}" | Subj: "${d.subject}" | Category: "${d.prepCategory}" | Public: ${d.isPublic} | Local Cards: ${d.cardCount}`);
      });
    } else {
      console.log(`🏠 [Home] SQLite Store is empty! No decks to display.`);
    }
  }, [decks]);

  // Calculate real stats dynamically
  const stats = useMemo(() => {
    const userFocus = user?.prepFocus || 'JEE'; // Fallback to JEE
    
    // 1. Filter decks for the user's focus (or if deck prep_category is empty, include it for backward compatibility)
    const validDecks = decks.filter(d => !d.prepCategory || d.prepCategory === userFocus);
    
    // 2. Group decks by subject
    const subjectMap: Record<string, { name: string, totalToStudy: number, decks: any[] }> = {};
    
    validDecks.forEach(d => {
      const subjName = d.subject && d.subject !== 'subject' ? d.subject : (d.name || 'General');
      if (!subjectMap[subjName]) {
        subjectMap[subjName] = { name: subjName, totalToStudy: 0, decks: [] };
      }
      subjectMap[subjName].decks.push(d);
      subjectMap[subjName].totalToStudy += getCardsToStudyCount(d.id);
    });

    const subjectData = Object.values(subjectMap).map(sub => {
      // Pick the first deck as primary for now, or the one with most cards due
      const decksWithCounts = sub.decks.map(deck => ({
        ...deck,
        studyCount: getCardsToStudyCount(deck.id)
      }));
      const primaryDeck = decksWithCounts.sort((a, b) => b.studyCount - a.studyCount)[0];
      return {
        name: sub.name,
        totalToStudy: sub.totalToStudy,
        deckId: primaryDeck?.id,
      };
    }).sort((a, b) => b.totalToStudy - a.totalToStudy); // Sort by most due cards

    const totalToStudy = subjectData.reduce((acc, curr) => acc + curr.totalToStudy, 0);

    return {
      subjectData,
      totalToStudy,
      streak: user?.streakDays || 0,
      totalStudied: user?.totalCardsStudied || 0,
      dailyGoal: 50, // Hardcoded goal for now
      userFocus,
    };
  }, [decks, user, getCardsToStudyCount]);

  // Determine top priority subject
  const topSubject = stats.subjectData.length > 0 ? stats.subjectData[0] : null;
  const otherSubjects = stats.subjectData.length > 1 ? stats.subjectData.slice(1) : [];

  const handleStartRevision = async (deckId: string) => {
    if (!deckId || isDownloadingDeck) return;
    const { SyncService } = require('@/services/sync-service');
    
    try {
      setIsDownloadingDeck(true);
      const store = useFlashcardStore.getState();
      let deck = store.decks.find((d: any) => d.id === deckId);
      
      if (!deck) return;
      
      console.log(`📡 [Home] Selected deck: ${deck.name} | Cards locally: ${deck.cardCount}`);

      if (deck.cardCount === 0) {
        console.log(`📡 [Home] Empty deck detected → downloading flashcard content`);
        const success = await SyncService.downloadDeckContent(deckId);
        
        if (!success) {
          console.log(`❌ [Home] Deck download failed`);
          return;
        }
        
        // Refresh the local store so it knows we now have cards!
        await store.loadDecks();
        deck = useFlashcardStore.getState().decks.find((d: any) => d.id === deckId);
        console.log(`📡 [Home] Reloaded → New cardCount=${deck?.cardCount}`);
        
        if (!deck?.cardCount) {
          console.log(`⚠️ Download completed but still 0 local cards. Check Supabase 'status' column.`);
          return;
        }
      }

      router.push(`/study/${deckId}`);
    } finally {
      setIsDownloadingDeck(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logoText}><Text style={{ color: '#5e6ad2' }}>✦</Text> Cramit.</Text>
            <Text style={styles.welcomeSub}>Ready to revise, {user?.name || 'Scholar'}?</Text>
            <View style={styles.focusBadge}>
               <Text style={styles.focusBadgeText}>{stats.userFocus} Prep</Text>
            </View>
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
          {topSubject ? (
            <TouchableOpacity 
              activeOpacity={0.9}
              onPress={() => topSubject.deckId && handleStartRevision(topSubject.deckId)}
              disabled={!topSubject.deckId}
            >
              <View style={styles.recommendedCard}>
                <View style={styles.recommendedHeader}>
                  <View style={[styles.priorityBadge, topSubject.totalToStudy === 0 && { backgroundColor: '#1F2125', borderColor: '#2A2C32' }]}>
                    <Text style={[styles.priorityBadgeText, topSubject.totalToStudy === 0 && { color: '#5F6166' }]}>
                      {topSubject.totalToStudy === 0 ? 'ALL CAUGHT UP' : 'CRITICAL RETENTION'}
                    </Text>
                  </View>
                  <View style={styles.priorityLabel}>
                    <Brain size={12} color="#5f6166" />
                    <Text style={styles.priorityLabelText}>High Priority</Text>
                  </View>
                </View>

                <View style={styles.recommendedMain}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[styles.gridIcon, { backgroundColor: '#1F1A1B', borderColor: '#2E2324', marginBottom: 0 }]}>
                      {getSubjectIcon(topSubject.name, 22, "#FF5F57")}
                    </View>
                    <View>
                      <Text style={styles.recommendedTitle}>{topSubject.name}</Text>
                      <Text style={styles.recommendedSubtitle}>Review Session</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>AVAILABLE</Text>
                    <View style={styles.statValueContainer}>
                      <Cards size={14} color={topSubject.totalToStudy === 0 ? "#5F6166" : "#5e6ad2"} fill={topSubject.totalToStudy === 0 ? "none" : "#5e6ad2"} />
                      <Text style={[styles.statValue, topSubject.totalToStudy === 0 && { color: '#5F6166' }]}>{topSubject.totalToStudy || 0}</Text>
                    </View>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>EST. TIME</Text>
                    <View style={styles.statValueContainer}>
                      <Clock size={14} color={topSubject.totalToStudy === 0 ? "#5F6166" : "#5e6ad2"} fill={topSubject.totalToStudy === 0 ? "none" : "#5e6ad2"} />
                      <Text style={[styles.statValue, topSubject.totalToStudy === 0 && { color: '#5F6166' }]}>~{Math.ceil((topSubject.totalToStudy || 0) * 0.5)}m</Text>
                    </View>
                  </View>
                </View>
                
                <View style={[
                  styles.startButton, 
                  (!topSubject.deckId || isDownloadingDeck) && { backgroundColor: '#1F2125', shadowOpacity: 0, elevation: 0 }
                ]}>
                  {isDownloadingDeck ? (
                    <ActivityIndicator size="small" color="#5e6ad2" />
                  ) : topSubject.totalToStudy === 0 ? (
                    <Check size={16} color="#5F6166" />
                  ) : (
                    <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
                  )}
                  <Text style={[styles.startButtonText, (topSubject.totalToStudy === 0 || !topSubject.deckId || isDownloadingDeck) && { color: '#5F6166' }]}>
                    {isDownloadingDeck ? 'Downloading...' : topSubject.totalToStudy === 0 ? 'Done for Today' : 'Start Revision'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.recommendedCard}>
               <Text style={styles.recommendedTitle}>No Decks Found</Text>
               <Text style={styles.recommendedSubtitle}>Check back later or subscribe to decks for {stats.userFocus}.</Text>
            </View>
          )}
        </View>

        {/* Subject Queues */}
        {otherSubjects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>OTHER SUBJECT QUEUES</Text>
            <View style={styles.grid}>
              {otherSubjects.map((subj, idx) => (
                <TouchableOpacity 
                  key={subj.name + idx}
                  style={styles.gridItem} 
                  onPress={() => subj.deckId && handleStartRevision(subj.deckId)}
                  disabled={!subj.deckId}
                >
                  <View style={[styles.gridIcon, { backgroundColor: '#1A1F1C', borderColor: '#232925' }]}>
                    {getSubjectIcon(subj.name, 18, "#4CD964")}
                  </View>
                  <Text style={styles.gridTitle} numberOfLines={1}>{subj.name}</Text>
                  <View style={styles.gridStats}>
                    <Text style={styles.gridDue}>{subj.totalToStudy || 0} Study</Text>
                    <Text style={styles.gridTime}>~{Math.ceil((subj.totalToStudy || 0) * 0.5)}m</Text>
                  </View>
                  <View style={[styles.gridButton, !subj.deckId && { opacity: 0.5 }]}>
                    <Text style={styles.gridButtonText}>{subj.totalToStudy ? 'Revise' : 'Explore'}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

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
  focusBadge: {
    backgroundColor: '#5e6ad220',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  focusBadgeText: {
    color: '#5e6ad2',
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
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
    flexWrap: 'wrap',
    gap: 15,
  },
  gridItem: {
    width: (width - 55) / 2, // 2 columns with padding/gap math
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
