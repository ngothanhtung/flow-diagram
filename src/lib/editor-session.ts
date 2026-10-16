import type { FlowDocumentJSON } from './flowchart-types';
import type { DiagramRole } from './sharing';
import type { VersionActor } from './version-history';

/**
 * Snapshot of "what's currently open" in the editor — enough to restore the
 * exact canvas (including unsaved edits) after a page refresh, without
 * re-fetching from Firestore.
 */
export interface EditorSession {
  doc: FlowDocumentJSON;
  currentDiagramId: string | null;
  currentDiagramName: string;
  /** Visibility of the open diagram — restored so re-saving keeps it. */
  currentDiagramPublic?: boolean;
  savedSignature: string | null;
  /** "Last saved by … at …" — kept so a restored session can show it
   *  without the Firestore fetch it skips. Absent in older sessions. */
  lastSavedAt?: number | null;
  lastSavedBy?: VersionActor | null;
  /** Share: whose Diagram it is, the user's role on it, and the revision
   *  the unsaved edits are based on — so a restored session saves to the
   *  right path and still detects a Save conflict. Absent in sessions from
   *  before Share (their Diagram was the user's own, base revision 0). */
  currentDiagramOwnerUid?: string | null;
  currentOwnerEmail?: string | null;
  currentRole?: DiagramRole;
  currentRevision?: number;
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
