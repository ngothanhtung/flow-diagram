'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { AuthLoadingScreen, LoginForm } from '@/components/auth/LoginForm';

/**
 * Wraps every surface that reads the signed-in user's data — the Diagrams
 * list, the Editor and the admin pages (not the Viewer: a Public link must
 * open for anyone). Children mount only once the user is signed in **and**
 * the Access list lets them in, so nothing inside ever fires a Firestore
 * request the rules would refuse; a refused or unverified user gets
 * `LoginForm`'s explanation instead.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, access } = useAuth();
  if (loading) return <AuthLoadingScreen />;
  if (!user) return <LoginForm />;
  if (access.status === 'checking') return <AuthLoadingScreen />;
  if (access.status !== 'allowed') return <LoginForm blocked={{ user, status: access.status }} />;
  return children;
}
