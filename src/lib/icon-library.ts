// On-demand access to the full Lucide / Tabler icon catalogs (thousands of
// icons each). Importing either package's barrel eagerly would bloat every
// page's bundle, so each library is fetched as its own chunk the first time
// it's actually needed (icon picker opened, or a document references an
// icon outside the small curated set in `@/lib/node-style`) and cached for
// the rest of the session.

import { useEffect, useSyncExternalStore, type ComponentType } from 'react';
import type { NodeIcon } from './flowchart-types';
import { LEGACY_ICONS } from './node-style';

export type IconLibraryId = 'lucide' | 'tabler';

export type IconLibraryComponent = ComponentType<{
  size?: number | string;
  className?: string;
  strokeWidth?: number;
}>;

export interface IconLibrarySnapshot {
  /** Canonical names, one per icon, sorted — e.g. `Network`, `IconSettings`.
   *  What the picker lists, and so what it stores for a new pick. */
  names: string[];
  /** Canonical name → component. */
  components: Record<string, IconLibraryComponent>;
  /** Every export name the library ships for an icon (`Network`,
   *  `NetworkIcon`, `LucideNetwork`, a renamed icon's old name…) → its
   *  canonical name. */
  aliases: Map<string, string>;
  /** `iconLookupKey` of every canonical name and alias → canonical name,
   *  so hand-written spellings (`network`, `git-branch`) resolve too. */
  keys: Map<string, string>;
}

/**
 * The spelling-insensitive key an icon name is looked up by: lower case,
 * separators dropped, and the library's own decoration stripped (Lucide's
 * `Lucide…` / `…Icon` aliases, Tabler's `Icon…` prefix). `Network`,
 * `LucideNetwork`, `NetworkIcon` and `network` share one key; so do
 * `IconWorld`, `world` and `icon-world`. No two icons of either library
 * collide under it — `icon-library.test.ts` pins that.
 */
export function iconLookupKey(library: IconLibraryId, name: string): string {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (library === 'tabler') return key.replace(/^icon/, '');
  return key.replace(/^lucide/, '').replace(/icon$/, '');
}

function isComponentValue(value: unknown): boolean {
  return (typeof value === 'function' || typeof value === 'object') && value !== null;
}

/**
 * Indexes a library module. Each icon is exported under several names —
 * Lucide ships `Network`, `NetworkIcon` and `LucideNetwork` for one
 * component, plus the old name of every renamed icon (`Home` for `House`);
 * Tabler keeps renamed icons' old names (`Icon123` for `IconNumber123`).
 *
 * The canonical name is the one in the module's own `icons` map — the
 * current name, spelled as lucide.dev / tabler.io spell it. Keeping the
 * alphabetically-first export instead, which this used to do, made
 * `LucideNetwork` canonical for every Lucide icon after "L", so a
 * hand-written `lucide:Network` resolved to nothing while the picker
 * stored `lucide:LucideNetwork`. Both still resolve, through `aliases`.
 */
export function buildIconSnapshot(mod: Record<string, unknown>, library: IconLibraryId): IconLibrarySnapshot {
  const isIconExport =
    library === 'lucide'
      ? (key: string) => /^[A-Z]/.test(key) && key !== 'LucideIcon' && key !== 'Icon' && key !== 'LucideProvider'
      : (key: string) => key.startsWith('Icon') && key !== 'IconContext';
  const canonicalOf = new Map<unknown, string>();
  const catalog = mod.icons;
  if (typeof catalog === 'object' && catalog !== null) {
    for (const [name, value] of Object.entries(catalog as Record<string, unknown>)) {
      if (isComponentValue(value) && !canonicalOf.has(value)) canonicalOf.set(value, name);
    }
  }
  if (canonicalOf.size === 0) {
    // No `icons` map to read: fall back to the plainest export name — no
    // `Lucide` prefix, no `Icon` suffix — then alphabetical.
    const decorated = (key: string) => (library === 'lucide' && (key.startsWith('Lucide') || key.endsWith('Icon')) ? 1 : 0);
    const exportNames = Object.keys(mod)
      .filter(isIconExport)
      .sort((a, b) => decorated(a) - decorated(b) || a.localeCompare(b));
    for (const key of exportNames) {
      const value = mod[key];
      if (isComponentValue(value) && !canonicalOf.has(value)) canonicalOf.set(value, key);
    }
  }

  const components: Record<string, IconLibraryComponent> = {};
  const aliases = new Map<string, string>();
  const keys = new Map<string, string>();
  for (const [value, name] of canonicalOf) {
    components[name] = value as IconLibraryComponent;
    aliases.set(name, name);
    keys.set(iconLookupKey(library, name), name);
  }
  for (const key of Object.keys(mod)) {
    if (!isIconExport(key)) continue;
    const name = canonicalOf.get(mod[key]);
    if (!name) continue;
    if (!aliases.has(key)) aliases.set(key, name);
    // Canonical names went in first, so an alias never displaces one.
    const lookup = iconLookupKey(library, key);
    if (!keys.has(lookup)) keys.set(lookup, name);
  }
  const names = Object.keys(components).sort((a, b) => a.localeCompare(b));
  return { names, components, aliases, keys };
}

/** The canonical name `name` refers to, or null. An exact export name
 *  (any alias) wins; otherwise the spelling-insensitive `iconLookupKey`. */
export function resolveIconName(snapshot: IconLibrarySnapshot, library: IconLibraryId, name: string): string | null {
  return snapshot.aliases.get(name) ?? snapshot.keys.get(iconLookupKey(library, name)) ?? null;
}

const cache: Record<IconLibraryId, IconLibrarySnapshot | null> = {
  lucide: null,
  tabler: null,
};
const pending: Record<IconLibraryId, Promise<IconLibrarySnapshot> | null> = {
  lucide: null,
  tabler: null,
};
const listeners: Record<IconLibraryId, Set<() => void>> = {
  lucide: new Set(),
  tabler: new Set(),
};

function notify(id: IconLibraryId) {
  for (const listener of listeners[id]) listener();
}

export function loadIconLibrary(id: IconLibraryId): Promise<IconLibrarySnapshot> {
  const cached = cache[id];
  if (cached) return Promise.resolve(cached);
  const inflight = pending[id];
  if (inflight) return inflight;

  const promise = (
    id === 'lucide'
      ? import('lucide-react').then((mod) => buildIconSnapshot(mod as unknown as Record<string, unknown>, 'lucide'))
      : import('@tabler/icons-react').then((mod) => buildIconSnapshot(mod as unknown as Record<string, unknown>, 'tabler'))
  ).then((snapshot) => {
    cache[id] = snapshot;
    pending[id] = null;
    notify(id);
    return snapshot;
  });

  pending[id] = promise;
  return promise;
}

export function getIconLibrarySnapshot(id: IconLibraryId): IconLibrarySnapshot | null {
  return cache[id];
}

export function subscribeIconLibrary(id: IconLibraryId, callback: () => void): () => void {
  listeners[id].add(callback);
  return () => listeners[id].delete(callback);
}

/** Splits a stored `NodeIcon` into its library + icon name. Bare names
 *  (the legacy `cog`, or a hand-written `server`) are Lucide icons. */
export function parseNodeIcon(icon: NodeIcon): { library: IconLibraryId; name: string } {
  if (icon.startsWith('lucide:')) return { library: 'lucide', name: icon.slice('lucide:'.length) };
  if (icon.startsWith('tabler:')) return { library: 'tabler', name: icon.slice('tabler:'.length) };
  return { library: 'lucide', name: icon };
}

/**
 * Resolves a `NodeIcon` to a component. Icons in the small curated set
 * resolve synchronously with no network fetch; anything else triggers a
 * background load of that icon's full library (cached after) and the
 * component pops in once available.
 */
export function useResolvedIcon(icon: NodeIcon | null): IconLibraryComponent | null {
  const legacy = icon && Object.hasOwn(LEGACY_ICONS, icon) ? LEGACY_ICONS[icon] : undefined;
  const parsed = !legacy && icon ? parseNodeIcon(icon) : null;
  const library = parsed?.library ?? null;

  const snapshot = useSyncExternalStore(
    (callback) => (library ? subscribeIconLibrary(library, callback) : () => {}),
    () => (library ? getIconLibrarySnapshot(library) : null),
    () => null,
  );

  useEffect(() => {
    if (library) void loadIconLibrary(library);
  }, [library]);

  if (!icon) return null;
  if (legacy) return legacy;
  if (!parsed || !snapshot) return null;
  const name = resolveIconName(snapshot, parsed.library, parsed.name);
  return name ? snapshot.components[name] : null;
}

/**
 * `icon` spelled the way the picker stores a pick (`lucide:LucideNetwork`
 * → `lucide:Network`), or the value unchanged when it belongs to another
 * library than `snapshot`, the snapshot isn't loaded yet, or it names
 * nothing. Lets the picker highlight an icon a
 * document stored under an alias.
 */
export function canonicalNodeIcon(icon: NodeIcon, snapshotLibrary: IconLibraryId, snapshot: IconLibrarySnapshot | null): NodeIcon {
  if (!snapshot || icon.startsWith('logo:')) return icon;
  const { library, name } = parseNodeIcon(icon);
  if (library !== snapshotLibrary) return icon;
  const canonical = resolveIconName(snapshot, library, name);
  return canonical ? (`${library}:${canonical}` as NodeIcon) : icon;
}
