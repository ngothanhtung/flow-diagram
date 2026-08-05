'use client';

import { FirebaseError } from 'firebase/app';
import { Boxes, CircuitBoard, LoaderCircle, LockKeyhole, Mail, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createAccountWithEmail,
  signInWithEmail,
  signInWithGoogle,
} from '@/lib/firebase/auth';

type AuthMode = 'login' | 'register';

function authErrorMessage(error: unknown) {
  if (!(error instanceof FirebaseError)) return 'Could not sign in. Please try again.';
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'This email already has an account.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/popup-closed-by-user': 'The Google sign-in window was closed.',
    'auth/popup-blocked': 'Your browser is blocking the Google sign-in window.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled on Firebase.',
  };
  return messages[error.code] ?? 'Firebase could not authenticate this account.';
}

export function LoginForm() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending('email');
    try {
      if (mode === 'register') {
        await createAccountWithEmail(email.trim(), password);
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (nextError) {
      setError(authErrorMessage(nextError));
    } finally {
      setPending(null);
    }
  };

  const submitGoogle = async () => {
    setError(null);
    setPending('google');
    try {
      await signInWithGoogle();
    } catch (nextError) {
      setError(authErrorMessage(nextError));
    } finally {
      setPending(null);
    }
  };

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-[#07090d] text-zinc-100 lg:grid-cols-[1.15fr_.85fr]">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(34,211,238,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.07)_1px,transparent_1px)] [background-size:48px_48px]" />
      <section className="relative hidden min-h-screen overflow-hidden border-r border-cyan-300/10 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_35%,rgba(6,182,212,.16),transparent_32%),radial-gradient(circle_at_72%_70%,rgba(16,185,129,.11),transparent_28%)]" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-cyan-300/10 ring-1 ring-cyan-200/30 shadow-[0_0_30px_rgba(34,211,238,.12)]">
            <Boxes className="size-5 text-cyan-200" />
          </span>
          <div>
            <p className="font-mono text-sm font-semibold tracking-wide">X FLOW TOOL</p>
            <p className="text-xs text-zinc-500">Architecture canvas · live systems</p>
          </div>
        </div>

        <div className="relative max-w-xl pb-12">
          <div className="mb-8 flex items-center gap-3 text-cyan-200/70">
            <span className="h-px w-16 bg-cyan-300/50" />
            <span className="font-mono text-[10px] uppercase tracking-[.28em]">Design the system</span>
          </div>
          <h1 className="max-w-lg font-mono text-5xl leading-[1.08] font-semibold tracking-[-.045em] text-zinc-100">
            Turn complex architecture into one clear flow.
          </h1>
          <p className="mt-6 max-w-lg text-sm leading-7 text-zinc-400">
            Draw, simulate, and store your software architecture diagrams in your own private space.
          </p>
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
            {[
              [CircuitBoard, 'Flow editor', 'Node & line'],
              [Sparkles, 'Live effects', 'A → B'],
              [LockKeyhole, 'Private cloud', 'Per account'],
            ].map(([Icon, title, detail]) => {
              const FeatureIcon = Icon as typeof CircuitBoard;
              return (
                <div key={title as string} className="rounded-2xl border border-white/8 bg-white/[.025] p-4 backdrop-blur-sm">
                  <FeatureIcon className="size-4 text-cyan-300" />
                  <p className="mt-4 text-xs font-semibold text-zinc-200">{title as string}</p>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-zinc-600">{detail as string}</p>
                </div>
              );
            })}
          </div>
        </div>
        <p className="relative font-mono text-[10px] tracking-wider text-zinc-700">CODEX FLOW DIAGRAM · FIREBASE SECURED</p>
      </section>

      <section className="relative flex min-h-screen items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-md border border-white/8 bg-zinc-950/75 py-0 shadow-[0_30px_100px_rgba(0,0,0,.55),0_0_50px_rgba(34,211,238,.05)] backdrop-blur-xl">
          <CardHeader className="border-b border-white/6 px-7 pt-7 pb-6">
            <div className="mb-5 flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-xl bg-cyan-300/10 ring-1 ring-cyan-200/25 lg:hidden">
                <Boxes className="size-5 text-cyan-200" />
              </span>
              <span className="ml-auto rounded-full bg-emerald-400/8 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.16em] text-emerald-300 ring-1 ring-emerald-300/15">
                Firebase secured
              </span>
            </div>
            <CardTitle className="font-mono text-2xl font-semibold tracking-tight">
              {mode === 'login' ? 'Sign in to workspace' : 'Create account'}
            </CardTitle>
            <CardDescription className="mt-1 text-zinc-500">
              {mode === 'login'
                ? 'Continue with your saved diagrams.'
                : 'Each account gets its own diagram library.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-7 pt-6 pb-7">
            <form onSubmit={submitEmail} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="auth-email" className="text-[10px] uppercase tracking-[.14em] text-zinc-400">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-600" />
                  <Input id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="you@company.com" className="h-11 border-white/8 bg-white/[.035] pl-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-password" className="text-[10px] uppercase tracking-[.14em] text-zinc-400">Password</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-600" />
                  <Input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required placeholder="At least 6 characters" className="h-11 border-white/8 bg-white/[.035] pl-10" />
                </div>
              </div>
              {error && (
                <div role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/8 px-3 py-2.5 text-xs leading-5 text-rose-200">
                  {error}
                </div>
              )}
              <Button type="submit" disabled={pending !== null} className="h-11 w-full bg-cyan-300 text-zinc-950 hover:bg-cyan-200">
                {pending === 'email' && <LoaderCircle className="animate-spin" />}
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3 text-[9px] uppercase tracking-[.18em] text-zinc-700">
              <span className="h-px flex-1 bg-white/7" /> or <span className="h-px flex-1 bg-white/7" />
            </div>

            <Button type="button" variant="outline" disabled={pending !== null} onClick={submitGoogle} className="h-11 w-full border-white/10 bg-white/[.025]">
              {pending === 'google' ? <LoaderCircle className="animate-spin" /> : <span className="font-bold text-cyan-300">G</span>}
              Continue with Google
            </Button>

            <p className="mt-6 text-center text-xs text-zinc-500">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button type="button" onClick={() => { setMode((value) => value === 'login' ? 'register' : 'login'); setError(null); }} className="font-semibold text-cyan-300 hover:text-cyan-200">
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

export function AuthLoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#07090d] text-zinc-300">
      <div className="flex flex-col items-center gap-4">
        <span className="grid size-12 place-items-center rounded-2xl bg-cyan-300/10 ring-1 ring-cyan-200/25">
          <Boxes className="size-5 animate-pulse text-cyan-200" />
        </span>
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-zinc-600">Authenticating workspace</p>
      </div>
    </main>
  );
}
