const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Opt-out of package.json:exports support as per Expo SDK 53 known issues
// and Supabase recommendations for React Native.
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: false,
  unstable_conditionNames: ['browser', 'require', 'react-native'],
  assetExts: [...config.resolver.assetExts, 'txt'],
};

module.exports = config; 