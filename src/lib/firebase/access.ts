'use client';

import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { accessDecision, normalizeAccessList, OPEN_ACCESS_LIST, type AccessList, type AccessStatus } from '../access-list';
import { sendVerificationEmail } from './auth';
import { firestore } from './client';
import { isAdminUser } from './roles';

/**
 * Reads the Access list (`config/access`, edited by hand in the Firestore
 * console). A missing doc is an open list.
 *
 * A failed read also comes back open — deliberately. firestore.rules is what
 * enforces the list; this read only decides which screen to show. Failing
 * open means a deployment whose rules predate the Access list (where this
 * read is denied) keeps working exactly as before instead of locking every
 * user out of a list nobody configured.
 */
export async function loadAccessList(): Promise<AccessList> {
  try {
    const snapshot = await getDoc(doc(firestore, 'config', 'access'));
    return normalizeAccessList(snapshot.exists() ? snapshot.data() : undefined);
  } catch (error) {
    console.warn('Could not read the Access list (config/access); treating it as open.', error);
    return OPEN_ACCESS_LIST;
  }
}

export interface UserAccess {
  status: AccessStatus;
  isAdmin: boolean;
}

/**
 * The client's copy of the rules' `hasAccess()` for `user`.
 *
 * It reads `email` / `email_verified` from the ID token rather than from
 * `User`, because the token is what the rules see. The two can disagree:
 * on page load the SDK refreshes the profile (so `emailVerified` turns true
 * once the link was clicked) but keeps the cached token, whose claim stays
 * false for up to an hour — so a mismatch forces a token refresh here.
 * `refresh` (the "I've verified" button) reloads the profile and the token
 * unconditionally.
 */
export async function checkUserAccess(user: User, { refresh = false }: { refresh?: boolean } = {}): Promise<UserAccess> {
  if (refresh) await user.reload();
  let token = await user.getIdTokenResult(refresh);
  if (user.emailVerified && token.claims.email_verified !== true) token = await user.getIdTokenResult(true);
  const [isAdmin, list] = await Promise.all([isAdminUser(user.uid), loadAccessList()]);
  const status = accessDecision({
    email: typeof token.claims.email === 'string' ? token.claims.email : null,
    emailVerified: token.claims.email_verified === true,
    isAdmin,
    list,
  });
  return { status, isAdmin };
}

/**
 * Called right after an Email/Password sign-up: sends the verification
 * email when — and only when — verifying is what stands between the new
 * account and the app (the list is non-empty and the address is on it).
 * An open list demands no verification; an off-list address would still be
 * refused after verifying, so it isn't sent a pointless email. Best-effort:
 * the "Check your inbox" screen offers Resend either way.
 */
export async function sendVerificationIfRequired(user: User): Promise<void> {
  try {
    const { status } = await checkUserAccess(user);
    if (status === 'needs-verification') await sendVerificationEmail(user);
  } catch (error) {
    console.warn('Could not send the verification email after sign-up.', error);
  }
}
