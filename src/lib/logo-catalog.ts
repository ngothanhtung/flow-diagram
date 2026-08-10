export type LogoType = 'icon' | 'wordmark';

export interface LogoCatalog {
  categories: Array<{ id: string; label: string; count: number }>;
  logos: Array<{ id: string; name: string; categories: string[]; type: LogoType }>;
}

let cachedCatalog: LogoCatalog | null = null;
let pendingCatalog: Promise<LogoCatalog> | null = null;

export function getCachedLogoCatalog(): LogoCatalog | null {
  return cachedCatalog;
}

export function loadLogoCatalog(): Promise<LogoCatalog> {
  if (cachedCatalog) return Promise.resolve(cachedCatalog);
  if (pendingCatalog) return pendingCatalog;

  pendingCatalog = fetch('/logos.json')
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load logo catalog: ${res.status}`);
      return res.json() as Promise<LogoCatalog>;
    })
    .then((data) => {
      cachedCatalog = data;
      pendingCatalog = null;
      return data;
    })
    .catch((err) => {
      pendingCatalog = null;
      throw err;
    });

  return pendingCatalog;
}
