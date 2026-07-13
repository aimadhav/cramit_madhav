import {
  canonicalizeSubject,
  getSubjectsForPrepFocus,
  isSubjectAllowedForPrepFocus,
} from '@/constants/examSubjects';
import type {
  StatsActivityBucket,
  StatsBacklogRow,
  StatsBacklogSummary,
  StatsDataSource,
  StatsFocusInsight,
  StatsRange,
  StatsReviewRow,
  StatsSnapshot,
  SubjectPerformance,
  TodayActivitySnapshot,
} from '@/types/stats';

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function addLocalDays(timestamp: number, days: number) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime();
}

function isValidResponseTime(value: number | null): value is number {
  return value !== null && value >= 250 && value <= 300_000;
}

function recallRate(rows: StatsReviewRow[]) {
  if (rows.length === 0) return null;
  return Math.round((rows.filter((row) => row.rating >= 2).length / rows.length) * 100);
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function medianResponseTime(rows: StatsReviewRow[]) {
  const values = rows
    .map((row) => row.responseTimeMs)
    .filter(isValidResponseTime)
    .sort((a, b) => a - b);

  if (values.length < 3) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? Math.round((values[middle - 1] + values[middle]) / 2)
    : values[middle];
}

export function buildTodayActivitySnapshot(args: {
  reviews: StatsReviewRow[];
  now?: Date;
  dataSource?: StatsDataSource;
}): TodayActivitySnapshot {
  const now = args.now ?? new Date();
  const today = startOfLocalDay(now);
  const nextDay = addLocalDays(today, 1);
  const periodStart = addLocalDays(today, -6);
  const recentReviews = args.reviews.filter(
    (row) => row.reviewedAt >= periodStart && row.reviewedAt < nextDay
  );
  const todayReviews = recentReviews.filter((row) => row.reviewedAt >= today);

  return {
    reviewsToday: todayReviews.length,
    focusedReviewTimeMs: todayReviews
      .map((row) => row.responseTimeMs)
      .filter(isValidResponseTime)
      .reduce((total, value) => total + value, 0),
    activity: buildActivity(recentReviews, 7, periodStart),
    dataSource: args.dataSource ?? 'local',
  };
}

function buildActivity(rows: StatsReviewRow[], range: StatsRange, periodStart: number): StatsActivityBucket[] {
  const bucketDays = range === 90 ? 7 : 1;
  const bucketCount = Math.ceil(range / bucketDays);
  const counts = Array.from({ length: bucketCount }, () => 0);

  for (const row of rows) {
    const rowDay = startOfLocalDay(new Date(row.reviewedAt));
    let dayIndex = 0;
    let cursor = periodStart;
    while (cursor < rowDay && dayIndex < range) {
      cursor = addLocalDays(cursor, 1);
      dayIndex += 1;
    }
    if (dayIndex >= 0 && dayIndex < range) counts[Math.floor(dayIndex / bucketDays)] += 1;
  }

  return counts.map((count, index) => {
    const start = addLocalDays(periodStart, index * bucketDays);
    const end = addLocalDays(start, Math.min(bucketDays - 1, range - index * bucketDays - 1));
    const startDate = new Date(start);
    const endDate = new Date(end);
    const label = range === 7
      ? startDate.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1)
      : startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const dateLabel = bucketDays === 1
      ? startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

    return {
      key: `${start}`,
      label,
      accessibilityLabel: `${dateLabel}: ${count} reviews`,
      count,
    };
  });
}

export function buildBacklogSummary(
  rows: StatsBacklogRow[],
  prepFocus?: string | null
): StatsBacklogSummary {
  const filtered = rows.filter((row) => {
    return isSubjectAllowedForPrepFocus(row.subject, prepFocus);
  });
  const counts = new Map<string, number>();
  for (const row of filtered) {
    const name = canonicalizeSubject(row.subject)!;
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  return {
    total: filtered.length,
    oldestDueAt: filtered.length > 0 ? Math.min(...filtered.map((row) => row.dueAt)) : null,
    subjects: Array.from(counts, ([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}

function buildSubjects(
  rows: StatsReviewRow[],
  prepFocus: string | null | undefined,
  availableSubjects: string[]
): SubjectPerformance[] {
  const allowed = getSubjectsForPrepFocus(prepFocus);
  const names = allowed ?? Array.from(new Set(
    [...availableSubjects, ...rows.map((row) => row.subject || '')]
      .map(canonicalizeSubject)
      .filter((name): name is string => Boolean(name))
  ));

  return names
    .map((name) => {
      const subjectRows = rows.filter((row) => canonicalizeSubject(row.subject) === name);
      const enough = subjectRows.length >= 5;
      const rate = recallRate(subjectRows);
      return {
        name,
        reviews: subjectRows.length,
        recallRate: enough ? rate : null,
        hasEnoughData: enough,
        needsAttention: enough && rate !== null && rate < 85,
      };
    })
    .sort((a, b) => {
      if (a.hasEnoughData !== b.hasEnoughData) return a.hasEnoughData ? -1 : 1;
      if (a.recallRate !== b.recallRate) return (a.recallRate ?? 101) - (b.recallRate ?? 101);
      return b.reviews - a.reviews;
    });
}

function buildFocusInsight(subjects: SubjectPerformance[]): StatsFocusInsight {
  const eligible = subjects.filter((subject) => subject.hasEnoughData && subject.recallRate !== null);
  if (eligible.length === 0) {
    return {
      kind: 'insufficient',
      subject: null,
      title: 'Build your learning signal',
      message: 'Complete a few more reviews and Cramit will identify the subject that needs attention.',
    };
  }

  const weakest = eligible[0];
  if ((weakest.recallRate ?? 0) >= 85) {
    return {
      kind: 'strong',
      subject: null,
      title: 'Strong across your subjects',
      message: 'Your recall is holding up well. Keep your daily review rhythm going.',
    };
  }

  return {
    kind: 'needs-attention',
    subject: weakest.name,
    title: `Focus next: ${weakest.name}`,
    message: `${weakest.recallRate}% recall across ${weakest.reviews} reviews. A short targeted session can strengthen it.`,
  };
}

export function buildStatsSnapshot(args: {
  reviews: StatsReviewRow[];
  range: StatsRange;
  now?: Date;
  prepFocus?: string | null;
  availableSubjects?: string[];
  dataSource?: StatsDataSource;
  backlogRows?: StatsBacklogRow[];
}): StatsSnapshot {
  const now = args.now ?? new Date();
  const today = startOfLocalDay(now);
  const currentStart = addLocalDays(today, -(args.range - 1));
  const nextDay = addLocalDays(today, 1);
  const previousStart = addLocalDays(currentStart, -args.range);
  const current = args.reviews.filter((row) => row.reviewedAt >= currentStart && row.reviewedAt < nextDay);
  const previous = args.reviews.filter((row) => row.reviewedAt >= previousStart && row.reviewedAt < currentStart);
  const currentRecall = recallRate(current);
  const previousRecall = recallRate(previous);
  const subjects = buildSubjects(current, args.prepFocus, args.availableSubjects ?? []);

  return {
    range: args.range,
    dataSource: args.dataSource ?? 'local',
    totalReviews: current.length,
    uniqueCards: new Set(current.map((row) => row.flashcardId)).size,
    recallRate: currentRecall,
    recallChangePoints: currentRecall === null || previousRecall === null ? null : currentRecall - previousRecall,
    reviewChangePercent: percentChange(current.length, previous.length),
    activeDays: new Set(current.map((row) => startOfLocalDay(new Date(row.reviewedAt)))).size,
    medianResponseTimeMs: medianResponseTime(current),
    activity: buildActivity(current, args.range, currentStart),
    backlog: buildBacklogSummary(args.backlogRows ?? [], args.prepFocus),
    subjects,
    focusInsight: buildFocusInsight(subjects),
  };
}
