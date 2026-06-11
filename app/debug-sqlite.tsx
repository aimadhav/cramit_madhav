import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text } from '@/components/AppText';
import { Stack } from 'expo-router';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { count, eq } from 'drizzle-orm';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Database, Trash2, PlusCircle, RefreshCw, Smartphone, CloudOff } from 'lucide-react-native';

export default function DebugSqliteScreen() {
  const [deckCount, setDeckCount] = useState(0);
  const [cardCount, setCardCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [syncQueueData, setSyncQueueData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshStats = async () => {
    setIsLoading(true);
    try {
      // Check if tables exist first to avoid crashing
      const { expoDb } = require('@/db');
   
      const d = await db.select({ value: count() }).from(schema.decks);
      const c = await db.select({ value: count() }).from(schema.flashcards);
      const q = await db.select().from(schema.syncQueue);
      
      setDeckCount(d[0]?.value ?? 0);
      setCardCount(c[0]?.value ?? 0);
      setSyncQueueCount(q.length);
      setSyncQueueData(q);
    } catch (error: any) {
      console.log('Debugger Refresh Note:', error.message);
      // Don't alert here to avoid spamming "no such table" errors
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const seedTestData = async () => {
    setIsLoading(true);
    try {
      const deckId = `test-deck-${Date.now()}`;
      const now = Date.now();
      
      // 1. Insert Deck
      await db.insert(schema.decks).values({
        id: deckId,
        name: 'Offline Physics 101',
        description: 'Testing the new SQLite architecture',
        createdAt: now,
        updatedAt: now,
        isDownloaded: true,
      });

      // 2. Insert Flashcards
      await db.insert(schema.flashcards).values([
        {
          id: `fc-1-${now}`,
          deckId: deckId,
          frontContent: JSON.stringify([{ type: 'text', value: 'What is the formula for Force?' }]),
          backContent: JSON.stringify([{ type: 'latex', value: 'F = ma' }]),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `fc-2-${now}`,
          deckId: deckId,
          frontContent: JSON.stringify([{ type: 'text', value: 'Speed of light in vacuum?' }]),
          backContent: JSON.stringify([{ type: 'text', value: '299,792,458 m/s' }]),
          createdAt: now,
          updatedAt: now,
        }
      ]);

      // 3. Add a Sync Task (Issue 2)
      await db.insert(schema.syncQueue).values({
        id: `sync-${now}`,
        operation: 'CREATE',
        entityType: 'deck',
        entityId: deckId,
        payload: JSON.stringify({ name: 'Offline Physics 101' }),
        createdAt: now,
        updatedAt: now,
      });

      Alert.alert('Success', 'Local test data seeded!');
      refreshStats();
    } catch (error: any) {
      Alert.alert('Seed Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllData = async () => {
    Alert.alert(
      'Reset Local DB',
      'This will wipe ALL local SQLite tables. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              // DROP TABLES to force recreation with new columns
              const { expoDb } = require('@/db');
              const tables = ['decks', 'flashcards', 'sync_queue', 'study_sessions', 'reviews', 'user_flashcard_status', 'rooms'];
              for (const table of tables) {
                try {
                  expoDb.execSync(`DROP TABLE IF EXISTS ${table};`);
                } catch (e) {
                  console.warn(`Could not drop ${table}`, e);
                }
              }
              Alert.alert('Database Reset', 'Tables dropped. Please restart the app to recreate them.');
              refreshStats();
            } catch (e: any) {
              Alert.alert('Reset Error', e.message);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'SQLite Debugger', headerTitleStyle: { fontFamily: 'Outfit_700Bold' } }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Smartphone size={20} color="#5e6ad2" />
            <Text style={styles.statusTitle}>Local Device Storage</Text>
          </View>
          
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{deckCount}</Text>
              <Text style={styles.statLabel}>Decks</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{cardCount}</Text>
              <Text style={styles.statLabel}>Cards</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{syncQueueCount}</Text>
              <Text style={styles.statLabel}>Pending Sync</Text>
            </View>
          </View>
          
          <View style={[styles.badge, { backgroundColor: '#10B98120', borderColor: '#10B98140' }]}>
            <CloudOff size={14} color="#10B981" />
            <Text style={[styles.badgeText, { color: '#10B981' }]}>OFFLINE-READY</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Operations</Text>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={seedTestData}
          disabled={isLoading}
        >
          <PlusCircle size={20} color="#FFF" />
          <Text style={styles.buttonText}>Seed Test Deck & Cards</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#1F2125' }]} 
          onPress={refreshStats}
          disabled={isLoading}
        >
          <RefreshCw size={20} color="#FFF" />
          <Text style={styles.buttonText}>Refresh Counts</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#EF4444' }]} 
          onPress={clearAllData}
          disabled={isLoading}
        >
          <Trash2 size={20} color="#FFF" />
          <Text style={styles.buttonText}>Wipe SQLite Tables</Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            This screen interacts directly with the local SQLite database. Even if you turn off Wi-Fi, the operations above will work instantly.
          </Text>
        </View>

        {syncQueueData.length > 0 && (
          <View style={{ marginTop: 30 }}>
            <Text style={styles.sectionTitle}>Sync Queue Details</Text>
            {syncQueueData.map((item, idx) => (
              <View key={idx} style={styles.queueItem}>
                <Text style={styles.queueOp}>{item.operation} {item.entityType}</Text>
                <Text style={styles.queueId}>ID: {item.entityId}</Text>
                <Text style={styles.queuePayload} numberOfLines={2}>{item.payload}</Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scroll: {
    padding: 20,
    paddingBottom: 100,
  },
  statusCard: {
    backgroundColor: '#15171B',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2C32',
    marginBottom: 30,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  statusTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    color: '#FFF',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Outfit_700Bold',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#94969a',
    fontFamily: 'Outfit_500Medium',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#94969a',
    marginBottom: 15,
    marginLeft: 5,
  },
  button: {
    backgroundColor: '#5e6ad2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
  },
  infoBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#1A1B1F',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#2A2C32',
  },
  infoText: {
    color: '#5F6166',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'Outfit_500Medium',
  },
  queueItem: {
    backgroundColor: '#15171B',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#5e6ad2',
  },
  queueOp: {
    color: '#FFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    marginBottom: 4,
  },
  queueId: {
    color: '#94969a',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  queuePayload: {
    color: '#5F6166',
    fontSize: 11,
  }
});
