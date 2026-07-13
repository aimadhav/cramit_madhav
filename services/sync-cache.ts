import { db } from '@/db';
import { flashcards } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { MediaService } from './media-service';

export async function cacheDeckImages(deckId: string) {
  const cards = await db.select().from(flashcards).where(eq(flashcards.deckId, deckId));
  if (!cards || cards.length === 0) return false;

  let hasUpdates = false;

  for (let i = 0; i < cards.length; i += 5) {
    const cardBatch = cards.slice(i, i + 5);

    await Promise.all(cardBatch.map(async (card: any) => {
      try {
        const urls = card.mediaUrls ? JSON.parse(card.mediaUrls) : [];
        if (!Array.isArray(urls) || urls.length === 0) return;

        const remoteUrls = urls.filter(u => typeof u === 'string' && u.startsWith('http'));
        if (remoteUrls.length === 0) return;

        const cachedResults = await MediaService.downloadImages(remoteUrls);

        let cardUpdated = false;
        const updatedUrls = urls.map(u => {
          if (typeof u === 'string' && u.startsWith('http')) {
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

  return hasUpdates;
}
