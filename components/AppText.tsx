import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';

export function Text(props: TextProps) {
  const style = StyleSheet.flatten(props.style) || {};
  let fontFamily = 'Outfit_400Regular';

  if (style.fontWeight === 'bold' || style.fontWeight === '700' || style.fontWeight === '800' || style.fontWeight === '900') {
    fontFamily = 'Outfit_700Bold';
  } else if (style.fontWeight === '600' || style.fontWeight === '500') {
    fontFamily = 'Outfit_600SemiBold';
  }

  // Google Outfit can cause horizontal clipping on Android if the geometric char bounding box exceeds the OS calculation.
  // We add a tiny 2px padding buffer to the right of all text nodes to prevent the last character from truncating.
  return <RNText {...props} style={[props.style, { fontFamily, fontWeight: undefined, paddingRight: 2 }]} />;
}
