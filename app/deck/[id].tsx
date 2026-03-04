import React, { useState, useEffect, useCallback, useRef } from "react";
import { StyleSheet, View, TouchableOpacity, Image, Alert, ScrollView, ActivityIndicator } from "react-native";
import { Text } from "@/components/AppText";;
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { 
  BookOpen, 
  Plus, 
  ChevronRight, 
  Tag,
  Clock,
  RefreshCw
} from "lucide-react-native";

import { useThemeColors } from "@/hooks/useThemeColors";
import { useFlashcardStore } from "@/store/flashcard-store";
import { containsLatex } from "@/utils/latex-renderer";
import WebViewLatexBlock from "../../components/WebViewLatexBlock";

export default function DeckDetailScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { id: idFromParams } = useLocalSearchParams<{ id: string }>();
  const routeId = Array.isArray(idFromParams) ? idFromParams[0] : idFromParams;
  
  const isMountedRef = useRef(true);

  const storeDeck = useFlashcardStore(state => 
    routeId ? state.decks.find(d => d.id === routeId) : undefined
  );
  
  const getFlashcardsForDeck = useFlashcardStore(state => state.getFlashcardsForDeck);
  const getDueFlashcardsForDeck = useFlashcardStore(state => state.getDueFlashcardsForDeck);
  const getNewFlashcardsForDeck = useFlashcardStore(state => state.getNewFlashcardsForDeck);
  const startStudySession = useFlashcardStore(state => state.startStudySession);
  const hasIncompleteSession = useFlashcardStore(state => state.hasIncompleteSession);
  const loadDeckWithCards = useFlashcardStore(state => state.loadDeckWithCards);
  const loadingDeckId = useFlashcardStore(state => state.loadingDeckId);

  const [showAll, setShowAll] = useState(false);

  const deck = storeDeck;
  const deckId = deck?.id;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadAttemptedRef = useRef(false);

  // Auto-load cards when deck is available
  useEffect(() => {
    if (deck && !deck.areCardsLoaded && loadingDeckId !== deck.id && !loadAttemptedRef.current) {
      console.log(`[DeckDetailScreen] Loading cards for deck ${deck.id}`);
      loadAttemptedRef.current = true;
      loadDeckWithCards(deck.id).catch(err => {
        console.warn(`[DeckDetailScreen] Auto-load failed, likely offline:`, err);
      });
    }
  }, [deck?.id, deck?.areCardsLoaded, loadingDeckId, loadDeckWithCards]);

  const handleRetryFetch = useCallback(() => {
    if (deck && isMountedRef.current) {
      loadDeckWithCards(deck.id);
    }
  }, [deck, loadDeckWithCards]);

  // Not found state
  if (!routeId) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Deck ID not provided.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!deck) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.notFoundContainer}>
          <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 10 }} />
          <Text style={styles.notFoundText}>Loading deck...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const flashcards = getFlashcardsForDeck(deck.id);
  const dueCards = getDueFlashcardsForDeck(deck.id);
  const newCards = getNewFlashcardsForDeck(deck.id);
  const displayedCards = showAll ? flashcards : flashcards.slice(0, 5);
  const hasIncompleteStudySession = hasIncompleteSession(deck.id);
  const isLoading = loadingDeckId === deck.id;

  const handleStartStudy = async () => {
    if (!deck || !isMountedRef.current) return;

    // If there's an incomplete session, continue it
    if (hasIncompleteStudySession) {
      router.push(`/study/${deck.id}`);
      return;
    }

    // Load cards if needed
    if (!deck.areCardsLoaded && deck.cardCount > 0) {
      try {
        await loadDeckWithCards(deck.id);
      } catch (error) {
        Alert.alert("Error", "Failed to load cards. Please try again.");
        return;
      }
    }

    // Check card availability
    if (deck.cardCount === 0) {
      Alert.alert("Empty Deck", "This deck has no flashcards yet.");
      return;
    }

    if (dueCards.length === 0 && newCards.length === 0) {
      // Start Cram Mode (study all cards ignoring SRS date)
      startStudySession(deck.id, 'all');
      router.push(`/study/${deck.id}`);
      return;
    }

    startStudySession(deck.id);
    router.push(`/study/${deck.id}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <Stack.Screen
        options={{
          title: deck.name,
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false, // makes it blend cleaner
          headerTintColor: colors.textDark,
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Cover Image */}
        <View style={styles.coverImageContainer}>
          <Image
            source={{ uri: deck.coverImage || undefined }}
            style={styles.coverImage}
          />
          <View style={styles.coverOverlay}>
            <View style={styles.deckInfo}>
              <Text style={styles.deckTitle}>{deck.name}</Text>
              <Text style={styles.deckSubtitle}>{deck.cardCount} cards</Text>
            </View>
            {deck.isPremium && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumText}>PRO</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.content}>
          {/* Description */}
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{deck.description || 'No description provided.'}</Text>
          </View>

          {/* Tags */}
          <View style={styles.tagsContainer}>
            <View style={styles.tagsHeader}>
              <Tag size={16} color={colors.textLight} />
              <Text style={styles.tagsTitle}>Tags</Text>
            </View>
            <View style={styles.tagsList}>
              {deck.tags && deck.tags.length > 0 ? deck.tags.map(tag => (
                <View key={tag} style={styles.tagBadge}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              )) : <Text style={styles.noTagsText}>No tags</Text>}
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Clock size={20} color={colors.primary} />
              <Text style={styles.statValue}>{dueCards.length}</Text>
              <Text style={styles.statLabel}>Due</Text>
            </View>
            <View style={styles.statItem}>
              <Plus size={20} color={colors.success} />
              <Text style={styles.statValue}>{newCards.length}</Text>
              <Text style={styles.statLabel}>New</Text>
            </View>
            <View style={styles.statItem}>
              <BookOpen size={20} color={colors.secondary} />
              <Text style={styles.statValue}>{deck.cardCount}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            {hasIncompleteStudySession && (
              <View style={[styles.statItem, styles.progressStatItem]}>
                <RefreshCw size={20} color={colors.warning} />
                <Text style={styles.statValue}>In Progress</Text>
                <Text style={styles.statLabel}>Session</Text>
              </View>
            )}
          </View>

          {/* Study Button */}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              isLoading && styles.loadingButton,
              hasIncompleteStudySession && styles.continueButton,
              (deck.cardCount === 0 && !hasIncompleteStudySession) && styles.disabledButton
            ]}
            onPress={handleStartStudy}
            disabled={isLoading || (deck.cardCount === 0 && !hasIncompleteStudySession)}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="white" />
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>
                {hasIncompleteStudySession 
                  ? 'Continue Studying' 
                  : dueCards.length > 0 
                    ? 'Start Studying' 
                    : newCards.length > 0 
                      ? 'Study New Cards'
                      : 'Retake Deck'
                }
              </Text>
            )}
          </TouchableOpacity>

          {/* Flashcards List */}
          <View style={styles.cardsSection}>
            <View style={styles.cardsSectionHeader}>
              <Text style={styles.cardsSectionTitle}>Flashcards</Text>
              {flashcards.length > 5 && (
                <TouchableOpacity onPress={() => setShowAll(!showAll)}>
                  <Text style={styles.viewAllText}>
                    {showAll ? "Show Less" : "View All"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {isLoading && !deck.areCardsLoaded ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Loading flashcards...</Text>
              </View>
            ) : flashcards.length > 0 ? (
              <View style={styles.flashcardsContainer}>
                {displayedCards.map(card => (
                  <TouchableOpacity
                    key={card.id}
                    style={styles.cardItem}
                    onPress={() => router.push(`/card/${card.id}`)}
                  >
                    {card.mediaUrls && card.mediaUrls.length > 0 && card.mediaUrls[0] && (
                      <Image 
                        source={{ uri: card.mediaUrls[0] }}
                        style={styles.cardThumbnail}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.cardContent} pointerEvents="none">
                      {containsLatex(card.front) ? (
                         <View style={{ maxHeight: 65, overflow: 'hidden' }}>
                            <WebViewLatexBlock latex={card.front} />
                         </View>
                      ) : (
                         <Text style={styles.cardFront} numberOfLines={2}>{card.front}</Text>
                      )}
                      
                      {containsLatex(card.back) ? (
                         <View style={{ maxHeight: 45, overflow: 'hidden', marginTop: 4 }}>
                            <WebViewLatexBlock latex={card.back} />
                         </View>
                      ) : (
                         <Text style={styles.cardBack} numberOfLines={1}>{card.back}</Text>
                      )}
                    </View>
                    <ChevronRight size={20} color={colors.gray[400]} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCardsContainer}>
                <Text style={styles.emptyCardsText}>No cards in this deck yet.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
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
    textAlign: 'center',
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  backButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  coverImageContainer: {
    height: 200,
    width: "100%",
    backgroundColor: colors.gray[200],
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
    padding: 20,
  },
  deckInfo: {
    maxWidth: "80%",
  },
  deckTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
  },
  deckSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
  },
  premiumBadge: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  premiumText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  descriptionContainer: {
    marginBottom: 20,
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textDark,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 16,
    color: colors.textLight,
    lineHeight: 24,
  },
  tagsContainer: {
    marginBottom: 20,
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
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tagBadge: {
    backgroundColor: colors.gray[200],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 14,
    color: colors.textDark,
  },
  noTagsText: {
    fontSize: 14,
    color: colors.textLight,
    fontStyle: 'italic',
  },
  statsContainer: {
    flexDirection: "row",
    marginBottom: 20,
    flexWrap: "wrap",
  },
  statItem: {
    flex: 1,
    minWidth: 80,
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginHorizontal: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  progressStatItem: {
    backgroundColor: colors.warning + '10',
    borderColor: colors.warning + '30',
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textDark,
    marginTop: 8,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  continueButton: {
    backgroundColor: colors.warning,
  },
  loadingButton: {
    opacity: 0.8,
  },
  disabledButton: {
    backgroundColor: colors.gray[300],
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  loadingText: {
    marginLeft: 8,
    color: colors.textLight,
    fontSize: 14,
  },
  cardsSection: {
    marginBottom: 20,
  },
  cardsSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardsSectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textDark,
  },
  viewAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },
  flashcardsContainer: {},
  cardItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
    marginRight: 8,
  },
  cardFront: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textDark,
  },
  cardBack: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 4,
  },
  emptyCardsContainer: {
    alignItems: "center",
    paddingVertical: 30,
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  emptyCardsText: {
    fontSize: 16,
    color: colors.textLight,
  },
});