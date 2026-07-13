import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { expoDb } from './index';
import { migrations } from './migrations/bundle';

const CURRENT_DATABASE_VERSION = 1;

function isExpectedExistingSchemaError(error: any) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('already exists') || message.includes('duplicate column');
}

function getColumns(tableName: string) {
  return new Set(
    expoDb.getAllSync<{ name: string }>(`PRAGMA table_info(${tableName})`).map((row) => row.name),
  );
}

function migrateDatabase() {
  const versionRow = expoDb.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = Number(versionRow?.user_version || 0);

  if (currentVersion < 1) {
    expoDb.execSync('BEGIN IMMEDIATE');
    try {
      // Version 1 first normalizes installations created by the pre-versioned
      // runner, then adds account ownership to the offline queue.
      for (const statement of migrations) {
        try {
          expoDb.execSync(statement);
        } catch (error) {
          if (!isExpectedExistingSchemaError(error)) throw error;
        }
      }

      const syncColumns = getColumns('sync_queue');
      if (!syncColumns.has('user_id')) {
        expoDb.execSync('ALTER TABLE sync_queue ADD COLUMN user_id text');
      }
      expoDb.execSync(`UPDATE sync_queue
        SET user_id = (
          SELECT MIN(user_id) FROM user_flashcard_status
          WHERE flashcard_id = sync_queue.entity_id
        )
        WHERE user_id IS NULL
          AND entity_type = 'card_status'
          AND (
            SELECT COUNT(DISTINCT user_id) FROM user_flashcard_status
            WHERE flashcard_id = sync_queue.entity_id
          ) = 1`);
      expoDb.execSync(`UPDATE sync_queue
        SET user_id = (
          SELECT MIN(user_id) FROM user_active_chapters
          WHERE deck_id = sync_queue.entity_id
        )
        WHERE user_id IS NULL
          AND entity_type = 'active_chapter'
          AND (
            SELECT COUNT(DISTINCT user_id) FROM user_active_chapters
            WHERE deck_id = sync_queue.entity_id
          ) = 1`);
      expoDb.execSync('CREATE INDEX IF NOT EXISTS sync_queue_user_status_idx ON sync_queue (user_id, status)');

      const statusIndexes = expoDb.getAllSync<{ name: string; unique: number }>(
        'PRAGMA index_list(user_flashcard_status)',
      );
      const userCardIndex = statusIndexes.find((index) => index.name === 'user_card_idx');
      if (!userCardIndex || Number(userCardIndex.unique) !== 1) {
        // Very early builds created this as a non-unique index. Keep the most
        // recently inserted local row before enforcing one status per user/card.
        expoDb.execSync(`DELETE FROM user_flashcard_status
          WHERE rowid NOT IN (
            SELECT MAX(rowid) FROM user_flashcard_status GROUP BY user_id, flashcard_id
          )`);
        expoDb.execSync('DROP INDEX IF EXISTS user_card_idx');
        expoDb.execSync('CREATE UNIQUE INDEX user_card_idx ON user_flashcard_status (user_id, flashcard_id)');
      }

      expoDb.execSync(`PRAGMA user_version = ${CURRENT_DATABASE_VERSION}`);
      expoDb.execSync('COMMIT');
    } catch (error) {
      try { expoDb.execSync('ROLLBACK'); } catch {}
      throw error;
    }
  }

  const requiredSyncColumns = ['id', 'user_id', 'entity_type', 'entity_id', 'status'];
  const syncColumns = getColumns('sync_queue');
  const missing = requiredSyncColumns.filter((column) => !syncColumns.has(column));
  if (missing.length > 0) {
    throw new Error(`Local database is missing required fields: ${missing.join(', ')}`);
  }

  const uniqueStatusIndex = expoDb
    .getAllSync<{ name: string; unique: number }>('PRAGMA index_list(user_flashcard_status)')
    .find((index) => index.name === 'user_card_idx');
  if (!uniqueStatusIndex || Number(uniqueStatusIndex.unique) !== 1) {
    throw new Error('Local card progress index is invalid.');
  }
}

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      migrateDatabase();
      setIsReady(true);
    } catch (migrationError: any) {
      console.error('[SQLite] Migration failed:', migrationError);
      setError(migrationError?.message || 'Local database setup failed.');
    }
  }, []);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Cramit couldn’t open your study data</Text>
        <Text style={styles.message}>{error}</Text>
        <Text style={styles.hint}>Close and reopen the app. If this continues, update to the latest build.</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#5e6ad2" />
        <Text style={styles.message}>Preparing your offline study data…</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0B0F', padding: 28 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  message: { color: '#A0A4AF', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 12 },
  hint: { color: '#6F7480', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 10 },
});
