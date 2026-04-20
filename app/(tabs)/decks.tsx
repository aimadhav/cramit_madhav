import React, { useState } from "react";
import { StyleSheet, View, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { Text } from "@/components/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Check, Zap, FunctionSquare, Lightbulb, Files, AlertCircle } from "lucide-react-native";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSequence, 
  withTiming, 
  withRepeat,
  interpolateColor
} from "react-native-reanimated";

import { useThemeColors } from "@/hooks/useThemeColors";
import { MOCK_CURRICULUM, MOCK_CONTENT_TYPES, MOCK_USER_STATS } from "@/constants/mockData";

const { width } = Dimensions.get('window');

type Subject = 'Physics' | 'Chem' | 'Maths';

export default function DecksScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [selectedSubject, setSelectedSubject] = useState<Subject>('Physics');
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);

  // Animation values - for very subtle suggestion
  const shakeSection1 = useSharedValue(0);
  const pulseSection1 = useSharedValue(0);

  const toggleContentType = (id: string) => {
    setSelectedContentTypes(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
    pulseSection1.value = withTiming(0);
  };

  const toggleChapter = (id: string) => {
    setSelectedChapters(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAllChapters = () => {
    const chapters = MOCK_CURRICULUM[selectedSubject].chapters;
    if (selectedChapters.length === chapters.length) {
      setSelectedChapters([]);
    } else {
      setSelectedChapters(chapters.map(c => c.id));
    }
  };

  const triggerSubtleSuggestion = () => {
    // Only if chapters are selected but content types are not
    if (selectedChapters.length > 0 && selectedContentTypes.length === 0) {
      // Snappier subtle shake
      shakeSection1.value = withSequence(
        withTiming(-6, { duration: 80 }),
        withRepeat(withTiming(6, { duration: 80 }), 3, true),
        withTiming(0, { duration: 80 })
      );
      // Subtle glow pulse
      pulseSection1.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 600 })
      );
    }
  };

  const handleStartPress = () => {
    if (isReady) {
      router.push(`/study/temp_123`);
    } else {
      triggerSubtleSuggestion();
    }
  };

  const animatedSection1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeSection1.value }],
    backgroundColor: interpolateColor(
      pulseSection1.value,
      [0, 1],
      ['rgba(11, 12, 14, 0)', 'rgba(94, 106, 210, 0.15)']
    ),
    borderRadius: 16,
  }));

  const currentChapters = MOCK_CURRICULUM[selectedSubject].chapters;
  const isReady = selectedChapters.length > 0 && selectedContentTypes.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header - Cleaned up */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>Quick Prep</Text>
              <Text style={styles.subtitle}>Ready to revise, {MOCK_USER_STATS.name}?</Text>
            </View>
            <View style={styles.cramModeBadge}>
              <Zap size={10} color="#5e6ad2" fill="#5e6ad2" />
              <Text style={styles.cramModeText}>CRAM MODE</Text>
            </View>
          </View>

          <View style={styles.segmentContainer}>
            {(['Physics', 'Chem', 'Maths'] as Subject[]).map((subj) => {
              const isActive = selectedSubject === subj;
              return (
                <TouchableOpacity 
                  key={subj}
                  style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
                  onPress={() => {
                    setSelectedSubject(subj);
                    setSelectedChapters([]);
                  }}
                >
                  <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>{subj}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Content Type Selector */}
        <Animated.View style={[styles.configPanel, animatedSection1Style]}>
          <Text style={styles.stepLabel}>1. SELECT CONTENT TYPE</Text>
          <View style={styles.chipsContainer}>
            {MOCK_CONTENT_TYPES.map((type) => {
              const isSelected = selectedContentTypes.includes(type.id);
              return (
                <TouchableOpacity 
                  key={type.id}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => toggleContentType(type.id)}
                >
                  {type.label === 'Formulas' && <FunctionSquare size={14} color={isSelected ? '#0b0c0e' : '#94969A'} />}
                  {type.label === 'Concepts' && <Lightbulb size={14} color={isSelected ? '#0b0c0e' : '#94969A'} />}
                  {type.label === 'PYQs' && <Files size={14} color={isSelected ? '#0b0c0e' : '#94969A'} />}
                  {type.label === 'Mistakes' && <AlertCircle size={14} color={isSelected ? '#0b0c0e' : '#94969A'} />}
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{type.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        <View style={styles.chapterHeader}>
          <Text style={styles.stepLabel}>2. SELECT CHAPTERS ({selectedChapters.length})</Text>
          <TouchableOpacity onPress={selectAllChapters}>
            <Text style={styles.selectAllText}>
              {selectedChapters.length === currentChapters.length ? "Deselect All" : "Select All"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.chapterList}>
          {currentChapters.map((chapter) => {
            const isSelected = selectedChapters.includes(chapter.id);
            return (
              <TouchableOpacity 
                key={chapter.id}
                activeOpacity={0.7}
                style={[styles.chapterRow, isSelected && styles.chapterRowSelected]}
                onPress={() => toggleChapter(chapter.id)}
              >
                <View style={styles.chapterInfo}>
                  <Text style={styles.chapterName}>{chapter.name}</Text>
                  <Text style={styles.chapterSub}>{chapter.subtitle}</Text>
                </View>
                <View style={[styles.customCheckbox, isSelected && styles.checkboxActive]}>
                  {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={4} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ height: 200 }} />
      </ScrollView>

      {/* Action Footer */}
      <View style={styles.actionFooter}>
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={handleStartPress}
          style={[styles.startBtn, !isReady && styles.startBtnDisabled]}
        >
          <Zap size={18} color={isReady ? "#FFFFFF" : "#5F6166"} fill={isReady ? "#FFFFFF" : "none"} />
          <Text style={[styles.startBtnText, !isReady && styles.startBtnTextDisabled]}>
            {isReady ? `Start Cramming • ${selectedChapters.length} Chps` : "Select Items to Start"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C0E',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: '#0B0C0E',
    gap: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#ECECEC',
  },
  subtitle: {
    fontSize: 12,
    color: '#94969A',
    fontFamily: 'Outfit_500Medium',
    marginTop: 2,
  },
  cramModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2125',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2C32',
    gap: 6,
  },
  cramModeText: {
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    color: '#94969A',
    letterSpacing: 1,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#1F2125',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: '#15171B',
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  segmentText: {
    color: '#94969A',
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    opacity: 0.6,
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    opacity: 1,
  },
  configPanel: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2C32',
    marginBottom: 16,
  },
  stepLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#5F6166',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#15171B',
    borderWidth: 1,
    borderColor: '#2A2C32',
    gap: 6,
  },
  chipActive: {
    backgroundColor: '#ECECEC',
    borderColor: '#ECECEC',
  },
  chipText: {
    color: '#94969A',
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
  },
  chipTextActive: {
    color: '#0B0C0E',
    fontFamily: 'Outfit_700Bold',
  },
  scrollContent: {
    paddingTop: 10,
  },
  chapterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  selectAllText: {
    fontSize: 9,
    fontFamily: 'Outfit_600SemiBold',
    color: '#5e6ad2',
  },
  chapterList: {
    gap: 8,
    paddingHorizontal: 24,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#0B0C0E',
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  chapterRowSelected: {
    backgroundColor: '#1E1B24',
    borderColor: 'rgba(94, 106, 210, 0.3)',
  },
  chapterInfo: {
    flex: 1,
  },
  chapterName: {
    color: '#ECECEC',
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
    marginBottom: 2,
  },
  chapterSub: {
    color: '#5F6166',
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
  },
  customCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#5F6166',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#5e6ad2',
    borderColor: '#5e6ad2',
  },
  actionFooter: {
    position: 'absolute',
    bottom: 110, 
    left: 20,
    right: 20,
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: '#5e6ad2',
    gap: 10,
    shadowColor: '#5e6ad2',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  startBtnDisabled: {
    backgroundColor: '#2A2C32',
  },
  startBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
  },
  startBtnTextDisabled: {
    color: '#5F6166',
  }
});