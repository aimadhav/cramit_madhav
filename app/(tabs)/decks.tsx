import React, { useState, useCallback } from "react";
import { StyleSheet, View, FlatList, TouchableOpacity, Image, ActivityIndicator, ScrollView, Alert } from "react-native";
import { Text } from "@/components/AppText";;
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { BookOpen, CheckCircle2, Search } from "lucide-react-native";

import { useThemeColors } from "@/hooks/useThemeColors";
import { useFlashcardStore } from "@/store/flashcard-store";
import { Deck } from "@/types";

export default function DecksScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const decks = useFlashcardStore(state => state.decks);
  const loadingDeckId = useFlashcardStore(state => state.loadingDeckId);
  const loadDeckWithCards = useFlashcardStore(state => state.loadDeckWithCards);
  const startStudySession = useFlashcardStore(state => state.startStudySession);
  
  const [filterPremium, setFilterPremium] = useState<boolean | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);

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
    const matchesPremium = filterPremium !== null ? deck.isPremium === filterPremium : true;
    const matchesSubjectFilter = subjectFilter ? matchesSubject(deck, subjectFilter) : true;
    return matchesPremium && matchesSubjectFilter;
  });

  const handleStartStudy = useCallback(async (deckId: string) => {
    const deck = decks.find(d => d.id === deckId);
    if (!deck) {
      Alert.alert("Error", "Deck not found.");
      return;
    }

    try {
      // Load cards if needed
      if (!deck.areCardsLoaded) {
        await loadDeckWithCards(deckId);
      }
      
      // Start session and navigate
      startStudySession(deckId);
      router.push(`/study/${deckId}`);
    } catch (error: any) {
      console.error('[DecksScreen] Study error:', error);
      Alert.alert("Error", error.message || "Failed to load deck.");
    }
  }, [decks, loadDeckWithCards, startStudySession, router]);

  const handleFilterPress = (type: 'premium' | 'subject', value: any) => {
    if (type === 'premium') {
      setFilterPremium(value);
    } else {
      setSubjectFilter(subjectFilter === value ? null : value);
    }
  };

  const getSubjectButtonStyle = (subject: string) => {
    const isActive = subjectFilter === subject;
    let brandColor = colors.primary;
    
    switch (subject) {
      case 'physics': brandColor = '#3B82F6'; break;
      case 'chemistry': brandColor = '#10B981'; break;
      case 'maths': brandColor = '#F59E0B'; break;
      case 'biology': brandColor = '#EF4444'; break;
    }
    
    return [
      styles.filterButton, 
      { 
        backgroundColor: isActive ? brandColor : 'transparent',
        borderColor: isActive ? brandColor : colors.border,
        borderWidth: 1.5,
      }
    ];
  };

  const getSubjectTextStyle = (subject: string) => {
    const isActive = subjectFilter === subject;
    let brandColor = colors.primary;
    
    switch (subject) {
      case 'physics': brandColor = '#3B82F6'; break;
      case 'chemistry': brandColor = '#10B981'; break;
      case 'maths': brandColor = '#F59E0B'; break;
      case 'biology': brandColor = '#EF4444'; break;
    }
    
    const weight: "bold" | "600" = isActive ? "bold" : "600";
    
    return [
      styles.filterText, 
      { 
        color: isActive ? '#FFFFFF' : brandColor,
        fontWeight: weight
      }
    ];
  };

  const renderDeckItem = ({ item }: { item: Deck }) => {
    const isLoading = loadingDeckId === item.id;
    
    return (
      <TouchableOpacity 
        style={styles.deckCard}
        onPress={() => router.push(`/deck/${item.id}`)}
      >
        <Image 
          source={{ uri: item.coverImage || undefined }} 
          style={styles.deckImage}
        />
        <View style={styles.deckContent}>
          <View style={styles.deckInfo}>
            <Text style={styles.deckTitle}>{item.name}</Text>
            <Text style={styles.deckSubtitle}>{item.cardCount || 0} cards</Text>
            <View style={styles.tagsContainer}>
              {(item.tags || []).slice(0, 2).map(tag => (
                <View key={tag} style={styles.tagBadge}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
              {item.tags && item.tags.length > 2 && (
                <Text style={styles.moreTagsText}>+{item.tags.length - 2}</Text>
              )}
            </View>
            {item.areCardsLoaded && (
              <View style={styles.downloadedBadge}>
                <CheckCircle2 size={12} color={colors.primary} />
                <Text style={styles.downloadedText}>Downloaded</Text>
              </View>
            )}
          </View>
          <TouchableOpacity 
            style={[styles.studyButton, isLoading && styles.loadingButton]}
            onPress={(e) => {
              e.stopPropagation();
              handleStartStudy(item.id);
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="white" />
                <Text style={styles.studyButtonText}>Loading...</Text>
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
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Library</Text>
          <Text style={styles.subtitle}>Explore {filteredDecks.length} collections</Text>
        </View>
        <TouchableOpacity style={styles.searchIconButton} onPress={() => router.push("/search")}>
           <Search size={22} color={colors.textDark} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollFilterContainer}
        style={styles.filterScrollView}
      >
        <TouchableOpacity 
          style={[styles.filterButton, filterPremium === null && styles.activeFilterButton]}
          onPress={() => handleFilterPress('premium', null)}
        >
          <Text style={[styles.filterText, filterPremium === null && styles.activeFilterText]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, filterPremium === false && styles.activeFilterButton]}
          onPress={() => handleFilterPress('premium', false)}
        >
          <Text style={[styles.filterText, filterPremium === false && styles.activeFilterText]}>Free</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, filterPremium === true && styles.activeFilterButton]}
          onPress={() => handleFilterPress('premium', true)}
        >
          <Text style={[styles.filterText, filterPremium === true && styles.activeFilterText]}>Premium</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={getSubjectButtonStyle('physics')}
          onPress={() => handleFilterPress('subject', 'physics')}
        >
          <Text style={getSubjectTextStyle('physics')}>Physics</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={getSubjectButtonStyle('chemistry')}
          onPress={() => handleFilterPress('subject', 'chemistry')}
        >
          <Text style={getSubjectTextStyle('chemistry')}>Chemistry</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={getSubjectButtonStyle('maths')}
          onPress={() => handleFilterPress('subject', 'maths')}
        >
          <Text style={getSubjectTextStyle('maths')}>Maths</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={getSubjectButtonStyle('biology')}
          onPress={() => handleFilterPress('subject', 'biology')}
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No decks found</Text>
          </View>
        }
      />
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
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32, // More dominant header size
    fontWeight: "bold",
    color: colors.textDark,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textLight,
    marginTop: 4,
  },
  searchIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gray[100],
    justifyContent: "center",
    alignItems: "center",
  },
  filterScrollView: {
    marginBottom: 16,
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 44,
  },
  scrollFilterContainer: {
    paddingHorizontal: 20,
    paddingRight: 40,
    alignItems: 'center',
  },
  filterButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 999,
    marginRight: 12,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  activeFilterButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.textDark,
    fontWeight: "600",
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  activeFilterText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  listContainer: {
    padding: 20,
    paddingTop: 0,
  },
  deckCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  deckImage: {
    width: "100%",
    height: 120,
    backgroundColor: colors.gray[200],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
  loadingButton: {
    opacity: 0.8,
  },
  studyButtonText: {
    color: "white",
    marginLeft: 4,
    fontWeight: "500",
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  downloadedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  downloadedText: {
    fontSize: 12,
    color: colors.primary,
    marginLeft: 4,
    fontWeight: "500",
  },
});