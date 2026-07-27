import { describe, expect, it } from 'vitest';

import { getRemainingDailyReviews } from './study-quota';

describe('daily study quota', () => {
  it('subtracts reviews completed earlier today', () => {
    expect(getRemainingDailyReviews(15)).toBe(30);
  });

  it('does not allow a negative queue after the daily limit', () => {
    expect(getRemainingDailyReviews(45)).toBe(0);
    expect(getRemainingDailyReviews(60)).toBe(0);
  });
});
