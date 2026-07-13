import { describe, expect, it, vi } from 'vitest';

import {
  buildCloudReviewPayload,
  collectPaginated,
  filterDuplicateCloudReviews,
  reviewSignature,
} from './review-sync-utils';

describe('review sync utilities', () => {
  it('preserves review identity and response time in the cloud payload', () => {
    const payload = buildCloudReviewPayload(
      'user-1',
      'card-1',
      { reviewId: 'review-1', rating: 3, reviewedAt: 1000, responseTimeMs: 2400, previousStability: 0 },
      'fallback',
      2000
    );

    expect(payload).toMatchObject({
      id: 'review-1',
      user_id: 'user-1',
      flashcard_id: 'card-1',
      response_time_ms: 2400,
      previous_stability: 0,
    });
  });

  it('deduplicates old local/cloud review IDs by card and exact timestamp', () => {
    const reviewedAt = new Date('2026-07-13T10:00:00.000Z');
    const existing = [reviewSignature('user-1', 'card-1', reviewedAt.getTime())];
    const unique = filterDuplicateCloudReviews('user-1', [
      { id: 'cloud-duplicate', flashcard_id: 'card-1', reviewed_at: reviewedAt.toISOString() },
      { id: 'cloud-new', flashcard_id: 'card-2', reviewed_at: reviewedAt.toISOString() },
      { id: 'cloud-new-again', flashcard_id: 'card-2', reviewed_at: reviewedAt.toISOString() },
    ], existing);

    expect(unique).toHaveLength(1);
    expect(unique[0].row.id).toBe('cloud-new');
  });

  it('collects every page until a short page is returned', async () => {
    const loader = vi.fn(async (offset: number) => offset === 0 ? [1, 2] : [3]);
    const rows = await collectPaginated(loader, 2);
    expect(rows).toEqual([1, 2, 3]);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
