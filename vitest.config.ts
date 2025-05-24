import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Use Jest-compatible globals (describe, it, expect, etc.)
    environment: 'node', // Or 'jsdom' if you were testing frontend components
    include: ['**/*.test.ts'], // Pattern to find test files
    setupFiles: ['./tests/vitest.setup.ts'], // We can add this later for Prisma client setup
    poolOptions: { // Added for sequential execution
      threads: {
        singleThread: true,
      },
    },
    // reporters: ['default', 'html'], // Optional: for HTML reports
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html'], // Coverage reports
      reportsDirectory: './coverage',
      all: true, // Include all files in coverage, not just tested ones
      include: ['backend/trpc/**/*.ts'], // Specify what to include in coverage (your source files)
      exclude: [ // What to exclude from coverage
        'backend/trpc/**/*.test.ts',
        'backend/trpc/**/app-router.ts', // Usually entry points or simple aggregators
        'backend/trpc/**/create-context.ts', // Context creation might be hard to unit test directly
        'backend/trpc/**/create-router.ts', // Router creation utility
        'node_modules/**',
        'dist/**',
        'coverage/**',
        'vitest.config.ts',
      ],
    },
  },
}); 