import { describe, expect, it } from 'vitest';

import {
  canonicalizeSubject,
  getSubjectQueryValuesForPrepFocus,
  getSubjectsForPrepFocus,
  isSubjectAllowedForPrepFocus,
} from './examSubjects';

describe('exam subject normalization', () => {
  it('accepts the creator dashboard CS preparation alias', () => {
    expect(getSubjectsForPrepFocus('CS')).toEqual([
      'DSA',
      'DBMS',
      'Operating Systems',
      'OOP',
      'Computer Networks',
    ]);
  });

  it('maps creator dashboard subject labels to app labels', () => {
    expect(canonicalizeSubject('Data Structures & Algorithms (DSA)')).toBe('DSA');
    expect(canonicalizeSubject('Object-Oriented Programming (OOP)')).toBe('OOP');
  });

  it('allows known aliases for the correct preparation focus', () => {
    expect(isSubjectAllowedForPrepFocus('Data Structures & Algorithms (DSA)', 'Computer Science')).toBe(true);
    expect(isSubjectAllowedForPrepFocus('Maths', 'JEE')).toBe(true);
    expect(isSubjectAllowedForPrepFocus('Biology', 'JEE')).toBe(false);
  });

  it('includes aliases in the Supabase subject query', () => {
    expect(getSubjectQueryValuesForPrepFocus('Computer Science')).toContain('Data Structures & Algorithms (DSA)');
  });
});
