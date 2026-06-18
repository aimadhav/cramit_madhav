import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';

export function Text(props: TextProps) {
  const incomingStyle = StyleSheet.flatten(props.style) || {};
  let fontFamily = 'Outfit_400Regular';

  if (incomingStyle.fontWeight === 'bold' || incomingStyle.fontWeight === '700' || incomingStyle.fontWeight === '800' || incomingStyle.fontWeight === '900') {
    fontFamily = 'Outfit_700Bold';
  } else if (incomingStyle.fontWeight === '600' || incomingStyle.fontWeight === '500') {
    fontFamily = 'Outfit_600SemiBold';
  }

  return (
    <RNText
      {...props}
      style={[
        {
          fontFamily,
          includeFontPadding: false,
        },
        props.style,
        {
          fontWeight: undefined,
          // Add a tiny buffer to prevent clipping on Android during font swaps/renders
          paddingRight: 2,
        }
      ]}
    />
  );
}
