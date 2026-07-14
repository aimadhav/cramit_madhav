const { getSentryExpoConfig } = require('@sentry/react-native/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname, {
  annotateReactComponents: true,
  includeWebReplay: false,
});

// Expo SDK 54 may still emit this removed Metro option. Keeping it produces
// an EAS validation warning even though Metro ignores the value.
if (config.watcher) delete config.watcher.unstable_workerThreads;

// Opt-out of package.json:exports support as per Expo SDK 53 known issues
// and Supabase recommendations for React Native.
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: false,
  unstable_conditionNames: ['browser', 'require', 'react-native'],
  assetExts: [...config.resolver.assetExts, 'txt'],
};

module.exports = config;
