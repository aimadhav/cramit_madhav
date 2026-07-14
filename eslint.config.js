const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: [
      '.expo/**',
      '.codex-remote-attachments/**',
      'coverage/**',
      'dist/**',
      'docs/**',
      'node_modules/**',
      'supabase/functions/**',
    ],
  },
]);
