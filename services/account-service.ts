import { eq } from 'drizzle-orm';

import { db } from '@/db';
import * as schema from '@/db/schema';
import { supabase } from '@/lib/supabase';
import { AuthService } from '@/services/auth-service';
import { useFlashcardStore } from '@/store/flashcard-store';
import { reportError } from '@/lib/monitoring';

export class AccountService {
  static async deleteCurrentAccount(userId: string) {
    const { error } = await supabase.functions.invoke('delete-account', {
      body: { confirmation: 'DELETE' },
    });
    if (error) throw new Error(error.message || 'Account deletion could not be completed.');

    try {
      await db.transaction(async (tx) => {
        await tx.delete(schema.syncQueue).where(eq(schema.syncQueue.userId, userId));
        await tx.delete(schema.reviews).where(eq(schema.reviews.userId, userId));
        await tx.delete(schema.studySessions).where(eq(schema.studySessions.userId, userId));
        await tx.delete(schema.userFlashcardStatus).where(eq(schema.userFlashcardStatus.userId, userId));
        await tx.delete(schema.userActiveChapters).where(eq(schema.userActiveChapters.userId, userId));
        // Room rows are a cache and do not carry an owner/member discriminator locally.
        await tx.delete(schema.rooms);
      });
    } catch (error) {
      // The cloud account is already gone. Never leave a deleted account
      // appearing signed in because a stale local table failed to clear.
      reportError(error, { operation: 'post-account-deletion-local-cleanup' });
    } finally {
      useFlashcardStore.getState().clearStore();
      await AuthService.signOut();
    }
  }
}
