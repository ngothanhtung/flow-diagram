// The "Forgot password?" flow, minus the Firebase call itself (that lives in
// `firebase/auth.ts`, injected as `send`). Kept free of any Firebase import so
// the rule that matters — no answer may reveal whether an account exists —
// is pinned down by plain unit tests.

/** The one confirmation shown for every answer the server gives. */
export const RESET_SENT_MESSAGE = "If this email has an account, you'll receive a reset link.";

/** Shown only when the request never got an answer from the server. */
export const RESET_RETRY_MESSAGE = "Couldn't send right now. Check your connection and try again.";

export const EMAIL_REQUIRED_MESSAGE = 'Enter your email address.';
export const EMAIL_MALFORMED_MESSAGE = "That doesn't look like an email address.";

// Deliberately loose: it only catches what is obviously not an address
// (missing `@`, no dot in the domain, whitespace). Anything subtler is the
// server's call, and the server's answer is never shown anyway.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Inline error for an email that is empty or obviously malformed, else `null`. */
export function emailFormatError(email: string): string | null {
  const value = email.trim();
  if (!value) return EMAIL_REQUIRED_MESSAGE;
  if (!EMAIL_SHAPE.test(value)) return EMAIL_MALFORMED_MESSAGE;
  return null;
}

export type PasswordResetOutcome = 'sent' | 'retry';

/**
 * Maps a failed send to what the user is told. Only a network failure — the
 * request never reached the server, so nothing about the account could have
 * come back — gets its own retry message. Every server answer, including
 * `auth/user-not-found`, `auth/invalid-email` and `auth/too-many-requests`,
 * collapses into the neutral confirmation.
 *
 * `auth/too-many-requests` is neutral on purpose: Firebase maps the
 * per-account `RESET_PASSWORD_EXCEED_LIMIT` quota onto that same code, and an
 * unknown email can never hit a per-account quota — so a distinct message
 * there would tell a prober that the address is registered.
 */
export function passwordResetOutcome(error: unknown): PasswordResetOutcome {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code: unknown }).code : undefined;
  return code === 'auth/network-request-failed' ? 'retry' : 'sent';
}

export type PasswordResetResult =
  | { kind: 'invalid'; message: string }
  | { kind: PasswordResetOutcome; message: string };

/**
 * Validates `email`, sends the reset through `send` (the trimmed address),
 * and resolves to what the form should show. Never rejects. A malformed
 * address returns `invalid` without calling `send` at all.
 */
export async function requestPasswordReset(email: string, send: (email: string) => Promise<unknown>): Promise<PasswordResetResult> {
  const formatError = emailFormatError(email);
  if (formatError) return { kind: 'invalid', message: formatError };
  try {
    await send(email.trim());
    return { kind: 'sent', message: RESET_SENT_MESSAGE };
  } catch (error) {
    return passwordResetOutcome(error) === 'retry'
      ? { kind: 'retry', message: RESET_RETRY_MESSAGE }
      : { kind: 'sent', message: RESET_SENT_MESSAGE };
  }
}
