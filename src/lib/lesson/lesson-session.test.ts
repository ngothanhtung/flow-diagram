import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lessonRestoreChoice, loadLessonSession, saveLessonSession, type LessonSession } from './lesson-session';
import { emptyLessonDocument } from './lesson-types';

function session(patch: Partial<LessonSession> = {}): LessonSession {
  const document = emptyLessonDocument('Caching');
  return { lessonId: 'l1', name: 'Caching', isPublic: false, savedSignature: JSON.stringify(document), document, ...patch };
}

/** The same session with an unsaved edit: its document no longer matches the signature. */
function dirtySession(patch: Partial<LessonSession> = {}): LessonSession {
  const clean = session(patch);
  return { ...clean, document: { ...clean.document, meta: { ...clean.document.meta, title: 'Edited' } } };
}

describe('lessonRestoreChoice', () => {
  it('no session → server', () => {
    expect(lessonRestoreChoice(null, 'l1')).toBe('server');
  });

  it('a session of another lesson → server, even with unsaved changes', () => {
    expect(lessonRestoreChoice(dirtySession({ lessonId: 'other' }), 'l1')).toBe('server');
  });

  it('the same lesson without unsaved changes → server', () => {
    expect(lessonRestoreChoice(session(), 'l1')).toBe('server');
  });

  it('the same lesson with unsaved changes → local', () => {
    expect(lessonRestoreChoice(dirtySession(), 'l1')).toBe('local');
  });

  it('the same lesson never saved (no signature) → local', () => {
    expect(lessonRestoreChoice(session({ savedSignature: null }), 'l1')).toBe('local');
  });
});

describe('lesson session storage', () => {
  let entries: Map<string, string>;

  beforeEach(() => {
    entries = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
      removeItem: (key: string) => void entries.delete(key),
      clear: () => entries.clear(),
      key: (index: number) => [...entries.keys()][index] ?? null,
      get length() {
        return entries.size;
      },
    } satisfies Storage;
    vi.stubGlobal('window', { localStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips a session under the per-user key', () => {
    const value = dirtySession();
    saveLessonSession('u1', value);
    expect(entries.has('xflow:lesson-session:u1')).toBe(true);
    expect(loadLessonSession('u1')).toEqual(value);
    expect(loadLessonSession('u2')).toBeNull();
  });

  it('broken JSON → null', () => {
    entries.set('xflow:lesson-session:u1', '{not json');
    expect(loadLessonSession('u1')).toBeNull();
  });

  it('JSON that is not a session → null', () => {
    for (const raw of ['null', '42', '[]', '{"name":"x"}', '{"lessonId":7,"document":{}}', '{"lessonId":"l1"}']) {
      entries.set('xflow:lesson-session:u1', raw);
      expect(loadLessonSession('u1')).toBeNull();
    }
  });

  it('repairs the wrapper fields of a usable session', () => {
    entries.set('xflow:lesson-session:u1', JSON.stringify({ lessonId: 'l1', name: 3, isPublic: 'yes', savedSignature: 5, document: { anything: true } }));
    expect(loadLessonSession('u1')).toEqual({ lessonId: 'l1', name: 'Untitled lesson', isPublic: false, savedSignature: null, document: { anything: true } });
  });

  it('without a window, reads nothing and writes nothing', () => {
    vi.unstubAllGlobals();
    expect(loadLessonSession('u1')).toBeNull();
    expect(() => saveLessonSession('u1', session())).not.toThrow();
  });
});
