import { db } from '@/db';
import * as schema from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function getDeckWithCards(deckId: string, userId: string) {
  return await db.select({
    card: schema.flashcards,
    status: schema.userFlashcardStatus,
  })
    .from(schema.flashcards)
    .leftJoin(
      schema.userFlashcardStatus,
      and(
        eq(schema.flashcards.id, schema.userFlashcardStatus.flashcardId),
        eq(schema.userFlashcardStatus.userId, userId)
      )
    )
    .where(eq(schema.flashcards.deckId, deckId));
}
