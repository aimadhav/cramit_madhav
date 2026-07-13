export const EXAM_SUBJECTS: Record<string, string[]> = {
  JEE: ['Physics', 'Chemistry', 'Mathematics'],
  NEET: ['Physics', 'Chemistry', 'Biology'],
  'Computer Science': ['DSA', 'DBMS', 'Operating Systems', 'OOP', 'Computer Networks'],
};

export const EXAM_OPTIONS = [
  {
    id: 'JEE',
    title: 'JEE',
    subtitle: 'Engineering entrance preparation',
    icon: 'flask-outline' as const,
    accent: '#6C7BFF',
  },
  {
    id: 'NEET',
    title: 'NEET',
    subtitle: 'Medical entrance preparation',
    icon: 'heart-outline' as const,
    accent: '#43C58A',
  },
  {
    id: 'Computer Science',
    title: 'Computer Science',
    subtitle: 'Build your CS fundamentals',
    icon: 'code-slash-outline' as const,
    accent: '#E4A85C',
  },
] as const;

export function getSubjectsForPrepFocus(prepFocus?: string | null) {
  if (!prepFocus) return null;
  return EXAM_SUBJECTS[prepFocus] || [];
}

export function isSubjectAllowedForPrepFocus(subject: string | null | undefined, prepFocus?: string | null) {
  if (!subject) return false;
  const allowedSubjects = getSubjectsForPrepFocus(prepFocus);
  if (allowedSubjects === null) return true;
  return allowedSubjects.some((allowed) => allowed.toLowerCase() === subject.trim().toLowerCase());
}
