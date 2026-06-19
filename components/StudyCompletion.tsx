import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from './AppText';
import { Plus, Play, AlertCircle, Award } from 'lucide-react-native';

interface StudyCompletionProps {
  onExit: () => void;
  backlogCount?: number;
  completedChapterName?: string | null;
  onStartBacklog?: () => void;
  onAddChapters?: () => void;
}

export const StudyCompletion: React.FC<StudyCompletionProps> = ({
  onExit,
  backlogCount = 0,
  completedChapterName = null,
  onStartBacklog,
  onAddChapters,
}) => {
  return (
    <View style={styles.completionContainer}>
      <Text style={styles.celebrationEmoji}>🎯</Text>
      <Text style={styles.celebrationTitle}>Session Complete!</Text>
      <Text style={styles.celebrationSubtitle}>
        Great job! You're making steady progress today.
      </Text>

      {/* Chapter Completed Prompt */}
      {completedChapterName && onAddChapters && (
        <View style={styles.promptBox}>
          <Award size={20} color="#8E96FF" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.promptTitle}>Chapter Completed! 🎉</Text>
            <Text style={styles.promptSub}>
              You've fully introduced all cards in "{completedChapterName}". Add a new chapter to keep learning new material!
            </Text>
          </View>
          <TouchableOpacity style={styles.promptBtn} onPress={onAddChapters}>
            <Plus size={14} color="#000000" strokeWidth={3} />
            <Text style={styles.promptBtnText}>Add Chapter</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Backlog Prompt */}
      {backlogCount > 0 && onStartBacklog && (
        <View style={[styles.promptBox, styles.backlogBox]}>
          <AlertCircle size={20} color="#d2995e" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.promptTitle, { color: '#d2995e' }]}>Backlog Remaining 🧭</Text>
            <Text style={styles.promptSub}>
              You have {backlogCount} overdue cards. Would you like to review {Math.min(30, backlogCount)} of them now?
            </Text>
          </View>
          <TouchableOpacity style={[styles.promptBtn, styles.backlogBtn]} onPress={onStartBacklog}>
            <Play size={12} color="#000000" fill="#000000" />
            <Text style={styles.promptBtnText}>Review Now</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.completionButton} onPress={onExit}>
        <Text style={styles.completionButtonText}>Finish Session</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  completionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#000',
  },
  celebrationEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  celebrationTitle: {
    fontSize: 28,
    fontFamily: 'Outfit_700Bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  celebrationSubtitle: {
    fontSize: 15,
    color: '#94969a',
    textAlign: 'center',
    marginBottom: 35,
    fontFamily: 'Outfit_500Medium',
  },
  promptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(142, 150, 255, 0.08)',
    borderColor: 'rgba(142, 150, 255, 0.2)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    width: '100%',
  },
  promptTitle: {
    color: '#8E96FF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    marginBottom: 4,
  },
  promptSub: {
    color: '#94969a',
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    lineHeight: 18,
  },
  promptBtn: {
    backgroundColor: '#8E96FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 10,
  },
  promptBtnText: {
    color: '#000000',
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
  },
  backlogBox: {
    backgroundColor: 'rgba(210, 153, 94, 0.08)',
    borderColor: 'rgba(210, 153, 94, 0.2)',
  },
  backlogBtn: {
    backgroundColor: '#d2995e',
  },
  completionButton: {
    backgroundColor: '#5e6ad2',
    paddingVertical: 18,
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  completionButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
});
