import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './AppText';

interface SubjectMasteryItem {
  name: string;
  color: string;
  mastery: number;
  icon: React.ComponentType<any>;
}

interface SubjectMasteryListProps {
  masteryData: SubjectMasteryItem[];
}

export const SubjectMasteryList: React.FC<SubjectMasteryListProps> = ({ masteryData }) => {
  return (
    <View style={styles.container}>
      <View style={styles.masteryHeaderRow}>
        <Text style={styles.cardSectionLabel}>SUBJECT MASTERY</Text>
        <View style={styles.masteryLine} />
      </View>

      {masteryData.map((s, index) => {
        const IconComponent = s.icon;
        return (
          <View key={index} style={styles.masteryItem}>
            <View style={styles.masterySubjectRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.subjectIcon, { backgroundColor: `${s.color}15` }]}>
                  <IconComponent size={20} color={s.color} />
                </View>
                <View>
                  <Text style={styles.subjectTitle}>{s.name}</Text>
                  <Text style={styles.subjectSub}>SRS LEVEL PROGRESS</Text>
                </View>
              </View>
              <Text style={[styles.subjectPercent, { color: s.color }]}>{s.mastery}%</Text>
            </View>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${s.mastery}%`, backgroundColor: s.color }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  masteryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  cardSectionLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    color: '#94969a',
    letterSpacing: 1.5,
  },
  masteryLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2A2C32',
    marginLeft: 15,
  },
  masteryItem: {
    backgroundColor: '#15171B',
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  masterySubjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  subjectIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  subjectTitle: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    color: '#ECECEC',
  },
  subjectSub: {
    fontSize: 11,
    color: '#94969a',
    fontFamily: 'Outfit_500Medium',
    marginTop: 2,
  },
  subjectPercent: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});
