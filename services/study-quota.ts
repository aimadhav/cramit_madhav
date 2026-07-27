export const DAILY_REVIEW_LIMIT = 45;

export function getRemainingDailyReviews(
  completedToday: number,
  limit = DAILY_REVIEW_LIMIT,
) {
  const safeLimit = Math.max(0, Math.floor(limit));
  const safeCompleted = Math.max(0, Math.floor(completedToday));
  return Math.max(0, safeLimit - safeCompleted);
}
