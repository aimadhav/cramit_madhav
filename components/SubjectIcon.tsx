import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type MaterialIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export function getSubjectIconName(subject?: string | null): MaterialIconName {
  const value = (subject ?? '').trim().toLowerCase();

  if (value.includes('phys')) return 'atom-variant';
  if (value.includes('chem')) return 'flask-outline';
  if (value.includes('math')) return 'function-variant';
  if (value.includes('biology') || value.includes('bio')) return 'dna';
  if (value.includes('dsa') || value.includes('data structure') || value.includes('algorithm')) return 'graph-outline';
  if (value.includes('dbms') || value.includes('database')) return 'database-outline';
  if (value.includes('operating system') || value === 'os') return 'desktop-classic';
  if (value.includes('oop') || value.includes('object oriented') || value.includes('object-oriented')) return 'cube-outline';
  if (value.includes('network')) return 'lan';
  if (value.includes('computer science') || value === 'cs') return 'code-braces';

  return 'book-open-page-variant-outline';
}

export function getSubjectAccentColor(subject?: string | null): string {
  const value = (subject ?? '').trim().toLowerCase();

  if (value.includes('phys')) return '#64A8FF';
  if (value.includes('chem')) return '#54D48B';
  if (value.includes('math')) return '#F0B35E';
  if (value.includes('biology') || value.includes('bio')) return '#F06FA8';
  if (value.includes('dsa') || value.includes('data structure') || value.includes('algorithm')) return '#8E96FF';
  if (value.includes('dbms') || value.includes('database')) return '#4CC9C0';
  if (value.includes('operating system') || value === 'os') return '#C58CFF';
  if (value.includes('oop') || value.includes('object oriented') || value.includes('object-oriented')) return '#FF9B63';
  if (value.includes('network')) return '#58C4DC';

  return '#8E96FF';
}

interface SubjectIconProps {
  subject?: string | null;
  size?: number;
  color?: string;
}

export function SubjectIcon({ subject, size = 20, color }: SubjectIconProps) {
  return (
    <MaterialCommunityIcons
      name={getSubjectIconName(subject)}
      size={size}
      color={color ?? getSubjectAccentColor(subject)}
    />
  );
}
