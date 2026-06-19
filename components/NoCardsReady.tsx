import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from './AppText';
import { AlertCircle } from 'lucide-react-native';

interface NoCardsReadyProps {
  onExit: () => void;
}

export const NoCardsReady: React.FC<NoCardsReadyProps> = ({ onExit }) => {
  return (
    <View style={styles.loadingContainer}>
      <AlertCircle size={48} color="#5e6ad2" style={{ marginBottom: 16 }} />
      <Text style={styles.emptyTitleText}>No Cards Ready</Text>
      <Text style={styles.emptySubtitleText}>
        There are no cards currently ready for review in this subject. Ensure your active chapters have completed downloads or try adding new chapters!
      </Text>
      <TouchableOpacity style={styles.completionButton} onPress={onExit}>
        <Text style={styles.completionButtonText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 30,
  },
  emptyTitleText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitleText: {
    color: '#94969a',
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
  },
  completionButton: {
    backgroundColor: '#5e6ad2',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
  },
  completionButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
});
