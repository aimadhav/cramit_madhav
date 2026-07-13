export function reviewSignature(userId: string, flashcardId: string, reviewedAt: number) {
  return `${userId}:${flashcardId}:${reviewedAt}`;
}

export async function collectPaginated<T>(
  loadPage: (offset: number, limit: number) => Promise<T[]>,
  pageSize = 1000
) {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const page = await loadPage(offset, pageSize);
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

export function filterDuplicateCloudReviews(
  userId: string,
  cloudRows: any[],
  existingSignatures: Iterable<string>
) {
  const signatures = new Set(existingSignatures);
  const unique: Array<{ row: any; reviewedAt: number }> = [];

  for (const row of cloudRows) {
    const reviewedAt = new Date(row.reviewed_at).getTime();
    if (!row.flashcard_id || !Number.isFinite(reviewedAt)) continue;
    const signature = reviewSignature(userId, row.flashcard_id, reviewedAt);
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    unique.push({ row, reviewedAt });
  }

  return unique;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function buildCloudReviewPayload(
  userId: string,
  flashcardId: string,
  data: any,
  fallbackId: string,
  fallbackNow: number
) {
  const reviewedAt = nullableNumber(data?.reviewedAt) ?? fallbackNow;

  return {
    id: data?.reviewId || fallbackId,
    flashcard_id: flashcardId,
    user_id: userId,
    rating: Number(data?.rating),
    reviewed_at: new Date(reviewedAt).toISOString(),
    response_time_ms: nullableNumber(data?.responseTimeMs),
    previous_stability: nullableNumber(data?.previousStability),
    new_stability: nullableNumber(data?.stability),
    previous_difficulty: nullableNumber(data?.previousDifficulty),
    new_difficulty: nullableNumber(data?.difficulty),
    created_at: new Date(fallbackNow).toISOString(),
    updated_at: new Date(fallbackNow).toISOString(),
  };
}
