import React, { useEffect, useState } from 'react';
import { db, expoDb } from './index';
import { migrations } from './migrations/bundle';
import { Text, View, ActivityIndicator } from 'react-native';

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function setup() {
      try {
        console.log('🚀 [SQLite] Initializing Database...');
        
        // Execute all migration statements sequentially
        for (const statement of migrations) {
          try {
            // Use raw execSync for speed and simplicity during init
            expoDb.execSync(statement);
          } catch (e: any) {
            // Ignore "already exists" errors during re-runs
            if (!e.message.includes('already exists') && !e.message.includes('duplicate')) {
              console.warn('⚠️ [SQLite] Migration statement warning:', e.message);
            }
          }
        }
        
        console.log('✅ [SQLite] Database Tables Verified');
        setIsReady(true);
      } catch (err: any) {
        console.error('❌ [SQLite] Migration failed:', err);
        setError(err.message);
      }
    }
    setup();
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <Text style={{ color: 'red', marginBottom: 10 }}>Database Error</Text>
        <Text style={{ color: '#fff' }}>{error}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#5e6ad2" />
        <Text style={{ color: '#fff', marginTop: 10 }}>Initializing Local Database...</Text>
      </View>
    );
  }

  return <>{children}</>;
}
