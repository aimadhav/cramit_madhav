import React, { useState, useMemo, useEffect } from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useThemeColors } from "@/hooks/useThemeColors";
import { useUserStore } from "@/store/user-store";
import { useFlashcardStore } from "@/store/flashcard-store";

import { CramHeader } from "@/components/CramHeader";
import { CramFilters } from "@/components/CramFilters";
import { CramChapterList } from "@/components/CramChapterList";
import { CramActionFooter } from "@/components/CramActionFooter";
import { UnifiedAlertModal } from "@/components/UnifiedAlertModal";

const EXAM_SUBJECTS: Record<string, string[]> = {
  'JEE': ['Physics', 'Chemistry', 'Mathematics'],
  'NEET': ['Physics', 'Chemistry', 'Biology'],
  'Computer Science': ['DSA', 'DBMS', 'Operating Systems', 'OOP', 'Computer Networks']
};

export default function DecksScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const { user } = useUserStore();
  const userFocus = user?.prepFocus || 'JEE';
  const subjects = useMemo(() => EXAM_SUBJECTS[userFocus] || EXAM_SUBJECTS['JEE'], [userFocus]);

  const [selectedSubject, setSelectedSubject] = useState<string>(subjects[0] || 'Physics');
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [isLaunching, setIsLaunching] = useState(false);
  const [downloadingChapterId, setDownloadingChapterId] = useState<string | null>(null);
  const [localSubjectCards, setLocalSubjectCards] = useState<any[]>([]);

  const decks = useFlashcardStore(state => state.decks);
  const userId = user?.id || 'local';

  // Real SQLite chapters (decks) filtered for the selected subject
  const chapters = useMemo(() => {
    return decks.filter(d => 
      d.subject && d.subject.toLowerCase() === selectedSubject.toLowerCase()
    );
  }, [decks, selectedSubject]);

  const loadLocalCards = async () => {
    try {
      const { db } = require('@/db');
      const { eq, and, inArray } = require('drizzle-orm');
      const { flashcards, userFlashcardStatus } = require('@/db/schema');

      const chapIds = chapters.map(c => c.id);
      if (chapIds.length === 0) {
        setLocalSubjectCards([]);
        return;
      }

      const cards = await db.select({
        card: flashcards,
        status: userFlashcardStatus
      })
      .from(flashcards)
      .leftJoin(
        userFlashcardStatus, 
        and(
          eq(flashcards.id, userFlashcardStatus.flashcardId),
          eq(userFlashcardStatus.userId, userId)
        )
      )
      .where(inArray(flashcards.deckId, chapIds));
      

      setLocalSubjectCards(cards);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadLocalCards();
  }, [selectedSubject, decks]);

  // Reset selected chapters when subject changes
  useEffect(() => {
    setSelectedChapters([]);
  }, [selectedSubject]);

  const getFilteredCardCount = (chapterId: string) => {
    if (selectedContentTypes.length === 0) {
      const chap = chapters.find(c => c.id === chapterId);
      return chap?.cardCount || 0;
    }

    const chapterCards = localSubjectCards.filter(c => c.card.deckId === chapterId);
    
    const filtered = chapterCards.filter((c: any) => {
      let matchesAtLeastOne = false;

      let cardTags: string[] = [];
      try {
        cardTags = c.card.tags ? (typeof c.card.tags === 'string' ? JSON.parse(c.card.tags) : c.card.tags) : [];
        cardTags = Array.isArray(cardTags) ? cardTags.map((t: string) => String(t).toLowerCase()) : [];
      } catch {
        cardTags = [];
      }

      if (selectedContentTypes.includes('ct1')) {
        if (cardTags.includes('formula') || cardTags.includes('formulas') || cardTags.includes('formulae')) {
          matchesAtLeastOne = true;
        } else {
          try {
            const frontText = String(c.card.frontContent).toLowerCase();
            const backText = String(c.card.backContent).toLowerCase();
            if (frontText.includes('formula') || backText.includes('formula')) {
              matchesAtLeastOne = true;
            }
          } catch {}
        }
      }

      if (selectedContentTypes.includes('ct2')) {
        if (cardTags.includes('concept') || cardTags.includes('concepts')) {
          matchesAtLeastOne = true;
        } else {
          try {
            const frontText = String(c.card.frontContent).toLowerCase();
            const backText = String(c.card.backContent).toLowerCase();
            if (frontText.includes('concept') || backText.includes('concept')) {
              matchesAtLeastOne = true;
            }
          } catch {}
        }
      }

      if (selectedContentTypes.includes('ct3')) {
        if (cardTags.includes('pyq') || cardTags.includes('pyqs')) {
          matchesAtLeastOne = true;
        } else {
          try {
            const frontText = String(c.card.frontContent).toLowerCase();
            const backText = String(c.card.backContent).toLowerCase();
            if (frontText.includes('pyq') || frontText.includes('pyq') || frontText.includes('question') || frontText.includes('question')) {
              matchesAtLeastOne = true;
            }
          } catch {}
        }
      }

      if (selectedContentTypes.includes('ct4')) {
        const status = c.status;
        if (status && ((status.leftSwipes > status.rightSwipes) || status.lastSwipeDirection === 'left')) {
          matchesAtLeastOne = true;
        }
      }

      return matchesAtLeastOne;
    });

    return filtered.length;
  };

  const toggleContentType = (id: string) => {
    setSelectedContentTypes(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleChapter = (id: string) => {
    setSelectedChapters(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAllChapters = () => {
    if (selectedChapters.length === chapters.length) {
      setSelectedChapters([]);
    } else {
      setSelectedChapters(chapters.map(c => c.id));
    }
  };

  const handleStartPress = async () => {
    if (selectedChapters.length === 0) {
      showCustomAlert("Selection Required", "Please select at least one chapter to start your custom cram session.", "info");
      return;
    }

    setIsLaunching(true);
    try {
      const { db } = require('@/db');
      const { eq, and, inArray } = require('drizzle-orm');
      const { flashcards, userFlashcardStatus } = require('@/db/schema');

      console.log(`📡 [Cram Mode] Fetching cards for chapters:`, selectedChapters);
      
      // 1. Fetch all cards for the selected chapters
      const cardsWithStatus = await db.select({
        card: flashcards,
        status: userFlashcardStatus
      })
      .from(flashcards)
      .leftJoin(
        userFlashcardStatus, 
        and(
          eq(flashcards.id, userFlashcardStatus.flashcardId),
          eq(userFlashcardStatus.userId, userId)
        )
      )
      .where(inArray(flashcards.deckId, selectedChapters));
        console.log('startingStability check:', cardsWithStatus[0]?.card.startingStability, typeof cardsWithStatus[0]?.card.startingStability)
      

      if (cardsWithStatus.length === 0) {
        showCustomAlert("No Content", "The selected chapters do not have any cards yet.", "warning");
        return;
      }

      // 2. Filter dynamically based on multi-selected content types (OR union operation)
      let filtered = cardsWithStatus;

      if (selectedContentTypes.length > 0) {
        filtered = cardsWithStatus.filter((c: any) => {
          let matchesAtLeastOne = false;

          // Parse tags array safely from SQLite card row
          let cardTags: string[] = [];
          try {
            cardTags = c.card.tags ? (typeof c.card.tags === 'string' ? JSON.parse(c.card.tags) : c.card.tags) : [];
            cardTags = Array.isArray(cardTags) ? cardTags.map((t: string) => String(t).toLowerCase()) : [];
          } catch {
            cardTags = [];
          }

          // Filter Formulas (ct1) - Check tags first, then fallback to content keywords
          if (selectedContentTypes.includes('ct1')) {
            if (cardTags.includes('formula') || cardTags.includes('formulas') || cardTags.includes('formulae')) {
              matchesAtLeastOne = true;
            } else {
              try {
                const frontText = String(c.card.frontContent).toLowerCase();
                const backText = String(c.card.backContent).toLowerCase();
                if (frontText.includes('formula') || backText.includes('formula')) {
                  matchesAtLeastOne = true;
                }
              } catch {}
            }
          }

          // Filter Concepts (ct2) - Check tags first, then fallback to content keywords
          if (selectedContentTypes.includes('ct2')) {
            if (cardTags.includes('concept') || cardTags.includes('concepts')) {
              matchesAtLeastOne = true;
            } else {
              try {
                const frontText = String(c.card.frontContent).toLowerCase();
                const backText = String(c.card.backContent).toLowerCase();
                if (frontText.includes('concept') || backText.includes('concept')) {
                  matchesAtLeastOne = true;
                }
              } catch {}
            }
          }

          // Filter PYQs (ct3) - Check tags first, then fallback to content keywords
          if (selectedContentTypes.includes('ct3')) {
            if (cardTags.includes('pyq') || cardTags.includes('pyqs')) {
              matchesAtLeastOne = true;
            } else {
              try {
                const frontText = String(c.card.frontContent).toLowerCase();
                const backText = String(c.card.backContent).toLowerCase();
                if (frontText.includes('pyq') || backText.includes('pyq') || frontText.includes('question') || backText.includes('question')) {
                  matchesAtLeastOne = true;
                }
              } catch {}
            }
          }

          // Filter Mistakes (ct4)
          if (selectedContentTypes.includes('ct4')) {
            const status = c.status;
            if (status && ((status.leftSwipes > status.rightSwipes) || status.lastSwipeDirection === 'left')) {
              matchesAtLeastOne = true;
            }
          }

          return matchesAtLeastOne;
        });
      }

      if (filtered.length === 0) {
        showCustomAlert("No Match", "No cards match your selected filters inside these chapters.", "warning");
        return;
      }

        

      // 3. Sort by FSRS stability ASC (weakest memory first, putting new cards last)
          filtered.sort((a: any, b: any) => {
        const stabA = a.status?.stability ?? a.card.startingStability ?? 999;
        const stabB = b.status?.stability ?? b.card.startingStability ?? 999;
        return stabA - stabB;
      });

      const queue = filtered.map((c: any) => c.card.id);

      // Start session with Cram flag = true
      await useFlashcardStore.getState().startStudySession(selectedSubject, true, queue);
      router.push(`/study/${selectedSubject}?cram=true`);
    } catch (e: any) {
      console.error(e);
      showCustomAlert("Error", "Could not compile cram session.", "error");
    } finally {
      setIsLaunching(false);
    }
  };

  const handleDownloadChapter = async (chapId: string) => {
    const { SyncService } = require('@/services/sync-service');
    const NetInfo = require('@react-native-community/netinfo');
    
    const state = await NetInfo.fetch();
    const isOnline = state.isConnected && state.isInternetReachable !== false;

    if (!isOnline) {
      showCustomAlert("Connection Required", "An active internet connection is required to download chapter flashcards for offline use. Please turn on Wi-Fi or mobile data.", "warning");
      return;
    }

    setDownloadingChapterId(chapId);
    try {
      console.log(`📡 [Cram] Downloading chapter on-demand: ${chapId}`);
      const success = await SyncService.downloadDeckContent(chapId);
      if (success) {
        await useFlashcardStore.getState().loadDecks();
      } else {
        showCustomAlert("Download Failed", "Could not download flashcards. Please try again.", "error");
      }
    } catch (e) {
      console.error(e);
      showCustomAlert("Download Error", "An error occurred during chapter download.", "error");
    } finally {
      setDownloadingChapterId(null);
    }
  };

  // Unified Custom Alert Modal State
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'warning' | 'error' | 'info';
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showCustomAlert = (title: string, message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    setAlertConfig({
      visible: true,
      title,
      message,
      type
    });
  };

  const isReady = selectedChapters.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <CramActionFooter
        selectedChaptersCount={selectedChapters.length}
        isReady={isReady}
        isLaunching={isLaunching}
        onStartPress={handleStartPress}
      />

      <ScrollView 
        style={styles.mainScrollView}
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        <CramHeader
          subjects={subjects}
          selectedSubject={selectedSubject}
          onSelectSubject={setSelectedSubject}
        />

        <CramFilters
          selectedContentTypes={selectedContentTypes}
          onToggleContentType={toggleContentType}
        />

        <CramChapterList
          chapters={chapters}
          selectedChapters={selectedChapters}
          downloadingChapterId={downloadingChapterId}
          onToggleChapter={toggleChapter}
          onSelectAllChapters={selectAllChapters}
          onDownloadChapter={handleDownloadChapter}
          getFilteredCardCount={getFilteredCardCount}
        />
        
        <View style={{ height: 200 }} />
      </ScrollView>

      <UnifiedAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />

    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C0E',
  },
  mainScrollView: {
    width: '100%',
  },
  scrollContent: {
    paddingTop: 10,
  },
});
