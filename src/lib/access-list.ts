// The Access list decision — who may use this deployment — written once.
//
// The Access list is the hand-edited Firestore doc `config/access`
// `{ domains: string[], emails: string[] }`. The server enforces it in
// firestore.rules (`hasAccess()`); this module answers the same question on
// the client so a refused user gets a clear screen instead of a permission
// error. The two must never disagree, so:
//
//   - every step below has a one-to-one counterpart in `accessListAdmits()` /
//     `accessEntries()` in firestore.rules — including the odd-looking string
//     handling, which is shaped by what the rules language can do (it has no
//     map/filter over a list, so entries are normalised by join → lower →
//     split rather than one at a time);
//   - `ACCESS_CASES` (access-list.cases.ts) is run against this module by
//     access-list.test.ts and against the real rules by
//     tests/rules/access-list.test.ts. Change one side, the other suite fails.
//
// Kept free of any Firebase import so it is plain unit-testable.

export type AccessStatus = 'allowed' | 'not-allowed' | 'needs-verification';

export interface AccessList {
  /**
   * No meaningful entry at all (missing doc, missing fields, empty lists, or
   * entries that are only whitespace / commas / `@`): anyone may sign in and
   * no email verification is demanded — the behaviour before the Access list
   * existed, and what a self-hoster who configures nothing keeps.
   */
  open: boolean;
  /**
   * `domains` or `emails` is present but not a list (e.g. `domains:
   * "company.com"`, or `null`). It fails closed: everyone except
   * administrators is refused until the doc is fixed.
   */
  malformed: boolean;
  /** Lower-case, trimmed, no leading `@`; matched exactly — no subdomains. */
  domains: string[];
  /** Lower-case, trimmed; matched against the whole address. */
  emails: string[];
}

export const OPEN_ACCESS_LIST: AccessList = { open: true, malformed: false, domains: [], emails: [] };

const MALFORMED_ACCESS_LIST: AccessList = { open: false, malformed: true, domains: [], emails: [] };

/**
 * What the rules' `list.join(',')` produces: a number, boolean or null entry
 * becomes its text (which never matches a real address, but does make the
 * list non-empty); a map, timestamp or other object entry makes `join()`
 * fail, returned here as `null` — the rules then treat that list as
 * matching nothing, and never as empty.
 */
function joinLikeRules(list: unknown[]): string | null {
  if (list.some((item) => typeof item === 'object' && item !== null)) return null;
  return list.map((item) => String(item)).join(',');
}

/** Rules: `domains.concat(emails).join(',').matches('[\\s,@]*')`. */
const BLANK_LIST = /^[\s,@]*$/;

/**
 * Rules: `list.join(',').lower().trim().replace('^@', '').split('\\s*,\\s*@?')`.
 * A comma inside one entry therefore separates two entries on both sides,
 * so `"company.com, partner.io"` written as one string works as two.
 */
function entries(list: unknown[]): string[] {
  const joined = joinLikeRules(list);
  if (joined === null) return [];
  return joined
    .toLowerCase()
    .trim()
    .replace(/^@/, '')
    .split(/\s*,\s*@?/)
    .filter((entry) => entry !== '');
}

/**
 * Turns the raw `config/access` data (`undefined` when the doc is missing)
 * into an `AccessList`. Never throws: whitespace, case, a leading `@`, blank
 * and non-string entries are tolerated (see `joinLikeRules`); only a field
 * that is not a list at all marks it malformed.
 */
export function normalizeAccessList(raw: unknown): AccessList {
  if (raw === undefined || raw === null) return OPEN_ACCESS_LIST;
  if (typeof raw !== 'object' || Array.isArray(raw)) return MALFORMED_ACCESS_LIST;
  // Rules: `config.data.get('domains', [])` then `domains is list`.
  const { domains = [], emails = [] } = raw as Record<string, unknown>;
  if (!Array.isArray(domains) || !Array.isArray(emails)) return MALFORMED_ACCESS_LIST;
  const all = joinLikeRules([...domains, ...emails]);
  if (all !== null && BLANK_LIST.test(all)) return OPEN_ACCESS_LIST;
  return { open: false, malformed: false, domains: entries(domains), emails: entries(emails) };
}

/** Rules: `email.matches('.*@[^@]+')` — an address with a non-empty domain. */
const HAS_DOMAIN = /^.*@[^@]+$/;

/**
 * Whether `email` is on the list — as an exception email, or by its domain
 * (the part after the last `@`, compared exactly: `eu.company.com` is not
 * `company.com`). Ignores verification and roles; see `accessDecision`.
 */
export function isListed(email: string | null | undefined, list: AccessList): boolean {
  const address = (email ?? '').toLowerCase();
  if (!HAS_DOMAIN.test(address)) return false;
  const domain = address.slice(address.lastIndexOf('@') + 1);
  return list.emails.includes(address) || list.domains.includes(domain);
}

export interface AccessInput {
  /** The ID token's `email` claim. */
  email: string | null | undefined;
  /**
   * The ID token's `email_verified` claim — read from the token, not from
   * `User.emailVerified`, because the token is what the rules see. Google
   * accounts arrive verified; a new Email/Password account does not.
   */
  emailVerified: boolean;
  /** `users-roles/{uid}` lists `administrators`. */
  isAdmin: boolean;
  list: AccessList;
}

/**
 * The whole table, in order:
 *
 * | administrator | list      | listed | verified | →                    |
 * | ------------- | --------- | ------ | -------- | -------------------- |
 * | yes           | any       | any    | any      | allowed              |
 * | no            | malformed | —      | —        | not-allowed          |
 * | no            | open      | —      | —        | allowed              |
 * | no            | non-empty | no     | any      | not-allowed          |
 * | no            | non-empty | yes    | no       | needs-verification   |
 * | no            | non-empty | yes    | yes      | allowed              |
 *
 * The rules collapse the last three into allowed / denied; the client keeps
 * `needs-verification` apart because verifying is something the user can do.
 */
export function accessDecision({ email, emailVerified, isAdmin, list }: AccessInput): AccessStatus {
  if (isAdmin) return 'allowed';
  if (list.malformed) return 'not-allowed';
  if (list.open) return 'allowed';
  if (!isListed(email, list)) return 'not-allowed';
  return emailVerified ? 'allowed' : 'needs-verification';
}
