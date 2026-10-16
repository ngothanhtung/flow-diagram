import type { DiagramRole } from './sharing';

/**
 * Opening `/diagrams/{id}/edit` when the editor may already hold a copy of
 * that Diagram — the localStorage session restored on reload, or the store
 * still holding it from earlier in this page load. Pure, so the whole
 * decision table is Vitest-covered (`session-restore.test.ts`);
 * `DiagramEditor` only performs what it returns.
 *
 * The rule: a copy without local work is never trusted over the server —
 * it is replaced by the latest saved Diagram (a Collaborator may have saved
 * since). A copy *with* local work is never thrown away — it stays on the
 * canvas and the server is only compared against it.
 */

/** What the editor holds of the route's Diagram before asking the server. */
export type LocalCopy =
  /** Nothing — a plain open. */
  | 'none'
  /** This Diagram, exactly as last saved, with no history to lose. */
  | 'clean'
  /** This Diagram with unsaved changes (or undo history behind it). */
  | 'unsaved';

export function localCopyOf({ holdsDiagram, dirty, canUndo }: { holdsDiagram: boolean; dirty: boolean; canUndo: boolean }): LocalCopy {
  if (!holdsDiagram) return 'none';
  // History counts as local work too: edits that happen to land back on
  // the saved document still leave undo steps a silent replace would drop.
  return dirty || canUndo ? 'unsaved' : 'clean';
}

/** What asking the server (`openDiagram`) came to. */
export type ServerCheck =
  /** Resolved: the caller's level on it now and the saved revision. */
  | { kind: 'opened'; role: DiagramRole; revision: number }
  /** `openDiagram` found nothing the caller may open: deleted, or the
   *  caller is no longer a Collaborator (or no longer verified). */
  | { kind: 'gone'; reason: 'not-found' | 'unverified' }
  /** The rules refused a read outright (permission-denied). */
  | { kind: 'denied' }
  /** Anything else — offline, network, emulator down. */
  | { kind: 'unreachable' };

export type RestoreAction =
  /** Put the server's copy on the canvas as an open (fresh history). */
  | { action: 'load-latest' }
  /** Can view now: the Viewer, as on any open. */
  | { action: 'redirect-view' }
  /** The ordinary status screen (`not-found` / `unverified` / `error`). */
  | { action: 'status'; status: 'not-found' | 'unverified' | 'error' }
  /** Keep the local copy; the server has nothing newer. */
  | { action: 'keep' }
  /** Keep the local copy, and say someone saved a newer version. */
  | { action: 'offer-latest' }
  /** Keep the local copy, but it can't be saved here any more — the
   *  Save path's revoked / missing dialog (Save as new Diagram). */
  | { action: 'blocked'; kind: 'revoked' | 'missing' }
  /** Keep the local copy, with a note that it is the local copy. */
  | { action: 'local-copy' };

/**
 * The decision table. `role` and `revision` are the local copy's — whose
 * edits they are and the revision they are based on.
 */
export function restoreDecision(local: { copy: LocalCopy; role: DiagramRole; revision: number }, check: ServerCheck): RestoreAction {
  const collaborator = local.role !== 'owner';

  if (local.copy === 'unsaved') {
    switch (check.kind) {
      case 'opened':
        // Lowered to Can view: the edits can't be saved here any more.
        if (check.role === 'view') return { action: 'blocked', kind: 'revoked' };
        return check.revision > local.revision ? { action: 'offer-latest' } : { action: 'keep' };
      case 'gone':
        // An Owner's own Diagram can only be gone by deletion; for a
        // Collaborator removal and deletion look the same from here, as
        // they do to the Save path.
        return { action: 'blocked', kind: collaborator ? 'revoked' : 'missing' };
      case 'denied':
        return collaborator ? { action: 'blocked', kind: 'revoked' } : { action: 'local-copy' };
      case 'unreachable':
        return { action: 'local-copy' };
    }
  }

  // 'clean' or 'none': nothing local to lose, so the server decides.
  switch (check.kind) {
    case 'opened':
      return check.role === 'view' ? { action: 'redirect-view' } : { action: 'load-latest' };
    case 'gone':
      return { action: 'status', status: check.reason };
    case 'denied':
      if (local.copy === 'none') return { action: 'status', status: 'error' };
      // A revoked Collaborator's clean copy is not shown any more.
      return collaborator ? { action: 'status', status: 'not-found' } : { action: 'local-copy' };
    case 'unreachable':
      return local.copy === 'none' ? { action: 'status', status: 'error' } : { action: 'local-copy' };
  }
}

/** How long a clean local copy waits for the server before it is shown
 *  anyway (with the local-copy note). The answer is still applied when it
 *  arrives. Firestore itself gives up on an unreachable backend after ~10s. */
export const LOCAL_COPY_FALLBACK_MS = 6000;
