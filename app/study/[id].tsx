import React, { useState, useEffect, useMemo, useCallback } from "react";
import { StyleSheet, View, TouchableOpacity, ScrollView, Alert, Dimensions, Platform, Modal, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Image } from 'expo-image';
import { Text } from "@/components/AppText";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useFlashcardStore } from "@/store/flashcard-store";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { X, RotateCw, Clock, ArrowLeft, Bookmark, Maximize2, FileText, Send, Pencil, Check } from "lucide-react-native";
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
import { DifficultyRating, Flashcard } from "@/types";
import { MOCK_TEMP_CARDS } from "@/constants/mockData";

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.2; 

export default function StudySessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
  
  // Mock handling for temp decks
  const isTempDeck = id?.startsWith('temp_') || id?.startsWith('rec_');
  
  // Start session on mount for real decks
  useEffect(() => {
    async function init() {
      if (!isTempDeck && id) {
        console.log('📱 [UI] Starting study session for deck:', id);
        await startStudySession(id);
      }
      setIsInitializing(false);
    }
    init();
  }, [id, isTempDeck]);

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
    return isTempDeck ? !!bookmarkedCards[currentCard.id] : currentCard.isBookmarked;
  }, [currentCard, isTempDeck, bookmarkedCards]);

  const hasNote = currentCard ? !!currentCard.notes : false;

  // Sync progress when session finishes
  useEffect(() => {
    if (isSessionComplete && !isTempDeck) {
      syncSessionProgress();
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
    }
  }, [currentCard?.id, tempCurrentIndex]);

  // Handle rating a card
  const handleRateCard = useCallback(async (rating: DifficultyRating) => {
    if (!currentCard || isRating) return;
    console.log('📱 [UI] Rating card:', currentCard.id, 'as', rating);

    setIsRating(true);
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

  const containsLatex = (text: string) => text.includes('$') || text.includes('\\');

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false, title: "" }} />
      
      {isInitializing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5e6ad2" />
          <Text style={{ color: '#94969a', marginTop: 10 }}>Loading Session...</Text>
        </View>
      ) : isSessionComplete ? (
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
      ) : currentCard ? (
        <>
          {/* Header - Completely Hidden in Full View */}
          {!isFullView && (
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
          )}
          
          {/* Swipe hints - Hidden in Full View */}
          {!isFullView && (
            <View style={styles.swipeHintContainer}>
              {swipeDirection === 'left' && <View style={[styles.swipePill, styles.againPill]}><Text style={styles.swipePillText}>DIDN'T KNOW</Text></View>}
              {swipeDirection === 'right' && <View style={[styles.swipePill, styles.easyPill]}><Text style={styles.swipePillText}>EASY</Text></View>}
            </View>
          )}
          
          {/* Card */}
          <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.cardContainer, cardStyle, isFullView && styles.cardContainerFull]}>
              <View style={styles.cardInner}>
                <View style={styles.cardTopActions}>
                  <View style={styles.topLeftActions}>
                    <Text style={styles.cardSideLabel}>{showBack ? 'EXPLANATION' : 'QUESTION'}</Text>
                  </View>
                  <View style={styles.topRightActions}>
                    <TouchableOpacity 
                      onPress={() => {
                        const hasExistingNote = !!currentCard?.notes;
                        setNoteMode(hasExistingNote ? 'read' : 'edit');
                        setIsNoteModalVisible(true);
                      }} 
                      style={styles.actionIconButton}
                    >
                      <FileText size={20} color={hasNote ? "#5e6ad2" : "#94969a"} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleToggleBookmark} style={styles.actionIconButton}>
                      <Bookmark 
                        size={22} 
                        color={isCurrentBookmarked ? "#5e6ad2" : "#94969a"}
                        fill={isCurrentBookmarked ? "#5e6ad2" : 'none'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsFullView(!isFullView)} style={styles.actionIconButton}>
                       {isFullView ? <X size={22} color="#FFFFFF" /> : <Maximize2 size={18} color="#94969a" />}
                    </TouchableOpacity>
                  </View>
                </View>
                
                <GestureDetector gesture={tapGesture}>
                  <Animated.View style={{ flex: 1 }}>
                    <ScrollView 
                      style={{ flex: 1 }}
                      contentContainerStyle={styles.cardScrollContent}
                      showsVerticalScrollIndicator={false}
                    >
                      <View style={styles.contentContainer}>
                        {currentCard?.mediaUrls && currentCard.mediaUrls.length > 0 && (
                          <Image 
                            source={{ uri: currentCard.mediaUrls[showBack && currentCard.mediaUrls.length > 1 ? 1 : 0] }} 
                            style={styles.cardImage} 
                            contentFit="contain"
                            transition={200}
                          />
                        )}
                        {currentCard && containsLatex(showBack ? currentCard.back : currentCard.front) ? (
                          <WebViewLatexBlock latex={showBack ? currentCard.back : currentCard.front} />
                        ) : (
                          <Text style={styles.cardText}>{currentCard ? (showBack ? currentCard.back : currentCard.front) : ''}</Text>
                        )}
                      </View>
                    </ScrollView>
    
                    {!isFullView && (
                      <View style={styles.cardFooterSimple}>
                        <View style={styles.flipHint}>
                          <RotateCw size={12} color="#5F6166" />
                          <Text style={styles.flipHintText}>Tap content to flip</Text>
                        </View>
                      </View>
                    )}
                  </Animated.View>
                </GestureDetector>
              </View>
            </Animated.View>
          </GestureDetector>
          
          {/* Legend - Hidden when in Full View */}
          {!isFullView && (
            <View style={styles.legend}>
              <Text style={styles.legendText}>← Didn't Know • Easy →</Text>
            </View>
          )}
    
          {/* Note Modal */}
          <Modal
            visible={isNoteModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setIsNoteModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.noteModalContent}>
                <View style={styles.modalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.modalIconBox, { backgroundColor: noteMode === 'edit' ? colors.primary : '#1A1B1F' }]}>
                      {noteMode === 'edit' ? <Pencil size={16} color="#FFFFFF" /> : <FileText size={16} color={colors.primary} />}
                    </View>
                    <Text style={styles.modalTitle}>{noteMode === 'edit' ? 'Edit Note' : 'Your Note'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setIsNoteModalVisible(false)} style={styles.modalCloseButton}>
                    <X size={20} color="#94969a" />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.noteBodyScroll} showsVerticalScrollIndicator={false}>
                  {noteMode === 'edit' ? (
                    <TextInput
                      style={styles.noteInput}
                      placeholder="Write something about this card..."
                      placeholderTextColor="#5F6166"
                      multiline
                      value={noteText}
                      onChangeText={setNoteText}
                      autoFocus
                    />
                  ) : (
                    <View style={styles.noteReadContainer}>
                      <Text style={styles.noteReadText}>
                        {currentCard?.notes || "No note added yet."}
                      </Text>
                    </View>
                  )}
                </ScrollView>
                
                <View style={styles.modalFooter}>
                  {noteMode === 'edit' ? (
                    <TouchableOpacity 
                      style={[
                        styles.saveNoteButton,
                        isNoteSaving && { backgroundColor: colors.success }
                      ]}
                      onPress={() => {
                        if (currentCard) {
                          setIsNoteSaving(true);
                          
                          // CALL THE STORE to trigger the sync engine!
                          if (!isTempDeck) {
                            updateCardNote(currentCard.id, noteText);
                          } else {
                            console.log('📱 [UI] Skip sync for temporary card note');
                          }
                          
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          
                          setTimeout(() => {
                            setIsNoteSaving(false);
                            setNoteMode('read');
                          }, 1000);
                        }
                      }}
                    >
                      {isNoteSaving ? (
                        <>
                          <Check size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                          <Text style={styles.saveNoteText}>Saved!</Text>
                        </>
                      ) : (
                        <>
                          <Send size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                          <Text style={styles.saveNoteText}>Save Changes</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={styles.editModeButton}
                      onPress={() => setNoteMode('edit')}
                    >
                      <Pencil size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.saveNoteText}>Edit Note</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </Modal>
        </>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={{ color: '#ff5f57' }}>Error: No cards available for study.</Text>
          <TouchableOpacity style={styles.completionButton} onPress={handleExit}>
            <Text style={styles.completionButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
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
    padding: 20,
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
  easyPill: { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10B981' },
  againPill: { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#F59E0B' },
  
  cardContainer: {
    flex: 1,
    marginHorizontal: 10, 
    marginTop: 5, 
    marginBottom: 35,
    borderRadius: 36, 
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#2D2D2D',
    overflow: 'hidden',
  },
  cardContainerFull: {
    marginHorizontal: 8, 
    marginTop: 0, // FLUSH TO TOP
    marginBottom: 20,
    borderRadius: 24, 
    borderWidth: 1,
    zIndex: 1000, 
  },
  cardContent: {
    flex: 1,
  },
  cardInner: {
    flex: 1,
    padding: 24, 
  },
  cardTopActions: {
    flexDirection: 'row',
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 20,
    marginTop: Platform.OS === 'ios' ? 10 : 0, 
  },
  topLeftActions: {
    flex: 1,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardSideLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#94969a',
    letterSpacing: 2,
  },
  actionIconButton: {
    padding: 6,
  },
  cardScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 40,
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
  cardImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 20,
    backgroundColor: '#1A1B1F',
  },
  cardFooterSimple: {
    marginTop: 10,
    paddingTop: 10,
    alignItems: 'center',
  },
  flipHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.5,
  },
  flipHintText: {
    fontSize: 10,
    color: '#5F6166',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  noteModalContent: {
    backgroundColor: '#15171B',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 30,
    paddingBottom: 50,
    borderWidth: 1,
    borderTopColor: '#2A2C32',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: '#FFFFFF',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1B1F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteBodyScroll: {
    maxHeight: 300,
  },
  noteReadContainer: {
    padding: 10,
  },
  noteReadText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#ECECEC',
    fontFamily: 'Outfit_500Medium',
  },
  noteInput: {
    backgroundColor: '#0B0C0E',
    borderRadius: 16,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Outfit_500Medium',
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  modalFooter: {
    marginTop: 20,
  },
  saveNoteButton: {
    backgroundColor: '#5e6ad2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  editModeButton: {
    backgroundColor: '#1F2125',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  saveNoteText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
  }
});
