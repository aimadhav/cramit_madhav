import React, { useState, useEffect, useCallback } from "react";
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
  
  const deck = useFlashcardStore(state => 
    routeId ? state.decks.find(d => d.id === routeId) : undefined
  );
  
  const getFlashcardsForDeck = useFlashcardStore(state => state.getFlashcardsForDeck);
  const getDueFlashcardsForDeck = useFlashcardStore(state => state.getDueFlashcardsForDeck);
  const startStudySession = useFlashcardStore(state => state.startStudySession);
  const deleteDeck = useFlashcardStore(state => state.deleteDeck);
  const pendingOperations = useFlashcardStore(state => state.pendingOperations);
  const tempIdToRealIdMap = useFlashcardStore(state => state.tempIdToRealIdMap);
  const clearTempIdMapping = useFlashcardStore(state => state.clearTempIdMapping);
  const fetchFlashcardsForDeck = useFlashcardStore(state => state.fetchFlashcardsForDeck);
  const loadingFlashcardsForDeckId = useFlashcardStore(state => state.loadingFlashcardsForDeckId);
  const flashcardStoreError = useFlashcardStore(state => state.error);
  
  const user = useUserStore(state => state.user);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  
  console.log('[DeckDetailScreen] Component rendered. Received routeId:', routeId);

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
        console.log(`DeckDetailScreen: [Focused] Executing route update for temp ID ${routeId} to real ID ${realId}.`);
        router.replace(`/deck/${realId}`);
        clearTempIdMapping(routeId);
      });
    } else if (!isFocused && routeId && routeId.startsWith('deck-temp-') && tempIdToRealIdMap && tempIdToRealIdMap[routeId]) {
      console.log(`DeckDetailScreen: [Not Focused] Temp ID ${routeId} confirmed to Real ID ${tempIdToRealIdMap[routeId]}. Route update deferred.`);
    }
  }, [routeId, tempIdToRealIdMap, router, clearTempIdMapping, isFocused]);
  
  // Destructure for stable dependencies
  const deckId = deck?.id;
  const deckAreCardsLoaded = deck?.areCardsLoaded;

  useEffect(() => {
    // Ensure deckId is defined and deckAreCardsLoaded is a boolean before proceeding
    if (deckId && typeof deckAreCardsLoaded === 'boolean' && !deckAreCardsLoaded && loadingFlashcardsForDeckId !== deckId) {
      console.log(`[DeckDetailScreen] Deck ${deckId} cards not loaded. Fetching...`);
      fetchFlashcardsForDeck(deckId);
    }
  }, [deckId, deckAreCardsLoaded, fetchFlashcardsForDeck, loadingFlashcardsForDeckId]);

  const handleRetryFetch = useCallback(() => {
    if (deck) {
      console.log(`[DeckDetailScreen] Retrying fetch for deck ${deck.id}`);
      fetchFlashcardsForDeck(deck.id);
    }
  }, [deck, fetchFlashcardsForDeck]);
  
  if (!routeId) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen options={{ title: "Error", headerShown: false }} />
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Deck ID not provided in route.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  if (!deck) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen options={{ title: "Loading Deck...", headerShown: false }} />
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Deck not found or still loading...</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  console.log('[DeckDetailScreen] Deck is defined, proceeding to render details for:', deck.id);

  const flashcards = getFlashcardsForDeck(deck.id);
  const dueCards = getDueFlashcardsForDeck(deck.id);
  const displayedCards = showAll ? flashcards : flashcards.slice(0, 5);
  
  const handleStartStudy = () => {
    if (!deck) return;
    if (!deck.areCardsLoaded && deck.cardCount > 0) {
        Alert.alert("Flashcards Not Loaded", "Flashcards for this deck are still being loaded or failed to load. Please wait or try again.");
        if (loadingFlashcardsForDeckId !== deck.id) {
            fetchFlashcardsForDeck(deck.id);
        }
        return;
    }

    if (dueCards.length === 0 && deck.cardCount > 0) {
      Alert.alert(
        "No Cards Due",
        "There are no cards due for review. Would you like to study all cards in this deck?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Study All",
            onPress: () => {
              startStudySession(deck.id);
              router.push(`/study/${deck.id}`);
            }
          }
        ]
      );
      return;
    }
    startStudySession(deck.id);
    router.push(`/study/${deck.id}`);
  };
  
  const handleDeleteDeck = async () => {
    Alert.alert(
      "Delete Deck",
      "Are you sure you want to delete this deck? This action cannot be undone.",
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
              await deleteDeck(deck.id);
              router.back();
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to delete deck. Please try again.");
            } finally {
              setIsDeleting(false);
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  const isPending = React.useMemo(() => {
    if (!deckId) return false;
    return Object.entries(pendingOperations).some(([key, op]) => {
      if (routeId && routeId.startsWith('deck-temp-') && op.type === 'add' && op.itemType === 'deck' && op.data.id === routeId) return true;
      if (op.type === 'update' && op.itemType === 'deck' && key === deckId) return true;
      if (op.type === 'delete' && op.itemType === 'deck' && key === deckId) return true;
      return false;
    });
  }, [pendingOperations, routeId, deckId]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen 
        options={{
          title: isPending ? "Syncing..." : deck.name,
          headerShown: true,
          headerRight: () => (
            <View style={styles.headerButtons}>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => router.push(`/deck/${deck.id}/edit`)}
                disabled={isDeleting || isPending || routeId?.startsWith('deck-temp-')}
              >
                <Edit size={20} color={(isDeleting || isPending || routeId?.startsWith('deck-temp-')) ? colors.gray[400] : colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={handleDeleteDeck}
                disabled={isDeleting || isPending || routeId?.startsWith('deck-temp-')}
              >
                <Trash2 size={20} color={(isDeleting || isPending || routeId?.startsWith('deck-temp-')) ? colors.gray[400] : colors.error} />
              </TouchableOpacity>
            </View>
          ),
        }} 
      />
      
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
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
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{deck.description}</Text>
          </View>
          
          <View style={styles.tagsContainer}>
            <View style={styles.tagsHeader}>
              <Tag size={16} color={colors.textLight} />
              <Text style={styles.tagsTitle}>Tags</Text>
            </View>
            <View style={styles.tagsList}>
              {deck.tags.map(tag => (
                <View key={tag} style={styles.tagBadge}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
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
              style={[styles.primaryButton, (isPending || (!deck.areCardsLoaded && deck.cardCount > 0)) && styles.disabledButton]}
              onPress={handleStartStudy}
              disabled={isPending || (!deck.areCardsLoaded && deck.cardCount > 0 && loadingFlashcardsForDeckId !== deck.id)}
            >
              <BookOpen size={18} color="white" />
              <Text style={styles.primaryButtonText}>Study Deck ({dueCards.length} due / {flashcards.length} total)</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.secondaryButton, (isPending || routeId?.startsWith('deck-temp-')) && styles.disabledButton]}
              onPress={() => router.push(`/deck/${deck.id}/add-card`)}
              disabled={isPending || routeId?.startsWith('deck-temp-')}
            >
              <Plus size={18} color={colors.primary} />
              <Text style={[styles.secondaryButtonText, (isPending || routeId?.startsWith('deck-temp-')) && styles.disabledButtonText]}>Add Card</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.cardsSection}>
            <View style={styles.cardsSectionHeader}>
              <Text style={styles.cardsSectionTitle}>Flashcards</Text>
              <TouchableOpacity onPress={() => setShowAll(!showAll)}>
                <Text style={styles.viewAllText}>
                  {showAll ? "Show Less" : "View All"}
                </Text>
              </TouchableOpacity>
            </View>
            
            {flashcards.length > 0 ? (
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
                <Text style={styles.emptyCardsText}>No cards in this deck</Text>
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
  coverImageContainer: {
    height: 200,
    width: "100%",
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 5,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[200],
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 5,
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
    paddingVertical: 20,
  },
  emptyCardsText: {
    fontSize: 16,
    color: colors.textLight,
    marginBottom: 16,
  },
  addCardButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  addCardButtonText: {
    color: "white",
    fontWeight: "600",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
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
    opacity: 0.5,
  },
  disabledButtonText: {
    color: colors.gray[400],
  },
});