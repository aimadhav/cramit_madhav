import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  Alert,
  Dimensions,
  Platform
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useFlashcardStore } from "@/store/flashcard-store";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, RotateCw, Clock, ArrowLeft, ArrowRight, Maximize2, Bookmark, Trash2 } from "lucide-react-native";
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

import colors from "@/constants/colors";
import { useUserStore } from "@/store/user-store";
import { extractLatex } from "@/utils/latex-renderer";
import WebViewLatexBlock from "../../components/WebViewLatexBlock";
import { DifficultyRating } from "@/types";

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

export default function StudySessionScreen() {
  const toggleBookmark = useFlashcardStore(state => state.toggleBookmark);
  const { id } = useLocalSearchParams<{ id: string }>();
  console.log('[StudySessionScreen] Component execution start. ID:', id, 'Initial isSessionFinished from useState.', 'Timestamp:', new Date().toISOString());
  const router = useRouter();

  // Subscribe to flashcards array to ensure re-render when a card's bookmark status changes
  useFlashcardStore(state => state.flashcards);
  
  const decks = useFlashcardStore(state => state.decks);
  const getCurrentCard = useFlashcardStore(state => state.getCurrentCard);
  const getNextCard = useFlashcardStore(state => state.getNextCard);
  const rateCard = useFlashcardStore(state => state.rateCard);
  const deleteFlashcard = useFlashcardStore(state => state.deleteFlashcard);
  const endStudySession = useFlashcardStore(state => state.endStudySession);
  const studyProgress = useFlashcardStore(state => state.studyProgress);
  const getDueFlashcardsForDeck = useFlashcardStore(state => state.getDueFlashcardsForDeck);
  const markSessionAsCompleted = useFlashcardStore(state => state.markSessionAsCompleted);
  const clearSessionJustCompleted = useFlashcardStore(state => state.clearSessionJustCompleted);
  const sessionJustCompletedDeckId = useFlashcardStore(state => state.sessionJustCompletedDeckId);
  const pendingOperations = useFlashcardStore(state => state.pendingOperations);
  
  const updateStudyStats = useUserStore(state => state.updateStudyStats);
  
  const [showBack, setShowBack] = useState(false);
  const [studyTime, setStudyTime] = useState(0);
  const [sessionStartTime] = useState(Date.now());
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0);
  const [isSessionFinished, setIsSessionFinished] = useState(false);
  
  // Image manipulation states
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isImageManipulationActive, setIsImageManipulationActive] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  
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
  
  const currentCard = getCurrentCard();
  const dueCards = getDueFlashcardsForDeck(id);
  const studyProgressFromStore = useFlashcardStore(state => state.studyProgress);
  
  // Ref to keep track of the latest studyProgress for cleanup
  const studyProgressRef = useRef(studyProgressFromStore);
  useEffect(() => {
    studyProgressRef.current = studyProgressFromStore;
  }, [studyProgressFromStore]);
  
  // Define handleNoCardsLeft before its usage
  const handleNoCardsLeft = useCallback(() => {
    console.log('[StudySessionScreen] handleNoCardsLeft: All cards session complete or deck empty.');
    // The primary UI for "No cards left" is handled by the conditional JSX.
    // This function will ensure the study session state in the store is cleaned up.
    // It will NOT navigate back here, allowing the JSX to show the message and "Go Back" button.
  }, []);
  
  // Check if there are any pending operations for the current card
  const isPending = useMemo(() => {
    if (!currentCard) return false;
    return Object.entries(pendingOperations).some(([key, op]) => {
      if (op.type === 'add' && key === currentCard.id) return true;
      if (op.type === 'update' && key === currentCard.id) return true;
      if (op.type === 'delete' && key === currentCard.id) return true;
      return false;
    });
  }, [currentCard, pendingOperations]);
  
  // Memoize screenOptions
  const screenOptions = useMemo(() => ({
    title: deck?.name || 'Study',
    headerShown: false,
    headerRight: () => (
      <TouchableOpacity 
        style={styles.closeButton}
        onPress={() => {
          clearSessionJustCompleted();
          endStudySession();
          router.back();
        }}
      >
        <X size={24} color={colors.textDark} />
      </TouchableOpacity>
    ),
  }), [deck, endStudySession, router, clearSessionJustCompleted]);
  
  // useEffect for handling "No Cards Left" and logging problematic states
  useEffect(() => {
    if (!isDeleting) {
      if (!currentCard && 
          (!studyProgressFromStore || studyProgressFromStore.cardsLeft === 0) && 
          dueCards.length === 0) {
        
        console.log('[StudySessionScreen] handleNoCardsLeft triggered. Details:', {
          deckId: id,
          currentCardFromStore: currentCard,
          studyProgressAtTrigger: studyProgressFromStore,
          dueCardsFromStoreLength: dueCards.length,
          dueCardsFromStoreContent: JSON.stringify(dueCards.map(c => c.id)),
          isDeletingState: isDeleting,
          forceRefreshCount: forceRefresh, 
          timestamp: new Date().toISOString(),
        });
        
        // Use requestAnimationFrame to defer the call
        requestAnimationFrame(() => {
          handleNoCardsLeft();
        });
      } else if (!currentCard && studyProgressFromStore && studyProgressFromStore.cardsLeft > 0 && dueCards.length > 0) {
        console.warn('[StudySessionScreen] State: No current card object, but store progress/dueCards indicate cards should be available. Details:', {
          deckId: id,
          currentCardFromStore: currentCard,
          studyProgressAtTrigger: studyProgressFromStore,
          dueCardsFromStoreLength: dueCards.length,
          dueCardsFromStoreContent: JSON.stringify(dueCards.map(c => c.id)),
          isDeletingState: isDeleting,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }, [id, isDeleting, dueCards, currentCard, studyProgressFromStore, handleNoCardsLeft, forceRefresh]);
  
  // This useEffect handles new session initialization regarding isSessionFinished
  useEffect(() => {
    console.log('[StudySessionScreen] Deck ID effect running. Current ID:', id, 'sessionJustCompletedDeckId from store:', sessionJustCompletedDeckId);
    if (sessionJustCompletedDeckId === id) {
      console.log('[StudySessionScreen] Deck ID effect: This deck was just completed. Setting isSessionFinished to true.');
      setIsSessionFinished(true);
      // Trigger celebration
      setTimeout(() => {
        setShowCelebration(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 500);
    } else {
      console.log('[StudySessionScreen] Deck ID effect: New/different session or no session just completed. Setting isSessionFinished to false.');
      setIsSessionFinished(false);
      setShowCelebration(false);
    }
  }, [id, sessionJustCompletedDeckId]);

  // Separate useEffect to handle clearing session completed state
  useEffect(() => {
    if (sessionJustCompletedDeckId && sessionJustCompletedDeckId !== id) {
      // Defer this store update to avoid updates during render
      const timeoutId = setTimeout(() => {
        clearSessionJustCompleted();
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [id, sessionJustCompletedDeckId, clearSessionJustCompleted]);
  
  // Timer for study session
  useEffect(() => {
    const timer = setInterval(() => {
      setStudyTime(prev => prev + 1);
    }, 60000); // Update every minute
    
    return () => clearInterval(timer);
  }, []);
  
  // End session when navigating away
  useEffect(() => {
    return () => {
      // Use the ref to get the latest studyProgress at the time of unmount
      const currentStudyProgress = studyProgressRef.current;
      const sessionDuration = Math.ceil((Date.now() - sessionStartTime) / 60000);
      const cardsStudied = currentStudyProgress?.cardsStudied || 0;
      
      requestAnimationFrame(() => {
      updateStudyStats(sessionDuration, cardsStudied);
      endStudySession();
      });
    };
    // Dependencies should be stable functions/values that don't change often
    // sessionStartTime is stable. updateStudyStats and endStudySession are store actions (should be stable).
  }, [sessionStartTime, updateStudyStats, endStudySession]); 

  // Log current card's bookmark status when it changes
  useEffect(() => {
    if (currentCard) {
      console.log(`[StudySessionScreen] Watched currentCard ID: ${currentCard.id}, isBookmarked: ${currentCard.isBookmarked}`);
    } else {
      console.log('[StudySessionScreen] Watched currentCard is null');
    }
  }, [currentCard?.isBookmarked, currentCard?.id]);
  
  // Reset image zoom/pan state when card changes
  useEffect(() => {
    if (!currentCard) { // Added this guard
      // If there's no current card, ensure image manipulation is reset/inactive
      setIsImageManipulationActive(false);
      setImageScale(1);
      setImagePosition({ x: 0, y: 0 });
      imgScale.value = 1;
      imgTranslateX.value = 0;
      imgTranslateY.value = 0;
      return;
    }
    // If there is a current card, reset these for the new card
    setIsImageManipulationActive(false);
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
    imgScale.value = 1;
    imgTranslateX.value = 0;
    imgTranslateY.value = 0;
  }, [currentCard?.id, imgScale, imgTranslateX, imgTranslateY]); // Added img animated values to dep array
  
  useEffect(() => {
    // This effect runs when currentCard (specifically its id) changes,
    // or when the component mounts with an initial card.
    if (currentCard) { 
        console.log(`[StudySessionScreen] New card detected (ID: ${currentCard.id}), resetting card position and style.`);
        translateX.value = withSpring(0); 
        translateY.value = withSpring(0);
        rotate.value = withTiming(0); // Rotation usually better withTiming for a direct reset
        cardBorderColor.value = withTiming(colors.gray[200]); // Reset border color for new card
    }
    // Ensure the front of the card is shown when a new card loads
    setShowBack(false); 
  }, [currentCard?.id]); // Key dependency
  
  const handleRateCard = useCallback(async (rating: DifficultyRating) => {
    if (!currentCard || isRating || isPending) return;

    setIsRating(true);
    const cardIdToRate = currentCard.id; // Capture ID before potential optimistic changes

    // Add haptic feedback based on rating
    if (rating === 'good' || rating === 'easy') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (rating === 'hard') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else { // 'again'
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    // Initiate store action but don't await here for UI speed.
    // Handle promise for error logging/potential non-blocking UI feedback.
    rateCard(cardIdToRate, rating)
      .catch((error) => {
        console.error("Error in handleRateCard (background sync):", error);
        // Optionally: Show a non-blocking toast message here if sync fails
        // Alert.alert("Sync Error", "Failed to sync rating with server.");
      });

    // Optimistically get the next card immediately
    const nextCard = getNextCard(); 
    
    setShowBack(false); // Reset flip state for the new card (if any)
    setSwipeDirection(null); // Reset swipe direction hint
    // Note: setIsRating(false) will be called in the finally block if we re-introduce it,
    // or can be called here if we are sure the critical path is done.
    // For now, let's ensure it's reset.
    setIsRating(false);
  }, [currentCard, isRating, isPending, rateCard, getNextCard, setShowBack, setSwipeDirection]);
  
  const handleDeleteCard = useCallback(async () => {
    // Always call setIsDeleting at the start to maintain hook order
    setIsDeleting(true);

    // Early return if conditions are not met
    if (!currentCard || isPending) {
      setIsDeleting(false);
      return;
    }

    // Store card ID before any async operations
    const cardIdToDelete = currentCard.id;

    // Reset UI states first
    setShowBack(false);

    // Delete immediately without confirmation
    try {
      await deleteFlashcard(cardIdToDelete);
      // Get next card after successful deletion
      getNextCard();
      // Add haptic feedback for successful deletion
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error("Error in handleDeleteCard:", error);
      Alert.alert(
        "Error",
        "Failed to delete card. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsDeleting(false);
    }
  }, [currentCard, isPending, deleteFlashcard, getNextCard, setShowBack, setIsDeleting]);
  
  const handleToggleBookmark = useCallback(async () => {
    if (!currentCard || isBookmarking || isPending) return;

    try {
      setIsBookmarking(true);
      await toggleBookmark(currentCard.id);
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to update bookmark. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsBookmarking(false);
    }
  }, [currentCard, isBookmarking, isPending, toggleBookmark, setIsBookmarking]);
  
  // Gesture handler for swipe
  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      // Don't handle card swipe if image manipulation is active
      if (isImageManipulationActive) return;
      
      // Update position
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      
      // Calculate rotation based on horizontal movement
      rotate.value = interpolate(
        translateX.value,
        [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        [-10, 0, 10],
        Extrapolate.CLAMP
      );
      
      // Determine swipe direction and update border color
      if (translateX.value > SWIPE_THRESHOLD) {
        // Swiping right (easy)
        cardBorderColor.value = colors.success;
        runOnJS(setSwipeDirection)('right');
      } else if (translateX.value < -SWIPE_THRESHOLD) {
        // Swiping left (good)
        cardBorderColor.value = colors.primary;
        runOnJS(setSwipeDirection)('left');
      } else if (translateY.value < -SWIPE_THRESHOLD) {
        // Swiping up (again/failure)
        cardBorderColor.value = colors.error;
        runOnJS(setSwipeDirection)('up');
      } else if (translateY.value > SWIPE_THRESHOLD) {
        // Swiping down (delete)
        cardBorderColor.value = colors.gray[600];
        runOnJS(setSwipeDirection)('down');
      } else {
        cardBorderColor.value = colors.gray[200];
        runOnJS(setSwipeDirection)(null);
      }
    })
    .onEnd((event) => {
      if (isImageManipulationActive) return;

      const swipeOffAnimationConfig = { duration: 200 }; // Animation for swiping card off-screen

      if (translateX.value > SWIPE_THRESHOLD) {
        // Swipe right - Easy
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, swipeOffAnimationConfig, (finished) => {
          if (finished) {
            runOnJS(handleRateCard)('easy');
          }
        });
      } else if (translateX.value < -SWIPE_THRESHOLD) {
        // Swipe left - Good (normal correct)
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, swipeOffAnimationConfig, (finished) => {
          if (finished) {
            runOnJS(handleRateCard)('good');
          }
        });
      } else if (translateY.value < -SWIPE_THRESHOLD && swipeDirection === 'up') {
        // Swipe up - Again (failure)
        translateY.value = withTiming(-SCREEN_HEIGHT * 1.5, swipeOffAnimationConfig, (finished) => {
          if (finished) {
            runOnJS(handleRateCard)('again');
          }
        });
      } else if (translateY.value > SWIPE_THRESHOLD && swipeDirection === 'down') {
        // Swipe down - Delete
        translateY.value = withTiming(SCREEN_HEIGHT * 1.5, swipeOffAnimationConfig, (finished) => {
          if (finished) {
            runOnJS(handleDeleteCard)();
          }
        });
      } else {
        // Not swiped far enough, or wrong direction for delete: spring back to center
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotate.value = withTiming(0);
        cardBorderColor.value = colors.gray[200]; // Reset border color
        runOnJS(setSwipeDirection)(null);       // Reset swipe direction hint
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
      runOnJS(setImageScale)(startScale.value * event.scale);
    })
    .onEnd(() => {
      // Limit min/max scale
      if (imgScale.value < 0.5) {
        imgScale.value = withSpring(0.5);
        runOnJS(setImageScale)(0.5);
      } else if (imgScale.value > 3) {
        imgScale.value = withSpring(3);
        runOnJS(setImageScale)(3);
      }
      
      runOnJS(setIsImageManipulationActive)(false);
    });
  
  const panGesture = Gesture.Pan()
    .onBegin(() => {
      startX.value = imgTranslateX.value;
      startY.value = imgTranslateY.value;
      runOnJS(setIsImageManipulationActive)(true);
    })
    .onUpdate((event) => {
      imgTranslateX.value = startX.value + event.translationX;
      imgTranslateY.value = startY.value + event.translationY;
      runOnJS(setImagePosition)({ 
        x: startX.value + event.translationX, 
        y: startY.value + event.translationY 
      });
    })
    .onEnd(() => {
      // Limit movement based on scale
      const maxOffset = (imgScale.value - 1) * 100;
      if (imgTranslateX.value < -maxOffset) {
        imgTranslateX.value = withSpring(-maxOffset);
        runOnJS(setImagePosition)(prev => ({ ...prev, x: -maxOffset }));
      } else if (imgTranslateX.value > maxOffset) {
        imgTranslateX.value = withSpring(maxOffset);
        runOnJS(setImagePosition)(prev => ({ ...prev, x: maxOffset }));
      }
      
      if (imgTranslateY.value < -maxOffset) {
        imgTranslateY.value = withSpring(-maxOffset);
        runOnJS(setImagePosition)(prev => ({ ...prev, y: -maxOffset }));
      } else if (imgTranslateY.value > maxOffset) {
        imgTranslateY.value = withSpring(maxOffset);
        runOnJS(setImagePosition)(prev => ({ ...prev, y: maxOffset }));
      }
      
      runOnJS(setIsImageManipulationActive)(false);
    });
  
  const imageGestures = Gesture.Simultaneous(pinchGesture, panGesture);
  
  // Double tap to reset image
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      imgScale.value = withSpring(1);
      imgTranslateX.value = withSpring(0);
      imgTranslateY.value = withSpring(0);
      runOnJS(setImageScale)(1);
      runOnJS(setImagePosition)({ x: 0, y: 0 });
    });
  
  // Animated styles
  const cardStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate.value}deg` }
      ],
      borderColor: cardBorderColor.value
    };
  });
  
  const imageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: imgTranslateX.value },
        { translateY: imgTranslateY.value },
        { scale: imgScale.value }
      ]
    };
  });
  
  // Parse content for LaTeX if we have a card
  const frontContent = currentCard ? extractLatex(currentCard.front) : [];
  const backContent = currentCard ? extractLatex(currentCard.back) : [];
  
  console.log('[StudySessionScreen] Rendering UI. currentCard:', currentCard ? `ID: ${currentCard.id}` : 'null', 'isDeleting:', isDeleting, 'Timestamp:', new Date().toISOString());

  if (!deck) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundText}>Deck not found</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen 
        options={screenOptions} 
      />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            clearSessionJustCompleted();
            endStudySession();
            router.back();
          }}
        >
          <ArrowLeft size={24} color={colors.textDark} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>{deck.name}</Text>
        
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => {
            clearSessionJustCompleted();
            endStudySession();
            router.back();
          }}
        >
          <X size={24} color={colors.textDark} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${studyProgress ? (studyProgress.cardsStudied / (studyProgress.cardsStudied + studyProgress.cardsLeft)) * 100 : 0}%` 
              }
            ]} 
          />
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            {studyProgress ? studyProgress.cardsStudied : 0} / {studyProgress ? (studyProgress.cardsStudied + studyProgress.cardsLeft) : 0}
          </Text>
          <View style={styles.timeContainer}>
            <Clock size={16} color={colors.textLight} />
            <Text style={styles.timeText}>{studyTime} min</Text>
          </View>
        </View>
      </View>
      
      {(() => {
        const isCurrentCardNull = currentCard === null;
        const isNotDeleting = isDeleting === false;
        console.log('[StudySessionScreen] Evaluating conditional render for card area. isCurrentCardNull:', isCurrentCardNull, 'isNotDeleting:', isNotDeleting, 'Timestamp:', new Date().toISOString());
        if (isCurrentCardNull && isNotDeleting) {
          console.log('[StudySessionScreen] Will attempt to render NOT FOUND/NO CARDS UI.');
        } else {
          console.log('[StudySessionScreen] Will attempt to render CARD DISPLAY UI.');
        }
        return null; // This console.log structure doesn't render anything itself
      })()}

      {(() => {
        console.log('[StudySessionScreen] Checking render conditions. isSessionFinished:', isSessionFinished, 'currentCard:', currentCard ? currentCard.id : 'null', 'isDeleting:', isDeleting, 'Timestamp:', new Date().toISOString());
        return null;
      })()}

      {(isSessionFinished || !currentCard) && !isDeleting ? (
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>No cards due for review</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              clearSessionJustCompleted();
              router.back();
            }}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.cardContainer, cardStyle]}>
              <TouchableOpacity 
                style={styles.cardContent}
                activeOpacity={0.9}
              >
                <View style={styles.flipIconContainer}>
                  <RotateCw size={20} color={colors.gray[500]} />
                  <Text style={styles.flipText}>Tap to flip</Text>
                </View>
                
                <TouchableOpacity
                  style={{ flex: 1 }} // Make the scrollable area tappable
                  activeOpacity={0.9}
                  onPress={() => setShowBack(!showBack)}
                >
                  <ScrollView 
                    contentContainerStyle={styles.cardScrollContent}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={!isImageManipulationActive} // Prevent ScrollView from capturing tap if image manipulation is active
                  >
                    {!showBack ? (
                      // Front of card
                      <>
                        <Text style={styles.cardSideLabel}>FRONT</Text>
                        <View style={styles.contentContainer}>
                          {frontContent.map((part, index) => (
                            part.type === 'latex' ? (
                              <WebViewLatexBlock key={index} latex={part.content} />
                            ) : (
                              <Text key={index} style={styles.cardText}>{part.content}</Text>
                            )
                          ))}
                        </View>
                        
                        {currentCard && currentCard.mediaUrls && currentCard.mediaUrls.length > 0 && currentCard.mediaUrls[0] && (
                          <View style={styles.imageContainer}>
                            <GestureDetector gesture={Gesture.Simultaneous(imageGestures, doubleTapGesture)}>
                              <Animated.Image 
                                source={{ uri: currentCard.mediaUrls[0] }}
                                style={[styles.cardImage, imageStyle]}
                                resizeMode="contain"
                              />
                            </GestureDetector>
                            <Text style={styles.imageHint}>Pinch to zoom • Drag to move • Double tap to reset</Text>
                          </View>
                        )}
                      </>
                    ) : (
                      // Back of card
                      <>
                        <Text style={styles.cardSideLabel}>BACK</Text>
                        <View style={styles.contentContainer}>
                          {backContent.map((part, index) => (
                            part.type === 'latex' ? (
                              <WebViewLatexBlock key={index} latex={part.content} />
                            ) : (
                              <Text key={index} style={styles.cardText}>{part.content}</Text>
                            )
                          ))}
                        </View>
                        
                        {currentCard && currentCard.mediaUrls && currentCard.mediaUrls.length > 1 && currentCard.mediaUrls[1] && (
                          <View style={styles.imageContainer}>
                            <GestureDetector gesture={Gesture.Simultaneous(imageGestures, doubleTapGesture)}>
                              <Animated.Image 
                                source={{ uri: currentCard.mediaUrls[1] }}
                                style={[styles.cardImage, imageStyle]}
                                resizeMode="contain"
                              />
                            </GestureDetector>
                            <Text style={styles.imageHint}>Pinch to zoom • Drag to move • Double tap to reset</Text>
                          </View>
                        )}
                      </>
                    )}
                  </ScrollView>
                </TouchableOpacity>
                
                {/* Expand icon to view details */}
                <TouchableOpacity 
                  style={styles.expandButton}
                  onPress={() => {
                    if (currentCard) {
                      router.push(`/study-card-detail/${currentCard.id}`);
                    }
                  }}
                >
                  <Maximize2 size={22} color={colors.primary} />
                </TouchableOpacity>

                {/* Bookmark icon (placeholder) */}
                <TouchableOpacity 
                  style={styles.bookmarkButton}
                  onPress={handleToggleBookmark}
                >
                  <Bookmark size={22} color={currentCard?.isBookmarked ? colors.primary : colors.gray[400]} fill={currentCard?.isBookmarked ? colors.primary : 'none'} />
                </TouchableOpacity>
              </TouchableOpacity>
            </Animated.View>
          </GestureDetector>
          
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
              <Text style={[styles.swipeHint, styles.deleteHint]}>Delete</Text>
            )}
            {!swipeDirection && (
              <Text style={[styles.swipeInstructions, { textAlign: 'center' }]}>
                ← Good • → Easy • ↑ Again • ↓ Delete
              </Text>
            )}
          </View>
          
          <View style={styles.paginationContainer}>
            <View style={styles.paginationDots}>
              <View style={[styles.paginationDot, !showBack && styles.activeDot]} />
              <View style={[styles.paginationDot, showBack && styles.activeDot]} />
            </View>
          </View>
        </> 
      )}
      
      {/* Celebration Modal */}
      {showCelebration && (
        <View style={styles.celebrationOverlay}>
          <Animated.View style={[styles.celebrationModal, {
            transform: [{ scale: showCelebration ? 1 : 0 }]
          }]}>
            <Text style={styles.celebrationEmoji}>🎉</Text>
            <Text style={styles.celebrationTitle}>Fantastic!</Text>
            <Text style={styles.celebrationSubtitle}>
              You've completed your study session!
            </Text>
            <Text style={styles.celebrationStats}>
              {studyProgress?.cardsStudied || 0} cards studied
            </Text>
            <TouchableOpacity 
              style={styles.celebrationButton}
              onPress={() => {
                setShowCelebration(false);
                clearSessionJustCompleted();
                endStudySession();
                router.back();
              }}
            >
              <Text style={styles.celebrationButtonText}>Awesome! 🚀</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  backButton: {
    padding: 8,
  },
  closeButton: {
    padding: 8,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  notFoundText: {
    fontSize: 18,
    color: colors.textDark,
    marginBottom: 16,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  progressText: {
    fontSize: 14,
    color: colors.textLight,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeText: {
    fontSize: 14,
    color: colors.textLight,
    marginLeft: 4,
  },
  cardContainer: {
    height: SCREEN_HEIGHT * 0.75,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 10,
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray[200],
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    flex: 1,
    padding: 20,
  },
  flipIconContainer: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  flipText: {
    fontSize: 12,
    color: colors.gray[500],
    marginLeft: 4,
  },
  cardScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  cardSideLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.textLight,
    marginBottom: 16,
    alignSelf: "center",
  },
  contentContainer: {
    alignItems: "center",
  },
  cardText: {
    fontSize: 22,
    color: colors.textDark,
    textAlign: "center",
    lineHeight: 32,
  },
  latexText: {
    fontSize: 20,
    color: colors.textDark,
    fontFamily: "monospace",
    textAlign: "center",
    marginVertical: 8,
  },
  imageContainer: {
    width: "100%",
    marginTop: 20,
    alignItems: "center",
  },
  cardImage: {
    width: 250,
    height: 150,
    borderRadius: 8,
  },
  imageHint: {
    fontSize: 10,
    color: colors.textLight,
    marginTop: 8,
    textAlign: "center",
  },
  swipeHintContainer: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 32,
    height: 48,
  },
  swipeHint: {
    fontSize: 18,
    fontWeight: "bold",
  },
  goodHint: {
    color: colors.primary,
  },
  easyHint: {
    color: colors.success,
  },
  againHint: {
    color: colors.error,
  },
  deleteHint: {
    color: colors.gray[600],
  },
  swipeInstructions: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
  },
  paginationContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  paginationDots: {
    flexDirection: "row",
    justifyContent: "center",
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
    width: 24,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: "500",
  },
  expandButton: {
    position: 'absolute',
    top: 12,
    left: 12, 
    padding: 6,
    zIndex: 20,
  },
  bookmarkButton: {
    position: 'absolute',
    top: 12,
    left: 46, // Positioned to the right of the expand icon (12 + 22 + 6 + 6)
    padding: 6,
    zIndex: 20,
  },
  disabledButton: {
    opacity: 0.5,
  },
  celebrationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  celebrationModal: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    maxWidth: '80%',
  },
  celebrationEmoji: {
    fontSize: 60,
    marginBottom: 20,
  },
  celebrationTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  celebrationSubtitle: {
    fontSize: 18,
    color: colors.textDark,
    marginBottom: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
  celebrationStats: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 25,
    textAlign: 'center',
  },
  celebrationButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  celebrationButtonText: {
    color: colors.background,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});