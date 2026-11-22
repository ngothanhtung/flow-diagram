// Shared by scripts/seed-emulator-lessons.ts and scripts/import-lessons.ts:
// reads the lessons in seed/lessons/<lang> and turns JSON into Firestore
// REST values.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { normalizeLessonTree, publicTreeOf, type LessonTree } from '../src/lib/lesson/lesson-tree';
import { mergeSeedTree } from '../src/lib/lesson/tutorial-tree';

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

/** A Firestore REST `Value` back to JSON (the inverse of `toValue`; timestamps stay ISO strings). */
export function fromValue(value: FirestoreValue): unknown {
  if ('mapValue' in value) return fromFields(((value.mapValue as { fields?: Record<string, FirestoreValue> }).fields) ?? {});
  if ('arrayValue' in value) return (((value.arrayValue as { values?: FirestoreValue[] }).values) ?? []).map(fromValue);
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  return value.stringValue;
}

export function fromFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, fromValue(value)]));
}

/** The seed's Lesson tree (seed/lessons/tree.json, written by scripts/convert-tutorials.ts). */
export function readSeedTree(dir: string, languages: string[]): LessonTree {
  const { tree } = normalizeLessonTree(JSON.parse(readFileSync(path.join(dir, 'tree.json'), 'utf8')));
  // Seeding one language: keep only that root, its chapters and lessons.
  const keepRoots = new Set(languages.map((lang) => `tutorial-${lang}`));
  const folders = Object.fromEntries(Object.entries(tree.folders).filter(([id, folder]) => keepRoots.has(folder.parentId ?? id)));
  const lessons = Object.fromEntries(Object.entries(tree.lessons).filter(([, entry]) => entry.folderId !== null && Object.hasOwn(folders, entry.folderId)));
  return { ...tree, folders, lessons };
}

/**
 * The two documents a Lesson tree is stored as — `users/{uid}/lesson-trees/main`
 * and `public-lesson-trees/{uid}` — after merging the seed into what the
 * account already has (its own folders and lessons are kept).
 */
export function seededTreeDocs(existing: unknown, seed: LessonTree, uid: string, now: Date) {
  const current = existing === null ? null : normalizeLessonTree(existing).tree;
  const tree = mergeSeedTree(current, seed);
  return {
    tree: { ...tree, updatedAt: now } as Record<string, unknown>,
    mirror: { ...publicTreeOf(tree, uid), updatedAt: now } as Record<string, unknown>,
  };
}

export function argValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
