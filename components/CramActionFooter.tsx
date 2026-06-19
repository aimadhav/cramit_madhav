import React from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from './AppText';
import { Zap } from 'lucide-react-native';

interface CramActionFooterProps {
  selectedChaptersCount: number;
  isReady: boolean;
  isLaunching: boolean;
  onStartPress: () => void;
}

export const CramActionFooter: React.FC<CramActionFooterProps> = ({
  selectedChaptersCount,
  isReady,
  isLaunching,
  onStartPress,
}) => {
  return (
    <View style={styles.actionFooter}>
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={onStartPress}
        style={[styles.startBtn, (!isReady || isLaunching) && styles.startBtnDisabled]}
        disabled={isLaunching}
      >
        {isLaunching ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Zap size={18} color={isReady ? "#FFFFFF" : "#5F6166"} fill={isReady ? "#FFFFFF" : "none"} />
        )}
        <Text style={[styles.startBtnText, !isReady && styles.startBtnTextDisabled]}>
          {isLaunching 
            ? "Preparing Session..." 
            : isReady 
              ? `Start Cramming • ${selectedChaptersCount} Chapters` 
              : "Select Chapters to Start"
          }
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  actionFooter: {
    position: 'absolute',
    bottom: 110, 
    left: 20,
    right: 20,
    zIndex: 100,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: '#5e6ad2',
    gap: 10,
    shadowColor: '#5e6ad2',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  startBtnDisabled: {
    backgroundColor: '#2A2C32',
  },
  startBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
  },
  startBtnTextDisabled: {
    color: '#5F6166',
  },
});
