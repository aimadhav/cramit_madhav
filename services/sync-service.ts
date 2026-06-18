import { db } from '@/db';
import * as schema from '@/db/schema';
import { supabase } from '@/lib/supabase';
import { eq, asc, and } from 'drizzle-orm';

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
        // SKIP LOCAL TEMP CARDS (Prevent Foreign Key Violations)
        if (task.entityId.startsWith('temp_')) {
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
      
      // Fetch latest full state from SQLite to prevent destructive overwrites
      const localStatus = await db.query.userFlashcardStatus.findFirst({
        where: and(
          eq(schema.userFlashcardStatus.userId, userId),
          eq(schema.userFlashcardStatus.flashcardId, flashcardId)
        )
      });

      if (!localStatus) {
         console.warn(`⚠️ [SyncService] No local status found for ${flashcardId}, skipping sync.`);
         return true; // Mark as done since we can't sync nothing
      }

      const parseDate = (val: any): Date => {
        if (!val) return new Date(now);
        const d = new Date(typeof val === 'number' ? val : val);
        return isNaN(d.getTime()) ? new Date(now) : d;
      };

      // Construct payload using full local state
      const supabaseData = {
        user_id: userId,
        flashcard_id: flashcardId,
        interval: Number(localStatus.interval ?? 1),
        stability: Number(localStatus.stability ?? 0),
        difficulty: Number(localStatus.difficulty ?? 0),
        repetitions: Number(localStatus.repetitions ?? 0),
        due_date: parseDate(localStatus.due_date).toISOString(),
        last_reviewed: localStatus.lastReviewed 
          ? parseDate(localStatus.lastReviewed).toISOString() 
          : null,
        is_bookmarked: Boolean(localStatus.isBookmarked),
        notes: String(localStatus.notes || ''),
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
      const { data, error } = await supabase.from('decks').select('*').eq('is_public', true);
      if (error) throw error;

      console.log(`📡 [SyncService] Cloud Scan: Found ${data?.length || 0} total decks in Supabase.`);

      if (data && data.length > 0) {
        let upsertedCount = 0;
        for (const deck of data) {
          // Add detailed logging
          console.log(`📡 [SyncService] Found Deck -> Name: "${deck.name}", Category: "${deck.prep_category}", Public: ${deck.is_public}`);
          
          if (deck.is_public) {
            console.log(`📡 [SyncService] Syncing metadata for: ${deck.name} (ID: ${deck.id})`);
            // We ONLY sync metadata here. 
            // The actual cards (Stage C) are downloaded on-demand when the user clicks "Start Revision"
            await DatabaseService.upsertDeck(deck, []);
            upsertedCount++;
          } else {
             console.log(`📡 [SyncService] SKIPPED: ${deck.name} is NOT public.`);
          }
        }
        console.log(`📡 [SyncService] Successfully saved ${upsertedCount} decks to local SQLite.`);
      } else {
        console.log(`📡 [SyncService] Supabase returned 0 decks.`);
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
      console.log(`📡 [SyncService] Fetching flashcards for deck ${deckId}...`);
      const { data: cards, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('deck_id', deckId)
        .eq('status', 'published');

      if (error) {
        console.error(`❌ [SyncService] Supabase error fetching cards:`, error.message);
        throw error;
      }
      
      console.log(`📡 [SyncService] Found ${cards?.length || 0} published cards for deck ${deckId}.`);

      // 2. Fetch Deck Metadata to get the full object
      const { data: deck, error: deckError } = await supabase
        .from('decks')
        .select('*')
        .eq('id', deckId)
        .eq('is_public', true)
        .single();

      if (deckError || !deck) {
        console.error(`❌ [SyncService] Failed to fetch deck metadata for ${deckId}:`, deckError?.message);
        return false;
      }

      // 3. Save to local SQLite (DatabaseService handles image downloading inside)
      if (cards) {
        await DatabaseService.upsertDeck(deck, cards);
      }
      
      return true;
    } catch (e: any) {
      console.error(`❌ [SyncService] downloadDeckContent failed for ${deckId}:`, e.message);
      return false;
    }
  }

  /**
   * EAGER CACHING: Background task to ensure all images for a deck are cached locally.
   * Scans local cards for 'http' URLs and downloads them.
   */
  static async cacheDeckImages(deckId: string) {
    console.log(`📦 [SyncService] Starting background eager caching for deck: ${deckId}`);
    try {
      const { db } = require('@/db');
      const { flashcards } = require('@/db/schema');
      const { eq } = require('drizzle-orm');
      const { MediaService } = require('./media-service');
      const { useFlashcardStore } = require('@/store/flashcard-store');

      // 1. Get all cards for this deck
      const cards = await db.select().from(flashcards).where(eq(flashcards.deckId, deckId));
      if (!cards || cards.length === 0) return;

      let hasUpdates = false;

      // 2. Scan and download
      for (const card of cards) {
        try {
          const urls = card.mediaUrls ? JSON.parse(card.mediaUrls) : [];
          if (!Array.isArray(urls) || urls.length === 0) continue;

          let cardUpdated = false;
          const updatedUrls = [];

          for (const url of urls) {
            if (url && typeof url === 'string' && url.startsWith('http')) {
              // Try to download
              const localUri = await MediaService.downloadImage(url);
              if (localUri && localUri.startsWith('file://')) {
                updatedUrls.push(localUri);
                cardUpdated = true;
              } else {
                updatedUrls.push(url); // Keep remote if failed
              }
            } else {
              updatedUrls.push(url); // Already local or empty
            }
          }

          if (cardUpdated) {
            // Update the card in SQLite
            await db.update(flashcards)
              .set({ mediaUrls: JSON.stringify(updatedUrls), updatedAt: Date.now() })
              .where(eq(flashcards.id, card.id));
            hasUpdates = true;
          }
        } catch (e) {
          console.warn(`⚠️ [SyncService] Failed to cache images for card ${card.id}:`, e);
        }
      }

      // 3. If we made changes and the user is currently viewing this deck, refresh the store
      if (hasUpdates) {
        console.log(`✅ [SyncService] Eager caching complete. Updates applied to deck ${deckId}`);
        const store = useFlashcardStore.getState();
        if (store.currentDeckId === deckId) {
          await store.loadDeckWithCards(deckId); // Refresh UI with local URIs
        }
      } else {
        console.log(`✅ [SyncService] Cache check complete for deck ${deckId}. All images already cached or failed.`);
      }

    } catch (e: any) {
      console.error(`❌ [SyncService] cacheDeckImages failed for ${deckId}:`, e.message);
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
