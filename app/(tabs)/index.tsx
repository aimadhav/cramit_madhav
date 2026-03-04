import React, { useCallback, useState } from "react";
import { StyleSheet, View, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { Text } from "@/components/AppText";;
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Award, BookOpen, Clock, Plus, ChevronRight, History } from "lucide-react-native";

import { useThemeColors } from "@/hooks/useThemeColors";
import { useUserStore } from "@/store/user-store";
import { useFlashcardStore } from "@/store/flashcard-store";
import { trpc } from "@/utils/trpc";
import { Skeleton } from "@/components/Skeleton";

export default function HomeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const user = useUserStore(state => state.user);
  
  const {
    decks,
    isLoading: isLoadingStore,
    loadingDeckId,
    error: storeError,
    loadDeckWithCards,
    getDueFlashcardsForDeck,
    getNewFlashcardsForDeck,
    startStudySession,
    clearError,
  } = useFlashcardStore();
  
  const [refreshing, setRefreshing] = useState(false);
  
  // Get featured decks (first 3)
  const featuredDecks = (decks || []).slice(0, 3);
  
  // Get recent decks (sort by updatedAt)
  const recentDecks = [...(decks || [])]
    .sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 3);
  
  // Get due cards count
  const totalDueCards = (decks || []).reduce((total, deck) => {
    if (deck.areCardsLoaded) {
      return total + getDueFlashcardsForDeck(deck.id).length;
    }
    return total;
  }, 0);

  // Handle study button press
  const handleStudyPress = async (deckId: string) => {
    const deck = decks.find(d => d.id === deckId);
    if (!deck) {
      Alert.alert("Error", "Deck not found.");
      return;
    }

    try {
      // Load cards if not already loaded
      if (!deck.areCardsLoaded) {
        await loadDeckWithCards(deckId);
      }
      
      const dueCards = getDueFlashcardsForDeck(deckId);
      const newCards = getNewFlashcardsForDeck(deckId);

      // Check card availability
      if (deck.cardCount === 0) {
        Alert.alert("Empty Deck", "This deck has no flashcards yet.");
        return;
      }

      if (dueCards.length === 0 && newCards.length === 0) {
        startStudySession(deckId, 'all');
      } else {
        startStudySession(deckId);
      }
      
      router.push(`/study/${deckId}`);
    } catch (error: any) {
      console.error('[HomeScreen] Study error:', error);
      Alert.alert("Error", error.message || "Failed to load deck. Please try again.");
    }
  };

  // tRPC query for refreshing
  const utils = trpc.useUtils();
  
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearError();
    try {
      await utils.deck.listPublic.invalidate();
    } catch (error) {
      console.error("[HomeScreen] Refresh error:", error);
    }
    setRefreshing(false);
  }, [utils, clearError]);

  // Render study button content with loading state
  const renderStudyButtonContent = (deckId: string, showText: boolean = true) => {
    const isLoading = loadingDeckId === deckId;
    
    if (isLoading) {
      return (
        <>
          <ActivityIndicator size="small" color="white" style={{ marginRight: showText ? 6 : 0 }} />
          {showText && <Text style={styles.studyButtonText}>Loading...</Text>}
        </>
      );
    }
    
    return (
      <>
        <BookOpen size={16} color="white" style={{ marginRight: showText ? 6 : 0 }} />
        {showText && <Text style={styles.studyButtonText}>Study</Text>}
      </>
    );
  };

  // Loading state (Production Skeleton)
  if (isLoadingStore && decks.length === 0 && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <View>
            <Skeleton width={120} height={16} borderRadius={4} style={{ marginBottom: 12 }} />
            <Skeleton width={200} height={32} borderRadius={8} />
          </View>
        </View>
        
        {/* Mock Stats Section */}
        <View style={styles.statsContainer}>
           <Skeleton width={80} height={60} borderRadius={16} />
           <Skeleton width={80} height={60} borderRadius={16} />
           <Skeleton width={80} height={60} borderRadius={16} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Mock Featured Decks */}
          <View style={styles.section}>
            <Skeleton width={150} height={24} borderRadius={6} style={{ marginBottom: 16 }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
              <Skeleton width={280} height={180} borderRadius={24} style={{ marginRight: 16 }} />
              <Skeleton width={280} height={180} borderRadius={24} />
            </ScrollView>
          </View>

          {/* Mock Recent Decks */}
          <View style={styles.section}>
            <Skeleton width={150} height={24} borderRadius={6} style={{ marginBottom: 16 }} />
            <Skeleton width='100%' height={80} borderRadius={20} style={{ marginBottom: 16 }} />
            <Skeleton width='100%' height={80} borderRadius={20} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={[colors.primary]} 
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
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

        {/* Empty state */}
        {decks.length === 0 && !isLoadingStore && (
          <View style={styles.centeredMessageContainer_withPadding}>
            <Text style={styles.emptyDecksTitle}>No decks available</Text>
            <Text style={styles.emptyDecksSubtitle}>Check back later for new study materials.</Text>
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
                      disabled={loadingDeckId === deck.id}
                    >
                      {renderStudyButtonContent(deck.id, true)}
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
                  {deck.tags && deck.tags.length > 0 && (
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
                  disabled={loadingDeckId === deck.id}
                >
                  {renderStudyButtonContent(deck.id, true)}
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View style={[styles.section, styles.lastSection]}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsContainer}>
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

const createStyles = (colors: any) => StyleSheet.create({
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
    borderRadius: 20,
    marginRight: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  deckImage: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  deckCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 16,
    justifyContent: "flex-end",
    borderRadius: 20,
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
    backgroundColor: colors.card,
    borderRadius: 24, // Softer curves
    padding: 20, // More breathing room
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1.5, // Slightly bolder border for contrast
    borderColor: colors.border,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 }, // Deeper shadow
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
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
    backgroundColor: colors.card,
    borderRadius: 20, // Softer curves
    padding: 20, // More breathing room
    marginBottom: 16, // More spacing
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 }, // Deeper shadow
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  recentDeckImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
    marginRight: 16,
    backgroundColor: colors.gray[200],
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
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    justifyContent: "center",
    marginBottom: 30,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.primary,
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
  lastSection: {
    marginBottom: 30,
  },
});