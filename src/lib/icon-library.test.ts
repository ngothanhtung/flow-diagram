import * as lucide from 'lucide-react';
import * as tabler from '@tabler/icons-react';
import { describe, expect, it } from 'vitest';
import { buildIconSnapshot, canonicalNodeIcon, iconLookupKey, parseNodeIcon, resolveIconName, type IconLibraryId } from '@/lib/icon-library';

const lucideSnapshot = buildIconSnapshot(lucide as unknown as Record<string, unknown>, 'lucide');
const tablerSnapshot = buildIconSnapshot(tabler as unknown as Record<string, unknown>, 'tabler');

function resolves(library: IconLibraryId, name: string) {
  return resolveIconName(library === 'lucide' ? lucideSnapshot : tablerSnapshot, library, name);
}

describe('iconLookupKey', () => {
  it('ignores case, separators and library decoration', () => {
    for (const spelling of ['Network', 'network', 'NetworkIcon', 'LucideNetwork', 'lucide-network']) {
      expect(iconLookupKey('lucide', spelling)).toBe('network');
    }
    expect(iconLookupKey('lucide', 'git-branch')).toBe(iconLookupKey('lucide', 'GitBranch'));
    expect(iconLookupKey('lucide', 'arrow-down-0-1')).toBe(iconLookupKey('lucide', 'ArrowDown01'));
    for (const spelling of ['IconWorld', 'world', 'icon-world', 'World']) {
      expect(iconLookupKey('tabler', spelling)).toBe('world');
    }
  });
});

describe('buildIconSnapshot', () => {
  it('lists Lucide icons under their current, undecorated names', () => {
    expect(lucideSnapshot.names).toContain('Network');
    expect(lucideSnapshot.names).toContain('House');
    expect(lucideSnapshot.names).not.toContain('LucideNetwork');
    expect(lucideSnapshot.names).not.toContain('NetworkIcon');
    expect(lucideSnapshot.names).not.toContain('Home');
    // The context provider is not an icon.
    expect(lucideSnapshot.names).not.toContain('LucideProvider');
    expect(lucideSnapshot.components.Network).toBe(lucide.Network);
  });

  it('lists Tabler icons under their current names', () => {
    expect(tablerSnapshot.names).toContain('IconNumber123');
    expect(tablerSnapshot.names).not.toContain('Icon123');
    expect(tablerSnapshot.components.IconWorld).toBe(tabler.IconWorld);
  });

  it.each([
    ['lucide', lucideSnapshot],
    ['tabler', tablerSnapshot],
  ] as const)('gives every %s icon a lookup key no other icon shares', (library, snapshot) => {
    for (const name of snapshot.names) expect(snapshot.keys.get(iconLookupKey(library, name))).toBe(name);
  });

  it('falls back to the plainest export name when a module has no icons map', () => {
    const Glyph = () => null;
    const snapshot = buildIconSnapshot({ LucideGlyph: Glyph, Glyph, GlyphIcon: Glyph }, 'lucide');
    expect(snapshot.names).toEqual(['Glyph']);
    expect(resolveIconName(snapshot, 'lucide', 'LucideGlyph')).toBe('Glyph');
  });
});

describe('resolveIconName', () => {
  it.each(['Network', 'LucideNetwork', 'NetworkIcon', 'network'])('resolves lucide:%s to Network', (name) => {
    expect(resolves('lucide', name)).toBe('Network');
  });

  it.each([
    ['Database', 'Database'],
    ['Server', 'Server'],
    ['git-branch', 'GitBranch'],
    // Renamed icons keep resolving under their old name.
    ['Home', 'House'],
    ['CheckCircle2', 'CircleCheck'],
    // What the picker stored before picks were canonical.
    ['LucideWorkflow', 'Workflow'],
    ['LucideServer', 'Server'],
  ])('resolves lucide:%s to %s', (name, canonical) => {
    expect(resolves('lucide', name)).toBe(canonical);
  });

  it.each([
    ['IconWorld', 'IconWorld'],
    ['world', 'IconWorld'],
    ['player-play', 'IconPlayerPlay'],
    ['Icon123', 'IconNumber123'],
  ])('resolves tabler:%s to %s', (name, canonical) => {
    expect(resolves('tabler', name)).toBe(canonical);
  });

  it('returns null for a name no icon has, including prototype keys', () => {
    expect(resolves('lucide', 'DefinitelyNotAnIcon')).toBeNull();
    expect(resolves('lucide', 'constructor')).toBeNull();
    expect(resolves('tabler', '__proto__')).toBeNull();
  });
});

describe('parseNodeIcon / canonicalNodeIcon', () => {
  it('reads the library prefix, and treats a bare name as Lucide', () => {
    expect(parseNodeIcon('lucide:Network')).toEqual({ library: 'lucide', name: 'Network' });
    expect(parseNodeIcon('tabler:IconWorld')).toEqual({ library: 'tabler', name: 'IconWorld' });
    expect(parseNodeIcon('cog')).toEqual({ library: 'lucide', name: 'cog' });
  });

  it('rewrites an alias to the spelling the picker stores', () => {
    expect(canonicalNodeIcon('lucide:LucideNetwork', 'lucide', lucideSnapshot)).toBe('lucide:Network');
    expect(canonicalNodeIcon('tabler:Icon123', 'tabler', tablerSnapshot)).toBe('tabler:IconNumber123');
  });

  it('leaves another library, logos, unknown names and an unloaded library alone', () => {
    expect(canonicalNodeIcon('tabler:IconWorld', 'lucide', lucideSnapshot)).toBe('tabler:IconWorld');
    expect(canonicalNodeIcon('logo:github', 'lucide', lucideSnapshot)).toBe('logo:github');
    expect(canonicalNodeIcon('lucide:Nope', 'lucide', lucideSnapshot)).toBe('lucide:Nope');
    expect(canonicalNodeIcon('lucide:LucideNetwork', 'lucide', null)).toBe('lucide:LucideNetwork');
  });
});
