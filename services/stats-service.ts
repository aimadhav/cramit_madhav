import NetInfo from '@react-native-community/netinfo';
import { and, eq, gte, isNotNull, isNull, lte } from 'drizzle-orm';

import { db } from '@/db';
import { decks, flashcards, reviews, userActiveChapters, userFlashcardStatus } from '@/db/schema';
import { supabase } from '@/lib/supabase';
import type { StatsDataSource, StatsRange, StatsReviewRow, StatsSnapshot } from '@/types/stats';
import { collectPaginated, filterDuplicateCloudReviews, reviewSignature } from './review-sync-utils';
import { buildStatsSnapshot, startOfLocalDay } from './stats-analytics';
import { SyncService } from './sync-service';

const CLOUD_PAGE_SIZE = 1000;
const HISTORY_DAYS = 180;

function historyStart(now = new Date()) {
  const start = new Date(startOfLocalDay(now));
  start.setDate(start.getDate() - (HISTORY_DAYS - 1));
  return start.getTime();
}

function parseCloudDate(value: unknown, fallback: number) {
  const parsed = new Date(value as any).getTime();
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function fetchCloudReviews(userId: string, since: number) {
  return collectPaginated(async (offset, limit) => {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', userId)
      .gte('reviewed_at', new Date(since).toISOString())
      .order('reviewed_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data ?? [];
  }, CLOUD_PAGE_SIZE);
}

async function mergeCloudReviews(userId: string, cloudRows: any[], since: number) {
  const existing = await db
    .select({
      id: reviews.id,
      flashcardId: reviews.flashcardId,
      reviewedAt: reviews.reviewedAt,
    })
    .from(reviews)
    .where(and(eq(reviews.userId, userId), gte(reviews.reviewedAt, since)));

  const signatures = new Set(
    existing.map((row) => reviewSignature(userId, row.flashcardId, row.reviewedAt))
  );
  const uniqueCloudRows = filterDuplicateCloudReviews(userId, cloudRows, signatures);

  await db.transaction(async (tx) => {
    for (const { row, reviewedAt } of uniqueCloudRows) {
      const createdAt = parseCloudDate(row.created_at, reviewedAt);
      const updatedAt = parseCloudDate(row.updated_at, createdAt);
      await tx.insert(reviews).values({
        id: row.id,
        flashcardId: row.flashcard_id,
        userId,
        rating: Number(row.rating),
        reviewedAt,
        responseTimeMs: row.response_time_ms === null ? null : Number(row.response_time_ms),
        previousStability: row.previous_stability === null ? null : Number(row.previous_stability),
        newStability: row.new_stability === null ? null : Number(row.new_stability),
        previousDifficulty: row.previous_difficulty === null ? null : Number(row.previous_difficulty),
        newDifficulty: row.new_difficulty === null ? null : Number(row.new_difficulty),
        createdAt,
        updatedAt,
        deletedAt: row.deleted_at ? parseCloudDate(row.deleted_at, updatedAt) : null,
      }).onConflictDoUpdate({
        target: reviews.id,
        set: {
          rating: Number(row.rating),
          responseTimeMs: row.response_time_ms === null ? null : Number(row.response_time_ms),
          updatedAt,
          deletedAt: row.deleted_at ? parseCloudDate(row.deleted_at, updatedAt) : null,
        },
      });
    }
  });
}

async function loadLocalReviewRows(userId: string): Promise<StatsReviewRow[]> {
  const since = historyStart();
  return db
    .select({
      id: reviews.id,
      flashcardId: reviews.flashcardId,
      rating: reviews.rating,
      reviewedAt: reviews.reviewedAt,
      responseTimeMs: reviews.responseTimeMs,
      subject: decks.subject,
    })
    .from(reviews)
    .leftJoin(flashcards, eq(reviews.flashcardId, flashcards.id))
    .leftJoin(decks, eq(flashcards.deckId, decks.id))
    .where(
      and(
        eq(reviews.userId, userId),
        gte(reviews.reviewedAt, since),
        isNull(reviews.deletedAt)
      )
    );
}

async function loadBacklogRows(userId: string) {
  return db
    .select({
      subject: decks.subject,
      dueAt: userFlashcardStatus.due_date,
    })
    .from(userFlashcardStatus)
    .innerJoin(flashcards, eq(userFlashcardStatus.flashcardId, flashcards.id))
    .innerJoin(decks, eq(flashcards.deckId, decks.id))
    .innerJoin(
      userActiveChapters,
      and(
        eq(userActiveChapters.deckId, decks.id),
        eq(userActiveChapters.userId, userId),
        eq(userActiveChapters.status, 'active')
      )
    )
    .where(
      and(
        eq(userFlashcardStatus.userId, userId),
        lte(userFlashcardStatus.due_date, Date.now()),
        isNotNull(userFlashcardStatus.lastReviewed),
        isNull(userFlashcardStatus.deletedAt)
      )
    );
}

export class StatsService {
  static async refreshCloudHistory(userId: string): Promise<StatsDataSource> {
    const network = await NetInfo.fetch();
    const online = network.isConnected === true && network.isInternetReachable !== false;
    if (!online) return 'cached';

    try {
      await SyncService.pushChanges(userId);
      const since = historyStart();
      const cloudRows = await fetchCloudReviews(userId, since);
      await mergeCloudReviews(userId, cloudRows, since);
      return 'cloud';
    } catch (error) {
      console.warn('[StatsService] Cloud history refresh failed; using cached reviews.', error);
      return 'cached';
    }
  }

  static async getSnapshot(args: {
    userId: string;
    range: StatsRange;
    prepFocus?: string | null;
    availableSubjects?: string[];
    dataSource?: StatsDataSource;
  }): Promise<StatsSnapshot> {
    const [reviewRows, backlogRows] = await Promise.all([
      loadLocalReviewRows(args.userId),
      loadBacklogRows(args.userId),
    ]);
    return buildStatsSnapshot({
      reviews: reviewRows,
      range: args.range,
      prepFocus: args.prepFocus,
      availableSubjects: args.availableSubjects,
      dataSource: args.dataSource,
      backlogRows,
    });
  }
}
