import { describe, expect, it, vi } from 'vitest';
import {
  EMAIL_MALFORMED_MESSAGE,
  EMAIL_REQUIRED_MESSAGE,
  RESET_RETRY_MESSAGE,
  RESET_SENT_MESSAGE,
  emailFormatError,
  passwordResetOutcome,
  requestPasswordReset,
} from './password-reset';

// Shaped like a FirebaseError without importing the SDK.
const authError = (code: string) => Object.assign(new Error(code), { code });

describe('emailFormatError', () => {
  it('asks for an email when the field is empty or blank', () => {
    expect(emailFormatError('')).toBe(EMAIL_REQUIRED_MESSAGE);
    expect(emailFormatError('   ')).toBe(EMAIL_REQUIRED_MESSAGE);
  });

  it('rejects obviously malformed addresses', () => {
    for (const email of ['alice', 'alice@', '@example.com', 'alice@example', 'al ice@example.com', 'alice@exa mple.com', 'a@b@c.com']) {
      expect(emailFormatError(email), email).toBe(EMAIL_MALFORMED_MESSAGE);
    }
  });

  it('accepts ordinary addresses, ignoring surrounding whitespace', () => {
    for (const email of ['alice@example.com', ' bob.smith+tag@sub.example.co.uk ', 'x@y.io']) {
      expect(emailFormatError(email), email).toBeNull();
    }
  });
});

describe('passwordResetOutcome', () => {
  it('maps every server answer to the neutral confirmation', () => {
    for (const code of [
      'auth/user-not-found',
      'auth/invalid-email',
      'auth/missing-email',
      'auth/too-many-requests',
      'auth/user-disabled',
      'auth/operation-not-allowed',
      'auth/internal-error',
      'auth/unauthorized-continue-uri',
      'auth/some-future-code',
    ]) {
      expect(passwordResetOutcome(authError(code)), code).toBe('sent');
    }
  });

  it('treats values without an auth code as neutral too', () => {
    expect(passwordResetOutcome(new Error('boom'))).toBe('sent');
    expect(passwordResetOutcome(undefined)).toBe('sent');
    expect(passwordResetOutcome('auth/network-request-failed')).toBe('sent');
  });

  it('offers a retry only when the request never reached the server', () => {
    expect(passwordResetOutcome(authError('auth/network-request-failed'))).toBe('retry');
  });
});

describe('requestPasswordReset', () => {
  it('reports a format error inline without sending anything', async () => {
    const send = vi.fn();
    expect(await requestPasswordReset('not-an-email', send)).toEqual({ kind: 'invalid', message: EMAIL_MALFORMED_MESSAGE });
    expect(await requestPasswordReset('', send)).toEqual({ kind: 'invalid', message: EMAIL_REQUIRED_MESSAGE });
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the trimmed address and confirms neutrally', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    expect(await requestPasswordReset('  alice@example.com ', send)).toEqual({ kind: 'sent', message: RESET_SENT_MESSAGE });
    expect(send).toHaveBeenCalledExactlyOnceWith('alice@example.com');
  });

  it('gives an unknown account exactly the same answer as a known one', async () => {
    const known = await requestPasswordReset('alice@example.com', vi.fn().mockResolvedValue(undefined));
    const unknown = await requestPasswordReset('nobody@example.com', vi.fn().mockRejectedValue(authError('auth/user-not-found')));
    const rejected = await requestPasswordReset('odd@example.com', vi.fn().mockRejectedValue(authError('auth/invalid-email')));
    const throttled = await requestPasswordReset('alice@example.com', vi.fn().mockRejectedValue(authError('auth/too-many-requests')));
    expect(unknown).toEqual(known);
    expect(rejected).toEqual(known);
    expect(throttled).toEqual(known);
  });

  it('asks to retry after a network failure', async () => {
    const send = vi.fn().mockRejectedValue(authError('auth/network-request-failed'));
    expect(await requestPasswordReset('alice@example.com', send)).toEqual({ kind: 'retry', message: RESET_RETRY_MESSAGE });
  });
});
