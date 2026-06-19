import React from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from './AppText';
import { Zap } from 'lucide-react-native';

interface CramHeaderProps {
  subjects: string[];
  selectedSubject: string;
  onSelectSubject: (subject: string) => void;
}

export const CramHeader: React.FC<CramHeaderProps> = ({
  subjects,
  selectedSubject,
  onSelectSubject,
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Zap size={22} color="#5e6ad2" fill="#5e6ad2" style={{ marginRight: 8 }} />
        <Text style={styles.title}>Cram Mode</Text>
      </View>
      <Text style={styles.subtitle}>Select chapters and filters to create a custom study mix.</Text>

      {/* Premium Scrollable Subject Selector - Prevents Out-Of-Screen Horizontal Stretching */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.segmentScroll}
      >
        {subjects.map((subj) => {
          const isActive = selectedSubject === subj;
          return (
            <TouchableOpacity 
              key={subj}
              style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
              onPress={() => onSelectSubject(subj)}
            >
              <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>{subj}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: '#0B0C0E',
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    color: '#ECECEC',
  },
  subtitle: {
    fontSize: 12,
    color: '#94969A',
    fontFamily: 'Outfit_500Medium',
    marginTop: 2,
    lineHeight: 18,
  },
  segmentScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  segmentButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#15171B',
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  segmentButtonActive: {
    backgroundColor: '#5e6ad2',
    borderColor: '#5e6ad2',
  },
  segmentText: {
    color: '#94969A',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
  },
});
