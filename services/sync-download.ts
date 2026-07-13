import { supabase } from '@/lib/supabase';
import { DatabaseService } from './database-service';

export async function downloadDeckContent(deckId: string) {
  console.log(`[SyncService] Downloading full content for deck: ${deckId}`);

  try {
    // Validate the deck before requesting any card content. RLS remains the
    // security boundary, but this avoids querying cards for an invalid/private deck.
    const { data: deck, error: deckError } = await supabase
      .from('decks')
      .select('*')
      .eq('id', deckId)
      .eq('is_public', true)
      .single();

    if (deckError || !deck) {
      console.error(`[SyncService] Failed to fetch public deck ${deckId}:`, deckError?.message);
      return false;
    }

    console.log(`[SyncService] Fetching flashcards for deck ${deckId}...`);
    const { data: cards, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('deck_id', deckId)
      .eq('status', 'published');

    if (error) {
      console.error(`[SyncService] Supabase error fetching cards:`, error.message);
      throw error;
    }

    console.log(`[SyncService] Found ${cards?.length || 0} published cards for deck ${deckId}.`);

    // DatabaseService handles image downloading and local persistence.
    if (cards) {
      await DatabaseService.upsertDeck(deck, cards);
    }

    // Keep this hook for the existing progress-pull flow.
    const { useUserStore } = require('@/store/user-store');
    const userId = useUserStore.getState().user?.id;
    if (userId && userId !== 'local' && userId !== 'guest-user') {
      console.log(`[SyncService] Pulling cloud statuses for downloaded cards.`);
    }

    return true;
  } catch (e: any) {
    console.error(`[SyncService] downloadDeckContent failed for ${deckId}:`, e.message);
    return false;
  }
}
