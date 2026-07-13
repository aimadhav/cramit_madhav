import { db } from '@/db';
import * as schema from '@/db/schema';
import { asc, eq } from 'drizzle-orm';

type SyncCardStatusFn = (userId: string, flashcardId: string, data: any) => Promise<boolean>;
type SyncActiveChapterFn = (userId: string, deckId: string, data: any) => Promise<boolean>;

export async function processSyncQueue(
  userId: string,
  syncCardStatus: SyncCardStatusFn,
  syncActiveChapter: SyncActiveChapterFn
) {
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
          success = await syncCardStatus(userId, task.entityId, payload);
          break;
        case 'active_chapter':
          success = await syncActiveChapter(userId, task.entityId, payload);
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
        const currentRetries = task.retryCount ?? 0;
        if (currentRetries < 5) {
          console.log(`📡 [SyncService] Task ${task.id} failed, incrementing retries (${currentRetries + 1}/5)`);
          await db.update(schema.syncQueue)
            .set({
              retryCount: currentRetries + 1,
              updatedAt: Date.now(),
            })
            .where(eq(schema.syncQueue.id, task.id));
        } else {
          console.warn(`📡 [SyncService] Task ${task.id} exceeded retry limit. Marking as failed.`);
          await db.update(schema.syncQueue)
            .set({
              status: 'failed_on_server',
              updatedAt: Date.now(),
            })
            .where(eq(schema.syncQueue.id, task.id));
        }
      }
    } catch (e: any) {
      console.error(`❌ [SyncService] Task processing crash:`, e.message);
    }
  }
}
