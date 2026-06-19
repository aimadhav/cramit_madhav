import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './AppText';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { FileText, Bookmark, X, Maximize2, RotateCw } from 'lucide-react-native';
import WebViewLatexBlock from './WebViewLatexBlock';
import { Flashcard } from '@/types';

interface StudyCardProps {
  cardStyle: any;
  gesture: any;
  tapGesture: any;
  isFullView: boolean;
  showBack: boolean;
  currentCard: Flashcard | null;
  hasNote: boolean;
  isCurrentBookmarked: boolean;
  onOpenNote: () => void;
  onToggleBookmark: () => void;
  onToggleFullView: () => void;
}

export const StudyCard: React.FC<StudyCardProps> = ({
  cardStyle,
  gesture,
  tapGesture,
  isFullView,
  showBack,
  currentCard,
  hasNote,
  isCurrentBookmarked,
  onOpenNote,
  onToggleBookmark,
  onToggleFullView,
}) => {
  const containsLatex = (text: string) => text.includes('$') || text.includes('\\');

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.cardContainer, cardStyle, isFullView && styles.cardContainerFull]}>
        <View style={styles.cardInner}>
          <View style={styles.cardTopActions}>
            <View style={styles.topLeftActions}>
              <Text style={styles.cardSideLabel}>{showBack ? 'EXPLANATION' : 'QUESTION'}</Text>
            </View>
            <View style={styles.topRightActions}>
              <TouchableOpacity 
                onPress={onOpenNote} 
                style={styles.actionIconButton}
              >
                <FileText size={20} color={hasNote ? "#5e6ad2" : "#94969a"} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onToggleBookmark} style={styles.actionIconButton}>
                <Bookmark 
                  size={22} 
                  color={isCurrentBookmarked ? "#5e6ad2" : "#94969a"}
                  fill={isCurrentBookmarked ? "#5e6ad2" : 'none'}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={onToggleFullView} style={styles.actionIconButton}>
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
  );
};

const styles = StyleSheet.create({
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
    width: '100%',
    alignItems: 'center',
  },
  cardText: {
    fontSize: 18,
    fontFamily: 'Outfit_500Medium',
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
});
