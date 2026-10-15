// Editor keyboard shortcuts as data — which key does what, and how to
// print it — with no DOM listeners and no store. `use-editor-shortcuts.ts`
// does the listening; the cheat-sheet dialog and button titles read the
// labels from here, so the keys a tooltip shows are the keys that work.

/** The subset of a `KeyboardEvent` the resolver reads. */
export interface KeyLike {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export type ShortcutAction =
  | { type: 'delete' }
  | { type: 'copy' }
  | { type: 'cut' }
  | { type: 'paste' }
  | { type: 'duplicate' }
  | { type: 'select-all' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'save' }
  | { type: 'nudge'; dx: number; dy: number; large: boolean }
  | { type: 'escape' }
  | { type: 'show-shortcuts' };

/** True on macOS (and iPadOS with a keyboard), where ⌘ is the modifier. */
export function isMacPlatform(nav: { platform?: string; userAgent?: string; userAgentData?: { platform?: string } } | undefined): boolean {
  if (!nav) return false;
  const platform = nav.userAgentData?.platform || nav.platform || '';
  if (platform) return /mac|iphone|ipad|ipod/i.test(platform);
  return /mac os x|macintosh|iphone|ipad/i.test(nav.userAgent ?? '');
}

/** The letter a key event names, independent of keyboard layout when the
 *  layout doesn't produce Latin letters (`code` is the physical key). */
function letterOf(event: KeyLike): string {
  if (/^[a-z]$/i.test(event.key)) return event.key.toLowerCase();
  const match = event.code?.match(/^Key([A-Z])$/);
  return match ? match[1].toLowerCase() : '';
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * Which editor action a key press asks for, or null. The command modifier
 * is ⌘ on macOS and Ctrl elsewhere; the other one never counts as it (so
 * Ctrl+C on a Mac is not copy). Ctrl+Y is redo everywhere but macOS.
 */
export function resolveShortcut(event: KeyLike, isMac: boolean): ShortcutAction | null {
  const command = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  const anyModifier = event.metaKey || event.ctrlKey || event.altKey;

  if (command && !event.altKey) {
    const letter = letterOf(event);
    if (letter === 'z') return event.shiftKey ? { type: 'redo' } : { type: 'undo' };
    if (event.shiftKey) return null;
    if (letter === 'y' && !isMac) return { type: 'redo' };
    if (letter === 'c') return { type: 'copy' };
    if (letter === 'x') return { type: 'cut' };
    if (letter === 'v') return { type: 'paste' };
    if (letter === 'd') return { type: 'duplicate' };
    if (letter === 'a') return { type: 'select-all' };
    if (letter === 's') return { type: 'save' };
    return null;
  }
  if (anyModifier) return null;

  if (event.key === 'Delete' || event.key === 'Backspace') return event.shiftKey ? null : { type: 'delete' };
  if (event.key === 'Escape') return { type: 'escape' };
  if (event.key === '?') return { type: 'show-shortcuts' };
  const arrow = ARROWS[event.key];
  if (arrow) return { type: 'nudge', dx: arrow[0], dy: arrow[1], large: event.shiftKey };
  return null;
}

/** Pixels per arrow press: 1, or with Shift one grid cell when snap is on and 10 otherwise. */
export function nudgeDistance(large: boolean, grid: { snapEnabled: boolean; gridSize: number }): number {
  if (!large) return 1;
  return grid.snapEnabled ? grid.gridSize : 10;
}

/** Key tokens a shortcut label is built from; `mod` is ⌘ or Ctrl. */
export type KeyToken = 'mod' | 'shift' | 'ctrl' | string;

/**
 * Prints a key combination the platform's way: `⇧⌘Z` on macOS (glyphs,
 * no separators, modifiers in the ⌃⇧⌘ order Apple's menus use),
 * `Ctrl+Shift+Z` elsewhere (Ctrl first, the Windows convention).
 */
export function formatKeys(keys: readonly KeyToken[], isMac: boolean): string {
  const glyph = (key: KeyToken) => {
    if (key === 'mod') return isMac ? '⌘' : 'Ctrl';
    if (key === 'shift') return isMac ? '⇧' : 'Shift';
    if (key === 'ctrl') return isMac ? '⌃' : 'Ctrl';
    return key;
  };
  const order: Record<string, number> = isMac ? { ctrl: 0, shift: 1, mod: 2 } : { ctrl: 0, mod: 0, shift: 1 };
  const sorted = [...keys].sort((a, b) => (order[a] ?? 3) - (order[b] ?? 3)).map(glyph);
  return isMac ? sorted.join('') : sorted.join('+');
}

export interface ShortcutRow {
  /** Alternative combinations, each a list of key tokens. */
  combos: KeyToken[][];
  label: string;
  /** Only on this platform (Ctrl+Y redo). */
  only?: 'mac' | 'other';
}

/** Every editor shortcut, grouped the way the cheat sheet shows them. */
export const SHORTCUT_GROUPS: { title: string; rows: ShortcutRow[] }[] = [
  {
    title: 'Edit',
    rows: [
      { combos: [['mod', 'Z']], label: 'Undo' },
      { combos: [['shift', 'mod', 'Z']], label: 'Redo', only: 'mac' },
      { combos: [['shift', 'mod', 'Z'], ['ctrl', 'Y']], label: 'Redo', only: 'other' },
      { combos: [['mod', 'C']], label: 'Copy selection' },
      { combos: [['mod', 'X']], label: 'Cut selection' },
      { combos: [['mod', 'V']], label: 'Paste (also Diagram JSON)' },
      { combos: [['mod', 'D']], label: 'Duplicate selection' },
      { combos: [['Delete'], ['Backspace']], label: 'Delete selection' },
      { combos: [['mod', 'S']], label: 'Save' },
    ],
  },
  {
    title: 'Select and move',
    rows: [
      { combos: [['mod', 'A']], label: 'Select all Elements' },
      { combos: [['Esc']], label: 'Deselect / disarm the drawing tool' },
      { combos: [['← ↑ → ↓']], label: 'Nudge selection 1 px' },
      { combos: [['shift', '← ↑ → ↓']], label: 'Nudge 10 px (one grid cell with snap on)' },
    ],
  },
  {
    title: 'Help',
    rows: [{ combos: [['?']], label: 'Show keyboard shortcuts' }],
  },
];
