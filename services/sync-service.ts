import { db } from '@/db';
import * as schema from '@/db/schema';
import { supabase } from '@/lib/supabase';
import { eq, asc, and } from 'drizzle-orm';
import { mirrorUserStatuses, mirrorUserActiveChapters } from './sync-pull';
import { mirrorPublicDecks } from './sync-decks';
import { downloadDeckContent as downloadDeckContentHelper } from './sync-download';
import { cacheDeckImages as cacheDeckImagesHelper } from './sync-cache';
import { processSyncQueue } from './sync-queue';

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
      await processSyncQueue(userId, this.syncCardStatus.bind(this), this.syncActiveChapter.bind(this));
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
      await mirrorUserStatuses(userId);

      try {
        await mirrorUserActiveChapters(userId);
      } catch (activeChaptersError: any) {
        console.warn('⚠️ [SyncService] Failed to pull user active chapters:', activeChaptersError.message);
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
      const { useUserStore } = require('@/store/user-store');
      await mirrorPublicDecks(useUserStore.getState().user?.prepFocus);
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
    const success = await downloadDeckContentHelper(deckId);

    if (success) {
      const { useUserStore } = require('@/store/user-store');
      const userId = useUserStore.getState().user?.id;
      if (userId && userId !== 'local' && userId !== 'guest-user') {
        await this.pullStatuses(userId);
      }
    }

    return success;
  }

  /**
   * EAGER CACHING: Background task to ensure all images for a deck are cached locally.
   * Scans local cards for 'http' URLs and downloads them.
   */
  static async cacheDeckImages(deckId: string) {
    console.log(`📦 [SyncService] Starting background eager caching for deck: ${deckId}`);
    try {
      const { useFlashcardStore } = require('@/store/flashcard-store');
      const hasUpdates = await cacheDeckImagesHelper(deckId);

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
