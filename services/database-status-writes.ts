import { db } from '@/db';
import * as schema from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';

type Tx = any;

async function addToSyncQueue(
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'REVIEW',
  entityType: 'deck' | 'card_status' | 'review' | 'active_chapter',
  entityId: string,
  userId: string,
  payload: any,
  tx?: Tx
) {
  const now = Date.now();
  const executor = tx || db;

  await executor.insert(schema.syncQueue).values({
    id: Crypto.randomUUID(),
    userId,
    operation,
    entityType,
    entityId,
    payload: JSON.stringify(payload),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });
}

export async function saveReview(reviewData: {
  flashcardId: string;
  userId: string;
  rating: number;
  newStatus: any;
  responseTimeMs?: number;
}) {
  const now = Date.now();
  const reviewId = Crypto.randomUUID();

  const isLeft = reviewData.rating === 1;
  const leftAdd = isLeft ? 1 : 0;
  const rightAdd = isLeft ? 0 : 1;
  const direction = isLeft ? 'left' : 'right';

  await db.transaction(async (tx) => {
    await tx.insert(schema.reviews).values({
      id: reviewId,
      flashcardId: reviewData.flashcardId,
      userId: reviewData.userId,
      rating: reviewData.rating,
      reviewedAt: now,
      responseTimeMs: reviewData.responseTimeMs,
      previousStability: reviewData.newStatus.previousStability,
      newStability: reviewData.newStatus.stability,
      previousDifficulty: reviewData.newStatus.previousDifficulty,
      newDifficulty: reviewData.newStatus.difficulty,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    });

    await tx.insert(schema.userFlashcardStatus).values({
      id: Crypto.randomUUID(),
      userId: reviewData.userId,
      flashcardId: reviewData.flashcardId,
      interval: reviewData.newStatus.interval,
      stability: reviewData.newStatus.stability,
      difficulty: reviewData.newStatus.difficulty,
      repetitions: reviewData.newStatus.repetitions,
      due_date: reviewData.newStatus.dueDate,
      lastReviewed: now,
      leftSwipes: leftAdd,
      rightSwipes: rightAdd,
      lastSwipeDirection: direction,
      updatedAt: now,
      createdAt: now,
      deletedAt: null
    }).onConflictDoUpdate({
      target: [schema.userFlashcardStatus.userId, schema.userFlashcardStatus.flashcardId],
      set: {
        interval: reviewData.newStatus.interval,
        stability: reviewData.newStatus.stability,
        difficulty: reviewData.newStatus.difficulty,
        repetitions: reviewData.newStatus.repetitions,
        due_date: reviewData.newStatus.dueDate,
        lastReviewed: now,
        leftSwipes: sql`coalesce(${schema.userFlashcardStatus.leftSwipes}, 0) + ${leftAdd}`,
        rightSwipes: sql`coalesce(${schema.userFlashcardStatus.rightSwipes}, 0) + ${rightAdd}`,
        lastSwipeDirection: direction,
        updatedAt: now,
      }
    });

    await addToSyncQueue('REVIEW', 'card_status', reviewData.flashcardId, reviewData.userId, {
      reviewId,
      rating: reviewData.rating,
      reviewedAt: now,
      responseTimeMs: reviewData.responseTimeMs,
      ...reviewData.newStatus
    }, tx);
  });
}

export async function toggleBookmark(cardId: string, userId: string, isBookmarked: boolean) {
  const now = Date.now();

  await db.transaction(async (tx) => {
    await tx.insert(schema.userFlashcardStatus).values({
      id: Crypto.randomUUID(),
      userId,
      flashcardId: cardId,
      isBookmarked,
      due_date: now,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }).onConflictDoUpdate({
      target: [schema.userFlashcardStatus.userId, schema.userFlashcardStatus.flashcardId],
      set: {
        isBookmarked,
        updatedAt: now,
      }
    });

    await addToSyncQueue('UPDATE', 'card_status', cardId, userId, { isBookmarked }, tx);
  });
}

export async function updateNote(cardId: string, userId: string, notes: string) {
  const now = Date.now();

  await db.transaction(async (tx) => {
    await tx.insert(schema.userFlashcardStatus).values({
      id: Crypto.randomUUID(),
      userId,
      flashcardId: cardId,
      notes,
      due_date: now,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }).onConflictDoUpdate({
      target: [schema.userFlashcardStatus.userId, schema.userFlashcardStatus.flashcardId],
      set: {
        notes,
        updatedAt: now,
      }
    });

    await addToSyncQueue('UPDATE', 'card_status', cardId, userId, { notes }, tx);
  });
}

export async function addActiveChapter(userId: string, deckId: string, subject: string) {
  const now = Date.now();
  const id = Crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(schema.userActiveChapters).values({
      id,
      userId,
      deckId,
      subject,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [schema.userActiveChapters.userId, schema.userActiveChapters.deckId],
      set: {
        status: 'active',
        updatedAt: now,
      }
    });

    await addToSyncQueue('CREATE', 'active_chapter', deckId, userId, { subject, status: 'active' }, tx);
  });
}

export async function completeActiveChapter(userId: string, deckId: string) {
  const now = Date.now();

  await db.transaction(async (tx) => {
    await tx.update(schema.userActiveChapters)
      .set({ status: 'completed', updatedAt: now })
      .where(
        and(
          eq(schema.userActiveChapters.userId, userId),
          eq(schema.userActiveChapters.deckId, deckId)
        )
      );

    await addToSyncQueue('UPDATE', 'active_chapter', deckId, userId, { status: 'completed' }, tx);
  });
}

export async function getActiveChapterIds(userId: string, subject: string): Promise<string[]> {
  const results = await db.select({ deckId: schema.userActiveChapters.deckId })
    .from(schema.userActiveChapters)
    .where(
      and(
        eq(schema.userActiveChapters.userId, userId),
        eq(schema.userActiveChapters.subject, subject),
        eq(schema.userActiveChapters.status, 'active')
      )
    );

  return results.map(r => r.deckId);
}
