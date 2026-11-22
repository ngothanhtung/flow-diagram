// Shared by scripts/seed-emulator-lessons.ts and scripts/import-lessons.ts:
// reads the lessons in seed/lessons/<lang> and turns JSON into Firestore
// REST values.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export type SeedLesson = {
  lang: string;
  /** Doc id, `tutorial-<lang>-<file>`, so a re-run overwrites rather than duplicates. */
  id: string;
  /** The Lesson's one name; Vietnamese copies get a " (VI)" suffix. */
  name: string;
  document: Record<string, unknown>;
  /** Stamped so the newest-first Lessons list reads EN A→Z, then VI A→Z. */
  updatedAt: Date;
};

export function readSeedLessons(dir: string, languages: string[], now = Date.now()): SeedLesson[] {
  const lessons: SeedLesson[] = [];
  for (const lang of languages) {
    const files = readdirSync(path.join(dir, lang)).filter((file) => file.endsWith('.lesson.json')).sort();
    for (const file of files) {
      const source = JSON.parse(readFileSync(path.join(dir, lang, file), 'utf8')) as { meta?: { title?: string } };
      const id = `tutorial-${lang}-${file.replace(/\.lesson\.json$/, '')}`;
      const title = source.meta?.title || id;
      const name = lang === 'vi' ? `${title} (VI)` : title;
      const document = { ...source, meta: { ...source.meta, title: name } };
      lessons.push({ lang, id, name, document, updatedAt: new Date(now - lessons.length * 1000) });
    }
  }
  return lessons;
}

export type FirestoreValue = Record<string, unknown>;

/** A JSON value (or Date) as a Firestore REST `Value`. */
export function toValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: value.length ? { values: value.map(toValue) } : {} };
  return { mapValue: { fields: toFields(value as Record<string, unknown>) } };
}

export function toFields(object: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined).map(([key, value]) => [key, toValue(value)]));
}

export function argValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
