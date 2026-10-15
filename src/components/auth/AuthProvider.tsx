'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import type { AccessStatus } from '@/lib/access-list';
import { checkUserAccess } from '@/lib/firebase/access';
import { observeAuthState } from '@/lib/firebase/auth';

/** `checking` until the signed-in user's Access list answer is known. */
export interface AuthAccess {
  status: AccessStatus | 'checking';
  /** `users-roles/{uid}` lists `administrators`. False while checking. */
  isAdmin: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  access: AuthAccess;
  /**
   * Re-runs the Access list check after reloading the user and forcing a
   * fresh ID token, so a just-clicked verification link reaches both the
   * client and the rules without signing out. Resolves to the new status;
   * rejects if the check itself could not run.
   */
  recheckAccess: () => Promise<AccessStatus>;
}

const CHECKING: AuthAccess = { status: 'checking', isAdmin: false };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Keyed by uid, so a different (or no) user reads as `checking` without a
  // reset inside the effect.
  const [checked, setChecked] = useState<{ uid: string; access: AuthAccess } | null>(null);

  useEffect(() => observeAuthState((nextUser) => {
    // Every sign-in is checked afresh — signing out and back in as the same
    // uid must not reuse an answer from before the list was edited.
    setChecked(null);
    setUser(nextUser);
    setLoading(false);
  }), []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    checkUserAccess(user)
      // The rules enforce the list; this only picks the screen. If the check
      // can't run, let the user in and let the server answer.
      .catch((error: unknown) => {
        console.warn('Access check failed; deferring to Firestore rules.', error);
        return { status: 'allowed' as const, isAdmin: false };
      })
      .then((access) => {
        if (!cancelled) setChecked({ uid: user.uid, access });
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const recheckAccess = useCallback(async () => {
    if (!user) throw new Error('Not signed in.');
    const access = await checkUserAccess(user, { refresh: true });
    setChecked({ uid: user.uid, access });
    return access.status;
  }, [user]);

  const access = user && checked?.uid === user.uid ? checked.access : CHECKING;
  const value = useMemo(() => ({ user, loading, access, recheckAccess }), [access, loading, recheckAccess, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
