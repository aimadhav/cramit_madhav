import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './AppText';
import { AlertCircle } from 'lucide-react-native';

interface CompletedChaptersBannerProps {
  completedChapters: any[];
}

export const CompletedChaptersBanner: React.FC<CompletedChaptersBannerProps> = ({ completedChapters }) => {
  if (completedChapters.length === 0) return null;

  return (
    <View style={styles.completedBanner}>
      <AlertCircle size={16} color="#4CD964" />
      <Text style={styles.completedBannerText}>
        You fully completed {completedChapters.map(c => c.name).join(', ')}! Please configure active chapters to keep introducing new cards.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 217, 100, 0.08)',
    borderColor: 'rgba(76, 217, 100, 0.2)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  completedBannerText: {
    color: '#4CD964',
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    lineHeight: 16,
    flex: 1,
    marginLeft: 8,
  }
});
