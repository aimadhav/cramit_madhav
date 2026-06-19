import React from 'react';
import { Modal, View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from './AppText';
import { Check, X, Lock } from 'lucide-react-native';

interface SubjectConfigModalProps {
  visible: boolean;
  modalSubject: string | null;
  selectedChapters: string[];
  decks: any[];
  downloadingChapterId: string | null;
  onClose: () => void;
  onSave: () => void;
  setSelectedChapters: React.Dispatch<React.SetStateAction<string[]>>;
  onDownloadChapter: (chapId: string) => Promise<void>;
  onShowCustomAlert: (title: string, message: string, type: 'success' | 'warning' | 'error' | 'info') => void;
  subjects?: string[];
  onSubjectChange?: (newSubject: string) => void;
  lockedChapterIds?: string[];
  completedChapterIds?: string[];
}

export const SubjectConfigModal: React.FC<SubjectConfigModalProps> = ({
  visible,
  modalSubject,
  selectedChapters,
  decks,
  downloadingChapterId,
  onClose,
  onSave,
  setSelectedChapters,
  onDownloadChapter,
  onShowCustomAlert,
  subjects = [],
  onSubjectChange,
  lockedChapterIds = [],
  completedChapterIds = [],
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose Active Chapters</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <X size={20} color="#94969a" />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSubtitle}>
            Select up to 3 chapters to study.
          </Text>

          {/* Subjects Tab Selector */}
          {subjects && subjects.length > 0 && onSubjectChange && (
            <View style={styles.tabContainer}>
              {subjects.map((subj) => {
                const isActive = modalSubject === subj;
                return (
                  <TouchableOpacity
                    key={subj}
                    style={[styles.tabButton, isActive && styles.tabButtonActive]}
                    onPress={() => onSubjectChange(subj)}
                  >
                    <Text 
                      style={[styles.tabText, isActive && styles.tabTextActive]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {subj}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <ScrollView style={{ height: 200, marginBottom: 20 }} showsVerticalScrollIndicator={false}>
            {modalSubject && decks
              .filter(d => d.subject && d.subject.toLowerCase() === modalSubject.toLowerCase())
              .map((chap) => {
                const isChecked = selectedChapters.includes(chap.id);
                const isDownloaded = chap.cardCount > 0;
                const isCompleted = completedChapterIds.includes(chap.id);
                const isLocked = lockedChapterIds.includes(chap.id) || isCompleted;
                
                return (
                  <TouchableOpacity 
                    key={chap.id}
                    style={[
                      styles.chapterRow, 
                      isChecked && styles.chapterRowSelected,
                      isCompleted && styles.chapterRowCompleted,
                      isLocked && !isCompleted && styles.chapterRowLocked,
                      !isDownloaded && { opacity: 0.8 }
                    ]}
                    disabled={!isDownloaded}
                    onPress={() => {
                      if (isLocked) {
                        if (isCompleted) {
                          onShowCustomAlert(
                            "Chapter Completed", 
                            "This chapter is fully completed. Its cards are already active in your reviews queue automatically!", 
                            "info"
                          );
                        } else {
                          onShowCustomAlert(
                            "Chapter Locked", 
                            "This chapter is currently active and cards are being studied, so it cannot be disabled.", 
                            "warning"
                          );
                        }
                        return;
                      }
                      if (isChecked) {
                        setSelectedChapters(prev => prev.filter(id => id !== chap.id));
                      } else {
                        if (selectedChapters.length >= 3) {
                          onShowCustomAlert(
                            "Limit Reached", 
                            "You can select up to 3 chapters to study at a time.", 
                            "warning"
                          );
                          return;
                        }
                        setSelectedChapters(prev => [...prev, chap.id]);
                      }
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.chapterRowName}>{chap.name}</Text>
                      {isDownloaded && (
                        <Text style={[styles.chapterRowSub, isCompleted && { color: '#5F6166' }]}>
                          {chap.cardCount} cards {isCompleted && '• Completed'}
                        </Text>
                      )}
                    </View>
                    
                    {isCompleted ? (
                      <View style={[styles.customCheckbox, styles.checkboxCompleted, { backgroundColor: '#15171b' }]}>
                        <Check size={12} color="#5F6166" strokeWidth={4} />
                      </View>
                    ) : isLocked ? (
                      <View style={[styles.customCheckbox, styles.checkboxLocked]}>
                        <Lock size={10} color="#94969a" />
                      </View>
                    ) : isDownloaded ? (
                      <View style={[styles.customCheckbox, isChecked && styles.checkboxActive]}>
                        {isChecked && <Check size={12} color="#FFFFFF" strokeWidth={4} />}
                      </View>
                    ) : downloadingChapterId === chap.id ? (
                      <ActivityIndicator size="small" color="#5e6ad2" />
                    ) : (
                      <TouchableOpacity 
                        style={styles.inlineLoadBtn} 
                        onPress={() => onDownloadChapter(chap.id)}
                      >
                        <Text style={styles.inlineLoadBtnText}>Load</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })
            }
          </ScrollView>

          <TouchableOpacity style={styles.saveModalBtn} onPress={onSave}>
            <Text style={styles.saveModalBtnText}>Save Preferences</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#15171b',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    backgroundColor: '#1F2125',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#5e6ad2',
  },
  tabText: {
    color: '#94969a',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  modalSubtitle: {
    color: '#94969a',
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    marginBottom: 20,
    lineHeight: 18,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1F2125',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#1F2125',
    borderWidth: 1,
    borderColor: '#2A2C32',
    marginBottom: 8,
  },
  chapterRowSelected: {
    backgroundColor: 'rgba(94, 106, 210, 0.1)',
    borderColor: 'rgba(94, 106, 210, 0.3)',
  },
  chapterRowLocked: {
    backgroundColor: '#121318',
    borderColor: '#2A2C32',
    opacity: 0.65,
  },
  chapterRowCompleted: {
    backgroundColor: '#121318',
    borderColor: '#1F2125',
    opacity: 0.6,
  },
  chapterRowName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
    marginBottom: 2,
  },
  chapterRowSub: {
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
  checkboxLocked: {
    backgroundColor: '#1E2125',
    borderColor: '#2A2C32',
  },
  checkboxCompleted: {
    backgroundColor: '#1E2125',
    borderColor: '#2A2C32',
  },
  saveModalBtn: {
    backgroundColor: '#5e6ad2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveModalBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
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
  }
});
