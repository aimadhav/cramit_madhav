import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Text } from './AppText';
import { X, Pencil, FileText, Check, Send } from 'lucide-react-native';

interface StudyNoteModalProps {
  visible: boolean;
  noteText: string;
  noteMode: 'read' | 'edit';
  isNoteSaving: boolean;
  currentCardNotes: string | undefined;
  onClose: () => void;
  onChangeNoteText: (text: string) => void;
  onSaveNote: () => void;
  onSetNoteMode: (mode: 'read' | 'edit') => void;
}

export const StudyNoteModal: React.FC<StudyNoteModalProps> = ({
  visible,
  noteText,
  noteMode,
  isNoteSaving,
  currentCardNotes,
  onClose,
  onChangeNoteText,
  onSaveNote,
  onSetNoteMode,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.noteModalContent}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.modalIconBox, { backgroundColor: noteMode === 'edit' ? '#5e6ad2' : '#1A1B1F' }]}>
                {noteMode === 'edit' ? <Pencil size={16} color="#FFFFFF" /> : <FileText size={16} color="#5e6ad2" />}
              </View>
              <Text style={styles.modalTitle}>{noteMode === 'edit' ? 'Edit Note' : 'Your Note'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <X size={20} color="#94969a" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.noteBodyScroll} showsVerticalScrollIndicator={false}>
            {noteMode === 'edit' ? (
              <TextInput
                style={styles.noteInput}
                placeholder="Write something about this card..."
                placeholderTextColor="#5F6166"
                multiline
                value={noteText}
                onChangeText={onChangeNoteText}
                autoFocus
              />
            ) : (
              <View style={styles.noteReadContainer}>
                <Text style={styles.noteReadText}>
                  {currentCardNotes || "No note added yet."}
                </Text>
              </View>
            )}
          </ScrollView>
          
          <View style={styles.modalFooter}>
            {noteMode === 'edit' ? (
              <TouchableOpacity 
                style={[
                  styles.saveNoteButton,
                  isNoteSaving && { backgroundColor: '#3fb950' }
                ]}
                onPress={onSaveNote}
              >
                {isNoteSaving ? (
                  <>
                    <Check size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.saveNoteText}>Saved!</Text>
                  </>
                ) : (
                  <>
                    <Send size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.saveNoteText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.editModeButton}
                onPress={() => onSetNoteMode('edit')}
              >
                <Pencil size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.saveNoteText}>Edit Note</Text>
              </TouchableOpacity>
            )}
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
    justifyContent: 'flex-end',
  },
  noteModalContent: {
    backgroundColor: '#15171B',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 30,
    paddingBottom: 50,
    borderWidth: 1,
    borderTopColor: '#2A2C32',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: '#FFFFFF',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1B1F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteBodyScroll: {
    maxHeight: 300,
  },
  noteReadContainer: {
    padding: 10,
  },
  noteReadText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#ECECEC',
    fontFamily: 'Outfit_500Medium',
  },
  noteInput: {
    backgroundColor: '#0B0C0E',
    borderRadius: 16,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Outfit_500Medium',
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  modalFooter: {
    marginTop: 20,
  },
  saveNoteButton: {
    backgroundColor: '#5e6ad2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  editModeButton: {
    backgroundColor: '#1F2125',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  saveNoteText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
  }
});
