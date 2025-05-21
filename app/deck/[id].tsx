import React, { useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, FlatList, Image, Alert } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { 
  BookOpen, 
  Edit, 
  Trash2, 
  Plus, 
  ChevronRight, 
  Tag,
  Clock,
  Share
} from "lucide-react-native";

import colors from "@/constants/colors";
import { useFlashcardStore } from "@/store/flashcard-store";
import { useUserStore } from "@/store/user-store";
import { Flashcard } from "@/types";

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const decks = useFlashcardStore(state => state.decks);
  const getFlashcardsForDeck = useFlashcardStore(state => state.getFlashcardsForDeck);
  const getDueFlashcardsForDeck = useFlashcardStore(state => state.getDueFlashcardsForDeck);
  const startStudySession = useFlashcardStore(state => state.startStudySession);
  const deleteDeck = useFlashcardStore(state => state.deleteDeck);
  
  const user = useUserStore(state => state.user);
  
  const deck = decks.find(d => d.id === id);
  const flashcards = getFlashcardsForDeck(id);
  const dueCards = getDueFlashcardsForDeck(id);
  
  const [showAll, setShowAll] = useState(false);
  
  if (!deck) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundText}>Deck not found</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  const displayedCards = showAll ? flashcards : flashcards.slice(0, 5);
  
  const handleStartStudy = () => {
    if (dueCards.length === 0) {
      Alert.alert(
        "No Cards Due",
        "There are no cards due for review. Would you like to study anyway?",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Study All",
            onPress: () => {
              startStudySession(id);
              router.push(`/study/${id}`);
            }
          }
        ]
      );
      return;
    }
    
    startStudySession(id);
    router.push(`/study/${id}`);
  };
  
  const handleDeleteDeck = () => {
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
          onPress: () => {
            deleteDeck(id);
            router.back();
          },
          style: "destructive"
        }
      ]
    );
  };
  
  const renderCardItem = ({ item }: { item: Flashcard }) => (
    <TouchableOpacity 
      style={styles.cardItem}
      onPress={() => router.push(`/card/${item.id}`)}
    >
      <View style={styles.cardContent}>
        <Text style={styles.cardFront} numberOfLines={2}>{item.front}</Text>
        <Text style={styles.cardBack} numberOfLines={1}>{item.back}</Text>
      </View>
      <ChevronRight size={20} color={colors.gray[400]} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen 
        options={{
          title: deck.name,
          headerRight: () => (
            <View style={styles.headerButtons}>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => router.push(`/deck/edit/${id}`)}
              >
                <Edit size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={handleDeleteDeck}
              >
                <Trash2 size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          ),
        }} 
      />
      
      <View style={styles.coverImageContainer}>
        <Image 
          source={{ uri: deck.coverImage }} 
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
            style={styles.primaryButton}
            onPress={handleStartStudy}
          >
            <Text style={styles.primaryButtonText}>Start Studying</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => router.push(`/deck/${id}/add-card`)}
          >
            <Plus size={20} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Add Card</Text>
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
            <FlatList
              data={displayedCards}
              renderItem={renderCardItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyCardsContainer}>
              <Text style={styles.emptyCardsText}>No cards in this deck</Text>
              <TouchableOpacity 
                style={styles.addCardButton}
                onPress={() => router.push(`/deck/${id}/add-card`)}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
});