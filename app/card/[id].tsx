import React, { useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Platform } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Edit, Trash2, Tag, ArrowLeft, ArrowRight, RotateCw, Newspaper, Bookmark } from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Image } from 'expo-image';

import colors from "@/constants/colors";
import { useFlashcardStore } from "@/store/flashcard-store";
import { extractLatex } from "@/utils/latex-renderer";
import WebViewLatexBlock from "../../components/WebViewLatexBlock";
import FlashcardContentModal from '@/components/FlashcardContentModal';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerButtons: {
    flexDirection: "row",
  },
  headerButton: {
    marginLeft: 16,
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
  cardPositionIndicator: {
    alignItems: "center",
    paddingVertical: 12,
  },
  cardPositionText: {
    fontSize: 14,
    color: colors.textLight,
  },
  cardContainer: {
    flex: 1,
    margin: 20,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.gray[200],
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  cardContent: {
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
  imageWrapper: {
    overflow: "hidden",
    borderRadius: 8,
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
  tagsContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  tagsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  tagsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textDark,
    marginLeft: 8,
  },
  tagsList: {
    paddingBottom: 8,
  },
  tagBadge: {
    backgroundColor: colors.gray[200],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  tagText: {
    fontSize: 14,
    color: colors.textDark,
  },
  navigationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.gray[100],
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
    marginHorizontal: 8,
  },
  navButtonTextDisabled: {
    color: colors.gray[400],
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 16, // Space above the button
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  viewDetailsIcon: {
    marginRight: 8,
  },
  viewDetailsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
});

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const flashcards = useFlashcardStore(state => state.flashcards);
  const decks = useFlashcardStore(state => state.decks);
  const getFlashcardsForDeck = useFlashcardStore(state => state.getFlashcardsForDeck);
  const deleteFlashcard = useFlashcardStore(state => state.deleteFlashcard);
  const toggleBookmark = useFlashcardStore(state => state.toggleBookmark);
  const pendingOperations = useFlashcardStore(state => state.pendingOperations);
  
  const card = flashcards.find(c => c.id === id);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);
  
  const [showBack, setShowBack] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  // Image manipulation states
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  
  // Image manipulation values
  const imgScale = useSharedValue(1);
  const imgTranslateX = useSharedValue(0);
  const imgTranslateY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Check if there are any pending operations for this card
  const isPending = Object.entries(pendingOperations).some(([key, op]) => {
    if (op.type === 'add' && key === id) return true;
    if (op.type === 'update' && key === id) return true;
    if (op.type === 'delete' && key === id) return true;
    return false;
  });

  const handleDeleteCard = async () => {
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
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteFlashcard(id);
              router.back();
            } catch (error) {
              Alert.alert(
                "Error",
                "Failed to delete card. Please try again.",
                [{ text: "OK" }]
              );
            } finally {
              setIsDeleting(false);
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  const handleToggleBookmark = async () => {
    try {
      setIsBookmarking(true);
      await toggleBookmark(id);
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to update bookmark. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsBookmarking(false);
    }
  };

  const headerRight = () => (
    <View style={styles.headerButtons}>
      <TouchableOpacity 
        style={styles.headerButton}
        onPress={handleToggleBookmark}
        disabled={isDeleting || isPending || isBookmarking}
      >
        <Bookmark 
          size={20} 
          color={card?.isBookmarked ? colors.primary : colors.gray[400]} 
          fill={card?.isBookmarked ? colors.primary : 'none'}
        />
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.headerButton}
        onPress={() => router.push(`/card/edit/${id}`)}
        disabled={isDeleting || isPending}
      >
        <Edit size={20} color={colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.headerButton}
        onPress={handleDeleteCard}
        disabled={isDeleting || isPending}
      >
        <Trash2 size={20} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
  
  if (!card) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundText}>Card not found</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  const deck = decks.find(d => d.id === card.deckId);
  const deckCards = getFlashcardsForDeck(card.deckId);
  const cardIndex = deckCards.findIndex(c => c.id === card.id);
  const hasNext = cardIndex < deckCards.length - 1;
  const hasPrevious = cardIndex > 0;
  
  const navigateToNextCard = () => {
    if (hasNext) {
      // Reset image manipulation when navigating
      imgScale.value = 1;
      imgTranslateX.value = 0;
      imgTranslateY.value = 0;
      setImageScale(1);
      setImagePosition({ x: 0, y: 0 });
      
      router.replace(`/card/${deckCards[cardIndex + 1].id}`);
    }
  };
  
  const navigateToPreviousCard = () => {
    if (hasPrevious) {
      // Reset image manipulation when navigating
      imgScale.value = 1;
      imgTranslateX.value = 0;
      imgTranslateY.value = 0;
      setImageScale(1);
      setImagePosition({ x: 0, y: 0 });
      
      router.replace(`/card/${deckCards[cardIndex - 1].id}`);
    }
  };
  
  // Image manipulation gestures
  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = imgScale.value;
    })
    .onUpdate((event) => {
      imgScale.value = startScale.value * event.scale;
      setImageScale(startScale.value * event.scale);
    })
    .onEnd(() => {
      // Limit min/max scale
      if (imgScale.value < 0.5) {
        imgScale.value = withSpring(0.5);
        setImageScale(0.5);
      } else if (imgScale.value > 3) {
        imgScale.value = withSpring(3);
        setImageScale(3);
      }
    });
  
  const panGesture = Gesture.Pan()
    .onBegin(() => {
      startX.value = imgTranslateX.value;
      startY.value = imgTranslateY.value;
    })
    .onUpdate((event) => {
      imgTranslateX.value = startX.value + event.translationX;
      imgTranslateY.value = startY.value + event.translationY;
      setImagePosition({ 
        x: startX.value + event.translationX, 
        y: startY.value + event.translationY 
      });
    })
    .onEnd(() => {
      // Limit movement based on scale
      const maxOffset = (imgScale.value - 1) * 100;
      if (imgTranslateX.value < -maxOffset) {
        imgTranslateX.value = withSpring(-maxOffset);
        setImagePosition(prev => ({ ...prev, x: -maxOffset }));
      } else if (imgTranslateX.value > maxOffset) {
        imgTranslateX.value = withSpring(maxOffset);
        setImagePosition(prev => ({ ...prev, x: maxOffset }));
      }
      
      if (imgTranslateY.value < -maxOffset) {
        imgTranslateY.value = withSpring(-maxOffset);
        setImagePosition(prev => ({ ...prev, y: -maxOffset }));
      } else if (imgTranslateY.value > maxOffset) {
        imgTranslateY.value = withSpring(maxOffset);
        setImagePosition(prev => ({ ...prev, y: maxOffset }));
      }
    });
  
  const imageGestures = Gesture.Simultaneous(pinchGesture, panGesture);
  
  // Double tap to reset image
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      imgScale.value = withSpring(1);
      imgTranslateX.value = withSpring(0);
      imgTranslateY.value = withSpring(0);
      setImageScale(1);
      setImagePosition({ x: 0, y: 0 });
    });
  
  // Animated styles
  const imageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: imgTranslateX.value },
        { translateY: imgTranslateY.value },
        { scale: imgScale.value }
      ]
    };
  });
  
  // Parse content for LaTeX
  const frontContent = extractLatex(card.front);
  const backContent = extractLatex(card.back);
  
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen 
        options={{
          title: deck?.name || "Flashcard",
          headerRight: headerRight,
        }} 
      />
      
      <View style={styles.cardPositionIndicator}>
        <Text style={styles.cardPositionText}>
          Card {cardIndex + 1} of {deckCards.length}
        </Text>
      </View>
      
      <TouchableOpacity 
        style={styles.cardContainer}
        activeOpacity={0.9}
        onPress={() => setShowBack(!showBack)}
      >
        <View style={styles.flipIconContainer}>
          <RotateCw size={20} color={colors.gray[500]} />
          <Text style={styles.flipText}>Tap to flip</Text>
        </View>
        
        <ScrollView 
          contentContainerStyle={styles.cardContent}
          showsVerticalScrollIndicator={false}
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
              
              {card.mediaUrls && card.mediaUrls.length > 0 && (
                <View style={styles.imageContainer}>
                  {Platform.OS !== 'web' ? (
                    <GestureDetector gesture={Gesture.Simultaneous(imageGestures, doubleTapGesture)}>
                      <Animated.View style={styles.imageWrapper}>
                        <Animated.Image 
                          source={{ uri: card.mediaUrls[0] }}
                          style={[styles.cardImage, imageStyle]}
                          resizeMode="contain"
                        />
                      </Animated.View>
                    </GestureDetector>
                  ) : (
                    <Image 
                      source={{ uri: card.mediaUrls[0] }}
                      style={styles.cardImage}
                      contentFit="contain"
                    />
                  )}
                  <Text style={styles.imageHint}>
                    {Platform.OS !== 'web' ? 
                      "Pinch to zoom • Drag to move • Double tap to reset" : 
                      "Image manipulation not available on web"}
                  </Text>
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
            </>
          )}
        </ScrollView>

        {/* Button to open the modal */}
        <TouchableOpacity 
          style={styles.viewDetailsButton}
          onPress={() => setIsModalVisible(true)}
        >
          <Newspaper size={18} color={colors.primary} style={styles.viewDetailsIcon} />
          <Text style={styles.viewDetailsButtonText}>View Full Details</Text>
        </TouchableOpacity>
      </TouchableOpacity>
      
      <View style={styles.tagsContainer}>
        <View style={styles.tagsHeader}>
          <Tag size={16} color={colors.textLight} />
          <Text style={styles.tagsTitle}>Tags</Text>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagsList}
        >
          {card.tags.map(tag => (
            <View key={tag} style={styles.tagBadge}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
      
      <View style={styles.navigationContainer}>
        <TouchableOpacity 
          style={[styles.navButton, !hasPrevious && styles.navButtonDisabled]}
          onPress={navigateToPreviousCard}
          disabled={!hasPrevious}
        >
          <ArrowLeft size={20} color={hasPrevious ? colors.primary : colors.gray[400]} />
          <Text style={[styles.navButtonText, !hasPrevious && styles.navButtonTextDisabled]}>
            Previous
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navButton, !hasNext && styles.navButtonDisabled]}
          onPress={navigateToNextCard}
          disabled={!hasNext}
        >
          <Text style={[styles.navButtonText, !hasNext && styles.navButtonTextDisabled]}>
            Next
          </Text>
          <ArrowRight size={20} color={hasNext ? colors.primary : colors.gray[400]} />
        </TouchableOpacity>
      </View>
      <FlashcardContentModal isVisible={isModalVisible} onClose={() => setIsModalVisible(false)} card={card!} />
    </SafeAreaView>
  );
}