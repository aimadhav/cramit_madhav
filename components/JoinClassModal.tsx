import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Text } from './AppText';

interface JoinClassModalProps {
  visible: boolean;
  joinCode: string;
  onClose: () => void;
  onChangeJoinCode: (code: string) => void;
  onJoin: () => void;
}

export const JoinClassModal: React.FC<JoinClassModalProps> = ({
  visible,
  joinCode,
  onClose,
  onChangeJoinCode,
  onJoin,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Join a Class</Text>
          <Text style={styles.modalSub}>Enter the 6-character code provided by your teacher.</Text>
          
          <TextInput
            style={styles.joinInput}
            placeholder="CODE"
            placeholderTextColor="#5F6166"
            autoCapitalize="characters"
            maxLength={6}
            value={joinCode}
            onChangeText={onChangeJoinCode}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={onClose}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.joinBtn}
              onPress={onJoin}
            >
              <Text style={styles.joinBtnText}>Join Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#15171B',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 13,
    color: '#94969a',
    fontFamily: 'Outfit_500Medium',
    marginBottom: 20,
    lineHeight: 18,
  },
  joinInput: {
    backgroundColor: '#0B0C0E',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'monospace',
    textAlign: 'center',
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: '#2A2C32',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
  cancelBtnText: {
    color: '#94969a',
    fontFamily: 'Outfit_700Bold',
  },
  joinBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#5e6ad2',
  },
  joinBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
  },
});
