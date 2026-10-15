'use client';

import { useSyncExternalStore } from 'react';
import { formatKeys, isMacPlatform, type KeyToken } from './shortcuts';

const noopSubscribe = () => () => undefined;

/** Reads the platform from `navigator` — client only. */
export function detectMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return isMacPlatform(navigator as Navigator & { userAgentData?: { platform?: string } });
}

/**
 * True on macOS. `useSyncExternalStore` (the repo's pattern for
 * "resolve after hydration") keeps the server render and the first client
 * render identical — both say "not a Mac" — then re-renders with the real
 * answer, without a setState inside an effect.
 */
export function useIsMac(): boolean {
  return useSyncExternalStore(noopSubscribe, detectMac, () => false);
}

/** A key combination printed for this platform: `⌘S` or `Ctrl+S`. */
export function useShortcutLabel(keys: readonly KeyToken[]): string {
  return formatKeys(keys, useIsMac());
}
