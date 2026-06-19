import React from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from './AppText';
import { Check } from 'lucide-react-native';

interface CramChapterListProps {
  chapters: any[];
  selectedChapters: string[];
  downloadingChapterId: string | null;
  onToggleChapter: (id: string) => void;
  onSelectAllChapters: () => void;
  onDownloadChapter: (id: string) => void;
  getFilteredCardCount: (id: string) => number;
}

export const CramChapterList: React.FC<CramChapterListProps> = ({
  chapters,
  selectedChapters,
  downloadingChapterId,
  onToggleChapter,
  onSelectAllChapters,
  onDownloadChapter,
  getFilteredCardCount,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.chapterHeader}>
        <Text style={styles.stepLabel}>2. SELECT CHAPTERS ({selectedChapters.length})</Text>
        {chapters.length > 0 && (
          <TouchableOpacity onPress={onSelectAllChapters}>
            <Text style={styles.selectAllText}>
              {selectedChapters.length === chapters.length ? "Deselect All" : "Select All"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.chapterList}>
        {chapters.length > 0 ? (
          chapters.map((chapter) => {
            const isSelected = selectedChapters.includes(chapter.id);
            const isDownloaded = chapter.cardCount > 0;
            
            return (
              <TouchableOpacity 
                key={chapter.id}
                activeOpacity={0.7}
                style={[
                  styles.chapterRow, 
                  isSelected && styles.chapterRowSelected,
                  !isDownloaded && { opacity: 0.8 }
                ]}
                disabled={!isDownloaded}
                onPress={() => onToggleChapter(chapter.id)}
              >
                <View style={styles.chapterInfo}>
                  <Text style={styles.chapterName}>{chapter.name}</Text>
                  {isDownloaded && (
                    <Text style={styles.chapterSub}>{getFilteredCardCount(chapter.id)} cards</Text>
                  )}
                </View>
                
                {isDownloaded ? (
                  <View style={[styles.customCheckbox, isSelected && styles.checkboxActive]}>
                    {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={4} />}
                  </View>
                ) : downloadingChapterId === chapter.id ? (
                  <ActivityIndicator size="small" color="#5e6ad2" />
                ) : (
                  <TouchableOpacity 
                    style={styles.inlineLoadBtn} 
                    onPress={() => onDownloadChapter(chapter.id)}
                  >
                    <Text style={styles.inlineLoadBtnText}>Load</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No chapters available.</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  chapterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  stepLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#5F6166',
    letterSpacing: 1.5,
  },
  selectAllText: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    color: '#5e6ad2',
  },
  chapterList: {
    gap: 8,
    paddingHorizontal: 20,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#15171B',
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  chapterRowSelected: {
    backgroundColor: '#1E1B24',
    borderColor: 'rgba(94, 106, 210, 0.3)',
  },
  chapterInfo: {
    flex: 1,
    paddingRight: 10,
  },
  chapterName: {
    color: '#ECECEC',
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
    marginBottom: 2,
    lineHeight: 18,
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#5F6166',
    fontFamily: 'Outfit_500Medium',
  },
  inlineLoadBtn: {
    backgroundColor: '#5e6ad220',
    borderColor: '#5e6ad250',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  inlineLoadBtnText: {
    color: '#5e6ad2',
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
  },
});
