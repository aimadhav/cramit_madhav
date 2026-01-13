const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Opt-out of package.json:exports support as per Expo SDK 53 known issues
// and Supabase recommendations for React Native.
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: false,
  // It's often recommended for React Native, especially with libraries like Supabase,
  // to ensure 'react-native' is a condition, and to list conditions explicitly.
  // Default conditions usually include 'require', 'import'. 
  // Supabase specifically mentions issues if 'browser' takes precedence over 'react-native' for some of its modules.
  unstable_conditionNames: ['browser', 'require', 'react-native'], 
};

module.exports = config; 