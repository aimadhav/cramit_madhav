import React, { useEffect, useCallback, useState } from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, FlatList, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Award, BookOpen, Clock, Plus, ChevronRight, History, AlertCircle, DownloadCloud } from "lucide-react-native";

import colors from "@/constants/colors";
import { useUserStore } from "@/store/user-store";
import { useFlashcardStore } from "@/store/flashcard-store";
import { Deck } from '@/types';

export default function HomeScreen() {
  const router = useRouter();
  const user = useUserStore(state => state.user);
  const {
    decks,
    flashcards,
    isLoading: isLoadingFlashcardStore,
    error: flashcardStoreError,
    loadInitialData,
    getDueFlashcardsForDeck,
    startStudySession,
    fetchFlashcardsForDeck,
    loadingFlashcardsForDeckId,
  } = useFlashcardStore();
  
  const [refreshing, setRefreshing] = useState(false);
  const [activelyDownloadingDeckId, setActivelyDownloadingDeckId] = useState<string | null>(null);
  const [loadingDots, setLoadingDots] = useState(1);
  
  useEffect(() => {
    console.log("[HomeScreen] Mounted. User:", user?.name, "Decks loaded:", decks.length);
  }, []);
  
  useEffect(() => {
    let intervalId: number | null = null;
    if (activelyDownloadingDeckId) {
      intervalId = setInterval(() => {
        setLoadingDots(prevDots => (prevDots % 3) + 1);
      }, 500); // Change dot count every 500ms
    } else {
      if (intervalId !== null) {
         clearInterval(intervalId);
      }
      setLoadingDots(1); // Reset dots when not downloading
    }

    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [activelyDownloadingDeckId]);
  
  // Get featured decks (first 3)
  const featuredDecks = decks.slice(0, 3);
  
  // Get recent decks (sort by updatedAt)
  const recentDecks = [...decks]
    .sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA; // Sort descending (newest first)
    })
    .slice(0, 3);
  
  // Get due cards count
  const totalDueCards = decks.reduce((total, deck) => {
    return total + getDueFlashcardsForDeck(deck.id).length;
  }, 0);

  useEffect(() => {
    if (activelyDownloadingDeckId && !loadingFlashcardsForDeckId) {
      const deckJustLoaded = decks.find(d => d.id === activelyDownloadingDeckId);
      
      if (flashcardStoreError && useFlashcardStore.getState().error?.includes(activelyDownloadingDeckId)) {
        Alert.alert("Download Failed", `Could not download flashcards for ${deckJustLoaded?.name || 'deck'}. Please try again.`);
        setActivelyDownloadingDeckId(null);
        return;
      }

      if (deckJustLoaded && deckJustLoaded.areCardsLoaded) {
        console.log(`[HomeScreen] Flashcards for deck ${activelyDownloadingDeckId} loaded. Starting session and navigating.`);
        const cardsForDeck = useFlashcardStore.getState().getFlashcardsForDeck(activelyDownloadingDeckId);
        if (cardsForDeck.length > 0 || deckJustLoaded.cardCount === 0) {
            startStudySession(activelyDownloadingDeckId);
            router.push(`/study/${activelyDownloadingDeckId}`);
        } else {
            console.warn(`[HomeScreen] Deck ${activelyDownloadingDeckId} marked as loaded, but no cards found in store. Card count: ${deckJustLoaded.cardCount}`);
            Alert.alert("Study Error", `Flashcards for ${deckJustLoaded.name} seem to be missing. Try refreshing.`);
        }
      } else if (deckJustLoaded) {
        console.warn(`[HomeScreen] Deck ${activelyDownloadingDeckId} finished loading but 'areCardsLoaded' is false or no cards. Deck state:`, deckJustLoaded);
        Alert.alert("Download Incomplete", `Flashcards for ${deckJustLoaded.name} may not have loaded correctly. Please try refreshing or re-opening the deck.`);
      } else if (!flashcardStoreError) {
        console.warn(`[HomeScreen] Download finished for ${activelyDownloadingDeckId}, but deck not found or not marked as loaded and no specific error from store.`);
      }
      setActivelyDownloadingDeckId(null);
    }
  }, [loadingFlashcardsForDeckId, decks, flashcardStoreError, activelyDownloadingDeckId, router, startStudySession]);

  const handleStudyPress = (deckId: string) => {
    const deck = decks.find(d => d.id === deckId);
    if (!deck) {
      console.warn(`[HomeScreen] Attempted to study deck ID ${deckId} not found in store.`);
      Alert.alert("Error", "Deck not found. It might have been deleted.");
      return;
    }

    if (deck.areCardsLoaded || deck.cardCount === 0) {
      console.log(`[HomeScreen] Cards for deck ${deckId} are already loaded or deck is empty. Starting session.`);
      startStudySession(deckId);
      router.push(`/study/${deckId}`);
    } else {
      console.log(`[HomeScreen] Cards for deck ${deckId} not loaded. Fetching now...`);
      setActivelyDownloadingDeckId(deckId);
      fetchFlashcardsForDeck(deckId);
    }
  };

  const onRefresh = useCallback(async () => {
    console.log("[HomeScreen] Refresh triggered.");
    setRefreshing(true);
    setActivelyDownloadingDeckId(null);
    try {
      const { checkAuthStatus } = useUserStore.getState();
      await checkAuthStatus();
    } catch (error) {
      console.error("[HomeScreen] Refresh error:", error);
      Alert.alert("Refresh Failed", "Could not update decks. Please check your connection.");
    }
    setRefreshing(false);
  }, []);

  if (isLoadingFlashcardStore && decks.length === 0 && !refreshing && !activelyDownloadingDeckId) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.centeredMessageContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your decks...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderStudyButtonContent = (deckId: string, buttonStyleConfig: { textStyle: any, iconSize: number, iconColor: string, showText: boolean, text: string }) => {
    if (activelyDownloadingDeckId === deckId) {
      return (
        <>
          <ActivityIndicator size="small" color={buttonStyleConfig.iconColor} style={{marginRight: buttonStyleConfig.showText ? 6 : 0}} />
          {buttonStyleConfig.showText && <Text style={buttonStyleConfig.textStyle}>Downloading...</Text>}
        </>
      );
    }
    return (
      <>
        <BookOpen size={buttonStyleConfig.iconSize} color={buttonStyleConfig.iconColor} style={{marginRight: buttonStyleConfig.showText ? 6 : 0}} />
        {buttonStyleConfig.showText && <Text style={buttonStyleConfig.textStyle}>{buttonStyleConfig.text}</Text>}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary}/>
      }>
        <View style={styles.header}>
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>Hello, {user?.name || "Student"}</Text>
            <Text style={styles.subtitle}>Ready to improve your knowledge?</Text>
          </View>
          <View style={styles.streakContainer}>
            <Award size={20} color={colors.warning} />
            <Text style={styles.streakText}>{user?.studyStats.streakDays || 0} day streak</Text>
          </View>
        </View>

        {decks.length === 0 && !isLoadingFlashcardStore && (
          <View style={styles.centeredMessageContainer_withPadding}>
            <Text style={styles.emptyDecksTitle}>No decks yet!</Text>
            <Text style={styles.emptyDecksSubtitle}>Create your first deck or explore public decks.</Text>
            <TouchableOpacity 
              style={styles.createDeckButton}
              onPress={() => router.push("/decks/create")}
            >
              <Plus size={18} color="white" style={{marginRight: 8}} />
              <Text style={styles.createDeckButtonText}>Create New Deck</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Featured Decks Section */}
        {featuredDecks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured Decks</Text>
              {decks.length > 3 && (
                <TouchableOpacity onPress={() => router.push("/decks")}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredDecksContainer}
            >
              {featuredDecks.map(deck => (
                <TouchableOpacity 
                  key={deck.id} 
                  style={styles.deckCard}
                  onPress={() => router.push(`/deck/${deck.id}`)}
                >
                  <Image 
                    source={{ uri: deck.coverImage || undefined }}
                    style={styles.deckImage}
                    resizeMode="cover"
                  />
                  <View style={styles.deckCardOverlay}>
                    <Text style={styles.deckCardTitle} numberOfLines={2}>{deck.name}</Text>
                    <Text style={styles.deckCardSubtitle}>{deck.cardCount || 0} cards</Text>
                    <TouchableOpacity 
                      style={styles.studyNowButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleStudyPress(deck.id);
                      }}
                      disabled={activelyDownloadingDeckId === deck.id}
                    >
                      {renderStudyButtonContent(deck.id, { textStyle: styles.studyNowText, iconSize: 16, iconColor: 'white', showText: true, text: 'Study Now' })}
                    </TouchableOpacity>
                    {deck.isPremium && (
                      <View style={styles.premiumBadge}>
                        <Text style={styles.premiumText}>PRO</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Continue Studying Section */}
        {totalDueCards > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Continue Studying</Text>
            <TouchableOpacity 
              style={styles.continueCard}
              onPress={() => router.push("/decks")}
            >
              <View style={styles.continueCardContent}>
                <View style={styles.continueCardIcon}>
                  <Clock size={24} color={colors.primary} />
                </View>
                <View style={styles.continueCardTextContainer}>
                  <Text style={styles.continueCardTitle}>You have {totalDueCards} cards due</Text>
                  <Text style={styles.continueCardSubtitle}>Tap to review your cards</Text>
                </View>
              </View>
              <ChevronRight size={20} color={colors.gray[400]} />
            </TouchableOpacity>
          </View>
        )}

        {/* Recent Decks Section */}
        {recentDecks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Decks</Text>
              {decks.length > 3 && (
                <TouchableOpacity onPress={() => router.push("/decks")}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              )}
            </View>
            {recentDecks.map(deck => (
              <TouchableOpacity 
                key={deck.id} 
                style={styles.recentDeckCard}
                onPress={() => router.push(`/deck/${deck.id}`)}
              >
                <Image 
                  source={{ uri: deck.coverImage || undefined }}
                  style={styles.recentDeckImage}
                  resizeMode="cover"
                />
                <View style={styles.recentDeckTextContainer}>
                  <Text style={styles.recentDeckTitle} numberOfLines={1}>{deck.name}</Text>
                  <Text style={styles.recentDeckSubtitle}>{deck.cardCount || 0} cards</Text>
                  {(deck.tags && deck.tags.length > 0) && (
                    <View style={styles.recentDeckTagsContainer}>
                      {deck.tags.slice(0, 2).map(tag => (
                        <View key={tag} style={styles.tagBadge}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <TouchableOpacity 
                  style={styles.studyButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleStudyPress(deck.id);
                  }}
                  disabled={activelyDownloadingDeckId === deck.id}
                >
                  {renderStudyButtonContent(deck.id, { textStyle: styles.studyButtonText, iconSize: 16, iconColor: 'white', showText: true, text: 'Study' })}
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Study Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Study Stats</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Clock size={24} color={colors.primary} />
              <Text style={styles.statValue}>{user?.studyStats.totalTimeStudied || 0}</Text>
              <Text style={styles.statLabel}>Minutes</Text>
            </View>
            <View style={styles.statCard}>
              <BookOpen size={24} color={colors.secondary} />
              <Text style={styles.statValue}>{user?.studyStats.totalCardsStudied || 0}</Text>
              <Text style={styles.statLabel}>Cards</Text>
            </View>
            <View style={styles.statCard}>
              <History size={24} color={colors.success} />
              <Text style={styles.statValue}>{totalDueCards}</Text>
              <Text style={styles.statLabel}>Due</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={[styles.section, styles.lastSection]}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push("/decks/create")}
            >
              <Plus size={18} color="white" style={styles.actionButtonIcon} />
              <Text style={styles.actionButtonText}>Create Deck</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={() => router.push("/decks")}
            >
              <BookOpen size={18} color={colors.primary} style={styles.actionButtonIcon} />
              <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>Browse Decks</Text>
            </TouchableOpacity>
          </View>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greetingContainer: {
    flex: 1,
    paddingRight: 10,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.textDark,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textLight,
    marginTop: 4,
  },
  streakContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.gray[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexShrink: 0,
  },
  streakText: {
    marginLeft: 6,
    fontWeight: "600",
    color: colors.textDark,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textDark,
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },
  featuredDecksContainer: {
    paddingRight: 20,
  },
  deckCard: {
    width: 280,
    height: 180,
    borderRadius: 12,
    marginRight: 16,
    overflow: "hidden",
  },
  deckImage: {
    width: "100%",
    height: "100%",
  },
  deckCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 16,
    justifyContent: "flex-end",
  },
  deckCardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  deckCardSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
    marginBottom: 12,
  },
  studyNowButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
    flexDirection: 'row',
    alignItems: 'center',
  },
  studyNowText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  premiumBadge: {
    position: "absolute",
    top: 12,
    right: 12,
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
  continueCard: {
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  continueCardContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  continueCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray[100],
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  continueCardTextContainer: {
    flex: 1,
  },
  continueCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textDark,
  },
  continueCardSubtitle: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 4,
  },
  recentDeckCard: {
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  recentDeckInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  recentDeckImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
  },
  recentDeckTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  recentDeckTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textDark,
  },
  recentDeckSubtitle: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 2,
  },
  recentDeckTagsContainer: {
    flexDirection: "row",
    marginTop: 6,
    flexWrap: "wrap",
  },
  tagBadge: {
    backgroundColor: colors.gray[200],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 12,
    color: colors.textDark,
  },
  studyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  studyButtonText: {
    color: "white",
    fontWeight: "600",
    marginLeft: 6,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statCard: {
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
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    marginRight: 8,
    flexDirection: "row",
    justifyContent: "center",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.primary,
    marginLeft: 8,
    marginRight: 0,
  },
  actionButtonIcon: {
    marginRight: 6,
  },
  actionButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  secondaryButtonText: {
    color: colors.primary,
  },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centeredMessageContainer_withPadding: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: colors.text,
  },
  emptyDecksTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  emptyDecksSubtitle: {
    fontSize: 16,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 24,
  },
  createDeckButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  createDeckButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  lastSection: {
    marginBottom: 30,
  },
});