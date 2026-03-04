import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated } from "react-native";
import { Text } from "@/components/AppText";;
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const OfflineStatusBar = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [slideAnim] = useState(new Animated.Value(-30));
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? true);
      
      if (!state.isConnected) {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.spring(slideAnim, {
          toValue: -30,
          useNativeDriver: true,
        }).start();
      }
    });

    return () => unsubscribe();
  }, []);

  if (isConnected) return null;

  return (
    <Animated.View style={[
      styles.container, 
      { 
        transform: [{ translateY: slideAnim }],
        paddingTop: insets.top
      }
    ]}>
      <Text style={styles.text}>You are offline</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#666666',
    padding: 6,
    alignItems: 'center',
    zIndex: 1000,
  },
  text: {
    color: 'white',
    fontWeight: '500',
    fontSize: 12,
  },
}); 