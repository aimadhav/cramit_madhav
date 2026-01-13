import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Image, ActivityIndicator, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { BookOpen, Plus, Filter } from "lucide-react-native";

import colors from "@/constants/colors";
import { useFlashcardStore } from "@/store/flashcard-store";
import { Deck } from "@/types";
import { trpc } from "@/lib/trpc";

type FilterType = null | boolean | 'physics' | 'chemistry' | 'maths' | 'biology';

export default function DecksScreen() {
  const router = useRouter();
  const decks = useFlashcardStore(state => state.decks);
  const startStudySession = useFlashcardStore(state => state.startStudySession);
  const fetchFlashcardsForDeck = useFlashcardStore(state => state.fetchFlashcardsForDeck);
  const loadingFlashcardsForDeckId = useFlashcardStore(state => state.loadingFlashcardsForDeckId);
  const [filterPremium, setFilterPremium] = useState<boolean | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [lastLoadingDeckId, setLastLoadingDeckId] = useState<string | null>(null);
  const [shouldNavigateAfterLoad, setShouldNavigateAfterLoad] = useState(false);

  const { data: userDecksResult, isLoading: isLoadingUserDecks, refetch: refetchUserDecks } = 
    trpc.deck.listUserDecks.useQuery(
      { cursor: cursor, limit: 20 },
      { enabled: !!cursor || cursor === null }
    );

  useEffect(() => {
    if (userDecksResult) {
      const newDecks = userDecksResult.map(deck => ({
        ...deck,
        createdAt: deck.createdAt ? new Date(deck.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: deck.updatedAt ? new Date(deck.updatedAt).toISOString() : new Date().toISOString(),
        cardCount: deck._count?.flashcards ?? 0,
        tags: deck.tagsJson ? JSON.parse(deck.tagsJson) : (deck.tags || [])
      }));
      
      if (cursor === null) {
        // First load
        useFlashcardStore.getState().loadInitialData(newDecks, []);
      } else {
        // Append to existing decks
        const currentDecks = useFlashcardStore.getState().decks;
        const uniqueNewDecks = newDecks.filter(newDeck => 
          !currentDecks.some(existingDeck => existingDeck.id === newDeck.id)
        );
        useFlashcardStore.getState().loadInitialData([...currentDecks, ...uniqueNewDecks], []);
      }
      
      // Update pagination state
      setHasMore(newDecks.length === 20); // If we got 20 items, there might be more
      setCursor(newDecks[newDecks.length - 1]?.id || null);
    }
  }, [userDecksResult]);

  useEffect(() => {
    if (loadingFlashcardsForDeckId !== null) {
      setLastLoadingDeckId(loadingFlashcardsForDeckId);
    }
  }, [loadingFlashcardsForDeckId]);

  useEffect(() => {
    const checkAndNavigate = async () => {
      console.log(`[DecksScreen] Effect triggered. loadingFlashcardsForDeckId: ${loadingFlashcardsForDeckId}, lastLoadingDeckId: ${lastLoadingDeckId}, shouldNavigate: ${shouldNavigateAfterLoad}`);
      if (loadingFlashcardsForDeckId === null && lastLoadingDeckId && shouldNavigateAfterLoad) {
        // Find the deck that was just loading
        const deck = decks.find(d => d.areCardsLoaded && d.id === lastLoadingDeckId);
        console.log(`[DecksScreen] Found deck with loaded cards:`, deck?.id);
        if (deck) {
          console.log(`[DecksScreen] Cards loaded for deck ${deck.id}, navigating to study screen...`);
          startStudySession(deck.id);
          router.push(`/study/${deck.id}`);
          setLastLoadingDeckId(null);
          setShouldNavigateAfterLoad(false);
        }
      }
    };

    checkAndNavigate();
  }, [loadingFlashcardsForDeckId, lastLoadingDeckId, decks, router, startStudySession, shouldNavigateAfterLoad]);

  const loadMoreDecks = async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    await refetchUserDecks();
    setIsLoadingMore(false);
  };

  // Function to check if deck matches subject filter
  const matchesSubject = (deck: Deck, subject: string): boolean => {
    const deckName = deck.name.toLowerCase();
    const deckTags = deck.tags.map(tag => tag.toLowerCase()).join(' ');
    const deckSubject = deck.subject?.toLowerCase() || '';
    const searchText = `${deckName} ${deckTags} ${deckSubject}`;

    switch (subject) {
      case 'physics':
        return searchText.includes('phy') || searchText.includes('physics');
      case 'chemistry':
        return searchText.includes('chem') || searchText.includes('chemistry');
      case 'maths':
        return searchText.includes('math') || searchText.includes('maths');
      case 'biology':
        return searchText.includes('bio') || searchText.includes('biology');
      default:
        return true;
    }
  };

  const filteredDecks = decks.filter(deck => {
    // Apply premium filter
    const matchesPremium = filterPremium !== null ? deck.isPremium === filterPremium : true;
    
    // Apply subject filter
    const matchesSubjectFilter = subjectFilter ? matchesSubject(deck, subjectFilter) : true;
    
    return matchesPremium && matchesSubjectFilter;
  });

  const handleStartStudy = (deckId: string) => {
    const deck = decks.find(d => d.id === deckId);
    if (!deck) {
      console.warn(`[DecksScreen] Attempted to study deck ID ${deckId} not found in store.`);
      Alert.alert("Error", "Deck not found. It might have been deleted.");
      return;
    }

    console.log(`[DecksScreen] handleStartStudy for deck ${deckId}. Cards loaded: ${deck.areCardsLoaded}, Card count: ${deck.cardCount}`);
    if (!deck.areCardsLoaded && deck.cardCount > 0) {
      console.log(`[DecksScreen] Cards for deck ${deckId} not loaded. Fetching now...`);
      setShouldNavigateAfterLoad(true);
      fetchFlashcardsForDeck(deckId);
    } else {
      console.log(`[DecksScreen] Cards already loaded for deck ${deckId}. Starting study session...`);
      startStudySession(deckId);
      router.push(`/study/${deckId}`);
    }
  };

  const handleFilterPress = (type: 'premium' | 'subject', value: FilterType) => {
    if (type === 'premium') {
      setFilterPremium(value as boolean | null);
    } else {
      setSubjectFilter(value as string | null);
    }
  };

  const getSubjectButtonStyle = (subject: string) => {
    const baseStyle = [styles.filterButton];
    
    let subjectStyle = {};
    switch (subject) {
      case 'physics':
        subjectStyle = { backgroundColor: subjectFilter === 'physics' ? '#3B82F6' : '#DBEAFE' };
        break;
      case 'chemistry':
        subjectStyle = { backgroundColor: subjectFilter === 'chemistry' ? '#10B981' : '#D1FAE5' };
        break;
      case 'maths':
        subjectStyle = { backgroundColor: subjectFilter === 'maths' ? '#F59E0B' : '#FEF3C7' };
        break;
      case 'biology':
        subjectStyle = { backgroundColor: subjectFilter === 'biology' ? '#EF4444' : '#FEE2E2' };
        break;
      default:
        subjectStyle = {};
    }
    
    return [...baseStyle, subjectStyle];
  };

  const getSubjectTextStyle = (subject: string) => {
    const baseStyle = styles.filterText;
    let textColor = {};
    
    switch (subject) {
      case 'physics':
        textColor = { color: subjectFilter === 'physics' ? 'white' : '#1E40AF' };
        break;
      case 'chemistry':
        textColor = { color: subjectFilter === 'chemistry' ? 'white' : '#047857' };
        break;
      case 'maths':
        textColor = { color: subjectFilter === 'maths' ? 'white' : '#92400E' };
        break;
      case 'biology':
        textColor = { color: subjectFilter === 'biology' ? 'white' : '#B91C1C' };
        break;
      default:
        textColor = {};
    }
    
    return [baseStyle, textColor];
  };

  const renderDeckItem = ({ item }: { item: Deck }) => (
    <TouchableOpacity 
      style={styles.deckCard}
      onPress={() => router.push(`/deck/${item.id}`)}
    >
      <Image 
        source={{ uri: item.coverImage || 'https://via.placeholder.com/300x200.png?text=CramItDeck' }} 
        style={styles.deckImage}
      />
      <View style={styles.deckContent}>
        <View style={styles.deckInfo}>
          <Text style={styles.deckTitle}>{item.name}</Text>
          <Text style={styles.deckSubtitle}>{item.cardCount} cards</Text>
          <View style={styles.tagsContainer}>
            {(item.tags || []).slice(0, 2).map(tag => (
              <View key={tag} style={styles.tagBadge}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
            {item.tags.length > 2 && (
              <Text style={styles.moreTagsText}>+{item.tags.length - 2}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity 
          style={[styles.studyButton, loadingFlashcardsForDeckId === item.id && styles.loadingButton]}
          onPress={(e) => {
            e.stopPropagation();
            handleStartStudy(item.id);
          }}
          disabled={loadingFlashcardsForDeckId === item.id}
        >
          {loadingFlashcardsForDeckId === item.id ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="white" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : (
            <>
              <BookOpen size={16} color="white" />
              <Text style={styles.studyButtonText}>Study</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      {item.isPremium && (
        <View style={styles.premiumBadge}>
          <Text style={styles.premiumText}>PRO</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Flashcard Decks</Text>
        <TouchableOpacity 
          style={styles.createButton}
          onPress={() => router.push("/decks/create")}
        >
          <Plus size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollFilterContainer}
        style={styles.filterScrollView}
      >
        <TouchableOpacity 
          style={[
            styles.filterButton, 
            filterPremium === null && styles.activeFilterButton
          ]}
          onPress={() => handleFilterPress('premium', null)}
        >
          <Text style={[
            styles.filterText,
            filterPremium === null && styles.activeFilterText
          ]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.filterButton, 
            filterPremium === false && styles.activeFilterButton
          ]}
          onPress={() => handleFilterPress('premium', false)}
        >
          <Text style={[
            styles.filterText,
            filterPremium === false && styles.activeFilterText
          ]}>Free</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.filterButton, 
            filterPremium === true && styles.activeFilterButton
          ]}
          onPress={() => handleFilterPress('premium', true)}
        >
          <Text style={[
            styles.filterText,
            filterPremium === true && styles.activeFilterText
          ]}>Premium</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={getSubjectButtonStyle('physics')}
          onPress={() => handleFilterPress('subject', subjectFilter === 'physics' ? null : 'physics')}
        >
          <Text style={getSubjectTextStyle('physics')}>Physics</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={getSubjectButtonStyle('chemistry')}
          onPress={() => handleFilterPress('subject', subjectFilter === 'chemistry' ? null : 'chemistry')}
        >
          <Text style={getSubjectTextStyle('chemistry')}>Chemistry</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={getSubjectButtonStyle('maths')}
          onPress={() => handleFilterPress('subject', subjectFilter === 'maths' ? null : 'maths')}
        >
          <Text style={getSubjectTextStyle('maths')}>Maths</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={getSubjectButtonStyle('biology')}
          onPress={() => handleFilterPress('subject', subjectFilter === 'biology' ? null : 'biology')}
        >
          <Text style={getSubjectTextStyle('biology')}>Biology</Text>
        </TouchableOpacity>
      </ScrollView>

      <FlatList
        data={filteredDecks}
        renderItem={renderDeckItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMoreDecks}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No decks found</Text>
          </View>
        }
      />
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
    paddingVertical: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.textDark,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray[100],
    justifyContent: "center",
    alignItems: "center",
  },
  filterScrollView: {
    marginBottom: 16,
    height: 40, 
    // flexGrow: 0 is important to stop it from expanding unnecessarily.
    flexGrow: 0,
  },
  scrollFilterContainer: {
    paddingHorizontal: 20,
    paddingRight: 40, // Extra padding for last item
    // This will vertically center your buttons within the 55px height.
    alignItems: 'center', 
    
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 18,
    paddingVertical: 2,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: colors.gray[100],
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  activeFilterButton: {
    backgroundColor: colors.primary,
  },
  activeSubjectFilterButton: {
    // This will be overridden by individual subject styles
  },
  filterText: {
    color: colors.textDark,
    fontWeight: "500",
    fontSize: 14,
    textAlign: 'center',
  },
  activeFilterText: {
    color: "white",
  },
  listContainer: {
    padding: 20,
    paddingTop: 0,
  },
  deckCard: {
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  deckImage: {
    width: "100%",
    height: 120,
  },
  deckContent: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deckInfo: {
    flex: 1,
    paddingRight: 12,
  },
  deckTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textDark,
  },
  deckSubtitle: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 4,
  },
  tagsContainer: {
    flexDirection: "row",
    marginTop: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  tagBadge: {
    backgroundColor: colors.gray[200],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 12,
    color: colors.textDark,
  },
  moreTagsText: {
    fontSize: 12,
    color: colors.textLight,
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
    marginLeft: 4,
    fontWeight: "500",
  },
  premiumBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  premiumText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textLight,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: "center",
  },
  loadingButton: {
    opacity: 0.8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '500',
  },
});