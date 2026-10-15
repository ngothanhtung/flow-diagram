import { describe, expect, it } from 'vitest';
import { formatKeys, isMacPlatform, nudgeDistance, resolveShortcut, type KeyLike } from './shortcuts';

const press = (key: string, modifiers: Partial<KeyLike> = {}): KeyLike => ({ key, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...modifiers });

describe('resolveShortcut', () => {
  it('uses ⌘ on macOS and Ctrl elsewhere as the command modifier', () => {
    expect(resolveShortcut(press('z', { metaKey: true }), true)).toEqual({ type: 'undo' });
    expect(resolveShortcut(press('z', { ctrlKey: true }), true)).toBeNull();
    expect(resolveShortcut(press('z', { ctrlKey: true }), false)).toEqual({ type: 'undo' });
    expect(resolveShortcut(press('z', { metaKey: true }), false)).toBeNull();
  });

  it('redo is ⇧⌘Z everywhere and Ctrl+Y off macOS', () => {
    expect(resolveShortcut(press('Z', { metaKey: true, shiftKey: true }), true)).toEqual({ type: 'redo' });
    expect(resolveShortcut(press('Z', { ctrlKey: true, shiftKey: true }), false)).toEqual({ type: 'redo' });
    expect(resolveShortcut(press('y', { ctrlKey: true }), false)).toEqual({ type: 'redo' });
    expect(resolveShortcut(press('y', { metaKey: true }), true)).toBeNull();
  });

  it('maps the letter commands', () => {
    const mac = (key: string) => resolveShortcut(press(key, { metaKey: true }), true)?.type;
    expect(['c', 'x', 'v', 'd', 'a', 's'].map(mac)).toEqual(['copy', 'cut', 'paste', 'duplicate', 'select-all', 'save']);
  });

  it('falls back to the physical key on a non-Latin layout', () => {
    expect(resolveShortcut({ ...press('я', { ctrlKey: true }), code: 'KeyZ' }, false)).toEqual({ type: 'undo' });
  });

  it('plain keys: delete, escape, ? and arrows (Shift = large nudge)', () => {
    expect(resolveShortcut(press('Delete'), true)).toEqual({ type: 'delete' });
    expect(resolveShortcut(press('Backspace'), false)).toEqual({ type: 'delete' });
    expect(resolveShortcut(press('Escape'), true)).toEqual({ type: 'escape' });
    expect(resolveShortcut(press('?', { shiftKey: true }), true)).toEqual({ type: 'show-shortcuts' });
    expect(resolveShortcut(press('ArrowLeft'), true)).toEqual({ type: 'nudge', dx: -1, dy: 0, large: false });
    expect(resolveShortcut(press('ArrowDown', { shiftKey: true }), true)).toEqual({ type: 'nudge', dx: 0, dy: 1, large: true });
  });

  it('ignores keys that carry another modifier', () => {
    expect(resolveShortcut(press('ArrowLeft', { metaKey: true }), true)).toBeNull();
    expect(resolveShortcut(press('Delete', { altKey: true }), true)).toBeNull();
    expect(resolveShortcut(press('c', { metaKey: true, altKey: true }), true)).toBeNull();
    expect(resolveShortcut(press('c'), true)).toBeNull();
  });
});

describe('nudgeDistance', () => {
  it('is 1px, or 10px / one grid cell with Shift', () => {
    expect(nudgeDistance(false, { snapEnabled: true, gridSize: 40 })).toBe(1);
    expect(nudgeDistance(true, { snapEnabled: false, gridSize: 40 })).toBe(10);
    expect(nudgeDistance(true, { snapEnabled: true, gridSize: 20 })).toBe(20);
  });
});

describe('formatKeys / isMacPlatform', () => {
  it('prints glyphs on macOS and Ctrl+ elsewhere', () => {
    expect(formatKeys(['shift', 'mod', 'Z'], true)).toBe('⇧⌘Z');
    expect(formatKeys(['mod', 'shift', 'Z'], true)).toBe('⇧⌘Z');
    expect(formatKeys(['shift', 'mod', 'Z'], false)).toBe('Ctrl+Shift+Z');
    expect(formatKeys(['mod', 'S'], false)).toBe('Ctrl+S');
  });

  it('detects macOS from userAgentData, platform or the user agent', () => {
    expect(isMacPlatform({ userAgentData: { platform: 'macOS' } })).toBe(true);
    expect(isMacPlatform({ platform: 'MacIntel' })).toBe(true);
    expect(isMacPlatform({ platform: 'Win32' })).toBe(false);
    expect(isMacPlatform({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' })).toBe(false);
    expect(isMacPlatform(undefined)).toBe(false);
  });
});
