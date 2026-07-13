import { describe, expect, it } from 'vitest';

import { buildBacklogSummary, buildStatsSnapshot, startOfLocalDay } from './stats-analytics';
import type { StatsReviewRow } from '@/types/stats';

const now = new Date(2026, 6, 13, 12, 0, 0);

function daysAgo(days: number, hour = 12) {
  return new Date(2026, 6, 13 - days, hour, 0, 0).getTime();
}

function review(id: string, rating: number, days: number, subject = 'Physics', responseTimeMs: number | null = 1500): StatsReviewRow {
  return {
    id,
    flashcardId: `card-${id}`,
    rating,
    reviewedAt: daysAgo(days),
    responseTimeMs,
    subject,
  };
}

describe('stats analytics', () => {
  it('calculates recall, period comparison, unique cards, and ratings from real reviews', () => {
    const current = [
      review('1', 1, 0),
      review('2', 2, 1),
      review('3', 3, 2),
      review('4', 4, 3),
      review('5', 4, 4),
    ];
    const previous = [0, 1, 2, 3, 4].map((day) => review(`old-${day}`, 3, 7 + day));
    const snapshot = buildStatsSnapshot({ reviews: [...current, ...previous], range: 7, now });

    expect(snapshot.totalReviews).toBe(5);
    expect(snapshot.uniqueCards).toBe(5);
    expect(snapshot.recallRate).toBe(80);
    expect(snapshot.recallChangePoints).toBe(-20);
  });

  it('uses local calendar boundaries and builds 13 weekly buckets for 90 days', () => {
    const atStartOfToday = startOfLocalDay(now);
    const snapshot = buildStatsSnapshot({
      reviews: [{ ...review('today', 3, 0), reviewedAt: atStartOfToday }],
      range: 90,
      now,
    });

    expect(snapshot.totalReviews).toBe(1);
    expect(snapshot.activity).toHaveLength(13);
    expect(snapshot.activity.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(1);
  });

  it('calculates median response time and excludes accidental or idle values', () => {
    const snapshot = buildStatsSnapshot({
      reviews: [
        review('fast-invalid', 3, 0, 'Physics', 100),
        review('a', 3, 0, 'Physics', 1000),
        review('b', 3, 0, 'Physics', 2000),
        review('c', 3, 0, 'Physics', 3000),
        review('idle-invalid', 3, 0, 'Physics', 400_000),
      ],
      range: 7,
      now,
    });

    expect(snapshot.medianResponseTimeMs).toBe(2000);
  });

  it('ranks the weakest eligible subject and creates an actionable focus insight', () => {
    const physics = [1, 1, 1, 3, 4].map((rating, index) => review(`p${index}`, rating, index, 'Physics'));
    const chemistry = [2, 3, 3, 4, 4].map((rating, index) => review(`c${index}`, rating, index, 'Chemistry'));
    const snapshot = buildStatsSnapshot({
      reviews: [...physics, ...chemistry],
      range: 7,
      now,
      prepFocus: 'JEE',
    });

    expect(snapshot.subjects[0]).toMatchObject({ name: 'Physics', recallRate: 40, needsAttention: true });
    expect(snapshot.focusInsight).toMatchObject({ kind: 'needs-attention', subject: 'Physics' });
    expect(snapshot.subjects.find((subject) => subject.name === 'Mathematics')).toMatchObject({ hasEnoughData: false });
  });

  it('shows an insufficient-data insight for empty history', () => {
    const snapshot = buildStatsSnapshot({ reviews: [], range: 30, now, prepFocus: 'NEET' });
    expect(snapshot.recallRate).toBeNull();
    expect(snapshot.focusInsight.kind).toBe('insufficient');
    expect(snapshot.subjects.every((subject) => !subject.hasEnoughData)).toBe(true);
  });

  it('groups backlog by allowed preparation subject and tracks the oldest due card', () => {
    const backlog = buildBacklogSummary([
      { subject: 'Physics', dueAt: daysAgo(3) },
      { subject: 'Physics', dueAt: daysAgo(1) },
      { subject: 'Chemistry', dueAt: daysAgo(2) },
      { subject: 'Biology', dueAt: daysAgo(5) },
    ], 'JEE');

    expect(backlog.total).toBe(3);
    expect(backlog.oldestDueAt).toBe(daysAgo(3));
    expect(backlog.subjects).toEqual([
      { name: 'Physics', count: 2 },
      { name: 'Chemistry', count: 1 },
    ]);
  });
});
