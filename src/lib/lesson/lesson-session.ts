// The Lesson editor's local autosave: what makes a refresh keep unsaved
// work in a Lesson. Separate from the Diagram editor's session
// (`editor-session.ts`, key `flowgram:session:{uid}`), so neither editor
// can ever restore the other's content. Not a save-to-cloud path.

import type { LessonDocumentJSON } from './lesson-types';

export interface LessonSession {
  lessonId: string;
  name: string;
  isPublic: boolean;
  /** `JSON.stringify` of the document as last saved to the cloud, or null when never saved. */
  savedSignature: string | null;
  /** Raw as stored: the editor sends it through `normalizeLessonDocument` before opening it. */
  document: LessonDocumentJSON;
}

function storageKey(uid: string) {
  return `xflow:lesson-session:${uid}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Best-effort read. Broken JSON, or anything without a lesson id and a
 * document object, is no session. The wrapper fields are repaired; the
 * document is left for `normalizeLessonDocument`.
 */
export function loadLessonSession(uid: string): LessonSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.lessonId !== 'string' || !parsed.lessonId || !isRecord(parsed.document)) return null;
    return {
      lessonId: parsed.lessonId,
      name: typeof parsed.name === 'string' ? parsed.name : 'Untitled lesson',
      isPublic: parsed.isPublic === true,
      savedSignature: typeof parsed.savedSignature === 'string' ? parsed.savedSignature : null,
      document: parsed.document as unknown as LessonDocumentJSON,
    };
  } catch {
    return null;
  }
}

/** Best-effort write — quota or serialisation errors are ignored. */
export function saveLessonSession(uid: string, session: LessonSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(uid), JSON.stringify(session));
  } catch {
    // Persistence is a convenience, never a hard requirement.
  }
}

/**
 * Where the route's Lesson opens from: the local copy only when it is this
 * Lesson *and* holds unsaved changes; otherwise the server's latest.
 */
export function lessonRestoreChoice(session: LessonSession | null, routeId: string): 'local' | 'server' {
  if (!session || session.lessonId !== routeId) return 'server';
  return JSON.stringify(session.document) !== session.savedSignature ? 'local' : 'server';
}
