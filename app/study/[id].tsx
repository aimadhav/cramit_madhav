import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { StyleSheet, View, Alert, Dimensions, ActivityIndicator } from "react-native";
import { Text } from "@/components/AppText";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useFlashcardStore } from "@/store/flashcard-store";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';

import { useThemeColors } from "@/hooks/useThemeColors";
import { useUserStore } from "@/store/user-store";
import { DifficultyRating, Flashcard } from "@/types";
import { MOCK_TEMP_CARDS } from "@/constants/mockData";

import { StudyCompletion } from "@/components/StudyCompletion";
import { StudyHeader } from "@/components/StudyHeader";
import { StudySwipeHints } from "@/components/StudySwipeHints";
import { StudyCard } from "@/components/StudyCard";
import { StudyNoteModal } from "@/components/StudyNoteModal";
import { NoCardsReady } from "@/components/NoCardsReady";

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.2; 

export default function StudySessionScreen() {
  const { id, cram } = useLocalSearchParams<{ id: string, cram?: string }>();
  const isCramMode = cram === 'true';
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(colors, insets), [colors, insets]);

  // Store selectors
  const decks = useFlashcardStore(state => state.decks);
  const flashcards = useFlashcardStore(state => state.flashcards);
  const studyProgress = useFlashcardStore(state => state.studyProgress);
  const sessionQueue = useFlashcardStore(state => state.sessionQueue);
  
  const getNextCardFromStore = useFlashcardStore(state => state.getNextCard);
  const startStudySession = useFlashcardStore(state => state.startStudySession);
  const rateCard = useFlashcardStore(state => state.rateCard);
  const syncSessionProgress = useFlashcardStore(state => state.syncSessionProgress);
  const endStudySession = useFlashcardStore(state => state.endStudySession);
  const toggleBookmark = useFlashcardStore(state => state.toggleBookmark);
  const updateCardNote = useFlashcardStore(state => state.updateCardNote);
  
  const updateStudyStats = useUserStore(state => state.updateStudyStats);
  const user = useUserStore(state => state.user);
  const userId = user?.id || 'local';
  
  // Local state
  const [showBack, setShowBack] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);
  const [isRating, setIsRating] = useState(false);
  const [isFullView, setIsFullView] = useState(false);
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteMode, setNoteMode] = useState<'read' | 'edit'>('edit');
  const [isNoteSaving, setIsNoteSaving] = useState(false);
  const [bookmarkedCards, setBookmarkedCards] = useState<Record<string, boolean>>({});
  const [isInitializing, setIsInitializing] = useState(true);
  const [backlogCount, setBacklogCount] = useState(0);
  const [completedChapterName, setCompletedChapterName] = useState<string | null>(null);
  const cardShownTimeRef = useRef<number>(Date.now());
  
  // Mock handling for temp decks
  const isTempDeck = id?.startsWith('temp_') || id?.startsWith('rec_');
  
  // Start session on mount for real decks
  useEffect(() => {
    async function init() {
      if (!isTempDeck && id) {
        const store = useFlashcardStore.getState();
        // If the store already has an active session pre-loaded for this ID/Subject, do not override it!
        if (store.currentDeckId === id && store.sessionQueue.length > 0) {
          console.log('📱 [UI] Active session already loaded for:', id);
          setIsInitializing(false);
          return;
        }

        console.log('📱 [UI] Starting study session for deck:', id);
        try {
          await startStudySession(id, isCramMode);
          setIsInitializing(false);
        } catch (error) {
          console.error('📱 [UI] Error starting study session:', error);
          Alert.alert("Error", "Could not load this study session.", [
            { text: "OK", onPress: () => router.back() }
          ]);
        }
      } else {
        setIsInitializing(false);
      }
    }
    init();
  }, [id, isTempDeck, isCramMode]);

  const tempCards = MOCK_TEMP_CARDS;
  const [tempCurrentIndex, setTempCurrentIndex] = useState(0);

  // Animation values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const outlineColor = useSharedValue('transparent');
  
  // Get current card
  const currentCard = useMemo(() => {
    if (isTempDeck) {
      return (tempCurrentIndex < tempCards.length ? tempCards[tempCurrentIndex] : null) as Flashcard | null;
    }
    if (!studyProgress || sessionQueue.length === 0) return null;
    if (studyProgress.currentCardIndex >= sessionQueue.length) return null;
    
    // Always check for real cards first, then fallback to mock for quick prep
    const cardId = sessionQueue[studyProgress.currentCardIndex];
    const realCard = flashcards.find(f => f.id === cardId);
    
    if (realCard) return realCard;
    
    // Fallback for Quick Prep mock cards
    return (tempCards.find(f => f.id === cardId) || null) as Flashcard | null;
  }, [isTempDeck, tempCurrentIndex, studyProgress, sessionQueue, flashcards]);
  
  // Check if session is complete
  const isSessionComplete = isTempDeck 
    ? (tempCurrentIndex >= tempCards.length)
    : (!currentCard && studyProgress && !isInitializing && studyProgress.cardsLeft === 0);

  const isCurrentBookmarked = useMemo(() => {
    if (!currentCard) return false;
    return isTempDeck ? !!bookmarkedCards[currentCard.id] : !!currentCard.isBookmarked;
  }, [currentCard, isTempDeck, bookmarkedCards]);

  const hasNote = currentCard ? !!currentCard.notes : false;

  // Sync progress when session finishes
  useEffect(() => {
    if (isSessionComplete && !isTempDeck && !isCramMode) {
      syncSessionProgress();

      // Query backlog count and completed chapters for congratulations screen prompts
      async function checkPostSessionStats() {
        try {
          const { db } = require('@/db');
          const { eq, and, inArray } = require('drizzle-orm');
          const { flashcards, userFlashcardStatus, decks } = require('@/db/schema');
          
          const { DatabaseService } = require('@/services/database-service');
          const activeIds = await DatabaseService.getActiveChapterIds(userId, id);
          if (activeIds.length > 0) {
            const activeCards = await db.select({
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

            const now = Date.now();
            const actualDue = activeCards.filter((c: any) => c.dueDate !== null && c.dueDate <= now).length;
            setBacklogCount(actualDue);

            // Check if any active chapters are fully completed (0 new cards remaining)
            const chaptersList = await db.select()
              .from(decks)
              .where(inArray(decks.id, activeIds));

            for (const chap of chaptersList) {
              const chapNewCardsCount = activeCards.filter((c: any) => c.deckId === chap.id && c.dueDate === null).length;
              if (chapNewCardsCount === 0 && chap.cardCount > 0) {
                setCompletedChapterName(chap.name);
                break;
              }
            }
          }
        } catch (e) {
          console.error('[Study] Error checking post session stats:', e);
        }
      }
      checkPostSessionStats();
    }
  }, [isSessionComplete, isTempDeck]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!isTempDeck) {
        const sessionDuration = Math.ceil((Date.now() - sessionStartTime) / 60000);
        const cardsStudied = studyProgress?.cardsStudied || 0;
        updateStudyStats(sessionDuration, cardsStudied);
        endStudySession();
      }
    };
  }, []);
  
  // Reset card position when card changes
  useEffect(() => {
    if (currentCard) {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      rotate.value = withTiming(0);
      outlineColor.value = withTiming('transparent');
      setShowBack(false);
      
      const existingNote = currentCard.notes || "";
      setNoteText(existingNote);
      setNoteMode(existingNote ? 'read' : 'edit');

      // Reset the response timer for the newly visible card
      cardShownTimeRef.current = Date.now();
    }
  }, [currentCard?.id, tempCurrentIndex]);

  // Handle rating a card
  const handleRateCard = useCallback(async (rating: DifficultyRating) => {
    if (!currentCard || isRating) return;
    const responseTimeMs = Date.now() - cardShownTimeRef.current;
    console.log('📱 [UI] Rating card:', currentCard.id, 'as', rating, 'Response time:', responseTimeMs);

    setIsRating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isTempDeck) {
      setTempCurrentIndex(prev => prev + 1);
      setSwipeDirection(null);
      setIsRating(false);
    } else {
      try {
        await rateCard(currentCard.id, rating, { updateFSRS: !isCramMode, responseTimeMs });
        getNextCardFromStore();
        setSwipeDirection(null);
        setIsRating(false);
      } catch (error) {
        console.error("Error rating card:", error);
        setIsRating(false);
      }
    }
  }, [currentCard, isRating, rateCard, getNextCardFromStore, isTempDeck, isCramMode]);
  
  // Handle bookmark toggle
  const handleToggleBookmark = useCallback(async () => {
    if (!currentCard) return;
    console.log('📱 [UI] Toggle Bookmark clicked for card:', currentCard.id);
    try {
      if (isTempDeck) {
        setBookmarkedCards(prev => ({ ...prev, [currentCard.id]: !prev[currentCard.id] }));
      } else {
        await toggleBookmark(currentCard.id);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      Alert.alert("Error", "Failed to update bookmark.");
    }
  }, [currentCard, toggleBookmark, isTempDeck]);

  // Handle exit
  const handleExit = useCallback(() => {
    if (!isTempDeck) endStudySession();
    router.back();
  }, [endStudySession, router, isTempDeck]);

  // Gesture handler for swipe
  const gesture = Gesture.Pan()
    .enabled(!isFullView) 
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.2; 
      
      rotate.value = interpolate(
        translateX.value,
        [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        [-8, 0, 8],
        Extrapolate.CLAMP
      );
      
      if (translateX.value > 20) {
        outlineColor.value = '#10B981'; 
        runOnJS(setSwipeDirection)('right');
      } else if (translateX.value < -20) {
        outlineColor.value = '#F59E0B'; 
        runOnJS(setSwipeDirection)('left');
      } else {
        outlineColor.value = 'transparent';
        runOnJS(setSwipeDirection)(null);
      }
    })
    .onEnd(() => {
      const swipeOffConfig = { duration: 200 };

      if (translateX.value > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, swipeOffConfig, (finished) => {
          if (finished) runOnJS(handleRateCard)('easy');
        });
      } else if (translateX.value < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, swipeOffConfig, (finished) => {
          if (finished) runOnJS(handleRateCard)('again');
        });
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotate.value = withTiming(0);
        outlineColor.value = withTiming('transparent');
        runOnJS(setSwipeDirection)(null);
      }
    });
  
  // Animated styles
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` }
    ],
    borderColor: outlineColor.value === 'transparent' ? '#2D2D2D' : outlineColor.value,
    borderWidth: 3,
  }));
  
  // Flip gesture
  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      runOnJS(setShowBack)(!showBack);
    });

  const handleStartBacklogSession = async () => {
    try {
      const { StudyService } = require('@/services/study-service');
      const queue = await StudyService.getBacklogQueue(id, Math.min(30, backlogCount));
      await useFlashcardStore.getState().startStudySession(id, false, queue);
      router.replace(`/study/${id}`);
    } catch (e) {
      Alert.alert("Error", "Could not start backlog session.");
    }
  };

  const handleAddChaptersRedirect = () => {
    router.replace(`/(tabs)?openConfig=true&subject=${id}`);
  };

  const containsLatex = (text: string) => text.includes('$') || text.includes('\\');

  console.log('📱 [StudySessionScreen] Debug Stats:', {
    currentCardId: !isTempDeck && studyProgress && sessionQueue.length > 0 && studyProgress.currentCardIndex < sessionQueue.length ? sessionQueue[studyProgress.currentCardIndex] : null,
    currentCard: currentCard ? { id: currentCard.id, front: currentCard.front?.substring(0, 30) } : null,
    cardsLeft: studyProgress?.cardsLeft,
    currentCardIndex: studyProgress?.currentCardIndex,
    queueLength: sessionQueue.length,
    isSessionComplete,
    flashcardsCount: flashcards.length,
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false, title: "" }} />
      
      {isInitializing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5e6ad2" />
          <Text style={{ color: '#94969a', marginTop: 10 }}>Loading Session...</Text>
        </View>
      ) : isSessionComplete ? (
        <StudyCompletion 
          onExit={handleExit}
          backlogCount={backlogCount}
          completedChapterName={completedChapterName}
          onStartBacklog={handleStartBacklogSession}
          onAddChapters={handleAddChaptersRedirect}
        />
      ) : currentCard ? (
        <>
          {/* Header - Completely Hidden in Full View */}
          {!isFullView && (
            <StudyHeader
              title={isTempDeck ? "Quick Prep Session" : (decks.find(d => d.id === id)?.name || "Study")}
              progressPercent={
                isTempDeck 
                  ? (tempCurrentIndex / tempCards.length) * 100
                  : ((studyProgress?.cardsStudied || 0) / ((studyProgress?.cardsStudied || 0) + (studyProgress?.cardsLeft || 0))) * 100
              }
              onExit={handleExit}
            />
          )}
          
          {/* Swipe hints - Hidden in Full View */}
          {!isFullView && (
            <StudySwipeHints swipeDirection={swipeDirection} />
          )}
          
          {/* Card */}
          <StudyCard
            cardStyle={cardStyle}
            gesture={gesture}
            tapGesture={tapGesture}
            isFullView={isFullView}
            showBack={showBack}
            currentCard={currentCard}
            hasNote={hasNote}
            isCurrentBookmarked={isCurrentBookmarked}
            onOpenNote={() => {
              const hasExistingNote = !!currentCard?.notes;
              setNoteMode(hasExistingNote ? 'read' : 'edit');
              setIsNoteModalVisible(true);
            }}
            onToggleBookmark={handleToggleBookmark}
            onToggleFullView={() => setIsFullView(!isFullView)}
          />
          
          {/* Legend - Hidden when in Full View */}
          {!isFullView && (
            <View style={styles.legend}>
              <Text style={styles.legendText}>← Didn't Know • Easy →</Text>
            </View>
          )}
    
          {/* Note Modal */}
          <StudyNoteModal
            visible={isNoteModalVisible}
            noteText={noteText}
            noteMode={noteMode}
            isNoteSaving={isNoteSaving}
            currentCardNotes={currentCard?.notes}
            onClose={() => setIsNoteModalVisible(false)}
            onChangeNoteText={setNoteText}
            onSetNoteMode={setNoteMode}
            onSaveNote={() => {
              if (currentCard) {
                setIsNoteSaving(true);
                if (!isTempDeck) {
                  updateCardNote(currentCard.id, noteText);
                }
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setTimeout(() => {
                  setIsNoteSaving(false);
                  setNoteMode('read');
                }, 1000);
              }
            }}
          />
        </>
      ) : (
        <NoCardsReady onExit={handleExit} />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any, insets: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 30,
  },
  legend: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  legendText: {
    fontSize: 12,
    color: '#94969a',
    fontFamily: 'Outfit_500Medium',
  },
});
