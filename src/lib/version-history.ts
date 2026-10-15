/**
 * Pure half of Versions (PRD v0.3 §4.1): who saved, how a Version is
 * labelled, which unnamed Versions the retention rule removes. No Firebase
 * here — `lib/firebase/versions.ts` does the reads and writes and calls
 * into this module, so the rules that matter are Vitest-covered.
 */

/** How many unnamed Versions a Diagram keeps; Named versions don't count. */
export const UNNAMED_VERSIONS_KEPT = 50;

/** Longest Version name accepted (the rules enforce the same bound). */
export const VERSION_NAME_MAX = 80;

/**
 * Who performed a Save. Stored on each Version (`savedBy`) and on the
 * Diagram (`lastSavedBy`). `uid` is what the rules check; email and display
 * name are for people reading the history — a Collaborator (T7) saves too,
 * so "who" is not always the Owner.
 */
export interface VersionActor {
  uid: string;
  email: string | null;
  displayName: string | null;
}

/** A Version as the history panel sees it (timestamps as epoch millis). */
export interface VersionSummary {
  id: string;
  /** `null` = unnamed. Stored as an explicit `null`, never a missing
   *  field: the prune query filters on `name == null`, which a missing
   *  field would not match. */
  name: string | null;
  savedAt: number | null;
  savedBy: VersionActor | null;
}

/** The actor for a signed-in Firebase user (anything with these fields). */
export function actorOf(user: { uid: string; email?: string | null; displayName?: string | null }): VersionActor {
  return { uid: user.uid, email: user.email ?? null, displayName: user.displayName?.trim() || null };
}

/**
 * Whether a newly created Diagram gets a first Version: yes for anything
 * with content (Save as, a template, a Version copied to a new Diagram),
 * no for a blank "New diagram" — an empty canvas has nothing to restore,
 * and skipping it keeps "Save N times → N Versions" literally true.
 */
export function hasVersionableContent(document: { nodes?: readonly unknown[]; edges?: readonly unknown[] }): boolean {
  return (document.nodes?.length ?? 0) > 0 || (document.edges?.length ?? 0) > 0;
}

/** How many unnamed Versions are over the cap, given how many exist. */
export function excessUnnamed(unnamedCount: number, keep = UNNAMED_VERSIONS_KEPT): number {
  return Math.max(0, unnamedCount - keep);
}

/**
 * Ids of the Versions the retention rule removes: every unnamed Version
 * older than the `keep` newest unnamed ones. Named versions are never
 * returned and don't use up a slot. A Version still waiting for its server
 * timestamp (`savedAt: null`) is the newest there is, so it sorts first.
 * Ties keep input order, which makes the answer deterministic.
 */
export function unnamedVersionsToPrune(versions: readonly Pick<VersionSummary, 'id' | 'name' | 'savedAt'>[], keep = UNNAMED_VERSIONS_KEPT): string[] {
  const unnamed = versions
    .map((version, index) => ({ version, index }))
    .filter(({ version }) => version.name === null)
    .sort((a, b) => (b.version.savedAt ?? Infinity) - (a.version.savedAt ?? Infinity) || a.index - b.index);
  return unnamed.slice(Math.max(0, keep)).map(({ version }) => version.id);
}

/**
 * What a typed Version name becomes: trimmed, inner whitespace collapsed,
 * cut to `VERSION_NAME_MAX`. Empty means "remove the name" (`null`).
 */
export function normalizeVersionName(input: string): string | null {
  const name = input.replace(/\s+/g, ' ').trim().slice(0, VERSION_NAME_MAX).trim();
  return name === '' ? null : name;
}

const absoluteFormat = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "Oct 16, 2026, 02:32 PM" — or "Saving…" while the server time is pending. */
export function formatSavedAt(savedAt: number | null): string {
  return savedAt === null ? 'Saving…' : absoluteFormat.format(new Date(savedAt));
}

/** A Version's title in lists: its name, else when it was saved. */
export function versionLabel(version: Pick<VersionSummary, 'name' | 'savedAt'>): string {
  return version.name ?? formatSavedAt(version.savedAt);
}

/** "You" for the signed-in user, else display name, email, or "Someone". */
export function savedByLabel(actor: VersionActor | null | undefined, currentUid?: string | null): string {
  if (!actor) return 'Someone';
  if (currentUid && actor.uid === currentUid) return 'You';
  return actor.displayName || actor.email || 'Someone';
}

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "just now", "5 minutes ago", "yesterday", "3 weeks ago"… */
export function formatRelativeTime(then: number | null, now: number): string {
  if (then === null) return 'just now';
  const seconds = Math.round((then - now) / 1000);
  // Under a minute either way (including small clock skew into the future).
  if (Math.abs(seconds) < 60) return 'just now';
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.trunc(seconds / size), unit);
  }
  return 'just now';
}
