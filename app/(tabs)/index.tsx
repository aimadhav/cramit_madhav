import React, { useMemo, useEffect, useState } from "react";
import { StyleSheet, View, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { BookOpen, Compass, FlaskConical, Hash, Heart, Code, Cpu, Settings2 } from "lucide-react-native";
import { Text } from "@/components/AppText";

import { useThemeColors } from "@/hooks/useThemeColors";
import { useUserStore } from "@/store/user-store";
import { useFlashcardStore } from "@/store/flashcard-store";
import { DatabaseService } from "@/services/database-service";
import { StudyService } from "@/services/study-service";

import { SubjectConfigModal } from "@/components/SubjectConfigModal";
import { UnifiedAlertModal } from "@/components/UnifiedAlertModal";
import { HomeHeader } from "@/components/HomeHeader";
import { CompletedChaptersBanner } from "@/components/CompletedChaptersBanner";
import { TodayActivityCard } from "@/components/TodayActivityCard";
import { RecommendedSubjectCard } from "@/components/RecommendedSubjectCard";
import { OtherSubjectsGrid } from "@/components/OtherSubjectsGrid";

const EXAM_SUBJECTS: Record<string, string[]> = {
  'JEE': ['Physics', 'Chemistry', 'Mathematics'],
  'NEET': ['Physics', 'Chemistry', 'Biology'],
  'Computer Science': ['DSA', 'DBMS', 'Operating Systems', 'OOP', 'Computer Networks']
};

const getSubjectIcon = (subject: string, size: number = 18, color: string = "#5e6ad2") => {
  if (!subject) return <BookOpen size={size} color={color} />;
  const s = subject.toLowerCase();
  if (s.includes('phys')) return <Compass size={size} color={color} />;
  if (s.includes('chem')) return <FlaskConical size={size} color={color} />;
  if (s.includes('math')) return <Hash size={size} color={color} />;
  if (s.includes('bio')) return <Heart size={size} color={color} />;
  if (s.includes('cs') || s.includes('dsa') || s.includes('os') || s.includes('network') || s.includes('dbms') || s.includes('oop')) {
    return <Cpu size={size} color={color} />;
  }
  return <BookOpen size={size} color={color} />;
};

export default function HomeScreen() {
  const router = useRouter();
  const { openConfig, subject } = useLocalSearchParams<{ openConfig?: string, subject?: string }>();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useUserStore();
  const { decks } = useFlashcardStore();

  const [activeChapters, setActiveChapters] = useState<Record<string, string[]>>({});
  const [completedChapters, setCompletedChapters] = useState<any[]>([]);
  const [lockedChapterIds, setLockedChapterIds] = useState<string[]>([]);
  const [subjectStatsMap, setSubjectStatsMap] = useState<Record<string, {
    dueCount: number;
    newCount: number;
    totalSession: number;
    backlogCount: number;
    totalCards: number;
    nextChapterName: string;
  }>>({});
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [isLaunchingSession, setIsLaunchingSession] = useState(false);
  
  // Chapter Config Modal State
  const [isConfigModalVisible, setIsChapterModalVisible] = useState(false);
  const [modalSubject, setModalSubject] = useState<string | null>(null);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);

  // Auto open config modal if requested from redirects (e.g., chapter completed mid-session)
  useEffect(() => {
    if (openConfig === 'true' && subject && activeChapters[subject]) {
      router.setParams({ openConfig: undefined, subject: undefined });
      openConfigModal(subject, activeChapters[subject] || []);
    }
  }, [openConfig, subject, activeChapters]);

  // Downloading Chapter State
  const [downloadingChapterId, setDownloadingChapterId] = useState<string | null>(null);
  
  // Unified Custom Alert Modal State
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'warning' | 'error' | 'info';
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showCustomAlert = (title: string, message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    setAlertConfig({
      visible: true,
      title,
      message,
      type
    });
  };

  const userId = user?.id || 'local';
  const userFocus = user?.prepFocus || 'JEE';
  const subjects = useMemo(() => EXAM_SUBJECTS[userFocus] || EXAM_SUBJECTS['JEE'], [userFocus]);

  const loadActiveChapters = async () => {
    try {
      const activeMap: Record<string, string[]> = {};
      const completedList: any[] = [];
      const lockedList: string[] = [];
      const statsMap: Record<string, {
        dueCount: number;
        newCount: number;
        totalSession: number;
        backlogCount: number;
        totalCards: number;
        nextChapterName: string;
      }> = {};

      for (const sub of subjects) {
        const activeIds = await DatabaseService.getActiveChapterIds(userId, sub);
        activeMap[sub] = activeIds;

        if (activeIds.length === 0) {
          statsMap[sub] = {
            dueCount: 0,
            newCount: 0,
            totalSession: 0,
            backlogCount: 0,
            totalCards: 0,
            nextChapterName: '',
          };
          continue;
        }

        const { db } = require('@/db');
        const { eq, and, inArray, lte } = require('drizzle-orm');
        const { flashcards, userFlashcardStatus } = require('@/db/schema');

        // Fetch subject decks
        const subjectDecks = decks.filter(d => 
          d.subject && d.subject.toLowerCase() === sub.toLowerCase()
        );
        const subjectDeckIds = subjectDecks.map(d => d.id);

        const now = Date.now();
        let actualDueInDb = 0;

        if (subjectDeckIds.length > 0) {
          const reviewedDueCards = await db.select({ id: flashcards.id })
            .from(flashcards)
            .innerJoin(
              userFlashcardStatus,
              and(
                eq(flashcards.id, userFlashcardStatus.flashcardId),
                eq(userFlashcardStatus.userId, userId),
                lte(userFlashcardStatus.due_date, now)
              )
            )
            .where(inArray(flashcards.deckId, subjectDeckIds));
          
          actualDueInDb = reviewedDueCards.length;
        }

        // Fetch active chapters cards
        let activeCards = [];
        let actualNewInDb = 0;
        let totalCards = 0;

        if (activeIds.length > 0) {
          activeCards = await db.select({
            id: flashcards.id,
            deckId: flashcards.deckId,
            dueDate: userFlashcardStatus.due_date,
          })
          .from(flashcards)
          .leftJoin(
            userFlashcardStatus,
            and(
              eq(flashcards.id, userFlashcardStatus.flashcardId),
              eq(userFlashcardStatus.userId, userId)
            )
          )
          .where(inArray(flashcards.deckId, activeIds));

          totalCards = activeCards.length;
          actualNewInDb = activeCards.filter((c: any) => c.dueDate === null).length;
        }

        const dailyTarget = 45;
        const reservedNew = Math.min(5, actualNewInDb);
        const dueCount = Math.min(actualDueInDb, dailyTarget - reservedNew);
        const newCardsNeeded = Math.max(0, dailyTarget - dueCount);
        const newCount = Math.min(newCardsNeeded, actualNewInDb);

        // Find the first active chapter that still has unreviewed new cards
        const nextChapterId = activeIds.find(id => {
          return activeCards.some((card: any) => card.deckId === id && card.dueDate === null);
        }) || activeIds[0];

        const nextChapterName = decks.find(d => d.id === nextChapterId)?.name || '';

        statsMap[sub] = {
          dueCount,
          newCount,
          totalSession: dueCount + newCount,
          backlogCount: Math.max(0, actualDueInDb - dueCount),
          totalCards,
          nextChapterName,
        };

        // Check if any active chapters have 0 new cards left (meaning chapter is fully introduced)
        const chaptersList = decks.filter(d => activeIds.includes(d.id));
        for (const chap of chaptersList) {
          const chapNewCardsCount = activeCards.filter((c: any) => c.deckId === chap.id && c.dueDate === null).length;
          if (chapNewCardsCount === 0 && chap.cardCount > 0) {
            completedList.push(chap);
          }

          // Check if studied AND has remaining unintroduced new cards (locked)
          const studiedCards = activeCards.filter((c: any) => c.deckId === chap.id && c.dueDate !== null);
          if (studiedCards.length > 0 && chapNewCardsCount > 0) {
            lockedList.push(chap.id);
          }
        }
      }
      setActiveChapters(activeMap);
      setCompletedChapters(completedList);
      setLockedChapterIds(lockedList);
      setSubjectStatsMap(statsMap);
    } catch (e) {
      console.error('[Home] Failed to load active chapters:', e);
    }
  };

  // Trigger sync on mount
  useEffect(() => {
    const { SyncService } = require('@/services/sync-service');
    if (userId) {
      setIsFetchingMetadata(true);
      SyncService.pullDecks()
        .then(() => useFlashcardStore.getState().loadDecks())
        .then(() => loadActiveChapters())
        .finally(() => setIsFetchingMetadata(false));
    }
  }, [userFocus, userId, decks.length]);

  // Refresh stats whenever home screen is refocused (e.g., returning from a study session)
  useFocusEffect(
    React.useCallback(() => {
      loadActiveChapters();
    }, [userId, userFocus, decks.length])
  );

  // Reactive Stats Mapper for each Subject
  const subjectStats = useMemo(() => {
    return subjects.map(subjectName => {
      const chapters = decks.filter(d => 
        d.subject && d.subject.toLowerCase() === subjectName.toLowerCase()
      );

      const activeIds = activeChapters[subjectName] || [];
      const activeChaptersList = chapters.filter(c => activeIds.includes(c.id));

      const stats = subjectStatsMap[subjectName] || {
        dueCount: 0,
        newCount: 0,
        totalSession: 0,
        backlogCount: 0,
        totalCards: 0,
        nextChapterName: '',
      };

      return {
        subjectName,
        chapters,
        activeChaptersList,
        activeIds,
        totalCards: stats.totalCards,
        dueCount: stats.dueCount,
        newCount: stats.newCount,
        totalSession: stats.totalSession,
        backlogCount: stats.backlogCount,
        nextChapterName: stats.nextChapterName,
      };
    }).sort((a, b) => {
      // 1. Prioritize subjects that actually have active cards to study today (totalSession > 0)
      const hasCardsA = a.activeIds.length > 0 && a.totalSession > 0 ? 1 : 0;
      const hasCardsB = b.activeIds.length > 0 && b.totalSession > 0 ? 1 : 0;
      if (hasCardsA !== hasCardsB) {
        return hasCardsB - hasCardsA; // Put subjects with cards to study first!
      }

      // 2. If both have cards, or both are completed/caught up, prioritize subjects that have active chapters selected
      const hasActiveA = a.activeIds.length > 0 ? 1 : 0;
      const hasActiveB = b.activeIds.length > 0 ? 1 : 0;
      if (hasActiveA !== hasActiveB) {
        return hasActiveB - hasActiveA;
      }

      // 3. Fallback to default focus array order (Physics, Chemistry, Maths, etc.)
      return 0;
    });
  }, [decks, subjects, activeChapters, subjectStatsMap]);

  // Determine top priority subject based on sorting
  const topSubject = subjectStats.length > 0 ? subjectStats[0] : null;
  const otherSubjects = subjectStats.length > 1 ? subjectStats.slice(1) : [];

  // Filter completed chapters to only show after the daily target session is fully completed
  const completedChaptersToShow = useMemo(() => {
    return completedChapters.filter(chap => {
      const stats = subjectStats.find(s => s.subjectName.toLowerCase() === chap.subject?.toLowerCase());
      return stats && stats.totalSession === 0;
    });
  }, [completedChapters, subjectStats]);

  const handleStartSession = async (subject: string, isBacklog: boolean = false) => {
    if (isLaunchingSession) return;
    setIsLaunchingSession(true);

    try {
      const targetLimit = isBacklog ? 30 : 45;
      const queue = isBacklog 
        ? await StudyService.getBacklogQueue(subject, targetLimit)
        : await StudyService.getSessionQueue(subject, targetLimit);

      if (queue.length === 0) {
        showCustomAlert("All Caught Up!", "No cards due or active in this subject right now. Add more chapters to continue!", "success");
        return;
      }

      await useFlashcardStore.getState().startStudySession(subject, false, queue);
      router.push(`/study/${subject}`);
    } catch (e: any) {
      showCustomAlert("Session Error", "Could not build study session queue.", "error");
    } finally {
      setIsLaunchingSession(false);
    }
  };

  const openConfigModal = (subject: string, currentlyActive: string[]) => {
    setModalSubject(subject);
    const uncompletedActive = currentlyActive.filter(id => !completedChapters.some(c => c.id === id));
    setSelectedChapters(uncompletedActive);
    setIsChapterModalVisible(true);
  };

  const handleSubjectChangeInModal = async (newSubject: string) => {
    setModalSubject(newSubject);
    try {
      const activeIds = await DatabaseService.getActiveChapterIds(userId, newSubject);
      const uncompletedActive = activeIds.filter(id => !completedChapters.some(c => c.id === id));
      setSelectedChapters(uncompletedActive);
    } catch (e) {
      console.error('[Home] Failed to load active chapters for switch:', e);
    }
  };

  const handleSaveChapters = async () => {
    if (!modalSubject) return;

    if (selectedChapters.length < 1 || selectedChapters.length > 3) {
      showCustomAlert("Selection Limit", "Please select between 1 and 3 chapters initially.", "warning");
      return;
    }

    try {
      const chaptersToDeactivate = (activeChapters[modalSubject] || []).filter(id => !selectedChapters.includes(id));
      
      // Update local SQLite
      for (const id of selectedChapters) {
        await DatabaseService.addActiveChapter(userId, id, modalSubject);
      }
      for (const id of chaptersToDeactivate) {
        await DatabaseService.completeActiveChapter(userId, id);
      }

      await loadActiveChapters();
      setIsChapterModalVisible(false);
      
      // Trigger background push sync to Supabase
      const { SyncService } = require('@/services/sync-service');
      SyncService.pushChanges(userId);
    } catch (e) {
      showCustomAlert("Error", "Could not save chapter preferences.", "error");
    }
  };

  const handleDownloadChapter = async (chapId: string) => {
    const { SyncService } = require('@/services/sync-service');
    const NetInfo = require('@react-native-community/netinfo');
    
    const state = await NetInfo.fetch();
    const isOnline = state.isConnected && state.isInternetReachable !== false;

    if (!isOnline) {
      showCustomAlert("Connection Required", "An active internet connection is required to download chapter flashcards for offline use. Please turn on Wi-Fi or mobile data.", "warning");
      return;
    }

    setDownloadingChapterId(chapId);
    try {
      console.log(`📡 [Home] Downloading chapter on-demand: ${chapId}`);
      const success = await SyncService.downloadDeckContent(chapId);
      if (success) {
        await useFlashcardStore.getState().loadDecks();
      } else {
        showCustomAlert("Download Failed", "Could not download flashcards. Please try again.", "error");
      }
    } catch (e) {
      console.error(e);
      showCustomAlert("Download Error", "An error occurred during chapter download.", "error");
    } finally {
      setDownloadingChapterId(null);
    }
  };

  const handleShowActiveChaptersInfo = (subjectName: string, activeIds: string[]) => {
    const activeChaptersList = decks.filter(d => activeIds.includes(d.id));
    if (activeIds.length > 0) {
      showCustomAlert(
        `${subjectName} Active`, 
        `Currently active chapters:\n\n• ${activeChaptersList.map(c => c.name).join('\n• ')}`, 
        "info"
      );
    } else {
      showCustomAlert(
        `${subjectName} Setup`, 
        "No active chapters selected yet. Click the configure button to setup your chapters!", 
        "warning"
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Modular Header Component */}
        <HomeHeader 
          userName={user?.name || 'Scholar'} 
          userFocus={userFocus} 
          streakDays={user?.streakDays || 0} 
        />

        {isFetchingMetadata && (
          <ActivityIndicator size="small" color="#5e6ad2" style={{ marginBottom: 15 }} />
        )}

        {/* Modular Recommended Subject Card Component (Bigger Box) */}
        <RecommendedSubjectCard 
          topSubject={topSubject}
          isLaunchingSession={isLaunchingSession}
          userFocus={userFocus}
          onStartSession={handleStartSession}
          onConfigureChapters={openConfigModal}
          onShowActiveChaptersInfo={handleShowActiveChaptersInfo}
          getSubjectIcon={getSubjectIcon}
        />

        {/* Modular Other Subjects Grid Component (Smaller Boxes) */}
        <OtherSubjectsGrid 
          otherSubjects={otherSubjects}
          onStartSession={handleStartSession}
          onConfigureChapters={openConfigModal}
          onShowActiveChaptersInfo={handleShowActiveChaptersInfo}
          getSubjectIcon={getSubjectIcon}
        />

        {/* Modular Today's Activity Progress Card Component */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TODAY'S ACTIVITY</Text>
          <TodayActivityCard 
            totalCardsStudied={user?.totalCardsStudied || 0} 
            totalTimeStudied={user?.totalTimeStudied || 0} 
            dailyGoal={45} 
          />
        </View>

        {/* Centralized Configuration Button at the bottom */}
        <TouchableOpacity 
          style={styles.globalConfigBtn}
          onPress={() => openConfigModal(subjects[0], activeChapters[subjects[0]] || [])}
        >
          <Settings2 size={15} color="#5e6ad2" style={{ marginRight: 8 }} />
          <Text style={styles.globalConfigBtnText}>CONFIGURE STUDY CHAPTERS</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Chapter Configuration Modal Component */}
      <SubjectConfigModal
        visible={isConfigModalVisible}
        modalSubject={modalSubject}
        selectedChapters={selectedChapters}
        decks={decks}
        downloadingChapterId={downloadingChapterId}
        onClose={() => setIsChapterModalVisible(false)}
        onSave={handleSaveChapters}
        setSelectedChapters={setSelectedChapters}
        onDownloadChapter={handleDownloadChapter}
        onShowCustomAlert={showCustomAlert}
        subjects={subjects}
        onSubjectChange={handleSubjectChangeInModal}
        lockedChapterIds={lockedChapterIds}
        completedChapterIds={completedChapters.map(c => c.id)}
      />

      {/* Unified Custom Alert Modal Component */}
      <UnifiedAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />

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
  // Global Configuration Button at the bottom
  globalConfigBtn: {
    backgroundColor: '#121318',
    borderColor: '#3a3f6d',
    borderWidth: 1,
    paddingVertical: 15,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25,
    marginBottom: 10,
    shadowColor: '#5e6ad2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 2,
  },
  globalConfigBtnText: {
    color: '#ECECEC',
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    letterSpacing: 0.5,
  }
});
