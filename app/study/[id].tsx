import React, { useState, useEffect, useMemo, useCallback } from "react";
import { StyleSheet, View, TouchableOpacity, Image, ScrollView, Alert, Dimensions } from "react-native";
import { Text } from "@/components/AppText";;
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useFlashcardStore } from "@/store/flashcard-store";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { X, RotateCw, Clock, ArrowLeft, Maximize2, Bookmark } from "lucide-react-native";
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
import { extractLatex } from "@/utils/latex-renderer";
import WebViewLatexBlock from "../../components/WebViewLatexBlock";
import { DifficultyRating } from "@/types";

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
  const getCurrentCard = useFlashcardStore(state => state.getCurrentCard);
  const getNextCard = useFlashcardStore(state => state.getNextCard);
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
  
  // Image manipulation states
  const [isImageManipulationActive, setIsImageManipulationActive] = useState(false);
  
  // Animation values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const cardBorderColor = useSharedValue(colors.gray[200]);
  
  // Image manipulation values
  const imgScale = useSharedValue(1);
  const imgTranslateX = useSharedValue(0);
  const imgTranslateY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  
  // Memoize deck
  const deck = useMemo(() => decks.find(d => d.id === id), [decks, id]);
  
  // Get current card
  const currentCard = getCurrentCard();
  
  // Check if session is complete
  const isSessionComplete = !currentCard && studyProgress && studyProgress.cardsLeft === 0;

  // Sync progress when session finishes
  useEffect(() => {
    if (isSessionComplete) {
      syncSessionProgress();
    }
  }, [isSessionComplete]);
  
  // Timer for study session
  useEffect(() => {
    const timer = setInterval(() => {
      setStudyTime(prev => prev + 1);
    }, 60000); // Update every minute
    
    return () => clearInterval(timer);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const sessionDuration = Math.ceil((Date.now() - sessionStartTime) / 60000);
      const cardsStudied = studyProgress?.cardsStudied || 0;
      updateStudyStats(sessionDuration, cardsStudied);
      endStudySession();
    };
  }, []);
  
  // Reset card position when card changes
  useEffect(() => {
    if (currentCard) {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      rotate.value = withTiming(0);
      cardBorderColor.value = withTiming(colors.gray[200]);
      setShowBack(false);
      
      // Reset image zoom
      imgScale.value = 1;
      imgTranslateX.value = 0;
      imgTranslateY.value = 0;
    }
  }, [currentCard?.id]);

  // Handle rating a card
  const handleRateCard = useCallback(async (rating: DifficultyRating) => {
    if (!currentCard || isRating) return;

    setIsRating(true);
    
    // Haptic feedback
    if (rating === 'good' || rating === 'easy') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (rating === 'hard') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    try {
      await rateCard(currentCard.id, rating);
      getNextCard();
      setSwipeDirection(null);
    } catch (error) {
      console.error("Error rating card:", error);
    } finally {
      setIsRating(false);
    }
  }, [currentCard, isRating, rateCard, getNextCard]);
  
  // Handle bookmark toggle
  const handleToggleBookmark = useCallback(async () => {
    if (!currentCard) return;
    
    try {
      await toggleBookmark(currentCard.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      Alert.alert("Error", "Failed to update bookmark.");
    }
  }, [currentCard, toggleBookmark]);

  // Handle exit
  const handleExit = useCallback(() => {
    endStudySession();
    router.back();
  }, [endStudySession, router]);

  const handleRetake = useCallback(() => {
    if (!id) return;
    startStudySession(id, 'all');
  }, [id, startStudySession]);
  
  // Gesture handler for swipe
  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      if (isImageManipulationActive) return;
      
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
        cardBorderColor.value = colors.success;
        runOnJS(setSwipeDirection)('right');
      } else if (translateX.value < -SWIPE_THRESHOLD) {
        cardBorderColor.value = colors.primary;
        runOnJS(setSwipeDirection)('left');
      } else if (translateY.value < -SWIPE_THRESHOLD) {
        cardBorderColor.value = colors.error;
        runOnJS(setSwipeDirection)('up');
      } else if (translateY.value > SWIPE_THRESHOLD) {
        cardBorderColor.value = colors.warning;
        runOnJS(setSwipeDirection)('down');
      } else {
        cardBorderColor.value = colors.gray[200];
        runOnJS(setSwipeDirection)(null);
      }
    })
    .onEnd(() => {
      if (isImageManipulationActive) return;

      const swipeOffConfig = { duration: 200 };

      if (translateX.value > SWIPE_THRESHOLD) {
        // Swipe right - Easy
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, swipeOffConfig, (finished) => {
          if (finished) runOnJS(handleRateCard)('easy');
        });
      } else if (translateX.value < -SWIPE_THRESHOLD) {
        // Swipe left - Good
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, swipeOffConfig, (finished) => {
          if (finished) runOnJS(handleRateCard)('good');
        });
      } else if (translateY.value < -SWIPE_THRESHOLD) {
        // Swipe up - Again
        translateY.value = withTiming(-SCREEN_HEIGHT * 1.5, swipeOffConfig, (finished) => {
          if (finished) runOnJS(handleRateCard)('again');
        });
      } else if (translateY.value > SWIPE_THRESHOLD) {
        // Swipe down - Hard
        translateY.value = withTiming(SCREEN_HEIGHT * 1.5, swipeOffConfig, (finished) => {
          if (finished) runOnJS(handleRateCard)('hard');
        });
      } else {
        // Spring back
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotate.value = withTiming(0);
        cardBorderColor.value = colors.gray[200];
        runOnJS(setSwipeDirection)(null);
      }
    });
  
  // Image manipulation gestures
  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = imgScale.value;
      runOnJS(setIsImageManipulationActive)(true);
    })
    .onUpdate((event) => {
      imgScale.value = startScale.value * event.scale;
    })
    .onEnd(() => {
      if (imgScale.value < 0.5) {
        imgScale.value = withSpring(0.5);
      } else if (imgScale.value > 3) {
        imgScale.value = withSpring(3);
      }
      runOnJS(setIsImageManipulationActive)(false);
    });
  
  const panImageGesture = Gesture.Pan()
    .onBegin(() => {
      startX.value = imgTranslateX.value;
      startY.value = imgTranslateY.value;
      runOnJS(setIsImageManipulationActive)(true);
    })
    .onUpdate((event) => {
      imgTranslateX.value = startX.value + event.translationX;
      imgTranslateY.value = startY.value + event.translationY;
    })
    .onEnd(() => {
      const maxOffset = (imgScale.value - 1) * 100;
      if (imgTranslateX.value < -maxOffset) {
        imgTranslateX.value = withSpring(-maxOffset);
      } else if (imgTranslateX.value > maxOffset) {
        imgTranslateX.value = withSpring(maxOffset);
      }
      if (imgTranslateY.value < -maxOffset) {
        imgTranslateY.value = withSpring(-maxOffset);
      } else if (imgTranslateY.value > maxOffset) {
        imgTranslateY.value = withSpring(maxOffset);
      }
      runOnJS(setIsImageManipulationActive)(false);
    });
  
  const imageGestures = Gesture.Simultaneous(pinchGesture, panImageGesture);
  
  // Double tap to reset image
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      imgScale.value = withSpring(1);
      imgTranslateX.value = withSpring(0);
      imgTranslateY.value = withSpring(0);
    });
  
  // Animated styles
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` }
    ],
    borderColor: cardBorderColor.value,
  }));
  
  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: imgTranslateX.value },
      { translateY: imgTranslateY.value },
      { scale: imgScale.value }
    ],
  }));
  
  // Check if string contains LaTeX
  const { containsLatex } = require('@/utils/latex-renderer');

  // Not found state
  if (!deck) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundText}>Deck not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Session complete state
  if (isSessionComplete) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.completionContainer}>
          <Text style={styles.celebrationEmoji}>🎉</Text>
          <Text style={styles.celebrationTitle}>Session Complete!</Text>
          <Text style={styles.celebrationSubtitle}>
            You've reviewed all cards in this deck.
          </Text>
          <Text style={styles.celebrationStats}>
            {studyProgress?.cardsStudied || 0} cards studied
          </Text>
          <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
            <Text style={styles.retakeButtonText}>Retake All Cards</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.completionButton} onPress={handleExit}>
            <Text style={styles.completionButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  // No cards to study
  if (!currentCard) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>No cards to study</Text>
          <Text style={styles.notFoundSubtext}>All cards are up to date!</Text>
          <TouchableOpacity style={styles.backButton} onPress={handleExit}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ title: deck?.name || 'Study', headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleExit}>
          <ArrowLeft size={24} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{deck.name}</Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleExit}>
          <X size={24} color={colors.textDark} />
        </TouchableOpacity>
      </View>
      
      {/* Progress */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: studyProgress 
                  ? `${(studyProgress.cardsStudied / (studyProgress.cardsStudied + studyProgress.cardsLeft)) * 100}%`
                  : '0%'
              }
            ]} 
          />
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            {studyProgress?.cardsStudied || 0} / {studyProgress ? (studyProgress.cardsStudied + studyProgress.cardsLeft) : 0}
          </Text>
          <View style={styles.timeContainer}>
            <Clock size={16} color={colors.textLight} />
            <Text style={styles.timeText}>{studyTime} min</Text>
          </View>
        </View>
      </View>
      
      {/* Swipe hints (Moved to top) */}
      <View style={styles.swipeHintContainer}>
        {swipeDirection === 'left' && (
          <Text style={[styles.swipeHint, styles.goodHint]}>Good</Text>
        )}
        {swipeDirection === 'right' && (
          <Text style={[styles.swipeHint, styles.easyHint]}>Easy</Text>
        )}
        {swipeDirection === 'up' && (
          <Text style={[styles.swipeHint, styles.againHint]}>Again</Text>
        )}
        {swipeDirection === 'down' && (
          <Text style={[styles.swipeHint, styles.hardHint]}>Hard</Text>
        )}
        {!swipeDirection && (
          <Text style={styles.swipeInstructions}>
            ← Good • → Easy • ↑ Again • ↓ Hard
          </Text>
        )}
      </View>
      
      {/* Card */}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.cardContainer, cardStyle]}>
          <TouchableOpacity 
            style={styles.cardContent}
            activeOpacity={0.9}
            onPress={() => setShowBack(!showBack)}
          >
            <View style={styles.flipIconContainer}>
              <RotateCw size={20} color={colors.gray[500]} />
              <Text style={styles.flipText}>Tap to flip</Text>
            </View>
            
            <ScrollView 
              contentContainerStyle={styles.cardScrollContent}
              showsVerticalScrollIndicator={false}
              scrollEnabled={!isImageManipulationActive}
            >
              {!showBack ? (
                // Front of card
                <>
                  <Text style={styles.cardSideLabel}>FRONT</Text>
                  <View style={styles.contentContainer}>
                    {containsLatex(currentCard.front) ? (
                      <WebViewLatexBlock latex={currentCard.front} />
                    ) : (
                      <Text style={styles.cardText}>{currentCard.front}</Text>
                    )}
                  </View>
                  
                  {currentCard.mediaUrls && currentCard.mediaUrls.length > 0 && currentCard.mediaUrls[0] && (
                    <View style={styles.imageContainer}>
                      <GestureDetector gesture={Gesture.Simultaneous(imageGestures, doubleTapGesture)}>
                        <Animated.Image 
                          source={{ uri: currentCard.mediaUrls[0] }}
                          style={[styles.cardImage, imageStyle]}
                          resizeMode="contain"
                        />
                      </GestureDetector>
                      <Text style={styles.imageHint}>Pinch to zoom • Double tap to reset</Text>
                    </View>
                  )}
                </>
              ) : (
                // Back of card
                <>
                  <Text style={styles.cardSideLabel}>BACK</Text>
                  <View style={styles.contentContainer}>
                    {containsLatex(currentCard.back) ? (
                      <WebViewLatexBlock latex={currentCard.back} />
                    ) : (
                      <Text style={styles.cardText}>{currentCard.back}</Text>
                    )}
                  </View>
                  
                  {currentCard.mediaUrls && currentCard.mediaUrls.length > 1 && currentCard.mediaUrls[1] && (
                    <View style={styles.imageContainer}>
                      <GestureDetector gesture={Gesture.Simultaneous(imageGestures, doubleTapGesture)}>
                        <Animated.Image 
                          source={{ uri: currentCard.mediaUrls[1] }}
                          style={[styles.cardImage, imageStyle]}
                          resizeMode="contain"
                        />
                      </GestureDetector>
                      <Text style={styles.imageHint}>Pinch to zoom • Double tap to reset</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
            
            {/* Expand button */}
            <TouchableOpacity 
              style={styles.expandButton}
              onPress={() => router.push(`/study-card-detail/${currentCard.id}`)}
            >
              <Maximize2 size={22} color={colors.primary} />
            </TouchableOpacity>

            {/* Bookmark button */}
            <TouchableOpacity style={styles.bookmarkButton} onPress={handleToggleBookmark}>
              <Bookmark 
                size={22} 
                color={currentCard.isBookmarked ? colors.primary : colors.gray[400]} 
                fill={currentCard.isBookmarked ? colors.primary : 'none'} 
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
      
      {/* Card side indicator */}
      <View style={styles.paginationContainer}>
        <View style={styles.paginationDots}>
          <View style={[styles.paginationDot, !showBack && styles.activeDot]} />
          <View style={[styles.paginationDot, showBack && styles.activeDot]} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, insets: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.textDark,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.gray[200],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressText: {
    fontSize: 14,
    color: colors.textLight,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    marginLeft: 4,
    fontSize: 14,
    color: colors.textLight,
  },
  cardContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardContent: {
    flex: 1,
    padding: 20,
  },
  flipIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  flipText: {
    marginLeft: 6,
    fontSize: 14,
    color: colors.gray[500],
  },
  cardScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 60,
  },
  cardSideLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray[400],
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 1,
  },
  contentContainer: {
    alignItems: 'center',
  },
  cardText: {
    fontSize: 18,
    color: colors.textDark,
    textAlign: 'center',
    lineHeight: 28,
  },
  imageContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  cardImage: {
    width: SCREEN_WIDTH - 80,
    height: 200,
    borderRadius: 8,
  },
  imageHint: {
    marginTop: 8,
    fontSize: 12,
    color: colors.gray[400],
  },
  expandButton: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    padding: 8,
    backgroundColor: colors.gray[100],
    borderRadius: 8,
  },
  bookmarkButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    padding: 8,
    backgroundColor: colors.gray[100],
    borderRadius: 8,
  },
  swipeHintContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 54, // Fixed height to prevent layout jumps
    marginBottom: 8,
  },
  swipeHint: {
    fontSize: 18,
    fontWeight: 'bold',
    paddingVertical: 8,
    // paddingHorizontal: 24,
    borderRadius: 16,
    minWidth: 100,
    textAlign: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  goodHint: {
    backgroundColor: colors.primary,
    color: 'white',
  },
  easyHint: {
    backgroundColor: colors.success,
    color: 'white',
  },
  againHint: {
    backgroundColor: colors.error,
    color: 'white',
  },
  hardHint: {
    backgroundColor: colors.warning,
    color: 'white',
  },
  swipeInstructions: {
    fontSize: 14,
    color: colors.gray[500],
    textAlign: 'center',
  },
  paginationContainer: {
    alignItems: 'center',
    paddingBottom: (insets?.bottom || 16) + 20,
  },
  paginationDots: {
    flexDirection: 'row',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray[300],
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: colors.primary,
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  notFoundText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 8,
  },
  notFoundSubtext: {
    fontSize: 16,
    color: colors.textLight,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  completionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  celebrationEmoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  celebrationTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 8,
  },
  celebrationSubtitle: {
    fontSize: 16,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 16,
  },
  celebrationStats: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 32,
  },
  completionButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  completionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 18,
  },
  retakeButton: {
    backgroundColor: 'white',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  retakeButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});