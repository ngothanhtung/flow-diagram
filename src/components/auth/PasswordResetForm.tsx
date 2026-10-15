'use client';

import { ArrowLeft, LoaderCircle, Mail, MailCheck } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendPasswordReset } from '@/lib/firebase/auth';
import { requestPasswordReset, type PasswordResetResult } from '@/lib/password-reset';

type PasswordResetFormProps = {
  /** Shared with the sign-in form, so what was typed there carries over (and back). */
  email: string;
  onEmailChange: (email: string) => void;
  onBack: () => void;
};

/**
 * The "Forgot password?" view of `LoginForm`. Every answer the server gives
 * is shown as the same neutral confirmation (see `lib/password-reset.ts`);
 * only an empty or obviously malformed address is reported, inline, and that
 * check runs before anything is sent.
 */
export function PasswordResetForm({ email, onEmailChange, onBack }: PasswordResetFormProps) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PasswordResetResult | null>(null);
  // `disabled` only lands on the next render; the ref closes the gap so a
  // fast double Enter can't send twice.
  const inFlight = useRef(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setResult(null);
    try {
      setResult(await requestPasswordReset(email, sendPasswordReset));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  const invalid = result?.kind === 'invalid';

  return (
    // noValidate: the browser's own type="email" bubble would pre-empt the
    // inline message below.
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="reset-email" className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">Email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="reset-email"
            type="email"
            value={email}
            onChange={(event) => { onEmailChange(event.target.value); setResult(null); }}
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? 'reset-email-error' : undefined}
            className="h-11 border-border bg-muted/20 pl-10"
          />
        </div>
        {invalid && (
          <p id="reset-email-error" className="text-xs text-rose-700 dark:text-rose-300">{result.message}</p>
        )}
      </div>

      {result?.kind === 'sent' && (
        <div role="status" className="flex gap-2.5 rounded-lg border border-cyan-400/25 bg-cyan-400/8 px-3 py-2.5 text-xs leading-5 text-cyan-800 dark:text-cyan-100">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-cyan-700 dark:text-cyan-300" />
          <span>{result.message}</span>
        </div>
      )}
      {result?.kind === 'retry' && (
        <div role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/8 px-3 py-2.5 text-xs leading-5 text-rose-700 dark:text-rose-200">
          {result.message}
        </div>
      )}

      <Button variant="accent" type="submit" disabled={pending} className="h-11 w-full">
        {pending && <LoaderCircle className="animate-spin" />}
        Send reset link
      </Button>

      <p className="text-xs leading-5 text-muted-foreground">
        Signed in with Google before? You don&apos;t need a password — use <span className="font-semibold text-foreground">Continue with Google</span> on the sign-in screen.
      </p>

      <div className="text-center">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-300 dark:hover:text-cyan-200">
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </button>
      </div>
    </form>
  );
}
