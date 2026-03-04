import React, { useState } from "react";
import { StyleSheet, View, TextInput, FlatList, TouchableOpacity, ScrollView } from "react-native";
import { Text } from "@/components/AppText";;
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Search as SearchIcon, X, Tag } from "lucide-react-native";

import { useThemeColors } from "@/hooks/useThemeColors";
import { useFlashcardStore } from "@/store/flashcard-store";
import { Flashcard, Deck } from "@/types";

type SearchResult = {
  id: string;
  type: 'deck' | 'card';
  title: string;
  subtitle: string;
  tags: string[];
};

export default function SearchScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  
  const decks = useFlashcardStore(state => state.decks);
  const flashcards = useFlashcardStore(state => state.flashcards);
  
  // Get all unique tags
  const allTags = Array.from(new Set([
    ...decks.flatMap(deck => deck.tags),
    ...flashcards.flatMap(card => card.tags)
  ])).sort();
  
  // Search logic
  const getSearchResults = (): SearchResult[] => {
    if (!searchQuery && !activeTag) return [];
    
    const results: SearchResult[] = [];
    
    // Search in decks
    decks.forEach(deck => {
      const matchesSearch = searchQuery && 
        (deck.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
         (deck.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false));
      
      const matchesTag = activeTag && deck.tags.includes(activeTag);
      
      if ((searchQuery && matchesSearch) || (activeTag && matchesTag)) {
        results.push({
          id: deck.id,
          type: 'deck',
          title: deck.name,
          subtitle: `${deck.cardCount} cards`,
          tags: deck.tags
        });
      }
    });
    
    // Search in flashcards
    flashcards.forEach(card => {
      const matchesSearch = searchQuery && 
        (card.front.toLowerCase().includes(searchQuery.toLowerCase()) || 
         card.back.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesTag = activeTag && card.tags.includes(activeTag);
      
      if ((searchQuery && matchesSearch) || (activeTag && matchesTag)) {
        // Find the deck this card belongs to
        const deck = decks.find(d => d.id === card.deckId);
        
        results.push({
          id: card.id,
          type: 'card',
          title: card.front,
          subtitle: deck ? `From: ${deck.name}` : '',
          tags: card.tags
        });
      }
    });
    
    return results;
  };
  
  const searchResults = getSearchResults();
  
  const handleResultPress = (result: SearchResult) => {
    if (result.type === 'deck') {
      router.push(`/deck/${result.id}`);
    } else {
      router.push(`/card/${result.id}`);
    }
  };
  
  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity 
      style={styles.resultItem}
      onPress={() => handleResultPress(item)}
    >
      <View style={styles.resultContent}>
        <Text style={styles.resultTitle}>{item.title}</Text>
        <Text style={styles.resultSubtitle}>{item.subtitle}</Text>
        <View style={styles.tagsContainer}>
          {(item.tags || []).slice(0, 3).map(tag => (
            <TouchableOpacity 
              key={tag} 
              style={styles.tagBadge}
              onPress={() => setActiveTag(tag)}
            >
              <Text style={styles.tagText}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={[
        styles.resultTypeBadge, 
        item.type === 'deck' ? styles.deckBadge : styles.cardBadge
      ]}>
        <Text style={styles.resultTypeText}>{item.type}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
      </View>
      
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <SearchIcon size={20} color={colors.gray[500]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search decks and cards..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.gray[500]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <X size={20} color={colors.gray[500]} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* Popular tags */}
      <View style={styles.tagsSection}>
        <View style={styles.tagsSectionHeader}>
          <Tag size={16} color={colors.textLight} />
          <Text style={styles.tagsSectionTitle}>Popular Tags</Text>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagsScrollContainer}
        >
          {allTags.map(tag => (
            <TouchableOpacity 
              key={tag}
              style={[
                styles.tagChip,
                activeTag === tag && styles.activeTagChip
              ]}
              onPress={() => setActiveTag(activeTag === tag ? null : tag)}
            >
              <Text style={[
                styles.tagChipText,
                activeTag === tag && styles.activeTagChipText
              ]}>{tag}</Text>
              {activeTag === tag && (
                <X size={14} color="white" style={styles.tagChipIcon} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {/* Results */}
      <FlatList
        data={searchResults}
        renderItem={renderSearchResult}
        keyExtractor={item => `${item.type}-${item.id}`}
        contentContainerStyle={styles.resultsContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery || activeTag 
                ? "No results found" 
                : "Search for decks and cards"}
            </Text>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.textDark,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.gray[100],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: colors.textDark,
  },
  tagsSection: {
    marginBottom: 16,
  },
  tagsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  tagsSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textDark,
    marginLeft: 8,
  },
  tagsScrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  tagChip: {
    backgroundColor: colors.gray[200],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  activeTagChip: {
    backgroundColor: colors.primary,
  },
  tagChipText: {
    fontSize: 14,
    color: colors.textDark,
  },
  activeTagChipText: {
    color: "white",
  },
  tagChipIcon: {
    marginLeft: 4,
  },
  resultsContainer: {
    padding: 20,
  },
  resultItem: {
    backgroundColor: colors.gray[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textDark,
  },
  resultSubtitle: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 4,
  },
  tagsContainer: {
    flexDirection: "row",
    marginTop: 8,
    flexWrap: "wrap",
  },
  tagBadge: {
    backgroundColor: colors.gray[200],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 6,
  },
  tagText: {
    fontSize: 12,
    color: colors.textDark,
  },
  resultTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginLeft: 8,
  },
  deckBadge: {
    backgroundColor: colors.primary,
  },
  cardBadge: {
    backgroundColor: colors.secondary,
  },
  resultTypeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "white",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textLight,
  },
});