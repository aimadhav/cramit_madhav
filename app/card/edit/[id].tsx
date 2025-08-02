import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, Image } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Plus, Tag, ImageIcon, Save, ArrowLeft } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import colors from "@/constants/colors";
import { useFlashcardStore } from "@/store/flashcard-store";
import { ContentType } from "@/types";

export default function EditCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const flashcards = useFlashcardStore(state => state.flashcards);
  const updateFlashcard = useFlashcardStore(state => state.updateFlashcard);
  const pendingOperations = useFlashcardStore(state => state.pendingOperations);
  
  const card = flashcards.find(c => c.id === id);
  
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState("");
  const [contentType, setContentType] = useState<ContentType>("text");
  const [frontMediaUrl, setFrontMediaUrl] = useState<string | null>(null);
  const [backMediaUrl, setBackMediaUrl] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Check if there are any pending operations for this card
  const isPending = Object.entries(pendingOperations).some(([key, op]) => {
    if (op.type === 'update' && key === id) return true;
    return false;
  });

  useEffect(() => {
    if (card) {
      setFront(card.front);
      setBack(card.back);
      setTags(card.tags || []);
      setContentType(card.contentType || "text");
      // Handle existing media URLs - assume first image is front, second is back
      if (card.mediaUrls && card.mediaUrls.length > 0) {
        setFrontMediaUrl(card.mediaUrls[0] || null);
        setBackMediaUrl(card.mediaUrls[1] || null);
      }
    }
  }, [card]);
  
  if (!card) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundText}>Card not found</Text>
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
    console.log(`[EditCard] handlePickImage called for ${side}, Platform: ${Platform.OS}`);
    
    if (Platform.OS === 'web') {
      Alert.alert("Not available", "This feature is not available on web");
      return;
    }
    
    try {
      // Request permissions first
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('[EditCard] Permission result:', permissionResult);
      
      if (permissionResult.granted === false) {
        Alert.alert("Permission denied", "You've refused to allow this app to access your photos!");
        return;
      }

      console.log('[EditCard] Launching image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      console.log('[EditCard] Image picker result:', result);
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log(`[EditCard] Setting ${side} image:`, result.assets[0].uri);
        if (side === 'front') {
          setFrontMediaUrl(result.assets[0].uri);
        } else {
          setBackMediaUrl(result.assets[0].uri);
        }
        setContentType("mixed");
      }
    } catch (error) {
      console.error('[EditCard] Error picking image:', error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };
  
  const handleUpdateCard = async () => {
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
      setIsUpdating(true);
      await updateFlashcard(id, {
        front: front.trim(),
        back: back.trim(),
        contentType,
        tags: tags.length > 0 ? tags : card.tags,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined
      });
      
      Alert.alert(
        "Success",
        "Card updated successfully!",
        [
          {
            text: "OK",
            onPress: () => router.back()
          }
        ]
      );
    } catch (error: any) {
      console.error("[EditCardScreen] Error updating flashcard:", error);
      Alert.alert(
        "Error Updating Card",
        error.message || "An unexpected error occurred while updating the card. Please try again."
      );
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen 
        options={{
          title: "Edit Card",
          headerShown: false,
        }} 
      />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => !isUpdating && router.back()}
          disabled={isUpdating}
        >
          <ArrowLeft size={24} color={isUpdating ? colors.gray[400] : colors.textDark} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Edit Card</Text>
        
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => !isUpdating && router.back()}
          disabled={isUpdating}
        >
          <X size={24} color={isUpdating ? colors.gray[400] : colors.textDark} />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
            editable={!isUpdating && !isPending}
          />
          <Text style={styles.helperText}>
            Tip: You can use LaTeX by wrapping it in $ symbols, e.g. $E = mc^2$
          </Text>
          
          {/* Front Image Section */}
          <View style={styles.imageSection}>
            <Text style={styles.imageSectionLabel}>Front Image (Optional)</Text>
            <TouchableOpacity 
              style={styles.imagePickerButton}
              onPress={() => handlePickImage('front')}
              disabled={isUpdating || isPending}
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
                disabled={isUpdating || isPending}
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
            editable={!isUpdating && !isPending}
          />
          
          {/* Back Image Section */}
          <View style={styles.imageSection}>
            <Text style={styles.imageSectionLabel}>Back Image (Optional)</Text>
            <TouchableOpacity 
              style={styles.imagePickerButton}
              onPress={() => handlePickImage('back')}
              disabled={isUpdating || isPending}
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
                disabled={isUpdating || isPending}
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
              disabled={isUpdating || isPending}
            >
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
              disabled={isUpdating || isPending}
            >
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
              disabled={isUpdating || isPending}
            >
              <Text style={[
                styles.contentTypeText,
                contentType === "latex" && styles.activeContentTypeText
              ]}>LaTeX</Text>
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
              editable={!isUpdating && !isPending}
            />
            <TouchableOpacity 
              style={styles.addTagButton}
              onPress={handleAddTag}
              disabled={isUpdating || isPending}
            >
              <Plus size={20} color={isUpdating || isPending ? colors.gray[300] : colors.primary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.tagsContainer}>
            {tags.map(tag => (
              <View key={tag} style={styles.tagBadge}>
                <Text style={styles.tagText}>{tag}</Text>
                <TouchableOpacity 
                  style={styles.removeTagButton}
                  onPress={() => handleRemoveTag(tag)}
                  disabled={isUpdating || isPending}
                >
                  <X size={14} color={isUpdating || isPending ? colors.gray[400] : colors.textDark} />
                </TouchableOpacity>
              </View>
            ))}
            {tags.length === 0 && (
              <Text style={styles.noTagsText}>No tags added yet</Text>
            )}
          </View>
        </View>
        
        <TouchableOpacity 
          style={[styles.updateButton, (isUpdating || isPending) && styles.updateButtonDisabled]}
          onPress={handleUpdateCard}
          disabled={isUpdating || isPending}
        >
          <Save size={20} color="white" style={styles.updateButtonIcon} />
          <Text style={styles.updateButtonText}>
            {isUpdating ? "Updating Card..." : "Update Card"}
          </Text>
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
  },
  activeContentTypeText: {
    color: "white",
  },
  imagePickerButton: {
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 8,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  imagePickerContent: {
    alignItems: "center",
  },
  imagePickerText: {
    fontSize: 14,
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
  updateButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 40,
  },
  updateButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
  updateButtonIcon: {
    marginRight: 8,
  },
  updateButtonText: {
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