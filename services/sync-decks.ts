import { inArray, isNull } from 'drizzle-orm';

import { getSubjectQueryValuesForPrepFocus } from '@/constants/examSubjects';
import { db } from '@/db';
import { decks } from '@/db/schema';
import { supabase } from '@/lib/supabase';
import { DatabaseService } from './database-service';

export async function mirrorPublicDecks(prepFocus?: string | null) {
  const allowedSubjects = getSubjectQueryValuesForPrepFocus(prepFocus);
  let query = supabase.from('decks').select('*').eq('is_public', true);

  if (allowedSubjects) query = query.in('subject', allowedSubjects);

  const { data, error } = await query;
  if (error) throw error;

  const cloudDecks = data ?? [];
  for (const deck of cloudDecks) {
    await DatabaseService.upsertDeck(deck, []);
  }

  // An empty result can also mean a newly misconfigured read policy. Preserve
  // the offline library rather than interpreting that ambiguous state as deletion.
  if (cloudDecks.length === 0) return;

  // Hide decks removed or unpublished by admins. Keep downloaded cards and
  // progress locally so republishing can restore them without data loss.
  const cloudIds = new Set(cloudDecks.map((deck) => deck.id));
  const candidates = allowedSubjects
    ? await db.select({ id: decks.id }).from(decks).where(inArray(decks.subject, allowedSubjects))
    : await db.select({ id: decks.id }).from(decks).where(isNull(decks.deletedAt));
  const staleIds = candidates.map((row) => row.id).filter((id) => !cloudIds.has(id));

  if (staleIds.length > 0) {
    const now = Date.now();
    await db.update(decks)
      .set({ deletedAt: now, updatedAt: now })
      .where(inArray(decks.id, staleIds));
  }
}
