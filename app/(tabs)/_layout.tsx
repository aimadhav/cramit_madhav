import React from "react";
import { Tabs } from "expo-router";
import { Home, BookOpen, Settings, Search } from "lucide-react-native";
import { Image, View, StyleSheet } from "react-native";
import { Text } from "@/components/AppText";;

import { useThemeColors } from "@/hooks/useThemeColors";

export default function TabLayout() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray[500],
        headerShown: route.name === "index",
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.background,
          height: 75,
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 20,
        },
        headerTitle: ({children}) => (
          <View style={{position: 'absolute', left: 5, bottom: 0}}>
            <Text style={styles.headerText}>{children}</Text>
          </View>
        ),
        headerRight: () => (
          <View style={{paddingRight: 16, paddingBottom: 5}}>
            <Image 
              source={require("@/assets/images/finallogo.png")} 
              style={styles.logo} 
              resizeMode="contain"
            />
          </View>
        ),
        headerLeft: () => null,
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{
          title: "Decks",
          tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  logo: {
    width: 100,
    height: 30,
  },
  headerText: {
    color: colors.textDark,
    fontSize: 20,
    fontWeight: 'bold',
    paddingBottom: 4,
  },
});