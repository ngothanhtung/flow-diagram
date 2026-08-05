'use client';

import { doc, getDoc } from 'firebase/firestore';
import { firestore } from './client';

/** Role value that unlocks the read-only admin overview. */
export const ADMIN_ROLE = 'administrators';

interface UserRoleDocument {
  /** Roles granted to the user, e.g. ['administrators']. */
  roles?: string[];
}

/**
 * Checks `users-roles/{uid}` for `roles: ['administrators', ...]` — the
 * doc must be keyed by the uid (same requirement as `isAdministrator()`
 * in firestore.rules, which cannot query collections). Missing document
 * or read failure means "not an admin".
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const snapshot = await getDoc(doc(firestore, 'users-roles', userId));
    if (!snapshot.exists()) return false;
    const data = snapshot.data() as UserRoleDocument;
    return Array.isArray(data.roles) && data.roles.includes(ADMIN_ROLE);
  } catch {
    return false;
  }
}
