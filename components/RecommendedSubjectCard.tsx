import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from './AppText';
import { Play, Brain, Clock, CreditCard as Cards, Check, Plus, AlertCircle, Info } from 'lucide-react-native';

interface SubjectStats {
  subjectName: string;
  chapters: any[];
  activeChaptersList: any[];
  activeIds: string[];
  totalCards: number;
  dueCount: number;
  newCount: number;
  totalSession: number;
  backlogCount: number;
  nextChapterName?: string;
}

interface RecommendedSubjectCardProps {
  topSubject: SubjectStats | null;
  isLaunchingSession: boolean;
  userFocus: string;
  onStartSession: (subject: string, isBacklog?: boolean) => Promise<void>;
  onConfigureChapters: (subject: string, currentlyActive: string[]) => void;
  onShowActiveChaptersInfo: (subjectName: string, activeIds: string[]) => void;
  getSubjectIcon: (subject: string, size?: number, color?: string) => React.ReactNode;
}

export const RecommendedSubjectCard: React.FC<RecommendedSubjectCardProps> = ({
  topSubject,
  isLaunchingSession,
  userFocus,
  onStartSession,
  onConfigureChapters,
  onShowActiveChaptersInfo,
  getSubjectIcon,
}) => {
  if (!topSubject) {
    return (
      <View style={styles.recommendedCard}>
         <Text style={styles.recommendedTitle}>No Decks Found</Text>
         <Text style={styles.recommendedSubtitle}>Check back later or subscribe to decks for {userFocus}.</Text>
      </View>
    );
  }

  const hasActiveChapters = topSubject.activeIds.length > 0;
  const isComplete = topSubject.totalSession === 0;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>RECOMMENDED NOW</Text>
      <TouchableOpacity 
        activeOpacity={0.9}
        onPress={() => {
          if (hasActiveChapters && !isComplete) {
            onStartSession(topSubject.subjectName);
          } else {
            onConfigureChapters(topSubject.subjectName, topSubject.activeIds);
          }
        }}
      >
        <View style={styles.recommendedCard}>
          <View style={styles.recommendedHeader}>
            <View style={[styles.priorityBadge, !hasActiveChapters && { backgroundColor: '#1F2125', borderColor: '#2A2C32' }]}>
              <Text style={[styles.priorityBadgeText, !hasActiveChapters && { color: '#5F6166' }]}>
                {!hasActiveChapters ? 'SETUP REQUIRED' : isComplete ? 'ALL CAUGHT UP' : 'CRITICAL RETENTION'}
              </Text>
            </View>
          </View>

          <View style={styles.recommendedMain}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Text style={styles.recommendedTitle}>{topSubject.subjectName}</Text>
              <View style={[styles.gridIcon, { backgroundColor: '#15171b', borderColor: '#2A2C32', width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' }]}>
                {getSubjectIcon(topSubject.subjectName, 22, "#5e6ad2")}
              </View>
            </View>
            {hasActiveChapters ? (
              <Text style={styles.recommendedChaptersText} numberOfLines={1}>
                {topSubject.nextChapterName || 'No chapters selected'}
              </Text>
            ) : (
              <Text style={styles.recommendedChaptersText}>No active chapters configured</Text>
            )}
          </View>

          {hasActiveChapters && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>REVIEWS</Text>
                <View style={styles.statValueContainer}>
                  <Cards size={16} color="#5e6ad2" fill="#5e6ad2" />
                  <Text style={styles.statValue}>{topSubject.totalSession}</Text>
                </View>
              </View>
              
              <View style={styles.statDivider} />
              
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>EST. TIME</Text>
                <View style={styles.statValueContainer}>
                  <Clock size={16} color="#5e6ad2" />
                  <Text style={styles.statValue}>~{Math.ceil(topSubject.totalSession * 12 / 60)}m</Text>
                </View>
              </View>
            </View>
          )}
          
          <View style={[
            styles.startButton, 
            (!hasActiveChapters || topSubject.totalSession === 0) && { backgroundColor: '#1F2125', shadowOpacity: 0, elevation: 0 }
          ]}>
            {!hasActiveChapters ? (
              <Plus size={16} color="#5F6166" />
            ) : topSubject.totalSession === 0 ? (
              <Plus size={16} color="#5F6166" />
            ) : (
              <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
            )}
            <Text style={[styles.startButtonText, (!hasActiveChapters || topSubject.totalSession === 0) && { color: '#5F6166' }]}>
              {!hasActiveChapters ? 'Choose Chapters' : topSubject.totalSession === 0 ? 'Add Chapters' : 'Start Revision'}
            </Text>
          </View>

          {/* Backlog optional box */}
          {hasActiveChapters && topSubject.backlogCount > 0 && (
            <View style={styles.backlogBox}>
              <AlertCircle size={14} color="#d2995e" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.backlogText}>You have {topSubject.backlogCount} overdue cards.</Text>
              </View>
              <TouchableOpacity style={styles.backlogBtn} onPress={() => onStartSession(topSubject.subjectName, true)}>
                <Text style={styles.backlogBtnText}>Review 30 Cards</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    color: '#94969a',
    letterSpacing: 1,
    marginBottom: 12,
  },
  recommendedCard: {
    backgroundColor: '#15171b',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2a2c32',
  },
  recommendedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  priorityBadge: {
    backgroundColor: '#2D2B4A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3E3C66',
  },
  priorityBadgeText: {
    color: '#8E96FF',
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.5,
  },
  priorityLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priorityLabelText: {
    color: '#5f6166',
    fontSize: 9,
    fontFamily: 'Outfit_600SemiBold',
  },
  recommendedMain: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 4,
  },
  recommendedTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    marginBottom: 2,
  },
  recommendedChaptersText: {
    color: '#94969a',
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    marginTop: 2,
  },
  recommendedSubtitle: {
    color: '#94969a',
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 32,
    marginBottom: 24,
  },
  statItem: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  statLabel: {
    fontSize: 8,
    fontFamily: 'Outfit_700Bold',
    color: '#5f6166',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: '#FFFFFF',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#2a2c32',
  },
  startButton: {
    backgroundColor: '#5e6ad2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#5e6ad2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
  },
  gridIcon: {
    width: 36,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backlogBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(210, 153, 94, 0.08)',
    borderColor: 'rgba(210, 153, 94, 0.2)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 15,
  },
  backlogText: {
    color: '#d2995e',
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
  backlogBtn: {
    backgroundColor: '#d2995e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backlogBtnText: {
    color: '#000000',
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
  },
  minimalIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#1F2125',
    borderColor: '#2A2C32',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
