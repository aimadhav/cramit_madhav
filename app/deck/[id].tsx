import React, { useState, useEffect, useCallback, useRef } from "react";
import { StyleSheet, Text, View, TouchableOpacity, FlatList, Image, Alert, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { 
  BookOpen, 
  Edit, 
  Trash2, 
  Plus, 
  ChevronRight, 
  Tag,
  Clock,
  Share,
  AlertCircle,
  RefreshCw
} from "lucide-react-native";

import colors from "@/constants/colors";
import { useFlashcardStore } from "@/store/flashcard-store";
import { useUserStore } from "@/store/user-store";

export default function DeckDetailScreen() {
  const router = useRouter();
  const { id: idFromParams } = useLocalSearchParams<{ id: string }>();
  const routeId = Array.isArray(idFromParams) ? idFromParams[0] : idFromParams;
  const isFocused = useIsFocused();
  
  // Use useRef for mounted state tracking
  const isMountedRef = useRef(true);

  const storeDeck = useFlashcardStore(state => 
    routeId ? state.decks.find(d => d.id === routeId) : undefined
  );
  
  const getFlashcardsForDeck = useFlashcardStore(state => state.getFlashcardsForDeck);
  const getDueFlashcardsForDeck = useFlashcardStore(state => state.getDueFlashcardsForDeck);
  const startStudySession = useFlashcardStore(state => state.startStudySession);
  const deleteDeckFromStore = useFlashcardStore(state => state.deleteDeck);
  const pendingOperations = useFlashcardStore(state => state.pendingOperations);
  const tempIdToRealIdMap = useFlashcardStore(state => state.tempIdToRealIdMap);
  const clearTempIdMapping = useFlashcardStore(state => state.clearTempIdMapping);
  const fetchFlashcardsForDeck = useFlashcardStore(state => state.fetchFlashcardsForDeck);
  const loadingFlashcardsForDeckId = useFlashcardStore(state => state.loadingFlashcardsForDeckId);

  const user = useUserStore(state => state.user);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const deck = storeDeck;
  const deckId = deck?.id;
  const deckAreCardsLoaded = deck?.areCardsLoaded;

  console.log('[DeckDetailScreen] Component rendered. Received routeId:', routeId, 'Deck ID from store:', deckId);

  // Set up cleanup for mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const currentDeckInStore = routeId ? useFlashcardStore.getState().decks.find(d => d.id === routeId) : undefined;
    console.log('[DeckDetailScreen] useEffect [routeId, store] triggered. Deck for routeId:', 
                currentDeckInStore ? currentDeckInStore.id : 'undefined');
  }, [routeId]); 

  useEffect(() => {
    if (isFocused && routeId && routeId.startsWith('deck-temp-') && tempIdToRealIdMap && tempIdToRealIdMap[routeId]) {
      const realId = tempIdToRealIdMap[routeId];
      console.log(`DeckDetailScreen: [Focused] Temp ID ${routeId} confirmed to Real ID ${realId}. Scheduling route update.`);
      requestAnimationFrame(() => {
        if (isMountedRef.current) {
          console.log(`DeckDetailScreen: [Focused] Executing route update for temp ID ${routeId} to real ID ${realId}.`);
          router.replace(`/deck/${realId}`);
          clearTempIdMapping(routeId);
        }
      });
    } else if (!isFocused && routeId && routeId.startsWith('deck-temp-') && tempIdToRealIdMap && tempIdToRealIdMap[routeId]) {
      console.log(`DeckDetailScreen: [Not Focused] Temp ID ${routeId} confirmed to Real ID ${tempIdToRealIdMap[routeId]}. Route update deferred.`);
    }
  }, [routeId, tempIdToRealIdMap, router, clearTempIdMapping, isFocused]);

  useEffect(() => {
    // Only attempt to fetch if deckId is available, cards aren't loaded,
    // and either it's a real ID OR it's a temporary ID that has been resolved.
    const isResolvedTempId = routeId?.startsWith('deck-temp-') && tempIdToRealIdMap?.[routeId];
    const shouldFetch = deckId && typeof deckAreCardsLoaded === 'boolean' && !deckAreCardsLoaded && loadingFlashcardsForDeckId !== deckId && (!routeId?.startsWith('deck-temp-') || isResolvedTempId);

    if (shouldFetch && isMountedRef.current) {
      console.log(`[DeckDetailScreen] Deck ${deckId} cards not loaded and ready to fetch. Fetching...`);
      fetchFlashcardsForDeck(deckId);
    } else if (routeId?.startsWith('deck-temp-') && !isResolvedTempId) {
        // Log if we are on a temporary ID route but haven't resolved it yet,
        // so fetch is intentionally skipped.
        console.log(`[DeckDetailScreen] On temporary route ${routeId}, waiting for real ID before fetching cards.`);
    }

  }, [deckId, deckAreCardsLoaded, fetchFlashcardsForDeck, loadingFlashcardsForDeckId, routeId, tempIdToRealIdMap, isFocused]);

  const handleRetryFetch = useCallback(() => {
    if (deck && isMountedRef.current) {
      console.log(`[DeckDetailScreen] Retrying fetch for deck ${deck.id}`);
      fetchFlashcardsForDeck(deck.id);
    }
  }, [deck, fetchFlashcardsForDeck]);

  const isPending = React.useMemo(() => {
    if (!deckId) return false;
    return Object.entries(pendingOperations).some(([key, op]) => {
      if (routeId && routeId.startsWith('deck-temp-') && op.type === 'add' && op.itemType === 'deck' && op.data.id === routeId) return true;
      if (op.type === 'update' && op.itemType === 'deck' && key === deckId) return true;
      if (op.type === 'delete' && op.itemType === 'deck' && key === deckId) return true;
      return false;
    });
  }, [pendingOperations, routeId, deckId]);

  const handleDeleteDeck = useCallback(async () => {
    if (!deck) {
        Alert.alert("Error", "Deck data is missing. Cannot delete.");
        return;
    }
    
    Alert.alert(
      "Delete Deck",
      `Are you sure you want to delete "${deck.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          onPress: async () => {
            const deckIdToDelete = deck.id;
            
            // Set deleting state before navigation
            if (isMountedRef.current) {
              setIsDeleting(true);
            }

            try {
              // Navigate back first
              router.back();
              
              // Wait a bit to ensure navigation completes
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Then delete the deck
              await deleteDeckFromStore(deckIdToDelete);
              
            } catch (error: any) {
              console.error("Failed to delete deck from store:", error);
              
              // Only show alert if component is still mounted
              if (isMountedRef.current) {
                Alert.alert(
                  "Delete Error", 
                  error.message || "Failed to delete deck. The deck might still appear until you refresh the list."
                );
              }
            } finally {
              // Only update state if component is still mounted
              if (isMountedRef.current) {
                setIsDeleting(false);
              }
            }
          },
          style: "destructive"
        }
      ]
    );
  }, [deck, router, deleteDeckFromStore]);
  
  let screenTitle = "Loading...";
  let screenHeaderShown = true;
  let screenHeaderRight: (() => React.ReactNode) | undefined = undefined;
  let mainContent: React.ReactNode;

  const isResolvingTempId = routeId?.startsWith('deck-temp-') && !(tempIdToRealIdMap?.[routeId]);
  const isDeckLoaded = !!deck; // Check if the deck object is available in the store

  // Determine the current state for rendering
  if (!routeId) {
    // State 1: No route ID provided (Error)
    screenTitle = "Error";
    screenHeaderShown = true;
    mainContent = (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundText}>Deck ID not provided in route.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (isResolvingTempId) {
      // State 2: Temporary ID is resolving
      screenTitle = "Creating Deck...";
      screenHeaderShown = true;
      mainContent = (
        <View style={styles.notFoundContainer}>
          <ActivityIndicator size="large" color={colors.primary} style={{marginBottom: 10}}/>
          <Text style={styles.notFoundText}>Finishing up deck creation...</Text>
        </View>
      );
  } else if (!isDeckLoaded) {
      // State 3: Route ID is valid (real or resolved temp), but deck object is not yet loaded into the store
      screenTitle = "Loading Deck...";
      screenHeaderShown = true;
      mainContent = (
        <View style={styles.notFoundContainer}>
          <ActivityIndicator size="large" color={colors.primary} style={{marginBottom: 10}}/>
          <Text style={styles.notFoundText}>Loading deck details...</Text>
        </View>
      );
  } else {
      // State 4: Deck object is successfully loaded into the store (Display Deck Details)
      screenTitle = isPending ? "Syncing..." : deck.name;
      screenHeaderShown = true;
      screenHeaderRight = () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push(`/deck/${deck.id}/edit`)}
            disabled={isDeleting || isPending}
          >
            <Edit size={20} color={(isDeleting || isPending) ? colors.gray[400] : colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleDeleteDeck}
            disabled={isDeleting || isPending}
          >
            <Trash2 size={20} color={(isDeleting || isPending) ? colors.gray[400] : colors.error} />
          </TouchableOpacity>
        </View>
      );

      const flashcards = getFlashcardsForDeck(deck.id);
      const dueCards = getDueFlashcardsForDeck(deck.id);
      const displayedCards = showAll ? flashcards : flashcards.slice(0, 5);

      const handleStartStudy = () => {
        if (!deck || !isMountedRef.current) return;

        // Check if flashcards are loaded *or* if the deck is known to have 0 cards
        if (!deck.areCardsLoaded && deck.cardCount > 0 && loadingFlashcardsForDeckId !== deck.id) {
          console.log(`[DeckDetailScreen] handleStartStudy: Cards not loaded for deck ${deck.id}, cardCount > 0. Fetching...`);
          fetchFlashcardsForDeck(deck.id);
          return;
        } else if (!deck.areCardsLoaded && deck.cardCount > 0 && loadingFlashcardsForDeckId === deck.id) {
          console.log(`[DeckDetailScreen] handleStartStudy: Cards not loaded for deck ${deck.id}, already loading.`);
          return;
        }

        if (dueCards.length === 0 && deck.cardCount > 0) {
          Alert.alert(
            "No Cards Due",
            "There are no cards due for review. Would you like to study all cards in this deck?",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Study All", onPress: () => { 
                if (isMountedRef.current) {
                  startStudySession(deck.id); 
                  router.push(`/study/${deck.id}`); 
                }
              }}
            ]
          );
          return;
        }
        if (deck.cardCount === 0) {
          Alert.alert("Empty Deck", "This deck has no flashcards yet. Add some cards to start studying!");
          return;
        }
        startStudySession(deck.id);
        router.push(`/study/${deck.id}`);
      };

      mainContent = (
        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.coverImageContainer}>
            <Image
              source={{ uri: deck.coverImage || undefined }}
              style={styles.coverImage}
              onError={(e) => console.log("Failed to load cover image:", e.nativeEvent.error)}
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
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionTitle}>Description</Text>
              <Text style={styles.descriptionText}>{deck.description || 'No description provided.'}</Text>
            </View>

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

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Clock size={20} color={colors.primary} />
                <Text style={styles.statValue}>{dueCards.length}</Text>
                <Text style={styles.statLabel}>Due</Text>
              </View>
              <View style={styles.statItem}>
                <BookOpen size={20} color={colors.secondary} />
                <Text style={styles.statValue}>{deck.cardCount}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>

            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.primaryButton, loadingFlashcardsForDeckId === deck.id && styles.loadingButton]}
                onPress={handleStartStudy}
                disabled={loadingFlashcardsForDeckId === deck.id}
              >
                {loadingFlashcardsForDeckId === deck.id ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={styles.loadingText}>Loading ...</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryButtonText}>Start Studying</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push(`/deck/${deck.id}/add-card`)}
              >
                <Plus size={20} color={colors.primary} />
                <Text style={styles.secondaryButtonText}>Add Card</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.cardsSection}>
              <View style={styles.cardsSectionHeader}>
                <Text style={styles.cardsSectionTitle}>Flashcards</Text>
                {flashcards.length > 5 && (
                   <TouchableOpacity onPress={() => isMountedRef.current && setShowAll(!showAll)}>
                     <Text style={styles.viewAllText}>
                       {showAll ? "Show Less" : "View All"}
                     </Text>
                   </TouchableOpacity>
                )}
              </View>

              {loadingFlashcardsForDeckId === deck.id && !deck.areCardsLoaded ? (
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
                      <View style={styles.cardContent}>
                        <Text style={styles.cardFront} numberOfLines={2}>{card.front}</Text>
                        <Text style={styles.cardBack} numberOfLines={1}>{card.back}</Text>
                      </View>
                      <ChevronRight size={20} color={colors.gray[400]} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyCardsContainer}>
                  <Text style={styles.emptyCardsText}>No cards in this deck yet.</Text>
                  <TouchableOpacity
                    style={styles.addCardButton}
                    onPress={() => router.push(`/deck/${deck.id}/add-card`)}
                  >
                    <Text style={styles.addCardButtonText}>Add Card</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.shareButton}>
              <Share size={20} color={colors.primary} />
              <Text style={styles.shareButtonText}>Share Deck</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <Stack.Screen
        options={{
          title: screenTitle,
          headerShown: screenHeaderShown,
          headerRight: screenHeaderRight,
          headerTintColor: colors.textDark,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
      {mainContent}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
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
    backgroundColor: colors.background,
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
  },
  statItem: {
    flex: 1,
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textDark,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 5,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[100],
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 5,
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
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
  cardItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.gray[200],
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
    marginBottom: 16,
  },
  addCardButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 14,
  },
  addCardButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.gray[100],
    marginBottom: 20,
  },
  shareButtonText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
  },
  flashcardsContainer: {
    marginBottom: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledButtonText: {
    color: colors.gray[500],
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingButton: {
    opacity: 0.8,
  },
});