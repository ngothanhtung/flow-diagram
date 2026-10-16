/**
 * Pure half of Share (PRD v0.3 §4.2, ADR 0001): email normalisation, the
 * access index's id and shape, invite validation, who-may-do-what, and the
 * Save conflict decision. No Firebase here — `lib/firebase/sharing.ts` and
 * `lib/firebase/diagrams.ts` do the reads and writes and call into this
 * module, so the decisions that matter are Vitest-covered.
 *
 * firestore.rules enforces the same things on the server (`isCollaborator`,
 * `isOwnerAccessWrite`, `isAttributedSave`); this module only decides what
 * the UI offers and what a write looks like.
 */

import { accessDecision, type AccessList } from './access-list';

/** What a Collaborator may do (GLOSSARY: Access level). */
export type AccessLevel = 'edit' | 'view';

/** Everyone who can open a Diagram, Owner included. */
export type DiagramRole = 'owner' | AccessLevel;

export const ACCESS_LEVELS: readonly AccessLevel[] = ['edit', 'view'];

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  edit: 'Can edit',
  view: 'Can view',
};

/** Most Collaborators one Diagram may have (the rules enforce the same cap,
 *  which also bounds the access document's size). */
export const MAX_COLLABORATORS = 50;

/**
 * The form every email takes before it is stored, compared or queried:
 * trimmed and lower-cased. The rules compare against
 * `request.auth.token.email.lower()`, so the index must hold exactly this.
 */
export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

/** One `@`, something before it, a dotted domain after it, no whitespace or
 *  commas (a comma would break the rules' `join(',')` lower-case check). */
const EMAIL_SHAPE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_SHAPE.test(email);
}

/**
 * Id of a Diagram's access index document: `{ownerUid}_{diagramId}`.
 *
 * Not the bare diagram id the ADR first sketched: Diagram ids are chosen by
 * the client, so anyone who learns an id (every Public link carries one)
 * could create their own Diagram with that id and claim
 * `diagram-access/{id}` first — the real Owner could then never Share it.
 * Prefixing the owner's uid makes the slot unclaimable by anyone else, and
 * lets the rules find the index from the Diagram's own path. The id is only
 * ever built, never parsed — `ownerUid` and `diagramId` are stored fields.
 */
export function accessDocId(ownerUid: string, diagramId: string): string {
  if (!ownerUid || !diagramId) throw new Error('An owner uid and a diagram id are required.');
  return `${ownerUid}_${diagramId}`;
}

/** `diagram-access/{ownerUid}_{diagramId}` as stored. */
export interface AccessIndex {
  ownerUid: string;
  /** The Owner's email, normalised — shown to Collaborators as "Owner". */
  ownerEmail: string;
  diagramId: string;
  /** Normalised email → Access level. Keys are the email verbatim (dots
   *  and all); they are only ever read as map keys or written as a whole
   *  map, never used as a dotted update path. */
  collaborators: Record<string, AccessLevel>;
  /** The same emails as `collaborators`' keys — what the "Shared with me"
   *  `array-contains` query runs on. The rules require the two to match. */
  collaboratorEmails: string[];
  /** Email → when someone signed in as it first saw the Diagram (Shared
   *  with me, Editor or Viewer). Missing = "Pending" in the Share dialog. */
  openedBy: Record<string, number>;
}

/** Reads a raw access document defensively (a hand-edited or partial doc
 *  must not crash the Share dialog). Unknown levels are dropped. */
export function parseAccessIndex(raw: unknown): AccessIndex | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.ownerUid !== 'string' || typeof data.diagramId !== 'string') return null;
  const collaborators: Record<string, AccessLevel> = {};
  if (data.collaborators && typeof data.collaborators === 'object') {
    for (const [email, level] of Object.entries(data.collaborators as Record<string, unknown>)) {
      if (level === 'edit' || level === 'view') collaborators[email] = level;
    }
  }
  const openedBy: Record<string, number> = {};
  if (data.openedBy && typeof data.openedBy === 'object') {
    for (const [email, at] of Object.entries(data.openedBy as Record<string, unknown>)) {
      const millis = toMillis(at);
      if (millis !== null) openedBy[email] = millis;
    }
  }
  return {
    ownerUid: data.ownerUid,
    ownerEmail: typeof data.ownerEmail === 'string' ? data.ownerEmail : '',
    diagramId: data.diagramId,
    collaborators,
    collaboratorEmails: Object.keys(collaborators).sort(),
    openedBy,
  };
}

function toMillis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

/**
 * The fields an Owner writes for a Collaborator map: the map itself, its
 * keys as a sorted list (the rules check they are the same set), and only
 * the `openedBy` marks of people still on it — removing someone and
 * inviting them again shows them as pending again.
 */
export function accessFields(collaborators: Record<string, AccessLevel>, openedBy: Record<string, unknown> = {}) {
  const collaboratorEmails = Object.keys(collaborators).sort();
  const keptOpened: Record<string, unknown> = {};
  for (const email of collaboratorEmails) if (email in openedBy) keptOpened[email] = openedBy[email];
  return { collaborators: { ...collaborators }, collaboratorEmails, openedBy: keptOpened };
}

/** A Collaborator's level on an index, by (any-case) email. */
export function collaboratorLevel(index: Pick<AccessIndex, 'collaborators'> | null | undefined, email: string | null | undefined): AccessLevel | null {
  if (!index) return null;
  const key = normalizeEmail(email);
  if (!key || !Object.hasOwn(index.collaborators, key)) return null;
  return index.collaborators[key] ?? null;
}

/** Whether a Collaborator has never been seen opening the Diagram. */
export function isPending(index: Pick<AccessIndex, 'openedBy'>, email: string): boolean {
  return !Object.hasOwn(index.openedBy, email);
}

export type InviteResult =
  | { ok: true; email: string }
  | { ok: false; reason: 'empty' | 'invalid' | 'owner' | 'duplicate' | 'not-allowed' | 'full'; message: string };

export interface InviteContext {
  /** The Owner's own email (any case). */
  ownerEmail: string | null | undefined;
  /** Who is on the Diagram already (normalised keys). */
  collaborators: Record<string, AccessLevel>;
  /** The deployment's Access list, as `loadAccessList` read it. */
  accessList: AccessList;
}

/**
 * Whether an email can be invited, and in what form it is stored.
 *
 * The Access list check is the T5 decision for that address as if it were
 * verified — the invitee will have to verify before the invite counts
 * anyway. Administrators pass the rules even off the list, but nobody can
 * read another user's role from the client, so an off-list administrator
 * is refused here too (they can still open everything as an administrator).
 */
export function validateInvite(raw: string, { ownerEmail, collaborators, accessList }: InviteContext): InviteResult {
  const email = normalizeEmail(raw);
  if (!email) return { ok: false, reason: 'empty', message: 'Enter an email address.' };
  if (!isValidEmail(email)) return { ok: false, reason: 'invalid', message: `“${raw.trim()}” isn't a valid email address.` };
  if (email === normalizeEmail(ownerEmail)) return { ok: false, reason: 'owner', message: "That's you — you already own this Diagram." };
  if (Object.hasOwn(collaborators, email)) return { ok: false, reason: 'duplicate', message: `${email} is already a Collaborator.` };
  if (accessDecision({ email, emailVerified: true, isAdmin: false, list: accessList }) !== 'allowed') {
    return { ok: false, reason: 'not-allowed', message: `${email} isn't on this deployment's Access list, so they couldn't open the Diagram. Ask your administrator to add them first.` };
  }
  if (Object.keys(collaborators).length >= MAX_COLLABORATORS) {
    return { ok: false, reason: 'full', message: `A Diagram can be shared with at most ${MAX_COLLABORATORS} people.` };
  }
  return { ok: true, email };
}

/** Where a role lands when it opens `/diagrams/{id}/…`. */
export function routeForRole(role: DiagramRole, diagramId: string): string {
  return role === 'view' ? `/diagrams/${diagramId}/view` : `/diagrams/${diagramId}/edit`;
}

/** What each role may do — the PRD §4.2 Access level table, for the UI.
 *  (The rules enforce it; this only decides what is offered.) */
export function permissionsOf(role: DiagramRole) {
  const owner = role === 'owner';
  const editor = owner || role === 'edit';
  return {
    view: true,
    edit: editor,
    versions: editor,
    saveAs: editor,
    togglePublic: owner,
    share: owner,
    delete: owner,
  };
}

/**
 * The Diagram's revision counter as stored. Diagrams saved before Share
 * existed have none and count as 0; anything that isn't a non-negative
 * integer is read the same way rather than poisoning the comparison.
 */
export function revisionOf(data: { revision?: unknown } | null | undefined): number {
  const revision = data?.revision;
  return typeof revision === 'number' && Number.isInteger(revision) && revision >= 0 ? revision : 0;
}

/**
 * Save conflict (GLOSSARY): someone saved since this editor loaded — or
 * last saved — the Diagram. `base` is the revision the editor has; `server`
 * is what the transaction just read.
 */
export function saveDecision(base: number, server: number): 'save' | 'conflict' {
  return base === server ? 'save' : 'conflict';
}
