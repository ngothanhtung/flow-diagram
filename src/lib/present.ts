// Present mode: a Diagram full screen, stepped by hand through its run
// timeline (the Manual run mode) with the keys presenters and clickers use.

export type PresentAction = 'next' | 'back' | 'first' | 'last' | 'exit';

const KEYS: Record<string, PresentAction> = {
  ArrowRight: 'next',
  ArrowDown: 'next',
  ' ': 'next',
  PageDown: 'next',
  Enter: 'next',
  ArrowLeft: 'back',
  ArrowUp: 'back',
  PageUp: 'back',
  Backspace: 'back',
  Home: 'first',
  End: 'last',
  Escape: 'exit',
};

/** What a key does in Present mode; null = not ours. Clickers send PageDown / PageUp. */
export function presentKeyAction(key: string): PresentAction | null {
  return Object.hasOwn(KEYS, key) ? KEYS[key] : null;
}

/** The step an action lands on. Unlike Manual's Next, it never wraps: the last step stays put. */
export function presentTarget(action: Exclude<PresentAction, 'exit'>, step: number, count: number): number {
  if (count <= 0) return 0;
  const last = count - 1;
  if (action === 'first') return 0;
  if (action === 'last') return last;
  return Math.min(last, Math.max(0, step + (action === 'next' ? 1 : -1)));
}
