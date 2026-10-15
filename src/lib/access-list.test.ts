import { describe, expect, it } from 'vitest';
import { accessDecision, isListed, normalizeAccessList, OPEN_ACCESS_LIST } from './access-list';
import { ACCESS_CASES } from './access-list.cases';

describe('accessDecision — the shared case table', () => {
  it.each(ACCESS_CASES)('$name → $expected', ({ config, email, emailVerified, isAdmin, expected }) => {
    expect(accessDecision({ email, emailVerified, isAdmin: isAdmin ?? false, list: normalizeAccessList(config) })).toBe(expected);
  });
});

describe('normalizeAccessList', () => {
  it('treats a missing doc as open', () => {
    expect(normalizeAccessList(undefined)).toEqual(OPEN_ACCESS_LIST);
    expect(normalizeAccessList(null)).toEqual(OPEN_ACCESS_LIST);
  });

  it('lower-cases, trims, drops a leading @ and blank entries', () => {
    expect(normalizeAccessList({ domains: [' Company.COM ', '', '@Partner.io'], emails: ['  B@Gmail.com'] })).toEqual({
      open: false,
      malformed: false,
      domains: ['company.com', 'partner.io'],
      emails: ['b@gmail.com'],
    });
  });

  it('splits comma-separated entries', () => {
    expect(normalizeAccessList({ domains: ['a.com,b.com , @c.com'] }).domains).toEqual(['a.com', 'b.com', 'c.com']);
  });

  it('marks a field that is not a list malformed instead of throwing', () => {
    for (const raw of [{ domains: 'a.com' }, { emails: 1 }, { domains: null }, { domains: { a: 1 } }, 'a.com', ['a.com']]) {
      const list = normalizeAccessList(raw);
      expect(list.malformed).toBe(true);
      expect(list.open).toBe(false);
    }
  });

  it('reads non-string entries the way the rules\' join() does', () => {
    // Scalars become text; an object entry empties its own list only.
    expect(normalizeAccessList({ domains: ['a.com', 42, null, true] }).domains).toEqual(['a.com', '42', 'null', 'true']);
    expect(normalizeAccessList({ domains: ['a.com', { x: 1 }], emails: ['b@c.io'] })).toEqual({
      open: false,
      malformed: false,
      domains: [],
      emails: ['b@c.io'],
    });
  });
});

describe('isListed', () => {
  const list = normalizeAccessList({ domains: ['company.com'], emails: ['b@gmail.com'] });

  it('matches the part after the last @ exactly', () => {
    expect(isListed('a@company.com', list)).toBe(true);
    expect(isListed('a@eu.company.com', list)).toBe(false);
    expect(isListed('"odd@name"@company.com', list)).toBe(true);
  });

  it('never matches a missing or domain-less address', () => {
    expect(isListed(null, list)).toBe(false);
    expect(isListed('', list)).toBe(false);
    expect(isListed('company.com', list)).toBe(false);
    expect(isListed('a@', list)).toBe(false);
  });
});
