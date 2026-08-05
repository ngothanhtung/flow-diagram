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
  /** Canonical export names, deduped and sorted — e.g. `Workflow`, `IconSettings`. */
  names: string[];
  components: Record<string, IconLibraryComponent>;
}

function dedupe(
  mod: Record<string, unknown>,
  include: (key: string) => boolean,
): IconLibrarySnapshot {
  const seen = new Map<unknown, string>();
  for (const key of Object.keys(mod)) {
    if (!include(key)) continue;
    const value = mod[key];
    if (typeof value !== 'function' && typeof value !== 'object') continue;
    if (!seen.has(value)) seen.set(value, key);
  }
  const names = [...seen.values()].sort((a, b) => a.localeCompare(b));
  const components: Record<string, IconLibraryComponent> = {};
  for (const [value, key] of seen) components[key] = value as IconLibraryComponent;
  return { names, components };
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
      ? import('lucide-react').then((mod) =>
          dedupe(mod as unknown as Record<string, unknown>, (key) => /^[A-Z]/.test(key) && key !== 'LucideIcon' && key !== 'Icon'),
        )
      : import('@tabler/icons-react').then((mod) =>
          dedupe(mod as unknown as Record<string, unknown>, (key) => key.startsWith('Icon') && key !== 'IconContext'),
        )
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

/** Splits a stored `NodeIcon` into its library + export name. Bare legacy
 *  names (e.g. `cog`) are plain Lucide icons with no prefix. */
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
  const legacy = icon ? LEGACY_ICONS[icon] : undefined;
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
  if (!parsed) return null;
  return snapshot?.components[parsed.name] ?? null;
}
