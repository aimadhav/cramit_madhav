import React, { useState, useEffect, useMemo, useRef } from "react";
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
import { X, RotateCw, Clock, ArrowLeft, ArrowRight, Maximize2, Bookmark } from "lucide-react-native";
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
  
  const updateStudyStats = useUserStore(state => state.updateStudyStats);
  
  const [showBack, setShowBack] = useState(false);
  const [studyTime, setStudyTime] = useState(0);
  const [sessionStartTime] = useState(Date.now());
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0);
  const [isSessionFinished, setIsSessionFinished] = useState(false);
  
  // Image manipulation states
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isImageManipulationActive, setIsImageManipulationActive] = useState(false);
  
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
  }), [deck, endStudySession, router]);
  
  // useEffect for handling "No Cards Left" and logging problematic states
  useEffect(() => {
    // Reset session finished state if deck ID changes (new session)
    runOnJS(setIsSessionFinished)(false);

    if (!isDeleting) {
      // Condition 1: getCurrentCard() returned null (session queue might be exhausted or no session active)
      // AND the store's studyProgress itself is null or indicates completion (cardsLeft is 0).
      // AND there are genuinely no more due cards for this deck right now.
      if (!currentCard && 
          (!studyProgressFromStore || studyProgressFromStore.cardsLeft === 0) && 
          dueCards.length === 0) {
        
        console.log('[StudySessionScreen] handleNoCardsLeft triggered. Details:', {
          deckId: id,
          currentCardFromStore: currentCard, // Expected to be null
          studyProgressAtTrigger: studyProgressFromStore, // Log what the store thinks about progress
          dueCardsFromStoreLength: dueCards.length, // Expected to be 0
          dueCardsFromStoreContent: JSON.stringify(dueCards.map(c => c.id)),
          isDeletingState: isDeleting,
          forceRefreshCount: forceRefresh, 
          timestamp: new Date().toISOString(),
        });
        handleNoCardsLeft();
      } else if (!currentCard && studyProgressFromStore && studyProgressFromStore.cardsLeft > 0 && dueCards.length > 0) {
        // This state is unusual: No current card object, but studyProgress claims cards are left, and dueCards exist.
        // This could happen if the card queue in the store got desynced or a card ID was bad.
        console.warn('[StudySessionScreen] State: No current card object, but store progress/dueCards indicate cards should be available. Details:', {
          deckId: id,
          currentCardFromStore: currentCard, // Expected to be null
          studyProgressAtTrigger: studyProgressFromStore,
          dueCardsFromStoreLength: dueCards.length,
          dueCardsFromStoreContent: JSON.stringify(dueCards.map(c => c.id)),
          isDeletingState: isDeleting,
          timestamp: new Date().toISOString(),
        });
         // Potentially force a session restart or a more graceful recovery if this state is hit.
         // For now, just logging. Could also try to re-initiate study session after a delay.
      }
    }
  }, [id, isDeleting, dueCards, currentCard, studyProgressFromStore]);
  
  // This useEffect handles new session initialization regarding isSessionFinished
  useEffect(() => {
    console.log('[StudySessionScreen] Deck ID effect running. Current ID:', id, 'sessionJustCompletedDeckId from store:', sessionJustCompletedDeckId);
    if (sessionJustCompletedDeckId === id) {
      console.log('[StudySessionScreen] Deck ID effect: This deck was just completed. Setting isSessionFinished to true.');
      setIsSessionFinished(true);
    } else {
      console.log('[StudySessionScreen] Deck ID effect: New/different session or no session just completed. Setting isSessionFinished to false.');
      setIsSessionFinished(false);
      // If the stored completed ID is for a *different* deck, clear it.
      // If it was for *this* deck, it's already handled by setting isSessionFinished to true.
      // If it was null, this does nothing.
      if (sessionJustCompletedDeckId && sessionJustCompletedDeckId !== id) {
        clearSessionJustCompleted();
      }
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
      const sessionDuration = Math.ceil((Date.now() - sessionStartTime) / 60000);
      const cardsStudied = studyProgress?.cardsStudied || 0;
      
      updateStudyStats(sessionDuration, cardsStudied);
      endStudySession();
    };
  }, []);

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
  
  const handleNoCardsLeft = () => {
    console.log('[StudySessionScreen] handleNoCardsLeft: All cards session complete or deck empty.');
    // The primary UI for "No cards left" is handled by the conditional JSX.
    // This function will ensure the study session state in the store is cleaned up.
    // It will NOT navigate back here, allowing the JSX to show the message and "Go Back" button.
    
    // endStudySession(); // We might still want to call this to clear studyProgress in the store.
                     // However, if currentCard is null, the UI is already in the "empty" state.
                     // Let's evaluate if this is strictly needed or if the natural end of session (no current card) is enough.
                     // For now, let's rely on the UI's back button to trigger router.back(), 
                     // and the main component's unmount effect to call endStudySession.

    // Alert.alert(
    //   "No Cards Left",
    //   "You've completed all cards in this deck!",
    //   [
    //     {
    //       text: "OK",
    //       onPress: () => {
    //         // endStudySession(); // Already called or will be called on unmount
    //         // router.back(); // Let the UI button handle this
    //       }
    //     }
    //   ]
    // );
  };
  
  const handleRateCard = (rating: DifficultyRating) => {
    if (!currentCard) {
      console.warn("[StudySessionScreen] handleRateCard called with no currentCard. This shouldn't happen.");
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const cardIdToRate = currentCard.id;
    
    // Action 1: Rate the card in the store
    rateCard(cardIdToRate, rating);
    
    // Action 2: Tell the store to advance its internal pointer/progress & get what it thinks is next.
    const nextCardFromStoreAfterUpdate = getNextCard();

    // Reset UI elements that are independent of card content
    setShowBack(false);
    setSwipeDirection(null);
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
    imgScale.value = 1;
    imgTranslateX.value = 0;
    imgTranslateY.value = 0;
    
    // Action 3: Force a re-render of this component.
    // In the next render, the main `currentCard` const will be updated via `getCurrentCard()`,
    // and the useEffect will evaluate the end-of-session condition.

    // Conditional reset of animated values:
    if (nextCardFromStoreAfterUpdate) {
      // If the store says there IS a next card, reset the swiped card's container to the center 
      // so the new card appears correctly.
      translateX.value = withSpring(0, { damping: 20, stiffness: 90 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 90 });
      rotate.value = withTiming(0);
      cardBorderColor.value = colors.gray[200];
    } else {
      // If the store says there is NO next card (session queue ended),
      // then *do not* reset the translateX/Y. The card that was just swiped off should stay off.
      // The re-render (due to forceRefresh) will result in the card container being hidden by JSX logic.
      console.log('[StudySessionScreen] Last card in session swiped. Position not reset. UI will update to hide card area.');
      // We might still want to reset rotation and border for visual consistency if it were to briefly appear.
      rotate.value = withTiming(0); // Keep rotation reset
      cardBorderColor.value = colors.gray[200]; // Keep border reset
    }
    
    if (!nextCardFromStoreAfterUpdate) {
      setIsSessionFinished(true);
      markSessionAsCompleted(id);
    }
  };
  
  const handleDeleteCard = () => {
    if (!currentCard) return;
    
    Alert.alert(
      "Delete Card",
      "Are you sure you want to delete this card? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          onPress: () => {
            setIsDeleting(true);
            const cardId = currentCard.id;
            deleteFlashcard(cardId);
            
            setShowBack(false);
            translateX.value = 0;
            translateY.value = 0;
            rotate.value = 0;
            setSwipeDirection(null);
            
            setImageScale(1);
            setImagePosition({ x: 0, y: 0 });
            imgScale.value = 1;
            imgTranslateX.value = 0;
            imgTranslateY.value = 0;
            
            setTimeout(() => {
              setForceRefresh(prev => prev + 1);
              
              const remainingDueCards = getDueFlashcardsForDeck(id);
              if (remainingDueCards.length === 0) {
                Alert.alert(
                  "No Cards Left",
                  "You've completed all cards in this deck.",
                  [
                    {
                      text: "OK",
                      onPress: () => router.back()
                    }
                  ]
                );
              }
              
              setIsDeleting(false);
            }, 100);
          },
          style: "destructive"
        }
      ]
    );
  };
  
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
        // Swiping left (hard)
        cardBorderColor.value = colors.warning;
        runOnJS(setSwipeDirection)('left');
      } else if (translateY.value < -SWIPE_THRESHOLD) {
        // Swiping up (delete)
        cardBorderColor.value = colors.error;
        runOnJS(setSwipeDirection)('up');
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
        // Swipe left - Hard
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, swipeOffAnimationConfig, (finished) => {
          if (finished) {
            runOnJS(handleRateCard)('hard');
          }
        });
      } else if (translateY.value < -SWIPE_THRESHOLD && swipeDirection === 'up') {
        // Swipe up - Delete (only if swipeDirection was 'up')
        translateY.value = withTiming(-SCREEN_HEIGHT * 1.5, swipeOffAnimationConfig, (finished) => {
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
                            part.isLatex ? (
                              <Text key={index} style={styles.latexText}>{part.text}</Text>
                            ) : (
                              <Text key={index} style={styles.cardText}>{part.text}</Text>
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
                            part.isLatex ? (
                              <Text key={index} style={styles.latexText}>{part.text}</Text>
                            ) : (
                              <Text key={index} style={styles.cardText}>{part.text}</Text>
                            )
                          ))}
                        </View>
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
                  onPress={() => {
                    if (currentCard) {
                      toggleBookmark(currentCard.id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                  }}
                >
                  <Bookmark size={22} color={currentCard?.isBookmarked ? colors.primary : colors.gray[400]} fill={currentCard?.isBookmarked ? colors.primary : 'none'} />
                </TouchableOpacity>
              </TouchableOpacity>
            </Animated.View>
          </GestureDetector>
          
          <View style={styles.swipeHintContainer}>
            {swipeDirection === 'left' && (
              <Text style={[styles.swipeHint, styles.hardHint]}>Hard</Text>
            )}
            {swipeDirection === 'right' && (
              <Text style={[styles.swipeHint, styles.easyHint]}>Easy</Text>
            )}
            {swipeDirection === 'up' && (
              <Text style={[styles.swipeHint, styles.deleteHint]}>Delete</Text>
            )}
            {!swipeDirection && (
              <Text style={[styles.swipeInstructions, { textAlign: 'center' }]}>
                Swipe left for Hard, right for Easy, up to Delete
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
  hardHint: {
    color: colors.warning,
  },
  easyHint: {
    color: colors.success,
  },
  deleteHint: {
    color: colors.error,
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
});