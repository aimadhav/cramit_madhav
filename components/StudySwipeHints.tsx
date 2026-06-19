import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './AppText';

interface StudySwipeHintsProps {
  swipeDirection: 'left' | 'right' | 'up' | 'down' | null;
}

export const StudySwipeHints: React.FC<StudySwipeHintsProps> = ({ swipeDirection }) => {
  if (!swipeDirection || (swipeDirection !== 'left' && swipeDirection !== 'right')) return null;

  return (
    <View style={styles.swipeHintContainer}>
      {swipeDirection === 'left' && (
        <View style={[styles.swipePill, styles.againPill]}>
          <Text style={styles.swipePillText}>DIDN'T KNOW</Text>
        </View>
      )}
      {swipeDirection === 'right' && (
        <View style={[styles.swipePill, styles.easyPill]}>
          <Text style={styles.swipePillText}>EASY</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  swipeHintContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipePill: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
  },
  swipePillText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  easyPill: { 
    backgroundColor: 'rgba(16, 185, 129, 0.2)', 
    borderColor: '#10B981' 
  },
  againPill: { 
    backgroundColor: 'rgba(245, 158, 11, 0.2)', 
    borderColor: '#F59E0B' 
  },
});
