import React, { useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, RotateCw } from "lucide-react-native";
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

export default function StudyCardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const flashcards = useFlashcardStore(state => state.flashcards);
  const card = flashcards.find(c => c.id === id);
  
  const [showBack, setShowBack] = useState(false);
  
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

  if (!card) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <Stack.Screen options={{ title: "Card Not Found", headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: Platform.OS === 'ios' ? 16 : 0}}>
              <ArrowLeft size={24} color={colors.primary} />
            </TouchableOpacity>
          )}} />
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Card not found</Text>
          <TouchableOpacity 
            style={styles.notFoundBackButton}
            onPress={() => router.back()}
          >
            <Text style={styles.notFoundBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Image manipulation gestures
  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = imgScale.value;
    })
    .onUpdate((event) => {
      imgScale.value = startScale.value * event.scale;
    })
    .onEnd(() => {
      if (imgScale.value < 0.5) imgScale.value = withSpring(0.5);
      if (imgScale.value > 3) imgScale.value = withSpring(3);
      setImageScale(imgScale.value); // Sync with component state if needed for other logic
    });

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      startX.value = imgTranslateX.value;
      startY.value = imgTranslateY.value;
    })
    .onUpdate((event) => {
      imgTranslateX.value = startX.value + event.translationX;
      imgTranslateY.value = startY.value + event.translationY;
    })
    .onEnd(() => {
      const maxOffset = (imgScale.value - 1) * 100; // Example boundary
      if (imgTranslateX.value < -maxOffset) imgTranslateX.value = withSpring(-maxOffset);
      if (imgTranslateX.value > maxOffset) imgTranslateX.value = withSpring(maxOffset);
      if (imgTranslateY.value < -maxOffset) imgTranslateY.value = withSpring(-maxOffset);
      if (imgTranslateY.value > maxOffset) imgTranslateY.value = withSpring(maxOffset);
      setImagePosition({ x: imgTranslateX.value, y: imgTranslateY.value }); // Sync with component state
    });

  const imageGestures = Gesture.Simultaneous(pinchGesture, panGesture);

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      imgScale.value = withSpring(1);
      imgTranslateX.value = withSpring(0);
      imgTranslateY.value = withSpring(0);
      setImageScale(1);
      setImagePosition({ x: 0, y: 0 });
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
  
  const frontContent = extractLatex(card.front);
  const backContent = extractLatex(card.back);
  
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen 
        options={{
          title: "Card Details",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: Platform.OS === 'ios' ? 16 : 0}}>
              <ArrowLeft size={24} color={colors.primary} />
            </TouchableOpacity>
          ),
          headerRight: () => null, // No edit/delete buttons
        }}
      />
      
      {/* cardPositionIndicator View removed to eliminate top whitespace */}

      <View style={styles.cardContainer}>
        <View style={styles.flipIconContainer}>
          <RotateCw size={20} color={colors.gray[500]} />
          <Text style={styles.flipText}>Tap to flip</Text>
        </View>
        
        <ScrollView contentContainerStyle={styles.cardContent}>
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
              
              {card.mediaUrls && card.mediaUrls.length > 0 && card.mediaUrls[0] && (
                <View style={styles.imageContainer}>
                  <GestureDetector gesture={Gesture.Simultaneous(imageGestures, doubleTapGesture)}>
                    <Animated.View style={styles.imageWrapper}> 
                      <Animated.Image 
                        source={{ uri: card.mediaUrls[0] }}
                        style={[styles.cardImage, imageStyle]}
                        resizeMode="contain"
                      />
                    </Animated.View>
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
              {/* Consider if back images are needed and how to handle them if card.mediaUrls has multiple items */}
            </>
          )}
        </ScrollView>
      </View>

      <TouchableOpacity 
        style={styles.flipButton}
        onPress={() => setShowBack(!showBack)}
      >
        <RotateCw size={20} color={colors.primary} style={styles.flipButtonIcon} />
        <Text style={styles.flipButtonText}>Flip Card</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  notFoundBackButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  notFoundBackButtonText: {
    color: "white",
    fontWeight: "600",
  },
  // cardPositionIndicator style removed as the element is no longer used
  // cardPositionText: { // Removed as it's not used
  //   fontSize: 14,
  //   color: colors.textLight,
  // },
  cardContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 20, // Added margin bottom for spacing from safe area
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
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', // Ensure monospace for LaTeX
    textAlign: "center",
    marginVertical: 8,
  },
  imageContainer: {
    width: "100%",
    marginTop: 20,
    alignItems: "center",
  },
  imageWrapper: { // Added for potentially clipping image during animation if needed
    overflow: "hidden",
    borderRadius: 8, // Match cardImage radius
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
  flipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[100],
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 20, // Spacing from bottom safe area
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  flipButtonIcon: {
    marginRight: 10,
  },
  flipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
});
