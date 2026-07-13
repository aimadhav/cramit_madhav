import { Link, Stack } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Page not found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This page isn’t available</Text>
        <Text style={styles.message}>The link may be old, or the screen may have moved.</Text>
        <Link href="/" style={styles.link}>Go to home</Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#0A0B0F' },
  title: { color: '#FFFFFF', fontSize: 22, fontFamily: 'Outfit_700Bold', textAlign: 'center' },
  message: { color: '#8B91A5', fontSize: 14, textAlign: 'center', marginTop: 8 },
  link: { color: '#8E98FF', marginTop: 22, paddingVertical: 12, fontFamily: 'Outfit_700Bold' },
});
