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

    // Check internet connection status first to avoid failing tasks on network-less requests
    const NetInfo = require('@react-native-community/netinfo');
    const state = await NetInfo.fetch();
    const isOnline = state.isConnected && state.isInternetReachable !== false;

    if (!isOnline) {
      console.log('📡 [SyncService] Device is offline. Postponing cloud pushes.');
      return;
    }

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
            case 'active_chapter':
              success = await this.syncActiveChapter(userId, task.entityId, payload);
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
             // Handle retry limit logic for transient network/server failures
             const currentRetries = task.retryCount ?? 0;
             if (currentRetries < 5) {
               console.log(`📡 [SyncService] Task ${task.id} failed, incrementing retries (${currentRetries + 1}/5)`);
               await db.update(schema.syncQueue)
                 .set({ 
                   retryCount: currentRetries + 1, 
                   updatedAt: Date.now() 
                 })
                 .where(eq(schema.syncQueue.id, task.id));
             } else {
               console.warn(`📡 [SyncService] Task ${task.id} exceeded retry limit. Marking as failed.`);
               await db.update(schema.syncQueue)
                 .set({ 
                   status: 'failed_on_server', 
                   updatedAt: Date.now() 
                 })
                 .where(eq(schema.syncQueue.id, task.id));
             }
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
        left_swipes: Number(localStatus.leftSwipes ?? 0),
        right_swipes: Number(localStatus.rightSwipes ?? 0),
        last_swipe_direction: localStatus.lastSwipeDirection || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_flashcard_statuses')
        .upsert(supabaseData, { onConflict: 'user_id,flashcard_id' });

      if (error) {
        console.error(`❌ [Supabase Sync] Upsert failed for ${flashcardId}:`, error.message);
        return false;
      }

      // Sync the actual review log historical event to the 'reviews' table on Supabase (T2/T3 requirement)
      if (data && data.rating) {
        const Crypto = require('expo-crypto');
        const supabaseReview = {
          id: Crypto.randomUUID(),
          flashcard_id: flashcardId,
          user_id: userId,
          rating: Number(data.rating),
          reviewed_at: new Date(data.reviewedAt || now).toISOString(),
          response_time_ms: data.responseTimeMs ? Number(data.responseTimeMs) : null,
          previous_stability: data.previousStability ? Number(data.previousStability) : null,
          new_stability: data.stability ? Number(data.stability) : null,
          previous_difficulty: data.previousDifficulty ? Number(data.previousDifficulty) : null,
          new_difficulty: data.difficulty ? Number(data.difficulty) : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: reviewError } = await supabase
          .from('reviews')
          .insert(supabaseReview);

        if (reviewError) {
          console.warn(`⚠️ [Supabase Sync] Failed to insert historical review for ${flashcardId}:`, reviewError.message);
          // We do NOT return false here because the card status synced successfully, 
          // and we do not want to block the sync queue over a logging warning!
        }
      }

      return true;
    } catch (e: any) {
      console.error(`❌ [SyncService] Failed to parse card status for ${flashcardId}:`, e.message);
      return false;
    }
  }

  private static async syncActiveChapter(userId: string, deckId: string, data: any) {
    try {
      const { supabase } = require('@/lib/supabase');
      const { db } = require('@/db');
      const { eq, and } = require('drizzle-orm');
      const { userActiveChapters } = require('@/db/schema');

      // Fetch latest full state from SQLite
      const localActive = await db.query.userActiveChapters.findFirst({
        where: and(
          eq(userActiveChapters.userId, userId),
          eq(userActiveChapters.deckId, deckId)
        )
      });

      if (!localActive) {
        console.warn(`⚠️ [SyncService] No local active chapter row found for ${deckId}, skipping sync.`);
        return true; 
      }

      const supabaseData = {
        id: localActive.id,
        user_id: userId,
        deck_id: deckId,
        subject: localActive.subject,
        status: localActive.status || 'active',
        created_at: new Date(localActive.createdAt).toISOString(),
        updated_at: new Date(localActive.updatedAt).toISOString(),
      };

      const { error } = await supabase
        .from('user_active_chapters')
        .upsert(supabaseData, { onConflict: 'user_id,deck_id' });

      if (error) {
        console.error(`❌ [Supabase Sync] Upsert failed for active chapter ${deckId}:`, error.message);
        return false;
      }

      return true;
    } catch (e: any) {
      console.error(`❌ [SyncService] Failed to sync active chapter ${deckId}:`, e.message);
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
      const { userFlashcardStatus, userActiveChapters } = require('@/db/schema');

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
            leftSwipes: row.left_swipes ?? 0,
            rightSwipes: row.right_swipes ?? 0,
            lastSwipeDirection: row.last_swipe_direction ?? null,
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
              leftSwipes: row.left_swipes ?? 0,
              rightSwipes: row.right_swipes ?? 0,
              lastSwipeDirection: row.last_swipe_direction ?? null,
              updatedAt: Date.now()
            }
          });
        }
      }

      // Fetch cloud user active chapters
      const { data: activeChaptersData, error: activeChaptersError } = await supabase
        .from('user_active_chapters')
        .select('*')
        .eq('user_id', userId);

      if (activeChaptersError) {
        console.warn('⚠️ [SyncService] Failed to pull user active chapters:', activeChaptersError.message);
      } else if (activeChaptersData) {
        console.log(`📡 [SyncService] Found ${activeChaptersData.length} cloud active chapters. Mirroring to SQLite...`);
        for (const row of activeChaptersData) {
          await db.insert(userActiveChapters).values({
            id: row.id,
            userId: row.user_id,
            deckId: row.deck_id,
            subject: row.subject,
            status: row.status,
            createdAt: new Date(row.created_at).getTime(),
            updatedAt: new Date(row.updated_at).getTime(),
          }).onConflictDoUpdate({
            target: [userActiveChapters.userId, userActiveChapters.deckId],
            set: {
              status: row.status,
              updatedAt: new Date(row.updated_at).getTime(),
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

      // 4. Critical Sync Fix: Automatically pull user's historical progress and bookmarks
      // for these cards so they don't show up with blank 0 values!
      const { useUserStore } = require('@/store/user-store');
      const userId = useUserStore.getState().user?.id;
      if (userId && userId !== 'local' && userId !== 'guest-user') {
        console.log(`📡 [SyncService] Pulling cloud statuses to match downloaded cards...`);
        await this.pullStatuses(userId);
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

      // 2. Scan and download in batches of cards
      for (let i = 0; i < cards.length; i += 5) {
        const cardBatch = cards.slice(i, i + 5);
        
        await Promise.all(cardBatch.map(async (card: any) => {
          try {
            const urls = card.mediaUrls ? JSON.parse(card.mediaUrls) : [];
            if (!Array.isArray(urls) || urls.length === 0) return;

            const remoteUrls = urls.filter(u => typeof u === 'string' && u.startsWith('http'));
            if (remoteUrls.length === 0) return;

            // Use the chunked downloader in MediaService to avoid overloading
            const cachedResults = await MediaService.downloadImages(remoteUrls);
            
            // Re-map the original array, replacing http urls with their cached file:// counterparts if successful
            let cardUpdated = false;
            const updatedUrls = urls.map(u => {
              if (typeof u === 'string' && u.startsWith('http')) {
                // Find if this URL was successfully downloaded and cached
                // MediaService.downloadImages preserves the order and returns local URIs or falls back to remote
                const cachedIndex = remoteUrls.indexOf(u);
                if (cachedIndex !== -1 && cachedResults[cachedIndex] && cachedResults[cachedIndex].startsWith('file://')) {
                  cardUpdated = true;
                  return cachedResults[cachedIndex];
                }
              }
              return u;
            });

            if (cardUpdated) {
              await db.update(flashcards)
                .set({ mediaUrls: JSON.stringify(updatedUrls), updatedAt: Date.now() })
                .where(eq(flashcards.id, card.id));
              hasUpdates = true;
            }
          } catch (e) {
            console.warn(`⚠️ [SyncService] Batch fail for card:`, e);
          }
        }));
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
