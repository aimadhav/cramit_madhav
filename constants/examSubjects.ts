export const EXAM_SUBJECTS: Record<string, string[]> = {
  JEE: ['Physics', 'Chemistry', 'Mathematics'],
  NEET: ['Physics', 'Chemistry', 'Biology'],
  'Computer Science': ['DSA', 'DBMS', 'Operating Systems', 'OOP', 'Computer Networks'],
};

const PREP_FOCUS_ALIASES: Record<string, string> = {
  cs: 'Computer Science',
  'cs / tech': 'Computer Science',
  'computer science': 'Computer Science',
};

const SUBJECT_ALIASES: Record<string, string[]> = {
  Physics: ['Physics'],
  Chemistry: ['Chemistry'],
  Mathematics: ['Mathematics', 'Maths', 'Math'],
  Biology: ['Biology'],
  DSA: [
    'DSA',
    'Data Structures & Algorithms (DSA)',
    'Data Structures and Algorithms',
    'Data Structures & Algorithms',
  ],
  DBMS: ['DBMS', 'Database Management Systems'],
  'Operating Systems': ['Operating Systems', 'OS'],
  OOP: ['OOP', 'Object-Oriented Programming (OOP)', 'Object Oriented Programming'],
  'Computer Networks': ['Computer Networks', 'CN'],
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
  const trimmed = prepFocus.trim();
  const canonicalFocus = PREP_FOCUS_ALIASES[trimmed.toLowerCase()] || trimmed;
  return EXAM_SUBJECTS[canonicalFocus] || [];
}

export function canonicalizeSubject(subject?: string | null) {
  if (!subject) return null;
  const trimmed = subject.trim();
  const normalized = trimmed.toLowerCase();

  for (const [canonical, aliases] of Object.entries(SUBJECT_ALIASES)) {
    if (aliases.some((alias) => alias.toLowerCase() === normalized)) return canonical;
  }

  return trimmed;
}

export function getSubjectQueryValuesForPrepFocus(prepFocus?: string | null) {
  const subjects = getSubjectsForPrepFocus(prepFocus);
  if (subjects === null) return null;

  return Array.from(new Set(subjects.flatMap((subject) => SUBJECT_ALIASES[subject] || [subject])));
}

export function isSubjectAllowedForPrepFocus(subject: string | null | undefined, prepFocus?: string | null) {
  const canonicalSubject = canonicalizeSubject(subject);
  if (!canonicalSubject) return false;
  const allowedSubjects = getSubjectsForPrepFocus(prepFocus);
  if (allowedSubjects === null) return true;
  return allowedSubjects.includes(canonicalSubject);
}
