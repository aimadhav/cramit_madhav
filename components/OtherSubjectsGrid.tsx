import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Text } from './AppText';
import { Info } from 'lucide-react-native';

const { width } = Dimensions.get('window');

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
}

interface OtherSubjectsGridProps {
  otherSubjects: SubjectStats[];
  onStartSession: (subject: string) => Promise<void>;
  onConfigureChapters: (subject: string, currentlyActive: string[]) => void;
  onShowActiveChaptersInfo: (subjectName: string, activeIds: string[]) => void;
  getSubjectIcon: (subject: string, size?: number, color?: string) => React.ReactNode;
}

export const OtherSubjectsGrid: React.FC<OtherSubjectsGridProps> = ({
  otherSubjects,
  onStartSession,
  onConfigureChapters,
  onShowActiveChaptersInfo,
  getSubjectIcon,
}) => {
  if (otherSubjects.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>OTHER SUBJECT QUEUES</Text>
      <View style={styles.grid}>
        {otherSubjects.map((subj, idx) => {
          const hasActive = subj.activeIds.length > 0;
          const isComplete = subj.totalSession === 0;

          let iconBg = '#1A1F1C'; 
          let iconBorder = '#232925';
          let iconColor = '#4CD964';

          const sName = subj.subjectName.toLowerCase();
          if (sName.includes('chem')) {
            iconBg = '#1A1F1C';
            iconBorder = '#232925';
            iconColor = '#4CD964';
          } else if (sName.includes('math')) {
            iconBg = '#2A1A1A'; 
            iconBorder = '#3C2323';
            iconColor = '#FF5F57';
          } else if (sName.includes('cs') || sName.includes('dsa') || sName.includes('os') || sName.includes('networks') || sName.includes('dbms') || sName.includes('oop')) {
            iconBg = '#1A1C2D'; 
            iconBorder = '#23253E';
            iconColor = '#8E96FF';
          } else {
            iconBg = '#1A1B1F';
            iconBorder = '#23242A';
            iconColor = '#5e6ad2';
          }

          const displayName = subj.subjectName === 'Mathematics' ? 'Maths' : subj.subjectName;

          return (
            <TouchableOpacity 
              key={subj.subjectName + idx}
              style={styles.gridItem} 
              onPress={() => {
                if (hasActive && !isComplete) {
                  onStartSession(subj.subjectName);
                } else if (!hasActive) {
                  onConfigureChapters(subj.subjectName, subj.activeIds);
                }
              }}
            >
              <View style={{ marginBottom: 12 }}>
                <View style={[styles.gridIcon, { backgroundColor: iconBg, borderColor: iconBorder, marginBottom: 0 }]}>
                  {getSubjectIcon(subj.subjectName, 18, iconColor)}
                </View>
              </View>
              
              <Text style={styles.gridTitle} numberOfLines={1}>{displayName}</Text>

              {hasActive && !isComplete ? (
                <View style={styles.gridStats}>
                  <Text style={styles.gridDue}>{subj.totalSession} Due</Text>
                  <Text style={styles.gridTime}>~{Math.ceil(subj.totalSession * 12 / 60)}m</Text>
                </View>
              ) : isComplete && hasActive ? (
                <View style={styles.gridStats}>
                  <Text style={[styles.gridDue, { color: '#5F6166' }]}>Waitlist</Text>
                  <Text style={[styles.gridTime, { color: '#5F6166' }]}>—</Text>
                </View>
              ) : (
                <View style={styles.gridStats}>
                  <Text style={[styles.gridDue, { color: '#5F6166' }]}>Setup</Text>
                  <Text style={styles.gridTime}>—</Text>
                </View>
              )}

              <View style={[
                styles.gridButton, 
                (!hasActive || isComplete) && { backgroundColor: '#121318', borderColor: '#222329', borderWidth: 1 }
              ]}>
                <Text style={[
                  styles.gridButtonText,
                  (!hasActive || isComplete) && { color: '#5F6166' }
                ]}>
                  {isComplete && hasActive ? 'Done' : hasActive ? 'Revise' : 'Add Chapters'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  gridItem: {
    width: (width - 55) / 2, // 2 columns with padding/gap math
    backgroundColor: '#15171b',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2c32',
  },
  gridIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridTitle: {
    color: '#ececec',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    marginBottom: 4,
  },
  gridStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    width: '100%',
  },
  gridDue: {
    color: '#ececec',
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
  },
  gridTime: {
    color: '#5f6166',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  gridButton: {
    backgroundColor: '#2a2c32',
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  gridButtonText: {
    color: '#94969a',
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
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
