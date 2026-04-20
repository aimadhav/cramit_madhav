import React, { useState, useEffect, useMemo, useCallback } from "react";
import { StyleSheet, View, TouchableOpacity, ScrollView, Alert, Dimensions, Platform } from "react-native";
import { Text } from "@/components/AppText";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useFlashcardStore } from "@/store/flashcard-store";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { X, RotateCw, Clock, ArrowLeft, Bookmark } from "lucide-react-native";
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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useThemeColors } from "@/hooks/useThemeColors";
import { useUserStore } from "@/store/user-store";
import WebViewLatexBlock from "../../components/WebViewLatexBlock";
import { DifficultyRating } from "@/types";
import { MOCK_TEMP_CARDS } from "@/constants/mockData";

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

export default function StudySessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(colors, insets), [colors, insets]);

  // Store selectors
  const decks = useFlashcardStore(state => state.decks);
  const flashcards = useFlashcardStore(state => state.flashcards);
  const getCurrentCardFromStore = useFlashcardStore(state => state.getCurrentCard);
  const getNextCardFromStore = useFlashcardStore(state => state.getNextCard);
  const startStudySession = useFlashcardStore(state => state.startStudySession);
  const rateCard = useFlashcardStore(state => state.rateCard);
  const syncSessionProgress = useFlashcardStore(state => state.syncSessionProgress);
  const endStudySession = useFlashcardStore(state => state.endStudySession);
  const studyProgress = useFlashcardStore(state => state.studyProgress);
  const toggleBookmark = useFlashcardStore(state => state.toggleBookmark);
  
  const updateStudyStats = useUserStore(state => state.updateStudyStats);
  
  // Local state
  const [showBack, setShowBack] = useState(false);
  const [studyTime, setStudyTime] = useState(0);
  const [sessionStartTime] = useState(Date.now());
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);
  const [isRating, setIsRating] = useState(false);
  
  // Mock handling for temp decks
  const isTempDeck = id?.startsWith('temp_') || id?.startsWith('rec_');
  const tempCards = MOCK_TEMP_CARDS;
  const [tempCurrentIndex, setTempCurrentIndex] = useState(0);

  // Animation values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  
  // Get current card
  const currentCard = isTempDeck 
    ? (tempCurrentIndex < tempCards.length ? tempCards[tempCurrentIndex] : null)
    : getCurrentCardFromStore();
  
  // Check if session is complete
  const isSessionComplete = isTempDeck 
    ? (tempCurrentIndex >= tempCards.length)
    : (!currentCard && studyProgress && studyProgress.cardsLeft === 0);

  // Sync progress when session finishes
  useEffect(() => {
    if (isSessionComplete && !isTempDeck) {
      syncSessionProgress();
    }
  }, [isSessionComplete, isTempDeck]);
  
  // Timer for study session
  useEffect(() => {
    const timer = setInterval(() => {
      setStudyTime(prev => prev + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  
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
      setShowBack(false);
    }
  }, [currentCard?.id, tempCurrentIndex]);

  // Handle rating a card
  const handleRateCard = useCallback(async (rating: DifficultyRating) => {
    if (!currentCard || isRating) return;

    setIsRating(true);
    
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isTempDeck) {
      setTempCurrentIndex(prev => prev + 1);
      setSwipeDirection(null);
      setIsRating(false);
    } else {
      try {
        await rateCard(currentCard.id, rating);
        getNextCardFromStore();
        setSwipeDirection(null);
        setIsRating(false);
      } catch (error) {
        console.error("Error rating card:", error);
        setIsRating(false);
      }
    }
  }, [currentCard, isRating, rateCard, getNextCardFromStore, isTempDeck]);
  
  // Handle bookmark toggle
  const handleToggleBookmark = useCallback(async () => {
    if (!currentCard || isTempDeck) return;
    try {
      await toggleBookmark(currentCard.id);
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
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      
      rotate.value = interpolate(
        translateX.value,
        [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        [-10, 0, 10],
        Extrapolate.CLAMP
      );
      
      // Determine swipe direction
      if (translateX.value > SWIPE_THRESHOLD) {
        runOnJS(setSwipeDirection)('right');
      } else if (translateX.value < -SWIPE_THRESHOLD) {
        runOnJS(setSwipeDirection)('left');
      } else if (translateY.value < -SWIPE_THRESHOLD) {
        runOnJS(setSwipeDirection)('up');
      } else if (translateY.value > SWIPE_THRESHOLD) {
        runOnJS(setSwipeDirection)('down');
      } else {
        runOnJS(setSwipeDirection)(null);
      }
    })
    .onEnd(() => {
      const swipeOffConfig = { duration: 250 };

      if (translateX.value > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, swipeOffConfig, (finished) => {
          if (finished) runOnJS(handleRateCard)('easy');
        });
      } else if (translateX.value < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, swipeOffConfig, (finished) => {
          if (finished) runOnJS(handleRateCard)('good');
        });
      } else if (translateY.value < -SWIPE_THRESHOLD) {
        translateY.value = withTiming(-SCREEN_HEIGHT * 1.5, swipeOffConfig, (finished) => {
          if (finished) runOnJS(handleRateCard)('again');
        });
      } else if (translateY.value > SWIPE_THRESHOLD) {
        translateY.value = withTiming(SCREEN_HEIGHT * 1.5, swipeOffConfig, (finished) => {
          if (finished) runOnJS(handleRateCard)('hard');
        });
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotate.value = withTiming(0);
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
  }));
  
  // Check if string contains LaTeX
  const containsLatex = (text: string) => text.includes('$') || text.includes('\\');

  // Session complete state
  if (isSessionComplete) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.completionContainer}>
          <Text style={styles.celebrationEmoji}>🎯</Text>
          <Text style={styles.celebrationTitle}>Session Complete!</Text>
          <Text style={styles.celebrationSubtitle}>
            Great job! You're making progress.
          </Text>
          <TouchableOpacity style={styles.completionButton} onPress={handleExit}>
            <Text style={styles.completionButtonText}>Finish Session</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  if (!currentCard) return null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleExit}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isTempDeck ? "Quick Prep Session" : (decks.find(d => d.id === id)?.name || "Study")}
          </Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: isTempDeck 
                      ? `${(tempCurrentIndex / tempCards.length) * 100}%`
                      : `${(studyProgress?.cardsStudied || 0) / ((studyProgress?.cardsStudied || 0) + (studyProgress?.cardsLeft || 0)) * 100}%`
                  }
                ]} 
              />
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={handleExit}>
          <X size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      {/* Swipe hints */}
      <View style={styles.swipeHintContainer}>
        {swipeDirection === 'left' && <View style={[styles.swipePill, styles.goodPill]}><Text style={styles.swipePillText}>GOOD</Text></View>}
        {swipeDirection === 'right' && <View style={[styles.swipePill, styles.easyPill]}><Text style={styles.swipePillText}>EASY</Text></View>}
        {swipeDirection === 'up' && <View style={[styles.swipePill, styles.againPill]}><Text style={styles.swipePillText}>AGAIN</Text></View>}
        {swipeDirection === 'down' && <View style={[styles.swipePill, styles.hardPill]}><Text style={styles.swipePillText}>HARD</Text></View>}
      </View>
      
      {/* Card */}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.cardContainer, cardStyle]}>
          <TouchableOpacity 
            style={styles.cardContent}
            activeOpacity={1}
            onPress={() => setShowBack(!showBack)}
          >
            <View style={styles.cardInner}>
              <Text style={styles.cardSideLabel}>{showBack ? 'EXPLANATION' : 'QUESTION'}</Text>
              
              <ScrollView 
                contentContainerStyle={styles.cardScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.contentContainer}>
                  {containsLatex(showBack ? currentCard.back : currentCard.front) ? (
                    <WebViewLatexBlock latex={showBack ? currentCard.back : currentCard.front} />
                  ) : (
                    <Text style={styles.cardText}>{showBack ? currentCard.back : currentCard.front}</Text>
                  )}
                </View>
              </ScrollView>

              <View style={styles.cardFooter}>
                <View style={styles.flipHint}>
                  <RotateCw size={14} color="#94969a" />
                  <Text style={styles.flipHintText}>Tap to reveal {showBack ? 'question' : 'answer'}</Text>
                </View>
                {!isTempDeck && (
                  <TouchableOpacity onPress={handleToggleBookmark}>
                    <Bookmark 
                      size={24} 
                      color={currentCard.isBookmarked ? "#5e6ad2" : "#94969a"}
                      fill={currentCard.isBookmarked ? "#5e6ad2" : 'none'}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
      
      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendText}>← Good • → Easy • ↑ Again • ↓ Hard</Text>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, insets: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  progressContainer: {
    width: '100%',
    height: 4,
    backgroundColor: '#1A1A1A',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    flex: 1,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#5e6ad2',
    borderRadius: 2,
  },
  swipeHintContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipePill: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
  },
  swipePillText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  goodPill: { backgroundColor: 'rgba(139, 92, 246, 0.2)', borderColor: '#5e6ad2' },
  easyPill: { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10B981' },
  againPill: { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#EF4444' },
  hardPill: { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#F59E0B' },
  
  cardContainer: {
    flex: 1,
    marginHorizontal: 25,
    marginBottom: 30,
    borderRadius: 32,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#2D2D2D',
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
  },
  cardInner: {
    flex: 1,
    padding: 30,
  },
  cardSideLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#94969a',
    letterSpacing: 2,
    marginBottom: 30,
    textAlign: 'center',
  },
  cardScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  contentContainer: {
    alignItems: 'center',
  },
  cardText: {
    fontSize: 22,
    fontFamily: 'Outfit_600SemiBold',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 32,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#2D2D2D',
  },
  flipHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flipHintText: {
    fontSize: 12,
    color: '#94969a',
    fontFamily: 'Outfit_500Medium',
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
  completionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  celebrationEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  celebrationTitle: {
    fontSize: 28,
    fontFamily: 'Outfit_700Bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  celebrationSubtitle: {
    fontSize: 16,
    color: '#94969a',
    textAlign: 'center',
    marginBottom: 40,
  },
  completionButton: {
    backgroundColor: '#5e6ad2',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
  },
  completionButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  notFoundText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
  },
  backButton: {
    marginTop: 20,
    padding: 15,
  },
  backButtonText: {
    color: '#5e6ad2',
    fontFamily: 'Outfit_700Bold',
  }
});