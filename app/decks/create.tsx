import React, { useState } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, Image } from "react-native";
import { useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Plus, Tag, Image as ImageIcon } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import colors from "@/constants/colors";
import { useFlashcardStore } from "@/store/flashcard-store";

export default function CreateDeckScreen() {
  const router = useRouter();
  const addDeck = useFlashcardStore(state => state.addDeck);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  
  const handleAddTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags([...tags, currentTag.trim()]);
      setCurrentTag("");
    }
  };
  
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };
  
  const handlePickImage = async () => {
    if (Platform.OS === 'web') {
      Alert.alert("Not available", "This feature is not available on web");
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setCoverImage(result.assets[0].uri);
    }
  };
  
  const handleCreateDeck = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a deck name");
      return;
    }
    
    const deckId = addDeck({
      name: name.trim(),
      description: description.trim() || "No description provided",
      tags: tags.length > 0 ? tags : ["uncategorized"],
      isPremium: false,
      coverImage: coverImage || "https://images.unsplash.com/photo-1635070041078-e363dbe005cb",
      subject: subject.trim() || undefined,
      chapter: chapter.trim() || undefined,
    });
    
    Alert.alert(
      "Success",
      "Deck created successfully!",
      [
        {
          text: "OK",
          onPress: () => router.replace(`/deck/${deckId}`)
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen 
        options={{
          title: "Create New Deck",
          headerRight: () => (
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => router.back()}
            >
              <X size={24} color={colors.textDark} />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formGroup}>
          <Text style={styles.label}>Deck Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter deck name"
            value={name}
            onChangeText={setName}
            placeholderTextColor={colors.gray[400]}
          />
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
          <Text style={styles.label}>Subject (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Physics, Mathematics"
            value={subject}
            onChangeText={setSubject}
            placeholderTextColor={colors.gray[400]}
          />
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Chapter/Topic (Optional)</Text>
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
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Cover Image</Text>
          <TouchableOpacity 
            style={styles.imagePickerButton}
            onPress={handlePickImage}
          >
            {coverImage ? (
              <Image 
                source={{ uri: coverImage }}
                style={styles.coverImagePreview}
              />
            ) : (
              <View style={styles.imagePickerContent}>
                <ImageIcon size={24} color={colors.primary} />
                <Text style={styles.imagePickerText}>Select Image</Text>
              </View>
            )}
          </TouchableOpacity>
          {Platform.OS === 'web' && (
            <Text style={styles.webNote}>
              Note: Image upload is not available on web. A default image will be used.
            </Text>
          )}
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
  coverImagePreview: {
    width: "100%",
    height: "100%",
  },
  webNote: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 8,
    fontStyle: "italic",
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
});