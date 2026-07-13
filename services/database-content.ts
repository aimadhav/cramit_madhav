export function safeParseJson<T>(value: any, fallback: T): T {
  if (value == null) return fallback;

  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

export function safeParseJsonArray<T = any>(value: any, fallback: T[] = []): T[] {
  const parsed = safeParseJson(value, fallback);
  return Array.isArray(parsed) ? parsed : fallback;
}

export function toStoredJson(value: any, fallback: string = '[]'): string {
  if (value == null) return fallback;

  if (typeof value === 'string') {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return fallback;
    }
  }

  return JSON.stringify(value);
}
