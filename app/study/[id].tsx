import React, { useState, useEffect, useRef } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { X, RotateCw, Clock, ArrowLeft, ArrowRight } from "lucide-react-native";
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
import { useFlashcardStore } from "@/store/flashcard-store";
import { useUserStore } from "@/store/user-store";
import { extractLatex } from "@/utils/latex-renderer";
import { DifficultyRating } from "@/types";

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

export default function StudySessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const decks = useFlashcardStore(state => state.decks);
  const getCurrentCard = useFlashcardStore(state => state.getCurrentCard);
  const getNextCard = useFlashcardStore(state => state.getNextCard);
  const rateCard = useFlashcardStore(state => state.rateCard);
  const deleteFlashcard = useFlashcardStore(state => state.deleteFlashcard);
  const endStudySession = useFlashcardStore(state => state.endStudySession);
  const studyProgress = useFlashcardStore(state => state.studyProgress);
  const getDueFlashcardsForDeck = useFlashcardStore(state => state.getDueFlashcardsForDeck);
  
  const updateStudyStats = useUserStore(state => state.updateStudyStats);
  
  const [showBack, setShowBack] = useState(false);
  const [studyTime, setStudyTime] = useState(0);
  const [sessionStartTime] = useState(Date.now());
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | null>(null);
  const [currentCardId, setCurrentCardId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0);
  
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
  
  const deck = decks.find(d => d.id === id);
  const currentCard = getCurrentCard();
  const dueCards = getDueFlashcardsForDeck(id);
  
  // Check if we have cards to study
  useEffect(() => {
    if (!isDeleting && dueCards.length === 0) {
      handleNoCardsLeft();
    } else if (currentCard) {
      setCurrentCardId(currentCard.id);
    }
  }, [dueCards.length, currentCard, isDeleting, forceRefresh]);
  
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
  
  const handleNoCardsLeft = () => {
    Alert.alert(
      "No Cards Left",
      "You've completed all cards in this deck!",
      [
        {
          text: "OK",
          onPress: () => {
            endStudySession();
            router.back();
          }
        }
      ]
    );
  };
  
  const handleRateCard = (rating: DifficultyRating) => {
    if (!currentCard) return;
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    rateCard(currentCard.id, rating);
    setShowBack(false);
    
    // Reset image manipulation
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
    imgScale.value = 1;
    imgTranslateX.value = 0;
    imgTranslateY.value = 0;
    
    // Check if we've reached the end of the cards
    if (!getNextCard()) {
      setTimeout(() => {
        handleNoCardsLeft();
      }, 300);
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
            
            // Reset UI state
            setShowBack(false);
            translateX.value = 0;
            translateY.value = 0;
            rotate.value = 0;
            setSwipeDirection(null);
            
            // Reset image manipulation
            setImageScale(1);
            setImagePosition({ x: 0, y: 0 });
            imgScale.value = 1;
            imgTranslateX.value = 0;
            imgTranslateY.value = 0;
            
            // Check if there are any cards left after deletion
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
      
      if (translateX.value > SWIPE_THRESHOLD) {
        // Swipe right - Easy
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 300 });
        runOnJS(handleRateCard)('easy');
      } else if (translateX.value < -SWIPE_THRESHOLD) {
        // Swipe left - Hard
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 300 });
        runOnJS(handleRateCard)('hard');
      } else if (translateY.value < -SWIPE_THRESHOLD) {
        // Swipe up - Delete
        translateY.value = withTiming(-SCREEN_HEIGHT, { duration: 300 });
        runOnJS(handleDeleteCard)();
      } else {
        // Reset position
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotate.value = withTiming(0);
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
        options={{
          title: deck.name,
          headerRight: () => (
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => {
                endStudySession();
                router.back();
              }}
            >
              <X size={24} color={colors.textDark} />
            </TouchableOpacity>
          ),
        }} 
      />
      
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
      
      {!currentCard && !isDeleting ? (
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>No cards due for review</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
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
                onPress={() => setShowBack(!showBack)}
              >
                <View style={styles.flipIconContainer}>
                  <RotateCw size={20} color={colors.gray[500]} />
                  <Text style={styles.flipText}>Tap to flip</Text>
                </View>
                
                <ScrollView 
                  contentContainerStyle={styles.cardScrollContent}
                  showsVerticalScrollIndicator={false}
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
                      
                      {currentCard.mediaUrls && currentCard.mediaUrls.length > 0 && (
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
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  backButtonText: {
    color: "white",
    fontWeight: "600",
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    height: SCREEN_HEIGHT * 0.65,
    marginHorizontal: 20,
    marginTop: 10,
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
});