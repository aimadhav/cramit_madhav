import { db } from '@/db';
import * as schema from '@/db/schema';
import { supabase } from '@/lib/supabase';
import { and, eq, inArray } from 'drizzle-orm';

function parseDate(value: any, fallbackMillis: number) {
  if (!value) return new Date(fallbackMillis);

  const parsedDate = new Date(typeof value === 'number' ? value : value);
  return isNaN(parsedDate.getTime()) ? new Date(fallbackMillis) : parsedDate;
}

export async function mirrorUserStatuses(userId: string) {
  const now = Date.now();
  const pendingRows = await db.select({ entityId: schema.syncQueue.entityId })
    .from(schema.syncQueue)
    .where(and(
      eq(schema.syncQueue.userId, userId),
      eq(schema.syncQueue.entityType, 'card_status'),
      inArray(schema.syncQueue.status, ['pending', 'failed_on_server']),
    ));
  const pendingCardIds = new Set(pendingRows.map((row) => row.entityId));

  const { data, error } = await supabase
    .from('user_flashcard_statuses')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  if (data) {
    console.log(`📡 [SyncService] Found ${data.length} cloud statuses. Mirroring to SQLite...`);
    for (const row of data) {
      if (pendingCardIds.has(row.flashcard_id)) continue;
      await db.insert(schema.userFlashcardStatus).values({
        id: row.id,
        userId: row.user_id,
        flashcardId: row.flashcard_id,
        interval: row.interval,
        stability: row.stability,
        difficulty: row.difficulty,
        repetitions: row.repetitions,
        due_date: parseDate(row.due_date, now).getTime(),
        lastReviewed: row.last_reviewed ? parseDate(row.last_reviewed, now).getTime() : null,
        isBookmarked: row.is_bookmarked,
        notes: row.notes,
        leftSwipes: row.left_swipes ?? 0,
        rightSwipes: row.right_swipes ?? 0,
        lastSwipeDirection: row.last_swipe_direction ?? null,
        createdAt: parseDate(row.created_at, now).getTime(),
        updatedAt: parseDate(row.updated_at, now).getTime(),
      }).onConflictDoUpdate({
        target: [schema.userFlashcardStatus.userId, schema.userFlashcardStatus.flashcardId],
        set: {
          interval: row.interval,
          stability: row.stability,
          difficulty: row.difficulty,
          repetitions: row.repetitions,
          due_date: parseDate(row.due_date, now).getTime(),
          lastReviewed: row.last_reviewed ? parseDate(row.last_reviewed, now).getTime() : null,
          isBookmarked: row.is_bookmarked,
          notes: row.notes,
          leftSwipes: row.left_swipes ?? 0,
          rightSwipes: row.right_swipes ?? 0,
          lastSwipeDirection: row.last_swipe_direction ?? null,
          updatedAt: Date.now(),
        }
      });
    }
  }
}

export async function mirrorUserActiveChapters(userId: string) {
  const pendingRows = await db.select({ entityId: schema.syncQueue.entityId })
    .from(schema.syncQueue)
    .where(and(
      eq(schema.syncQueue.userId, userId),
      eq(schema.syncQueue.entityType, 'active_chapter'),
      inArray(schema.syncQueue.status, ['pending', 'failed_on_server']),
    ));
  const pendingDeckIds = new Set(pendingRows.map((row) => row.entityId));
  const { data, error } = await supabase
    .from('user_active_chapters')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  if (data) {
    console.log(`📡 [SyncService] Found ${data.length} cloud active chapters. Mirroring to SQLite...`);
    for (const row of data) {
      if (pendingDeckIds.has(row.deck_id)) continue;
      await db.insert(schema.userActiveChapters).values({
        id: row.id,
        userId: row.user_id,
        deckId: row.deck_id,
        subject: row.subject,
        status: row.status,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
      }).onConflictDoUpdate({
        target: [schema.userActiveChapters.userId, schema.userActiveChapters.deckId],
        set: {
          status: row.status,
          updatedAt: new Date(row.updated_at).getTime(),
        }
      });
    }
  }
}
