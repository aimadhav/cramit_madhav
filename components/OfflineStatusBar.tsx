import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from "react-native";
import { WifiOff } from 'lucide-react-native';
import { Text } from "@/components/AppText";
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const OfflineStatusBar = () => {
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = useRef(new Animated.Value(-40)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
      
      if (offline) {
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 18,
          stiffness: 220,
          useNativeDriver: true,
        }).start();
      } else {
        slideAnim.setValue(-40);
      }
    });

    return () => unsubscribe();
  }, [slideAnim]);

  if (!isOffline) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLabel="You are offline"
      style={[
        styles.overlay,
        {
          top: Math.max(insets.top - 1, 0),
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.pill}>
        <WifiOff size={12} color="#e8b36a" strokeWidth={2.4} />
        <Text style={styles.text}>Offline</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 12,
  },
  pill: {
    height: 25,
    paddingHorizontal: 11,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1b1815',
    borderWidth: 1,
    borderColor: '#4a3824',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
  },
  text: {
    color: '#f2c27f',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
  },
});
