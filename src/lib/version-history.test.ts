import { describe, expect, it } from 'vitest';
import {
  actorOf,
  hasVersionableContent,
  excessUnnamed,
  formatRelativeTime,
  normalizeVersionName,
  savedByLabel,
  UNNAMED_VERSIONS_KEPT,
  unnamedVersionsToPrune,
  VERSION_NAME_MAX,
  versionLabel,
  type VersionSummary,
} from './version-history';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** `count` unnamed versions saved one minute apart; v0 is the oldest. */
function unnamedSeries(count: number, start = 0): Pick<VersionSummary, 'id' | 'name' | 'savedAt'>[] {
  return Array.from({ length: count }, (_, index) => ({ id: `v${start + index}`, name: null, savedAt: (start + index) * MINUTE }));
}

describe('retention — which versions a Save prunes', () => {
  it('keeps 50 unnamed versions by default', () => {
    expect(UNNAMED_VERSIONS_KEPT).toBe(50);
  });

  it('prunes nothing at or under the cap', () => {
    expect(unnamedVersionsToPrune(unnamedSeries(0))).toEqual([]);
    expect(unnamedVersionsToPrune(unnamedSeries(50))).toEqual([]);
    expect(excessUnnamed(50)).toBe(0);
    expect(excessUnnamed(3)).toBe(0);
  });

  it('51 unnamed → the single oldest goes', () => {
    expect(unnamedVersionsToPrune(unnamedSeries(51))).toEqual(['v0']);
    expect(excessUnnamed(51)).toBe(1);
  });

  it('does not depend on the order the versions arrive in', () => {
    const shuffled = [...unnamedSeries(53)].reverse();
    expect(unnamedVersionsToPrune(shuffled).sort()).toEqual(['v0', 'v1', 'v2']);
  });

  it('never prunes a named version, and named versions do not use up a slot', () => {
    // Name the very oldest, then save 60 more times.
    const versions = [{ id: 'sent-to-client', name: 'Sent to client', savedAt: -DAY }, ...unnamedSeries(60)];
    const doomed = unnamedVersionsToPrune(versions);
    expect(doomed).not.toContain('sent-to-client');
    expect([...doomed].sort()).toEqual(unnamedSeries(10).map((version) => version.id).sort());
    expect(versions.length - doomed.length).toBe(51); // 50 unnamed + the named one
  });

  it('treats a version still waiting for its server time as the newest', () => {
    const versions = [...unnamedSeries(50), { id: 'pending', name: null, savedAt: null }];
    expect(unnamedVersionsToPrune(versions)).toEqual(['v0']);
  });

  it('honours a custom cap', () => {
    expect(unnamedVersionsToPrune(unnamedSeries(5), 2)).toEqual(['v2', 'v1', 'v0']);
    expect(excessUnnamed(5, 2)).toBe(3);
  });
});

describe('version names', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeVersionName('  Sent   to\tclient ')).toBe('Sent to client');
  });

  it('an empty name removes the name', () => {
    expect(normalizeVersionName('')).toBeNull();
    expect(normalizeVersionName('   ')).toBeNull();
  });

  it('cuts to the maximum length the rules accept', () => {
    const name = normalizeVersionName('x'.repeat(200));
    expect(name).toHaveLength(VERSION_NAME_MAX);
  });
});

describe('labels', () => {
  it('a version is labelled by its name, else by when it was saved', () => {
    expect(versionLabel({ name: 'Sent to client', savedAt: 0 })).toBe('Sent to client');
    const saved = Date.UTC(2026, 9, 16, 7, 32);
    expect(versionLabel({ name: null, savedAt: saved })).toMatch(/Oct 16, 2026/);
    expect(versionLabel({ name: null, savedAt: null })).toBe('Saving…');
  });

  it('saved by: "You", then display name, then email', () => {
    const actor = { uid: 'a', email: 'a@company.com', displayName: 'Alice' };
    expect(savedByLabel(actor, 'a')).toBe('You');
    expect(savedByLabel(actor, 'b')).toBe('Alice');
    expect(savedByLabel({ ...actor, displayName: null }, 'b')).toBe('a@company.com');
    expect(savedByLabel({ uid: 'a', email: null, displayName: null }, 'b')).toBe('Someone');
    expect(savedByLabel(null, 'b')).toBe('Someone');
  });

  it('actorOf keeps uid, email and a trimmed display name (blank → null)', () => {
    expect(actorOf({ uid: 'a', email: 'a@x.io', displayName: '  Alice ' })).toEqual({ uid: 'a', email: 'a@x.io', displayName: 'Alice' });
    expect(actorOf({ uid: 'a', email: null, displayName: '   ' })).toEqual({ uid: 'a', email: null, displayName: null });
    expect(actorOf({ uid: 'a' })).toEqual({ uid: 'a', email: null, displayName: null });
  });

  it('relative time', () => {
    const now = Date.UTC(2026, 9, 16, 12);
    expect(formatRelativeTime(now - 10_000, now)).toBe('just now');
    expect(formatRelativeTime(now + 5_000, now)).toBe('just now');
    expect(formatRelativeTime(null, now)).toBe('just now');
    expect(formatRelativeTime(now - 5 * MINUTE, now)).toBe('5 minutes ago');
    expect(formatRelativeTime(now - 2 * HOUR, now)).toBe('2 hours ago');
    expect(formatRelativeTime(now - DAY, now)).toBe('yesterday');
    expect(formatRelativeTime(now - 3 * DAY, now)).toBe('3 days ago');
    expect(formatRelativeTime(now - 14 * DAY, now)).toBe('2 weeks ago');
    expect(formatRelativeTime(now - 400 * DAY, now)).toBe('last year');
  });
});

describe('first Version of a new Diagram', () => {
  it('is written for any content, not for a blank canvas', () => {
    expect(hasVersionableContent({ nodes: [], edges: [] })).toBe(false);
    expect(hasVersionableContent({})).toBe(false);
    expect(hasVersionableContent({ nodes: [{}], edges: [] })).toBe(true);
    expect(hasVersionableContent({ nodes: [], edges: [{}] })).toBe(true);
  });
});
