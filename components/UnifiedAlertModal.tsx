import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from './AppText';
import { AlertCircle, Check, Zap } from 'lucide-react-native';

interface UnifiedAlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  onClose: () => void;
}

export const UnifiedAlertModal: React.FC<UnifiedAlertModalProps> = ({
  visible,
  title,
  message,
  type,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.offlineOverlay}>
        <View style={styles.offlineContent}>
          {type === 'warning' && <AlertCircle size={48} color="#d2995e" style={{ marginBottom: 15 }} />}
          {type === 'error' && <AlertCircle size={48} color="#ff5f57" style={{ marginBottom: 15 }} />}
          {type === 'success' && <Check size={48} color="#4cd964" style={{ marginBottom: 15 }} />}
          {type === 'info' && <Zap size={48} color="#5e6ad2" fill="#5e6ad2" style={{ marginBottom: 15 }} />}
          
          <Text style={styles.offlineTitle}>{title}</Text>
          <Text style={styles.offlineSubtitle}>{message}</Text>
          
          <TouchableOpacity 
            style={[
              styles.offlineCloseBtn, 
              type === 'error' && { backgroundColor: '#ff5f57' },
              type === 'success' && { backgroundColor: '#4cd964' },
              type === 'info' && { backgroundColor: '#5e6ad2' }
            ]} 
            onPress={onClose}
          >
            <Text style={[styles.offlineCloseBtnText, type !== 'warning' && { color: '#FFFFFF' }]}>
              {type === 'success' ? 'Great' : 'Got it'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  offlineOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  offlineContent: {
    backgroundColor: '#15171b',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: '#2A2C32',
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  offlineTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  offlineSubtitle: {
    color: '#94969a',
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  offlineCloseBtn: {
    backgroundColor: '#d2995e',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  offlineCloseBtnText: {
    color: '#000000',
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
  }
});
