import React, { useState } from "react";
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { BookOpen, Plus, Filter } from "lucide-react-native";

import colors from "@/constants/colors";
import { useFlashcardStore } from "@/store/flashcard-store";
import { Deck } from "@/types";

export default function DecksScreen() {
  const router = useRouter();
  const decks = useFlashcardStore(state => state.decks);
  const startStudySession = useFlashcardStore(state => state.startStudySession);
  const [filterPremium, setFilterPremium] = useState<boolean | null>(null);

  const filteredDecks = filterPremium !== null 
    ? decks.filter(deck => deck.isPremium === filterPremium)
    : decks;

  const handleStartStudy = (deckId: string) => {
    startStudySession(deckId);
    router.push(`/study/${deckId}`);
  };

  const renderDeckItem = ({ item }: { item: Deck }) => (
    <TouchableOpacity 
      style={styles.deckCard}
      onPress={() => router.push(`/deck/${item.id}`)}
    >
      <Image 
        source={{ uri: item.coverImage }} 
        style={styles.deckImage}
      />
      <View style={styles.deckContent}>
        <View style={styles.deckInfo}>
          <Text style={styles.deckTitle}>{item.name}</Text>
          <Text style={styles.deckSubtitle}>{item.cardCount} cards</Text>
          <View style={styles.tagsContainer}>
            {item.tags.slice(0, 2).map(tag => (
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
          style={styles.studyButton}
          onPress={(e) => {
            e.stopPropagation();
            handleStartStudy(item.id);
          }}
        >
          <BookOpen size={16} color="white" />
          <Text style={styles.studyButtonText}>Study</Text>
        </TouchableOpacity>
      </View>
      {item.isPremium && (
        <View style={styles.premiumBadge}>
          <Text style={styles.premiumText}>PRO</Text>
        </View>
      )}
    </TouchableOpacity>
  );

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

      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[
            styles.filterButton, 
            filterPremium === null && styles.activeFilterButton
          ]}
          onPress={() => setFilterPremium(null)}
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
          onPress={() => setFilterPremium(false)}
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
          onPress={() => setFilterPremium(true)}
        >
          <Text style={[
            styles.filterText,
            filterPremium === true && styles.activeFilterText
          ]}>Premium</Text>
        </TouchableOpacity>
      </View>

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
    paddingVertical: 16,
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
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: colors.gray[100],
  },
  activeFilterButton: {
    backgroundColor: colors.primary,
  },
  filterText: {
    color: colors.textDark,
    fontWeight: "500",
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
    fontWeight: "600",
    marginLeft: 6,
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