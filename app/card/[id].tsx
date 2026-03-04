import React from "react";
import { StyleSheet, View, TouchableOpacity, Image, ScrollView } from "react-native";
import { Text } from "@/components/AppText";;
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bookmark } from "lucide-react-native";

import { useThemeColors } from "@/hooks/useThemeColors";
import { useFlashcardStore } from "@/store/flashcard-store";
import { extractLatex } from "@/utils/latex-renderer";
import WebViewLatexBlock from "@/components/WebViewLatexBlock";

export default function CardDetailScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const flashcards = useFlashcardStore(state => state.flashcards);
  const toggleBookmark = useFlashcardStore(state => state.toggleBookmark);
  
  const card = flashcards.find(c => c.id === id);

  if (!card) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Card not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const frontContent = extractLatex(card.front);
  const backContent = extractLatex(card.back);

  const handleToggleBookmark = async () => {
    try {
      await toggleBookmark(card.id);
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <Stack.Screen
        options={{
          title: 'Card Details',
          headerShown: true,
          headerTintColor: colors.textDark,
          headerRight: () => (
            <TouchableOpacity onPress={handleToggleBookmark} style={styles.headerButton}>
              <Bookmark
                size={24}
                color={card.isBookmarked ? colors.primary : colors.gray[400]}
                fill={card.isBookmarked ? colors.primary : 'none'}
              />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Front */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FRONT</Text>
          <View style={styles.contentCard}>
            {frontContent.map((part, index) => (
              part.type === 'latex' ? (
                <WebViewLatexBlock key={index} latex={part.content} />
              ) : (
                <Text key={index} style={styles.contentText}>{part.content}</Text>
              )
            ))}
            {card.mediaUrls && card.mediaUrls[0] && (
              <Image
                source={{ uri: card.mediaUrls[0] }}
                style={styles.cardImage}
                resizeMode="contain"
              />
            )}
          </View>
        </View>

        {/* Back */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BACK</Text>
          <View style={styles.contentCard}>
            {backContent.map((part, index) => (
              part.type === 'latex' ? (
                <WebViewLatexBlock key={index} latex={part.content} />
              ) : (
                <Text key={index} style={styles.contentText}>{part.content}</Text>
              )
            ))}
            {card.mediaUrls && card.mediaUrls[1] && (
              <Image
                source={{ uri: card.mediaUrls[1] }}
                style={styles.cardImage}
                resizeMode="contain"
              />
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>STUDY STATS</Text>
          <View style={styles.statsCard}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Interval</Text>
              <Text style={styles.statValue}>{card.interval} days</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Repetitions</Text>
              <Text style={styles.statValue}>{card.repetitions}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Due Date</Text>
              <Text style={styles.statValue}>
                {new Date(card.dueDate).toLocaleDateString()}
              </Text>
            </View>
            {card.lastReviewed && (
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Last Reviewed</Text>
                <Text style={styles.statValue}>
                  {new Date(card.lastReviewed).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Tags */}
        {card.tags && card.tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TAGS</Text>
            <View style={styles.tagsContainer}>
              {card.tags.map(tag => (
                <View key={tag} style={styles.tagBadge}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
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
    padding: 20,
  },
  headerButton: {
    padding: 8,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.gray[500],
    letterSpacing: 1,
    marginBottom: 12,
  },
  contentCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contentText: {
    fontSize: 18,
    color: colors.textDark,
    lineHeight: 28,
  },
  cardImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 16,
  },
  statsCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  statLabel: {
    fontSize: 14,
    color: colors.textLight,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagBadge: {
    backgroundColor: colors.gray[200],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 14,
    color: colors.textDark,
  },
});