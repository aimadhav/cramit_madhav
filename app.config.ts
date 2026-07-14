import type { ConfigContext, ExpoConfig } from 'expo/config';

const BETA_VARIANT = 'beta';

function requireReleaseEnvironment(profile: string | undefined) {
  if (!['preview', 'production'].includes(profile ?? '')) return;

  const required = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_SENTRY_DSN',
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing release environment variables: ${missing.join(', ')}`);
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const appVariant = process.env.APP_VARIANT === BETA_VARIANT ? BETA_VARIANT : 'production';
  const isBeta = appVariant === BETA_VARIANT;

  requireReleaseEnvironment(profile);

  const sentryOrganization = process.env.SENTRY_ORG ?? 'cramit';
  const sentryProject = process.env.SENTRY_PROJECT ?? 'react-native';
  const sentryPlugin: string | [string, { organization: string; project: string }] = sentryOrganization && sentryProject
    ? [
        '@sentry/react-native',
        {
          organization: sentryOrganization,
          project: sentryProject,
        },
      ]
    : '@sentry/react-native';

  return {
    ...config,
    name: isBeta ? 'Cramit Beta' : 'Cramit',
    slug: config.slug ?? 'madhavjoshi',
    scheme: isBeta ? 'cramit-beta' : 'cramit',
    ios: {
      ...config.ios,
      bundleIdentifier: isBeta ? 'com.cramit.app.beta' : 'com.cramit.app',
    },
    android: {
      ...config.android,
      package: isBeta ? 'com.cramit.app.beta' : 'com.cramit.app',
    },
    plugins: (config.plugins ?? []).map((plugin) => (
      plugin === '@sentry/react-native' ? sentryPlugin : plugin
    )),
    extra: {
      ...config.extra,
      appVariant,
      legal: {
        privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL
          ?? 'https://aimadhav.github.io/cramit_madhav/privacy.html',
        accountDeletionUrl: process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL
          ?? 'https://aimadhav.github.io/cramit_madhav/delete-account.html',
        supportUrl: process.env.EXPO_PUBLIC_SUPPORT_URL
          ?? 'https://aimadhav.github.io/cramit_madhav/support.html',
      },
    },
  };
};
