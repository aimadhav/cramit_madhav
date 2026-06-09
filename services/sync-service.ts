import { db } from '@/db';
import * as schema from '@/db/schema';
import { supabase } from '@/lib/supabase';
import { eq, asc } from 'drizzle-orm';

export class SyncService {
  private static isSyncing = false;

  /**
   * Processes the local sync queue and pushes changes to Supabase
   */
  static async pushChanges(userId: string) {
    if (this.isSyncing || !userId) return;
    this.isSyncing = true;

    try {
      const tasks = await db.query.syncQueue.findMany({
        where: eq(schema.syncQueue.status, 'pending'),
        orderBy: [asc(schema.syncQueue.createdAt)],
        limit: 50,
      });

      if (tasks.length === 0) return;

      console.log(`📡 [SyncService] Pushing ${tasks.length} changes to cloud...`);

      for (const task of tasks) {
        // SKIP LOCAL TEST CARDS (Prevent Foreign Key Violations)
        if (task.entityId.includes('test') || task.entityId.startsWith('temp_')) {
           await db.update(schema.syncQueue)
              .set({ status: 'synced', updatedAt: Date.now() })
              .where(eq(schema.syncQueue.id, task.id));
           continue;
        }

        try {
          const payload = JSON.parse(task.payload);
          let success = false;

          switch (task.entityType) {
            case 'card_status':
              success = await this.syncCardStatus(userId, task.entityId, payload);
              break;
            case 'deck':
              success = true;
              break;
          }

          if (success) {
            await db.update(schema.syncQueue)
              .set({ status: 'synced', updatedAt: Date.now() })
              .where(eq(schema.syncQueue.id, task.id));
          } else {
             // If it failed but it was a "Missing Record" error on Supabase,
             // we mark it as synced to avoid blocking the queue.
             await db.update(schema.syncQueue)
              .set({ status: 'failed_on_server', updatedAt: Date.now() })
              .where(eq(schema.syncQueue.id, task.id));
          }
        } catch (e: any) {
          console.error(`❌ [SyncService] Task processing crash:`, e.message);
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private static async syncCardStatus(userId: string, flashcardId: string, data: any) {
    try {
      const now = Date.now();
      
      const parseDate = (val: any): Date => {
        if (!val) return new Date(now);
        const d = new Date(typeof val === 'number' ? val : val);
        return isNaN(d.getTime()) ? new Date(now) : d;
      };

      // REMOVED 'id' from payload to let Supabase handle generation
      // This prevents "RLS Policy Violation" caused by ID conflicts.
      const supabaseData = {
        user_id: userId,
        flashcard_id: flashcardId,
        interval: Number(data.interval || 1),
        stability: Number(data.stability || 0),
        difficulty: Number(data.difficulty || 0),
        repetitions: Number(data.repetitions || 0),
        due_date: parseDate(data.due_date || data.dueDate).toISOString(),
        last_reviewed: (data.last_reviewed || data.lastReviewed) 
          ? parseDate(data.last_reviewed || data.lastReviewed).toISOString() 
          : null,
        is_bookmarked: Boolean(data.is_bookmarked || data.isBookmarked),
        notes: String(data.notes || ''),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_flashcard_statuses')
        .upsert(supabaseData, { onConflict: 'user_id,flashcard_id' });

      if (error) {
        console.error(`❌ [Supabase Sync] Upsert failed for ${flashcardId}:`, error.message);
        return false;
      }

      return true;
    } catch (e: any) {
      console.error(`❌ [SyncService] Failed to parse card status for ${flashcardId}:`, e.message);
      return false;
    }
  }

  /**
   * STAGE A: Downloads user progress (mastery, due dates)
   */
  static async pullStatuses(userId: string) {
    console.log('📡 [SyncService] Pulling progress for user:', userId);
    try {
      const { supabase } = require('@/lib/supabase');
      const { db } = require('@/db');
      const { userFlashcardStatus } = require('@/db/schema');

      // Fetch cloud status
      const { data, error } = await supabase
        .from('user_flashcard_statuses')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      if (data) {
        console.log(`📡 [SyncService] Found ${data.length} cloud statuses. Mirroring to SQLite...`);
        for (const row of data) {
          await db.insert(userFlashcardStatus).values({
            id: row.id,
            userId: row.user_id,
            flashcardId: row.flashcard_id,
            interval: row.interval,
            stability: row.stability,
            difficulty: row.difficulty,
            repetitions: row.repetitions,
            due_date: new Date(row.due_date).getTime(),
            lastReviewed: row.last_reviewed ? new Date(row.last_reviewed).getTime() : null,
            isBookmarked: row.is_bookmarked,
            notes: row.notes,
            createdAt: new Date(row.created_at).getTime(),
            updatedAt: new Date(row.updated_at).getTime(),
          }).onConflictDoUpdate({
            target: [userFlashcardStatus.userId, userFlashcardStatus.flashcardId],
            set: {
              interval: row.interval,
              stability: row.stability,
              difficulty: row.difficulty,
              repetitions: row.repetitions,
              due_date: new Date(row.due_date).getTime(),
              lastReviewed: row.last_reviewed ? new Date(row.last_reviewed).getTime() : null,
              isBookmarked: row.is_bookmarked,
              notes: row.notes,
              updatedAt: Date.now()
            }
          });
        }
      }
      return true;
    } catch (e: any) {
      console.error('❌ [SyncService] pullStatuses failed:', e.message);
      return false;
    }
  }

  /**
   * STAGE B: Downloads library metadata (Decks & Rooms)
   */
  static async pullDecks() {
    console.log('📡 [SyncService] Refreshing Library index...');
    try {
      const { supabase } = require('@/lib/supabase');
      const { DatabaseService } = require('./database-service');

      // Broaden search to ensure seeded decks are found
      const { data, error } = await supabase.from('decks').select('*');
      if (error) throw error;

      console.log(`📡 [SyncService] Cloud Scan: Found ${data?.length || 0} decks.`);

      if (data) {
        for (const deck of data) {
          console.log(`📡 [SyncService] Syncing: ${deck.name} (ID: ${deck.id})`);
          await DatabaseService.upsertDeck(deck, []);
        }
      }
      return true;
    } catch (e: any) {
      console.error('❌ [SyncService] pullDecks failed:', e.message);
      return false;
    }
  }

  /**
   * STAGE C: Full atomic download of a specific deck (Cards + Images)
   */
  static async downloadDeckContent(deckId: string) {
    console.log(`📡 [SyncService] Downloading full content for deck: ${deckId}`);
    try {
      const { supabase } = require('@/lib/supabase');
      const { DatabaseService } = require('./database-service');

      // 1. Fetch Cards
      const { data: cards, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('deck_id', deckId);

      if (error) throw error;

      // 2. Fetch Deck Metadata to get the full object
      const { data: deck } = await supabase.from('decks').select('*').eq('id', deckId).single();

      // 3. Save to local SQLite (DatabaseService handles image downloading inside)
      if (deck && cards) {
        await DatabaseService.upsertDeck(deck, cards);
      }
      
      return true;
    } catch (e: any) {
      console.error(`❌ [SyncService] downloadDeckContent failed for ${deckId}:`, e.message);
      return false;
    }
  }

  /**
   * Orchestrator: Pushes changes and pulls latest progress
   */
  static async fullSync(userId: string) {
    if (this.isSyncing) return;
    console.log('🔄 [SyncEngine] Starting Full Orchestration...');
    
    await this.pushChanges(userId);
    await this.pullStatuses(userId);
    await this.pullDecks();
    
    console.log('✅ [SyncEngine] Full sync cycle complete.');
  }
}
