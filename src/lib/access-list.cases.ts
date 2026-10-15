// One table of Access list cases, run twice: against `accessDecision`
// (src/lib/access-list.test.ts) and against the deployed rules on a real
// emulator (tests/rules/access-list.test.ts). A case that passes on one side
// and fails on the other means the client and firestore.rules have drifted.
//
// Not imported by app code, so it never reaches the bundle.

import type { AccessStatus } from './access-list';

export interface AccessCase {
  name: string;
  /** `config/access` data; `undefined` = the doc does not exist. */
  config: Record<string, unknown> | undefined;
  /** Token `email` claim; `null` = no email on the account. */
  email: string | null;
  emailVerified: boolean;
  provider: 'google.com' | 'password';
  isAdmin?: boolean;
  expected: AccessStatus;
}

const COMPANY = { domains: ['company.com'], emails: [] };

export const ACCESS_CASES: AccessCase[] = [
  // Open: nothing configured means today's behaviour, verification included.
  { name: 'missing config doc is open, even unverified', config: undefined, email: 'x@anything.io', emailVerified: false, provider: 'password', expected: 'allowed' },
  { name: 'empty lists are open', config: { domains: [], emails: [] }, email: 'x@anything.io', emailVerified: false, provider: 'password', expected: 'allowed' },
  { name: 'doc with no fields is open', config: {}, email: 'x@anything.io', emailVerified: false, provider: 'password', expected: 'allowed' },
  { name: 'blank entries count as empty', config: { domains: ['  ', ''], emails: [' @ '] }, email: 'x@anything.io', emailVerified: false, provider: 'password', expected: 'allowed' },

  // Domains.
  { name: 'listed domain, Google', config: COMPANY, email: 'a@company.com', emailVerified: true, provider: 'google.com', expected: 'allowed' },
  { name: 'off-list domain, Google', config: COMPANY, email: 'b@gmail.com', emailVerified: true, provider: 'google.com', expected: 'not-allowed' },
  { name: 'off-list domain, password, unverified', config: COMPANY, email: 'b@gmail.com', emailVerified: false, provider: 'password', expected: 'not-allowed' },
  { name: 'off-list domain, password, verified', config: COMPANY, email: 'b@gmail.com', emailVerified: true, provider: 'password', expected: 'not-allowed' },
  { name: 'email case does not matter', config: COMPANY, email: 'A.Person@Company.COM', emailVerified: true, provider: 'google.com', expected: 'allowed' },
  { name: 'config case and whitespace do not matter', config: { domains: ['  Company.COM '] }, email: 'a@company.com', emailVerified: true, provider: 'google.com', expected: 'allowed' },
  { name: 'a leading @ on a domain is tolerated', config: { domains: ['@company.com'] }, email: 'a@company.com', emailVerified: true, provider: 'google.com', expected: 'allowed' },
  { name: 'comma-separated domains in one entry', config: { domains: ['company.com, partner.io'] }, email: 'p@partner.io', emailVerified: true, provider: 'google.com', expected: 'allowed' },
  { name: 'a subdomain is not the domain', config: COMPANY, email: 'a@eu.company.com', emailVerified: true, provider: 'google.com', expected: 'not-allowed' },
  { name: 'a suffix is not the domain', config: COMPANY, email: 'a@notcompany.com', emailVerified: true, provider: 'google.com', expected: 'not-allowed' },
  { name: 'a plus-tagged address matches by domain', config: COMPANY, email: 'a+test@company.com', emailVerified: true, provider: 'google.com', expected: 'allowed' },

  // Exception emails.
  { name: 'exception email, Google', config: { domains: ['company.com'], emails: ['b@gmail.com'] }, email: 'b@gmail.com', emailVerified: true, provider: 'google.com', expected: 'allowed' },
  { name: 'exception email, messy config', config: { emails: ['  B@Gmail.com '] }, email: 'b@gmail.com', emailVerified: true, provider: 'password', expected: 'allowed' },
  { name: 'only the exact exception email', config: { emails: ['b@gmail.com'] }, email: 'c@gmail.com', emailVerified: true, provider: 'google.com', expected: 'not-allowed' },
  { name: 'a domain in the emails list is not a domain rule', config: { emails: ['company.com'] }, email: 'a@company.com', emailVerified: true, provider: 'google.com', expected: 'not-allowed' },

  // Verification — only demanded when the list is non-empty.
  { name: 'listed domain, password, unverified', config: COMPANY, email: 'x@company.com', emailVerified: false, provider: 'password', expected: 'needs-verification' },
  { name: 'listed domain, password, verified', config: COMPANY, email: 'x@company.com', emailVerified: true, provider: 'password', expected: 'allowed' },
  { name: 'exception email, password, unverified', config: { emails: ['b@gmail.com'] }, email: 'b@gmail.com', emailVerified: false, provider: 'password', expected: 'needs-verification' },
  { name: 'no email on the account', config: COMPANY, email: null, emailVerified: false, provider: 'password', expected: 'not-allowed' },

  // Administrators are always allowed.
  { name: 'administrator off-list and unverified', config: COMPANY, email: 'boss@gmail.com', emailVerified: false, provider: 'password', isAdmin: true, expected: 'allowed' },
  { name: 'administrator with a malformed list', config: { domains: 'company.com' }, email: 'boss@gmail.com', emailVerified: false, provider: 'password', isAdmin: true, expected: 'allowed' },

  // A field that is not a list fails closed for everyone else.
  { name: 'domains as a string is malformed', config: { domains: 'company.com' }, email: 'a@company.com', emailVerified: true, provider: 'google.com', expected: 'not-allowed' },
  { name: 'a null field is malformed', config: { domains: COMPANY.domains, emails: null }, email: 'a@company.com', emailVerified: true, provider: 'google.com', expected: 'not-allowed' },

  // Non-string entries: tolerated, never matched, never make the list empty.
  { name: 'a number entry is ignored', config: { domains: ['company.com', 42] }, email: 'a@company.com', emailVerified: true, provider: 'google.com', expected: 'allowed' },
  { name: 'a list of only non-strings is not empty', config: { domains: [42, null, true] }, email: 'x@anything.io', emailVerified: true, provider: 'google.com', expected: 'not-allowed' },
  { name: 'a map entry disables its own list', config: { domains: ['company.com', { x: 1 }], emails: ['b@gmail.com'] }, email: 'a@company.com', emailVerified: true, provider: 'google.com', expected: 'not-allowed' },
  { name: 'a map entry leaves the other list working', config: { domains: ['company.com', { x: 1 }], emails: ['b@gmail.com'] }, email: 'b@gmail.com', emailVerified: true, provider: 'google.com', expected: 'allowed' },
  { name: 'a lone map entry is not empty', config: { domains: [{ x: 1 }] }, email: 'x@anything.io', emailVerified: false, provider: 'password', expected: 'not-allowed' },
];
