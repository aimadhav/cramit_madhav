import { supabase } from '@/lib/supabase';
import { DatabaseService } from './database-service';
import { getSubjectsForPrepFocus } from '@/constants/examSubjects';

export async function mirrorPublicDecks(prepFocus?: string | null) {
  const allowedSubjects = getSubjectsForPrepFocus(prepFocus);
  let query = supabase.from('decks').select('*').eq('is_public', true);

  if (allowedSubjects) {
    query = query.in('subject', allowedSubjects);
  }

  const { data, error } = await query;
  if (error) throw error;

  console.log(`📡 [SyncService] Cloud Scan: Found ${data?.length || 0} total decks in Supabase.`);

  if (!data || data.length === 0) {
    console.log(`📡 [SyncService] Supabase returned 0 decks.`);
    return;
  }

  let upsertedCount = 0;
  for (const deck of data) {
    console.log(`📡 [SyncService] Found Deck -> Name: "${deck.name}", Category: "${deck.prep_category}", Public: ${deck.is_public}`);

    if (!deck.is_public) {
      console.log(`📡 [SyncService] SKIPPED: ${deck.name} is NOT public.`);
      continue;
    }

    console.log(`📡 [SyncService] Syncing metadata for: ${deck.name} (ID: ${deck.id})`);
    // We ONLY sync metadata here.
    // The actual cards (Stage C) are downloaded on-demand when the user clicks "Start Revision"
    await DatabaseService.upsertDeck(deck, []);
    upsertedCount++;
  }

  console.log(`📡 [SyncService] Successfully saved ${upsertedCount} decks to local SQLite.`);
}
