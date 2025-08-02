import React, { useState } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, Image } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Plus, Tag, Image as ImageIcon, FileText, ArrowLeft } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import colors from "@/constants/colors";
import { useFlashcardStore } from "@/store/flashcard-store";
import { ContentType } from "@/types";

export default function AddCardScreen() {
  const { id: routeDeckId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const decks = useFlashcardStore(state => state.decks);
  const tempIdToRealIdMap = useFlashcardStore(state => state.tempIdToRealIdMap);
  const addFlashcard = useFlashcardStore(state => state.addFlashcard);
  
  let deck = decks.find(d => d.id === routeDeckId);

  if (!deck && routeDeckId && routeDeckId.startsWith('deck-temp-')) {
    const realId = tempIdToRealIdMap && tempIdToRealIdMap[routeDeckId];
    if (realId) {
      console.log(`[AddCardScreen] Deck not found with tempId ${routeDeckId}, but realId ${realId} found in map. Attempting to find with realId.`);
      deck = decks.find(d => d.id === realId);
    }
  }
  
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState("");
  const [contentType, setContentType] = useState<ContentType>("text");
  const [frontMediaUrl, setFrontMediaUrl] = useState<string | null>(null);
  const [backMediaUrl, setBackMediaUrl] = useState<string | null>(null);
  
  if (!deck) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundText}>Deck not found</Text>
        <TouchableOpacity 
          style={styles.notFoundBackButton}
          onPress={() => router.back()}
        >
          <Text style={styles.notFoundBackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  const handleAddTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags([...tags, currentTag.trim()]);
      setCurrentTag("");
    }
  };
  
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };
  
  const handlePickImage = async (side: 'front' | 'back') => {
    console.log(`[AddCard] handlePickImage called for ${side}, Platform: ${Platform.OS}`);
    
    if (Platform.OS === 'web') {
      Alert.alert("Not available", "This feature is not available on web");
      return;
    }
    
    try {
      // Request permissions first
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('[AddCard] Permission result:', permissionResult);
      
      if (permissionResult.granted === false) {
        Alert.alert("Permission denied", "You've refused to allow this app to access your photos!");
        return;
      }

      console.log('[AddCard] Launching image picker...');
      console.log('[AddCard] Available ImagePicker options:', Object.keys(ImagePicker));
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images || 'Images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      console.log('[AddCard] Image picker result:', result);
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log(`[AddCard] Setting ${side} image:`, result.assets[0].uri);
        if (side === 'front') {
          setFrontMediaUrl(result.assets[0].uri);
        } else {
          setBackMediaUrl(result.assets[0].uri);
        }
        setContentType("mixed");
      }
    } catch (error) {
      console.error('[AddCard] Error picking image:', error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };
  
  const handleAddCard = async () => {
    if (!front.trim()) {
      Alert.alert("Error", "Please enter front side content");
      return;
    }
    
    if (!back.trim()) {
      Alert.alert("Error", "Please enter back side content");
      return;
    }
    
    const mediaUrls = [];
    if (frontMediaUrl) mediaUrls.push(frontMediaUrl);
    if (backMediaUrl) mediaUrls.push(backMediaUrl);
    
    try {
      const newCardIdOrTempId = await addFlashcard({
        front: front.trim(),
        back: back.trim(),
        contentType,
        tags: tags.length > 0 ? tags : ((deck.tags || []).slice(0, 1) || []),
        deckId: deck.id,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined
      });
      
      console.log(`[AddCardScreen] addFlashcard call completed. Returned ID/TempID: ${newCardIdOrTempId}`);

      Alert.alert(
        "Success",
        "Card added successfully!",
        [
          {
            text: "Add Another",
            onPress: () => {
              setFront("");
              setBack("");
              setFrontMediaUrl(null);
              setBackMediaUrl(null);
              setContentType("text");
            }
          },
          {
            text: "Done",
            onPress: () => router.back()
          }
        ]
      );
    } catch (error: any) {
      console.error("[AddCardScreen] Error adding flashcard:", error);
      Alert.alert(
        "Error Adding Card",
        error.message || "An unexpected error occurred while adding the card. Please try again."
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen 
        options={{
          title: "Add Card",
          headerShown: false,
        }} 
      />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={colors.textDark} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Add Card</Text>
        
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <X size={24} color={colors.textDark} />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.deckInfo}>
          <Text style={styles.deckName}>Deck: {deck.name}</Text>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Front Side</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter front side content"
            value={front}
            onChangeText={setFront}
            multiline
            numberOfLines={4}
            placeholderTextColor={colors.gray[400]}
          />
          <Text style={styles.helperText}>
            Tip: You can use LaTeX by wrapping it in $ symbols, e.g. $E = mc^2$
          </Text>
          
          {/* Front Image Section */}
          <View style={styles.imageSection}>
            <Text style={styles.imageSectionLabel}>Front Image (Optional)</Text>
            <TouchableOpacity 
              style={styles.imagePickerButton}
              onPress={() => {
                console.log('[AddCard] Button pressed for front image');
                handlePickImage('front');
              }}
            >
              {frontMediaUrl ? (
                <Image 
                  source={{ uri: frontMediaUrl }}
                  style={styles.imagePreview}
                />
              ) : (
                <View style={styles.imagePickerContent}>
                  <ImageIcon size={24} color={colors.primary} />
                  <Text style={styles.imagePickerText}>Add Image to Front</Text>
                </View>
              )}
            </TouchableOpacity>
            {frontMediaUrl && (
              <TouchableOpacity 
                style={styles.removeImageButton}
                onPress={() => setFrontMediaUrl(null)}
              >
                <Text style={styles.removeImageText}>Remove Image</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Back Side</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter back side content"
            value={back}
            onChangeText={setBack}
            multiline
            numberOfLines={4}
            placeholderTextColor={colors.gray[400]}
          />
          
          {/* Back Image Section */}
          <View style={styles.imageSection}>
            <Text style={styles.imageSectionLabel}>Back Image (Optional)</Text>
            <TouchableOpacity 
              style={styles.imagePickerButton}
              onPress={() => {
                console.log('[AddCard] Button pressed for back image');
                handlePickImage('back');
              }}
            >
              {backMediaUrl ? (
                <Image 
                  source={{ uri: backMediaUrl }}
                  style={styles.imagePreview}
                />
              ) : (
                <View style={styles.imagePickerContent}>
                  <ImageIcon size={24} color={colors.primary} />
                  <Text style={styles.imagePickerText}>Add Image to Back</Text>
                </View>
              )}
            </TouchableOpacity>
            {backMediaUrl && (
              <TouchableOpacity 
                style={styles.removeImageButton}
                onPress={() => setBackMediaUrl(null)}
              >
                <Text style={styles.removeImageText}>Remove Image</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Content Type</Text>
          <View style={styles.contentTypeContainer}>
            <TouchableOpacity 
              style={[
                styles.contentTypeButton,
                contentType === "text" && styles.activeContentTypeButton
              ]}
              onPress={() => setContentType("text")}
            >
              <FileText size={20} color={contentType === "text" ? "white" : colors.textDark} />
              <Text style={[
                styles.contentTypeText,
                contentType === "text" && styles.activeContentTypeText
              ]}>Text</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.contentTypeButton,
                contentType === "mixed" && styles.activeContentTypeButton
              ]}
              onPress={() => setContentType("mixed")}
            >
              <FileText size={20} color={contentType === "mixed" ? "white" : colors.textDark} />
              <Text style={[
                styles.contentTypeText,
                contentType === "mixed" && styles.activeContentTypeText
              ]}>Mixed</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.contentTypeButton,
                contentType === "latex" && styles.activeContentTypeButton
              ]}
              onPress={() => setContentType("latex")}
            >
              <FileText size={20} color={contentType === "latex" ? "white" : colors.textDark} />
              <Text style={[
                styles.contentTypeText,
                contentType === "latex" && styles.activeContentTypeText
              ]}>LaTeX</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.contentTypeButton,
                contentType === "image" && styles.activeContentTypeButton
              ]}
              onPress={() => setContentType("image")}
            >
              <ImageIcon size={20} color={contentType === "image" ? "white" : colors.textDark} />
              <Text style={[
                styles.contentTypeText,
                contentType === "image" && styles.activeContentTypeText
              ]}>Image</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {Platform.OS === 'web' && (
          <Text style={styles.webNote}>
            Note: Image upload is not available on web.
          </Text>
        )}
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Tags</Text>
          <View style={styles.tagInputContainer}>
            <TextInput
              style={styles.tagInput}
              placeholder="Add tags"
              value={currentTag}
              onChangeText={setCurrentTag}
              onSubmitEditing={handleAddTag}
              placeholderTextColor={colors.gray[400]}
            />
            <TouchableOpacity 
              style={styles.addTagButton}
              onPress={handleAddTag}
            >
              <Plus size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.tagsContainer}>
            {tags.map(tag => (
              <View key={tag} style={styles.tagBadge}>
                <Text style={styles.tagText}>{tag}</Text>
                <TouchableOpacity 
                  style={styles.removeTagButton}
                  onPress={() => handleRemoveTag(tag)}
                >
                  <X size={14} color={colors.textDark} />
                </TouchableOpacity>
              </View>
            ))}
            {tags.length === 0 && (
              <Text style={styles.noTagsText}>No tags added yet</Text>
            )}
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.addButton}
          onPress={handleAddCard}
        >
          <Text style={styles.addButtonText}>Add Card</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  backButton: {
    padding: 8,
  },
  closeButton: {
    padding: 8,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  notFoundText: {
    fontSize: 18,
    color: colors.textDark,
    marginBottom: 16,
  },
  notFoundBackButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  notFoundBackButtonText: {
    color: "white",
    fontWeight: "600",
  },
  content: {
    padding: 20,
  },
  deckInfo: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: colors.gray[100],
    borderRadius: 8,
  },
  deckName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textDark,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textDark,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textDark,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  helperText: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 4,
    fontStyle: "italic",
  },
  contentTypeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  contentTypeButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: colors.gray[100],
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeContentTypeButton: {
    backgroundColor: colors.primary,
  },
  contentTypeText: {
    fontSize: 14,
    color: colors.textDark,
    marginTop: 4,
  },
  activeContentTypeText: {
    color: "white",
  },
  imagePickerButton: {
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 8,
    height: 160,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  imagePickerContent: {
    alignItems: "center",
  },
  imagePickerText: {
    fontSize: 16,
    color: colors.primary,
    marginTop: 8,
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  webNote: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 8,
    fontStyle: "italic",
  },
  tagInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  tagInput: {
    flex: 1,
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textDark,
  },
  addTagButton: {
    width: 48,
    height: 48,
    backgroundColor: colors.gray[100],
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
  },
  tagBadge: {
    backgroundColor: colors.gray[200],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  tagText: {
    fontSize: 14,
    color: colors.textDark,
  },
  removeTagButton: {
    marginLeft: 6,
  },
  noTagsText: {
    fontSize: 14,
    color: colors.textLight,
    fontStyle: "italic",
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  imageSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  imageSectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textDark,
    marginBottom: 8,
  },
  removeImageButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.gray[200],
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  removeImageText: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '600',
  },
});