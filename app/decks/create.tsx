import React, { useState } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Plus, Tag, ArrowLeft } from "lucide-react-native";
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
  
  const handleNameChange = (text: string) => {
    // Split into words
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    
    // Check word count limit (max 2 words)
    if (words.length <= 2) {
      // Check if any word exceeds 12 letters
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
  
  const handleCreateDeck = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a deck name");
      return;
    }
    
    // Check character length
    if (name.length > 12) {
      setNameError("Deck name cannot exceed 12 characters");
      return;
    }
    
    // Check word count
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
    
    // Select default cover image based on the subject
    let defaultCoverImage = "https://images.unsplash.com/photo-1635070041078-e363dbe005cb";
    
    const subjectLower = subject.trim().toLowerCase();
    if (subjectLower.includes("bio")) {
      // Biology image
      defaultCoverImage = "https://images.unsplash.com/photo-1530026186672-2cd00ffc50fe";
    } else if (subjectLower.includes("chem")) {
      // Chemistry image
      defaultCoverImage = "https://images.unsplash.com/photo-1614935151651-0bea6508db6b";
    } else if (subjectLower.includes("math")) {
      // Math image
      defaultCoverImage = "https://images.unsplash.com/photo-1635070041078-e363dbe005cb";
    } else if (subjectLower.includes("physics")) {
      // Physics image
      defaultCoverImage = "https://images.unsplash.com/photo-1581093458791-9f3c3ae93ef1"; 
    }
    
    const newDeckId = await addDeck({
      name: name.trim(),
      description: description.trim() || "No description provided",
      tags: tags.length > 0 ? tags : ["uncategorized"],
      isPremium: false,
      coverImage: coverImage || defaultCoverImage,
      subject: subject.trim(),
      chapter: chapter.trim(),
    });
    
    if (newDeckId) {
      Alert.alert(
        "Success",
        "Deck created successfully!",
        [
          {
            text: "OK",
            onPress: () => router.replace(`/deck/${newDeckId}`)
          }
        ]
      );
    } else {
      Alert.alert("Error", "Could not create deck. Please try again.");
    }
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
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={colors.textDark} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Create New Deck</Text>
        
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
        <View style={styles.formGroup}>
          <Text style={styles.label}>Deck Name</Text>
          <TextInput
            style={[styles.input, nameError ? styles.inputError : null]}
            placeholder="Max 2 words (12 letters each)"
            value={name}
            onChangeText={handleNameChange}
            placeholderTextColor={colors.gray[400]}
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
          />
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
          style={styles.createButton}
          onPress={handleCreateDeck}
        >
          <Text style={styles.createButtonText}>Create Deck</Text>
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
});