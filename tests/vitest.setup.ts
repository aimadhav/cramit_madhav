// tests/vitest.setup.ts
import dotenv from 'dotenv';
import path from 'path';
import { vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

// Load environment variables from .env at the project root
// Assuming vitest.setup.ts is in <project_root>/tests/
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Define __DEV__ globally for Vitest environment
(global as any).__DEV__ = true; // Or false, depending on what behavior you want to test by default

// Define process.env.EXPO_OS
process.env.EXPO_OS = 'test'; // Mock OS, can be 'ios', 'android', 'web', or any string for tests

// Mock global.expo and global.expo.NativeModules if they are causing issues
if (typeof (global as any).expo === 'undefined') {
  (global as any).expo = {};
}
if (typeof (global as any).expo.NativeModules === 'undefined') {
  (global as any).expo.NativeModules = {}; 
}
// If specific native modules from expo are expected, mock them here, e.g.:
// (global as any).expo.NativeModules.ExponentFileSystem = { ...mocked functions... };

// Mock Prisma Client for tests
vi.mock('@prisma/client', () => {
  const mPrismaClient = {
    // Mock specific models and methods as needed by your tests
    // e.g., user: { findUnique: vi.fn(), create: vi.fn() },
    $connect: vi.fn(() => Promise.resolve()),
    $disconnect: vi.fn(() => Promise.resolve()),
    // Add any other specific models or methods your tRPC routes/store might touch if not fully mocked via tRPC client
  };
  return { PrismaClient: vi.fn(() => mPrismaClient) };
});

// Setup: ensure test database is ready before tests run
// This might involve running migrations or seeding
if (process.env.NODE_ENV === 'test') {
  try {
    // Example: Set a specific test database URL if not already set by cross-env
    // process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://user:pass@localhost:5432/test_db';
    console.log('Vitest setup: DATABASE_URL set to TEST_DATABASE_URL for testing.');
    // Optional: Run migrations - adjust command as needed for your setup
    // execSync('npx prisma migrate deploy --schema=./prisma/schema.prisma', { stdio: 'inherit' });
  } catch (error) { 
    console.error('Failed to setup test database:', error);
    // process.exit(1); // Optionally exit if DB setup is critical
  }
}

// Cleanup: (Optional) actions after all tests are done
// e.g., vi.restoreAllMocks(); or clean up test database

if (process.env.NODE_ENV === 'test') {
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    console.log(`Vitest setup: DATABASE_URL set to TEST_DATABASE_URL for testing.`);
  } else {
    console.error(
      'ERROR in Vitest setup: TEST_DATABASE_URL is not defined in your .env file. Tests cannot safely proceed.'
    );
    // Optionally, throw an error to halt tests if the test DB URL isn't set
    // throw new Error('TEST_DATABASE_URL is not defined. Halting test execution.');
  }
} 