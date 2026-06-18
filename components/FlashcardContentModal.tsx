import React from 'react';
import { Modal, View, ScrollView, TouchableOpacity, StyleSheet, Platform, StatusBar } from "react-native";
import { Text } from "@/components/AppText";;
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';

import { Flashcard } from '@/types';
import colors from '@/constants/colors';
import { extractLatex } from '@/utils/latex-renderer';
import WebViewLatexBlock from './WebViewLatexBlock';

interface FlashcardContentModalProps {
  isVisible: boolean;
  onClose: () => void;
  card: Flashcard | null;
}

const FlashcardContentModal: React.FC<FlashcardContentModalProps> = ({ isVisible, onClose, card }) => {
  if (!card) {
    return null;
  }

  const renderContent = (text: string, side: 'front' | 'back') => {
    console.log(`FlashcardContentModal: Raw input text for ${side}:`, JSON.stringify(text));
    const contentParts = extractLatex(text);
    console.log(`FlashcardContentModal: Extracted parts for ${side}:`, JSON.stringify(contentParts, null, 2));

    return contentParts.map((part, index) => {
      console.log(`FlashcardContentModal: Rendering part ${index} for ${side}:`, JSON.stringify(part));
      if (part.type === 'latex') {
        console.log(`FlashcardContentModal: Passing to WebViewLatexBlock for ${side}:`, JSON.stringify(part.content));
        return <WebViewLatexBlock key={`${side}-${index}`} latex={part.content} />;
      } else {
        console.log(`FlashcardContentModal: Rendering as Text for ${side}:`, JSON.stringify(part.content));
        return <Text key={`${side}-${index}`} style={styles.contentText}>{part.content}</Text>;
      }
    });
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOuterContainer}>
        <View style={styles.modalView}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={colors.textDark} />
          </TouchableOpacity>
          
          <ScrollView contentContainerStyle={styles.scrollViewContent}>
            <Text style={styles.headerText}>Full Content</Text>
            
            <View style={styles.contentSection}>
              <Text style={styles.subHeaderText}>Question:</Text>
              {renderContent(card.front, 'front')}
              {(card.mediaUrls && card.mediaUrls.length > 0) && (
                <Image 
                  source={{ uri: card.mediaUrls[0] }} 
                  style={styles.modalImage}
                  contentFit="contain"
                />
              )}
            </View>

            <View style={styles.contentSection}>
              <Text style={styles.subHeaderText}>Answer:</Text>
              {renderContent(card.back, 'back')}
              {/* We'll only display the first image on the front for now. If specific back images are needed, data model should support it. */}
              {/* Consider if/how to display images associated with the back if necessary */}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOuterContainer: { 
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center', 
    alignItems: 'center',   
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  modalView: { 
    width: '90%', 
    maxHeight: '80%', 
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5, 
  },
  closeButton: { 
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 8,
    zIndex: 10,
  },
  scrollViewContent: {
    paddingBottom: 20, 
  },
  headerText: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: colors.primary,
    textAlign: 'center',
  },
  contentSection: {
    marginBottom: 20,
  },
  subHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[300],
    paddingBottom: 5,
  },
  contentText: {
    fontSize: 16,
    color: colors.textDark,
    lineHeight: 24,
  },
  imagePlaceholder: { 
    fontSize: 14,
    color: colors.textLight,
    fontStyle: 'italic',
    marginTop: 10,
  },
  latexText: {
    fontSize: 16,
    color: colors.textDark,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    marginVertical: 4,
    textAlign: 'center',
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 10,


    backgroundColor: colors.gray[100],
  },
});

export default FlashcardContentModal;
//added by madhav
