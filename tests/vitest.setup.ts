// tests/vitest.setup.ts
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env at the project root
// Assuming vitest.setup.ts is in <project_root>/tests/
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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