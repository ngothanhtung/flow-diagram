'use client';

import { FirebaseError } from 'firebase/app';
import type { User } from 'firebase/auth';
import { LoaderCircle, LogOut, MailCheck, RefreshCw, Send, ShieldOff } from 'lucide-react';
import { useRef, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { sendVerificationEmail, signOutUser } from '@/lib/firebase/auth';

// The two screens `LoginForm` shows a signed-in user the Access list doesn't
// let in yet (see `AuthGate`). Both replace what would otherwise be raw
// permission-denied errors from Firestore.

export const ACCESS_DENIED_MESSAGE = "This email isn't allowed to use X Flow Tool. Contact your administrator.";

const ALERT = 'rounded-lg border px-3 py-2.5 text-xs leading-5';
const ERROR_ALERT = `${ALERT} border-rose-400/20 bg-rose-400/8 text-rose-700 dark:text-rose-200`;
const INFO_ALERT = `${ALERT} flex gap-2.5 border-cyan-400/25 bg-cyan-400/8 text-cyan-800 dark:text-cyan-100`;

function SignedInAs({ user }: { user: User }) {
  return (
    <p className="text-xs text-muted-foreground">
      Signed in as <span className="font-semibold text-foreground [overflow-wrap:anywhere]">{user.email ?? 'an account without an email'}</span>
    </p>
  );
}

function SignOutButton() {
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void signOutUser().finally(() => setPending(false));
      }}
      className="h-11 w-full border-border bg-muted/20"
    >
      {pending ? <LoaderCircle className="animate-spin" /> : <LogOut />}
      Sign out
    </Button>
  );
}

/** Off the Access list: a plain refusal and a way to switch accounts. */
export function AccessDeniedView({ user }: { user: User }) {
  return (
    <div className="space-y-4">
      <div role="alert" className={`${ERROR_ALERT} flex gap-2.5`}>
        <ShieldOff className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-300" />
        <span>{ACCESS_DENIED_MESSAGE}</span>
      </div>
      <SignedInAs user={user} />
      <SignOutButton />
      <p className="text-xs leading-5 text-muted-foreground">
        Have a work account? Sign out, then sign in with the email your administrator added.
      </p>
    </div>
  );
}

function resendErrorMessage(error: unknown) {
  const code = error instanceof FirebaseError ? error.code : undefined;
  if (code === 'auth/too-many-requests') return 'Too many emails sent. Wait a minute, then try again.';
  if (code === 'auth/network-request-failed') return "Couldn't send right now. Check your connection and try again.";
  return "Couldn't send the email. Try again in a moment.";
}

type Notice = { kind: 'info' | 'error'; message: string };

/**
 * On the Access list with an unverified Email/Password account: the email
 * has to be proven before it counts. "I've verified" reloads the user and
 * forces a fresh ID token (`recheckAccess`), so the rules see
 * `email_verified` without a sign-out.
 */
export function VerifyEmailView({ user }: { user: User }) {
  const { recheckAccess } = useAuth();
  const [pending, setPending] = useState<'check' | 'resend' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  // `disabled` only lands on the next render; the ref stops a double click
  // from sending two emails (Firebase rate-limits them per account).
  const inFlight = useRef(false);

  const run = async (kind: 'check' | 'resend', action: () => Promise<Notice | null>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(kind);
    setNotice(null);
    try {
      setNotice(await action());
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  const check = () => run('check', async () => {
    try {
      const status = await recheckAccess();
      // `allowed` / `not-allowed`: the gate swaps this screen out.
      return status === 'needs-verification'
        ? { kind: 'error', message: "Your email isn't verified yet. Open the link in the verification email, then try again." }
        : null;
    } catch {
      return { kind: 'error', message: "Couldn't check right now. Check your connection and try again." };
    }
  });

  const resend = () => run('resend', async () => {
    try {
      await sendVerificationEmail(user);
      return { kind: 'info', message: `Sent. Check ${user.email ?? 'your inbox'} — and the spam folder.` };
    } catch (error) {
      return { kind: 'error', message: resendErrorMessage(error) };
    }
  });

  return (
    <div className="space-y-4">
      <div className={INFO_ALERT}>
        <MailCheck className="mt-0.5 size-4 shrink-0 text-cyan-700 dark:text-cyan-300" />
        {/* Not "we sent": an account added to the list after it signed up
            was never sent one — Resend is how it gets its first. */}
        <span>
          Open the verification link emailed to <span className="font-semibold [overflow-wrap:anywhere]">{user.email}</span>, then come back here and press{' '}
          <span className="font-semibold">I&apos;ve verified</span>. No email? Use <span className="font-semibold">Resend</span> below.
        </span>
      </div>

      {notice && (
        <div role={notice.kind === 'error' ? 'alert' : 'status'} className={notice.kind === 'error' ? ERROR_ALERT : INFO_ALERT}>
          {notice.message}
        </div>
      )}

      <Button variant="accent" type="button" disabled={pending !== null} onClick={check} className="h-11 w-full">
        {pending === 'check' ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
        I&apos;ve verified
      </Button>
      <Button type="button" variant="outline" disabled={pending !== null} onClick={resend} className="h-11 w-full border-border bg-muted/20">
        {pending === 'resend' ? <LoaderCircle className="animate-spin" /> : <Send />}
        Resend verification email
      </Button>

      <div className="flex items-center gap-3 text-[9px] uppercase tracking-[.18em] text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> wrong account? <span className="h-px flex-1 bg-border" />
      </div>
      <SignOutButton />
    </div>
  );
}
