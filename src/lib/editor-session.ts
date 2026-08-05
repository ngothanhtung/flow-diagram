import type { FlowDocumentJSON } from './flowchart-types';

/**
 * Snapshot of "what's currently open" in the editor — enough to restore the
 * exact canvas (including unsaved edits) after a page refresh, without
 * re-fetching from Firestore.
 */
export interface EditorSession {
  doc: FlowDocumentJSON;
  currentDiagramId: string | null;
  currentDiagramName: string;
  savedSignature: string | null;
}

function storageKey(userId: string) {
  return `flowgram:session:${userId}`;
}

/** Best-effort read — a missing or corrupted entry just means "start fresh". */
export function loadEditorSession(userId: string): EditorSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as EditorSession) : null;
  } catch {
    return null;
  }
}

/** Best-effort write — persistence is a convenience, never a hard requirement. */
export function saveEditorSession(userId: string, session: EditorSession) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(session));
  } catch {
    // Ignore quota errors or serialization failures.
  }
}
