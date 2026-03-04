import React from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import { Text } from "@/components/AppText";;
import { useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Construction } from "lucide-react-native";

import { useThemeColors } from "@/hooks/useThemeColors";

export default function CreateDeckScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <Stack.Screen options={{ title: 'Create Deck', headerShown: true }} />
      
      <View style={styles.content}>
        <Construction size={64} color={colors.gray[400]} />
        <Text style={styles.title}>Coming Soon</Text>
        <Text style={styles.subtitle}>
          Personal deck creation will be available in a future update.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textDark,
    marginTop: 24,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});