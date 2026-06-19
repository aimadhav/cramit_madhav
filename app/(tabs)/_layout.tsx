import React from "react";
import { Tabs, useSegments, usePathname } from "expo-router";
import { Home, BookOpen, BarChart2 } from "lucide-react-native";
import { View, StyleSheet, TouchableOpacity } from "react-native";

import { useThemeColors } from "@/hooks/useThemeColors";

// Custom Tab Bar Button for the Home Screen
const HomeTabButton = (props: any) => {
  const { children, onPress, active, style, ...rest } = props;
  
  if (!active) {
    return (
      <TouchableOpacity
        {...rest}
        style={[style, { overflow: 'visible' }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[style, { overflow: 'visible', alignItems: 'center' }]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={{ alignItems: 'center', width: 80, height: '100%', overflow: 'visible' }}
      >
        <View style={styles.homeTabButtonPopped}>
          {React.Children.map(children, (child, index) => {
            if (index === 0) return child; 
            return null; 
          })}
        </View>
        <View style={styles.homeLabelActiveContainer}>
          {React.Children.map(children, (child, index) => {
            if (index === 1) return child; 
            return null;
          })}
        </View>
      </TouchableOpacity>
    </View>
  );
};



export default function TabLayout() {
  const colors = useThemeColors();
  const pathname = usePathname();
  
  // Home is active only if the exact active pathname is / or /index
  const isHomeActive = pathname === "/" || pathname === "/index";
  
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: '#5e6ad2',
        tabBarInactiveTintColor: '#5f6166',
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: '#0b0c0e',
          borderTopColor: '#2a2c32',
          height: 88,
          paddingBottom: 30,
          paddingTop: 10,
          borderTopWidth: 1,
          elevation: 0,
          overflow: 'visible', // Ensure popped button isn't clipped
        },
        tabBarLabelStyle: {
          fontFamily: 'Outfit_600SemiBold',
          fontSize: 10,
          marginTop: -5,
        }
      })}
    >
      <Tabs.Screen
        name="decks"
        options={{
          title: "Cram",
          tabBarIcon: ({ color, focused }) => (
            <BookOpen size={24} color={color} fill={focused ? color : 'none'} />
          ),
          tabBarLabelStyle: {
            fontFamily: 'Outfit_600SemiBold',
            fontSize: 10,
            marginTop: 2,
          }
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarActiveTintColor: "#FFFFFF",
          tabBarIcon: ({ color, focused }) => (
            <Home 
              size={focused ? 30 : 24} 
              color={focused ? "#FFFFFF" : "#5f6166"} 
              fill={focused ? "#FFFFFF" : "none"} 
            />
          ),
          tabBarLabelStyle: {
            fontFamily: isHomeActive ? 'Outfit_700Bold' : 'Outfit_600SemiBold',
            fontSize: isHomeActive ? 11 : 10,
            color: isHomeActive ? "#FFFFFF" : "#5f6166",
            marginTop: isHomeActive ? 4 : 2,
          },
          tabBarButton: (props) => (
            <HomeTabButton {...props} active={isHomeActive} />
          )
        }}
      />

      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ color, focused }) => (
            <BarChart2 size={24} color={color} fill={focused ? color : 'none'} />
          ),
          tabBarLabelStyle: {
            fontFamily: 'Outfit_600SemiBold',
            fontSize: 10,
            marginTop: 2,
          }
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  homeTabButtonPopped: {
    width: 64,
    height: 64,
    borderRadius: 20, 
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#5e6ad2',
    position: 'absolute',
    top: -28, // Lift it slightly more
    zIndex: 100,
    shadowColor: '#5e6ad2',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 15,
  },
  homeLabelActiveContainer: {

    position: 'absolute',
    bottom: 8, // Tuned to perfectly align the bottom of the text with others
    alignItems: 'center',
    justifyContent: 'center',
  },
});
