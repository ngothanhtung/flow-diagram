import { describe, expect, it } from 'vitest';
import { normalizeAccessList, OPEN_ACCESS_LIST } from './access-list';
import {
  accessDocId,
  accessFields,
  collaboratorLevel,
  isPending,
  isValidEmail,
  MAX_COLLABORATORS,
  normalizeEmail,
  parseAccessIndex,
  permissionsOf,
  revisionOf,
  routeForRole,
  saveDecision,
  validateInvite,
  type AccessLevel,
} from './sharing';

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  B@Company.COM ')).toBe('b@company.com');
    expect(normalizeEmail('b@company.com')).toBe('b@company.com');
  });

  it('turns nothing into an empty string', () => {
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail('   ')).toBe('');
  });
});

describe('isValidEmail', () => {
  it.each(['b@company.com', 'first.last+tag@sub.company.co.uk', 'x@y.io'])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(['', 'b', 'b@', '@company.com', 'b@company', 'b@@company.com', 'b c@company.com', 'b@company.com,c@company.com', 'b@company .com'])('refuses %j', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});

describe('accessDocId', () => {
  it('prefixes the owner uid, so another user cannot claim the slot', () => {
    expect(accessDocId('alice', 'd1')).toBe('alice_d1');
    expect(accessDocId('bob', 'd1')).not.toBe(accessDocId('alice', 'd1'));
  });

  it('refuses a missing part', () => {
    expect(() => accessDocId('', 'd1')).toThrow();
    expect(() => accessDocId('alice', '')).toThrow();
  });
});

describe('accessFields', () => {
  it('lists the map keys sorted, as the rules require', () => {
    const fields = accessFields({ 'c@company.com': 'view', 'b@company.com': 'edit' });
    expect(fields.collaboratorEmails).toEqual(['b@company.com', 'c@company.com']);
    expect(fields.collaborators).toEqual({ 'b@company.com': 'edit', 'c@company.com': 'view' });
  });

  it('keeps emails with dots as plain keys', () => {
    const fields = accessFields({ 'first.last@company.co.uk': 'edit' });
    expect(Object.keys(fields.collaborators)).toEqual(['first.last@company.co.uk']);
  });

  it('drops the opened mark of someone no longer listed', () => {
    const fields = accessFields({ 'b@company.com': 'edit' }, { 'b@company.com': 1, 'gone@company.com': 2 });
    expect(fields.openedBy).toEqual({ 'b@company.com': 1 });
  });

  it('an empty map yields empty lists', () => {
    expect(accessFields({})).toEqual({ collaborators: {}, collaboratorEmails: [], openedBy: {} });
  });
});

describe('parseAccessIndex', () => {
  it('reads a stored index, dropping unknown levels and non-time marks', () => {
    const index = parseAccessIndex({
      ownerUid: 'alice',
      ownerEmail: 'alice@company.com',
      diagramId: 'd1',
      collaborators: { 'b@company.com': 'edit', 'c@company.com': 'view', 'x@company.com': 'admin' },
      collaboratorEmails: ['b@company.com', 'c@company.com', 'x@company.com'],
      openedBy: { 'b@company.com': { toMillis: () => 5 }, 'c@company.com': 'yesterday' },
    });
    expect(index).toEqual({
      ownerUid: 'alice',
      ownerEmail: 'alice@company.com',
      diagramId: 'd1',
      collaborators: { 'b@company.com': 'edit', 'c@company.com': 'view' },
      collaboratorEmails: ['b@company.com', 'c@company.com'],
      openedBy: { 'b@company.com': 5 },
    });
  });

  it('refuses something that is not an index', () => {
    expect(parseAccessIndex(null)).toBeNull();
    expect(parseAccessIndex('alice')).toBeNull();
    expect(parseAccessIndex({ ownerUid: 'alice' })).toBeNull();
  });

  it('tolerates missing optional fields', () => {
    expect(parseAccessIndex({ ownerUid: 'alice', diagramId: 'd1' })).toEqual({
      ownerUid: 'alice',
      ownerEmail: '',
      diagramId: 'd1',
      collaborators: {},
      collaboratorEmails: [],
      openedBy: {},
    });
  });
});

describe('collaboratorLevel / isPending', () => {
  const index = { collaborators: { 'b@company.com': 'edit', 'c@company.com': 'view' } as Record<string, AccessLevel>, openedBy: { 'b@company.com': 1 } };

  it('resolves by normalised email', () => {
    expect(collaboratorLevel(index, 'B@Company.com ')).toBe('edit');
    expect(collaboratorLevel(index, 'c@company.com')).toBe('view');
  });

  it('is null for anyone else, and for prototype keys', () => {
    expect(collaboratorLevel(index, 'd@company.com')).toBeNull();
    expect(collaboratorLevel(index, '')).toBeNull();
    expect(collaboratorLevel(index, 'constructor')).toBeNull();
    expect(collaboratorLevel(null, 'b@company.com')).toBeNull();
  });

  it('pending = never seen opening it', () => {
    expect(isPending(index, 'b@company.com')).toBe(false);
    expect(isPending(index, 'c@company.com')).toBe(true);
  });
});

describe('validateInvite', () => {
  const companyList = normalizeAccessList({ domains: ['company.com'], emails: ['guest@partner.io'] });
  const context = { ownerEmail: 'Alice@company.com', collaborators: { 'b@company.com': 'edit' } as Record<string, AccessLevel>, accessList: companyList };

  it('accepts a listed address and returns it normalised', () => {
    expect(validateInvite('  C@Company.com ', context)).toEqual({ ok: true, email: 'c@company.com' });
    expect(validateInvite('guest@partner.io', context)).toEqual({ ok: true, email: 'guest@partner.io' });
  });

  it('refuses an empty or malformed address', () => {
    expect(validateInvite('  ', context)).toMatchObject({ ok: false, reason: 'empty' });
    expect(validateInvite('not-an-email', context)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it("refuses the owner's own email, in any case", () => {
    expect(validateInvite('alice@COMPANY.com', context)).toMatchObject({ ok: false, reason: 'owner' });
  });

  it('refuses someone already listed', () => {
    expect(validateInvite('B@company.com', context)).toMatchObject({ ok: false, reason: 'duplicate' });
  });

  it('refuses an address off the Access list, with a clear message', () => {
    const result = validateInvite('mallory@gmail.com', context);
    expect(result).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(!result.ok && result.message).toContain('Access list');
    // Exact domain only, like the rules.
    expect(validateInvite('b@eu.company.com', context)).toMatchObject({ ok: false, reason: 'not-allowed' });
  });

  it('anyone goes when the list is open, nobody when it is malformed', () => {
    expect(validateInvite('mallory@gmail.com', { ...context, accessList: OPEN_ACCESS_LIST })).toEqual({ ok: true, email: 'mallory@gmail.com' });
    expect(validateInvite('c@company.com', { ...context, accessList: normalizeAccessList({ domains: 'company.com' }) })).toMatchObject({ ok: false, reason: 'not-allowed' });
  });

  it('caps the number of Collaborators', () => {
    const full: Record<string, AccessLevel> = {};
    for (let i = 0; i < MAX_COLLABORATORS; i += 1) full[`p${i}@company.com`] = 'view';
    expect(validateInvite('c@company.com', { ...context, collaborators: full })).toMatchObject({ ok: false, reason: 'full' });
  });
});

describe('permissionsOf — PRD §4.2 Access level table', () => {
  it('owner may do everything', () => {
    expect(permissionsOf('owner')).toEqual({ view: true, edit: true, versions: true, saveAs: true, togglePublic: true, share: true, delete: true });
  });

  it('Can edit: view, edit, Versions, Save as — not Public, Share or Delete', () => {
    expect(permissionsOf('edit')).toEqual({ view: true, edit: true, versions: true, saveAs: true, togglePublic: false, share: false, delete: false });
  });

  it('Can view: view only', () => {
    expect(permissionsOf('view')).toEqual({ view: true, edit: false, versions: false, saveAs: false, togglePublic: false, share: false, delete: false });
  });

  it('routes Can view to the Viewer, everyone else to the Editor', () => {
    expect(routeForRole('view', 'd1')).toBe('/diagrams/d1/view');
    expect(routeForRole('edit', 'd1')).toBe('/diagrams/d1/edit');
    expect(routeForRole('owner', 'd1')).toBe('/diagrams/d1/edit');
  });
});

describe('Save conflict decision', () => {
  it('a Diagram saved before revisions existed counts as revision 0', () => {
    expect(revisionOf({})).toBe(0);
    expect(revisionOf(null)).toBe(0);
    expect(revisionOf({ revision: 7 })).toBe(7);
  });

  it('a non-integer or negative revision reads as 0', () => {
    expect(revisionOf({ revision: '3' })).toBe(0);
    expect(revisionOf({ revision: 1.5 })).toBe(0);
    expect(revisionOf({ revision: -1 })).toBe(0);
    expect(revisionOf({ revision: Number.NaN })).toBe(0);
  });

  it('saves when nobody saved since the editor loaded (or last saved)', () => {
    expect(saveDecision(0, 0)).toBe('save');
    expect(saveDecision(4, 4)).toBe('save');
  });

  it('is a conflict when the server moved on', () => {
    expect(saveDecision(3, 4)).toBe('conflict');
    // A server behind the editor (restored from an older backup, say) is
    // not something to overwrite silently either.
    expect(saveDecision(5, 4)).toBe('conflict');
  });
});
