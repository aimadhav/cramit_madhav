import React, { useState } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, Image } from "react-native";
import { useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Plus, Tag, ArrowLeft, ImageIcon } from "lucide-react-native";
import { Platform } from "react-native";

import colors from "@/constants/colors";
import { useFlashcardStore } from "@/store/flashcard-store";

export default function CreateDeckScreen() {
  const router = useRouter();
  const addDeck = useFlashcardStore(state => state.addDeck);
  
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState("");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  // Predefined cover photo options
  const coverPhotoOptions = [
    {
      id: 'math',
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Blackboard_with_math_formula.jpg/300px-Blackboard_with_math_formula.jpg',
      label: 'Mathematics'
    },
    {
      id: 'physics',
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Physics_world_map.png/300px-Physics_world_map.png',
      label: 'Physics'
    },
    {
      id: 'chemistry',
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Chemicals_in_flasks.jpg/300px-Chemicals_in_flasks.jpg',
      label: 'Chemistry'
    },
    {
      id: 'biology',
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/DNA_Overview.png/300px-DNA_Overview.png',
      label: 'Biology'
    },
    {
      id: 'general',
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Book_collection.jpg/300px-Book_collection.jpg',
      label: 'General Studies'
    },
    {
      id: 'languages',
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Desktop_computer_clipart_-_Yellow_theme.svg/300px-Desktop_computer_clipart_-_Yellow_theme.svg.png',
      label: 'Languages'
    }
  ];
  
  const handleNameChange = (text: string) => {
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    if (words.length <= 2) {
      const anyWordTooLong = words.some(word => word.length > 12);
      if (!anyWordTooLong) {
        setName(text);
        setNameError(null);
      } else {
        setNameError("Each word cannot exceed 12 letters");
      }
    } else {
      setNameError("Deck name cannot exceed 2 words");
    }
  };
  
  const handleAddTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags([...tags, currentTag.trim()]);
      setCurrentTag("");
    }
  };
  
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };
  
  const handleCreateDeck = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a deck name");
      return;
    }
    
    if (name.length > 12) {
      setNameError("Deck name cannot exceed 12 characters");
      return;
    }
    
    const wordCount = name.trim().split(/\s+/).filter(word => word.length > 0).length;
    if (wordCount > 2) {
      setNameError("Deck name cannot exceed 2 words");
      return;
    }
    
    if (!subject.trim()) {
      Alert.alert("Error", "Please enter a subject");
      return;
    }
    
    if (!chapter.trim()) {
      Alert.alert("Error", "Please enter a chapter/topic");
      return;
    }
    
    setIsCreating(true);

    const tempId = `deck-temp-${Date.now()}`;

    console.log("[CreateDeckScreen] Navigating to /deck/ with tempId:", tempId);
    router.replace(`/deck/${tempId}`);

    let defaultCoverImage = "assets/images/favicon.png";
    const subjectLower = subject.trim().toLowerCase();
    if (subjectLower.includes("bio")) {
      defaultCoverImage = "assets/images/favicon.png";
    } else if (subjectLower.includes("chem")) {
      defaultCoverImage = "assets/images/favicon.png";
    } else if (subjectLower.includes("math")) {
      defaultCoverImage = "assets/images/favicon.png";
    } else if (subjectLower.includes("physics")) {
      defaultCoverImage = "assets/images/favicon.png"; 
    }

    addDeck(
      {
        name: name.trim(),
        description: description.trim() || "No description provided",
        tags: tags.length > 0 ? tags : ["No tag"],
        isPremium: false,
        isPublic: false,
        coverImage: coverImage || defaultCoverImage,
        subject: subject.trim(),
        chapter: chapter.trim(),
      },
      tempId
    )
      .then((newDeckId) => {
        console.log(`[CreateDeckScreen] Deck creation confirmed for temp ID ${tempId}, real ID: ${newDeckId}.`);
      })
      .catch((err) => {
        const errorMessage = err.message || useFlashcardStore.getState().error || "Could not create deck.";
        console.error(`[CreateDeckScreen] Error creating deck (tempId: ${tempId}): ${errorMessage}.`);
        Alert.alert(
          "Creation Failed",
          `The deck "${name.trim()}" was created optimistically, but failed to save to the server. Error: ${errorMessage}`
        );
      })
      .finally(() => {
      });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen 
        options={{
          title: "Create New Deck",
          headerShown: false,
        }} 
      />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => !isCreating && router.back()}
          disabled={isCreating}
        >
          <ArrowLeft size={24} color={isCreating ? colors.gray[400] : colors.textDark} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Create New Deck</Text>
        
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => !isCreating && router.back()}
          disabled={isCreating}
        >
          <X size={24} color={isCreating ? colors.gray[400] : colors.textDark} />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formGroup}>
          <Text style={styles.label}>Deck Name</Text>
          <TextInput
            style={[styles.input, nameError ? styles.inputError : null]}
            placeholder="Max 2 words (12 letters each)"
            value={name}
            onChangeText={handleNameChange}
            placeholderTextColor={colors.gray[400]}
            editable={!isCreating}
          />
          {nameError && <Text style={styles.errorText}>{nameError}</Text>}
          <Text style={styles.charCount}>{name.split(/\s+/).filter(w => w.length > 0).length}/2 words</Text>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter deck description"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            placeholderTextColor={colors.gray[400]}
            editable={!isCreating}
          />
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Subject <Text style={styles.requiredStar}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Physics, Mathematics"
            value={subject}
            onChangeText={setSubject}
            placeholderTextColor={colors.gray[400]}
            editable={!isCreating}
          />
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Chapter/Topic <Text style={styles.requiredStar}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Mechanics, Calculus"
            value={chapter}
            onChangeText={setChapter}
            placeholderTextColor={colors.gray[400]}
            editable={!isCreating}
          />
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Cover Photo</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.coverPhotosContainer}
          >
            {coverPhotoOptions.map(photo => (
              <TouchableOpacity 
                key={photo.id}
                style={[
                  styles.coverPhotoOption,
                  coverImage === photo.url && styles.selectedCoverPhoto
                ]}
                onPress={() => setCoverImage(photo.url)}
                disabled={isCreating}
              >
                <Image 
                  source={{ uri: photo.url }}
                  style={styles.coverPhotoImage}
                  resizeMode="cover"
                />
                <Text style={[
                  styles.coverPhotoLabel,
                  coverImage === photo.url && styles.selectedCoverPhotoLabel
                ]}>
                  {photo.label}
                </Text>
                {coverImage === photo.url && (
                  <View style={styles.selectedIndicator}>
                    <Text style={styles.selectedIndicatorText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
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
              editable={!isCreating}
            />
            <TouchableOpacity 
              style={styles.addTagButton}
              onPress={handleAddTag}
              disabled={isCreating}
            >
              <Plus size={20} color={isCreating ? colors.gray[300] : colors.primary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.tagsContainer}>
            {tags.map(tag => (
              <View key={tag} style={styles.tagBadge}>
                <Text style={styles.tagText}>{tag}</Text>
                <TouchableOpacity 
                  style={styles.removeTagButton}
                  onPress={() => handleRemoveTag(tag)}
                  disabled={isCreating}
                >
                  <X size={14} color={isCreating ? colors.gray[400] : colors.textDark} />
                </TouchableOpacity>
              </View>
            ))}
            {tags.length === 0 && (
              <Text style={styles.noTagsText}>No tags added yet</Text>
            )}
          </View>
        </View>
        
        <TouchableOpacity 
          style={[styles.createButton, isCreating && styles.createButtonDisabled]}
          onPress={handleCreateDeck}
          disabled={isCreating}
        >
          <Text style={styles.createButtonText}>
            {isCreating ? "Creating Deck..." : "Create Deck"}
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
  tagInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  tagInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textDark,
  },
  addTagButton: {
    padding: 12,
    borderLeftWidth: 1,
    borderLeftColor: colors.gray[300],
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
  },
  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.gray[200],
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 14,
    color: colors.primaryDark,
    marginRight: 6,
  },
  removeTagButton: {
    marginLeft: 4,
  },
  noTagsText: {
    fontSize: 14,
    color: colors.textLight,
    fontStyle: "italic",
  },
  requiredStar: {
    color: colors.error,
    fontWeight: "bold",
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40,
  },
  createButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 4,
  },
  charCount: {
    fontSize: 12,
    color: colors.textLight,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  coverPhotosContainer: {
    paddingHorizontal: 4,
  },
  coverPhotoOption: {
    width: 100,
    marginHorizontal: 6,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.gray[200],
    backgroundColor: colors.gray[50],
    position: 'relative',
  },
  selectedCoverPhoto: {
    borderColor: colors.primary,
    borderWidth: 3,
  },
  coverPhotoImage: {
    width: '100%',
    height: 70,
  },
  coverPhotoLabel: {
    fontSize: 12,
    color: colors.textDark,
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  selectedCoverPhotoLabel: {
    fontWeight: '600',
    color: colors.primary,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedIndicatorText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});