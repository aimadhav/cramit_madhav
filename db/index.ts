import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

export const expoDb = openDatabaseSync('cramit.db');

export const db = drizzle(expoDb, { schema });

/**
 * Helper to initialize the database
 * In a real app, this would be part of a migration runner
 */
export const initDb = async () => {
  // Migration logic would go here
  console.log('📦 [SQLite] Database initialized');
};
