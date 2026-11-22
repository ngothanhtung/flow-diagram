// The Lesson tree: how one user organises their Lessons — nested Lesson
// folders, each Lesson in at most one folder (none = Unfiled). Pure data,
// no Firebase, no React; `lib/firebase/lesson-tree.ts` stores it and the
// `/lessons` panel and the Course sidebar render it. Every edit returns a
// new tree and never mutates its input.
//
// Stored as one document per user, `users/{uid}/lesson-trees/main`, whose
// `lessons` map is an index of *every* Lesson the user owns (title and
// Public flag copied in), so the public copy and the sidebar never have to
// read the Lessons themselves. See spec 2026-11-22-lesson-tree-design.md.

export const FOLDER_COLORS = ['sand', 'green', 'violet', 'orange', 'blue', 'teal', 'rose', 'olive', 'slate'] as const;
export type FolderColor = (typeof FOLDER_COLORS)[number];

/** The folder palette of system-design-tutorials: body fill and outline. */
export const FOLDER_PAINT: Record<FolderColor, { fill: string; stroke: string }> = {
  sand: { fill: '#d5b07a', stroke: '#a4824e' },
  green: { fill: '#3fa456', stroke: '#2a7a3d' },
  violet: { fill: '#7c63d0', stroke: '#5a43a6' },
  orange: { fill: '#e8834d', stroke: '#b8602f' },
  blue: { fill: '#2f86ce', stroke: '#1f63a0' },
  teal: { fill: '#2a9d8f', stroke: '#1d7066' },
  rose: { fill: '#d9577a', stroke: '#a83a58' },
  olive: { fill: '#8c9a3c', stroke: '#626d26' },
  slate: { fill: '#64728a', stroke: '#434e61' },
};

export const DEFAULT_FOLDER_COLOR: FolderColor = 'slate';
export const UNTITLED_FOLDER = 'Untitled folder';
export const FOLDER_NAME_MAX = 80;

export interface LessonFolder {
  parentId: string | null;
  name: string;
  color: FolderColor;
  order: number;
}

export interface LessonEntry {
  folderId: string | null;
  order: number;
  title: string;
  public: boolean;
}

export interface LessonTree {
  format: 'x-flow-lesson-tree';
  version: 1;
  folders: Record<string, LessonFolder>;
  lessons: Record<string, LessonEntry>;
}

export interface PublicLessonTree {
  ownerUid: string;
  folders: ({ id: string } & LessonFolder)[];
  lessons: { id: string; folderId: string | null; order: number; title: string }[];
}

export type TreeEdit = { ok: true; tree: LessonTree } | { ok: false; reason: string };

const RESERVED_IDS = new Set(['__proto__', 'constructor', 'prototype']);

export function emptyLessonTree(): LessonTree {
  return { format: 'x-flow-lesson-tree', version: 1, folders: {}, lessons: {} };
}

export function newFolderId(): string {
  return `f-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasFolder = (tree: LessonTree, id: string | null) => id !== null && Object.hasOwn(tree.folders, id);
const hasLesson = (tree: LessonTree, id: string) => Object.hasOwn(tree.lessons, id);
const byOrder = <T extends { id: string; order: number }>(a: T, b: T) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const fail = (reason: string): TreeEdit => ({ ok: false, reason });
const done = (tree: LessonTree): TreeEdit => ({ ok: true, tree });

export function cleanFolderName(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, FOLDER_NAME_MAX) : UNTITLED_FOLDER;
}

const isFolderColor = (value: unknown): value is FolderColor => typeof value === 'string' && (FOLDER_COLORS as readonly string[]).includes(value);

// ---- Queries ------------------------------------------------------------

export function childFolders(tree: LessonTree, parentId: string | null): ({ id: string } & LessonFolder)[] {
  return Object.entries(tree.folders)
    .filter(([, folder]) => folder.parentId === parentId)
    .map(([id, folder]) => ({ id, ...folder }))
    .sort(byOrder);
}

export function folderLessons(tree: LessonTree, folderId: string | null): ({ id: string } & LessonEntry)[] {
  return Object.entries(tree.lessons)
    .filter(([, entry]) => entry.folderId === folderId)
    .map(([id, entry]) => ({ id, ...entry }))
    .sort(byOrder);
}

export function descendantFolderIds(tree: LessonTree, id: string): Set<string> {
  const found = new Set<string>();
  let frontier = [id];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const [childId, folder] of Object.entries(tree.folders)) {
      if (folder.parentId !== null && frontier.includes(folder.parentId) && !found.has(childId) && childId !== id) {
        found.add(childId);
        next.push(childId);
      }
    }
    frontier = next;
  }
  return found;
}

export function lessonCountInSubtree(tree: LessonTree, id: string): number {
  const inside = descendantFolderIds(tree, id).add(id);
  return Object.values(tree.lessons).filter((entry) => entry.folderId !== null && inside.has(entry.folderId)).length;
}

/** "01.", "02." … by position among the folder's siblings. */
export function folderNumber(tree: LessonTree, id: string): string {
  if (!hasFolder(tree, id)) return '';
  const index = childFolders(tree, tree.folders[id].parentId).findIndex((folder) => folder.id === id);
  return `${String(index + 1).padStart(2, '0')}.`;
}

/** Lesson ids in reading order: depth-first, subfolders before a folder's own lessons. Unfiled Lessons are not part of the course. */
export function readingOrder(tree: LessonTree): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (folderId: string) => {
    if (seen.has(folderId)) return;
    seen.add(folderId);
    for (const child of childFolders(tree, folderId)) visit(child.id);
    for (const lesson of folderLessons(tree, folderId)) order.push(lesson.id);
  };
  for (const root of childFolders(tree, null)) visit(root.id);
  return order;
}

/** The folders leading to a Lesson, root first; [] when it is unfiled or unknown. */
export function pathTo(tree: LessonTree, lessonId: string): string[] {
  if (!hasLesson(tree, lessonId)) return [];
  const path: string[] = [];
  const seen = new Set<string>();
  for (let id = tree.lessons[lessonId].folderId; id !== null && hasFolder(tree, id) && !seen.has(id); id = tree.folders[id].parentId) {
    seen.add(id);
    path.unshift(id);
  }
  return path;
}

// ---- Folder edits -------------------------------------------------------

function withFolders(tree: LessonTree, folders: Record<string, LessonFolder>): LessonTree {
  return { ...tree, folders };
}

function lastOrder(items: { order: number }[]): number {
  return items.length === 0 ? 0 : Math.max(...items.map((item) => item.order)) + 1;
}

export function addFolder(tree: LessonTree, input: { id?: string; parentId: string | null; name: string; color?: FolderColor }): TreeEdit {
  const id = input.id ?? newFolderId();
  if (RESERVED_IDS.has(id) || hasFolder(tree, id)) return fail('That folder id is taken.');
  if (input.parentId !== null && !hasFolder(tree, input.parentId)) return fail('The parent folder no longer exists.');
  const folder: LessonFolder = {
    parentId: input.parentId,
    name: cleanFolderName(input.name),
    color: input.color && isFolderColor(input.color) ? input.color : DEFAULT_FOLDER_COLOR,
    order: lastOrder(childFolders(tree, input.parentId)),
  };
  return done(withFolders(tree, { ...tree.folders, [id]: folder }));
}

function patchFolder(tree: LessonTree, id: string, patch: Partial<LessonFolder>): TreeEdit {
  if (!hasFolder(tree, id)) return fail('That folder no longer exists.');
  return done(withFolders(tree, { ...tree.folders, [id]: { ...tree.folders[id], ...patch } }));
}

export function renameFolder(tree: LessonTree, id: string, name: string): TreeEdit {
  return patchFolder(tree, id, { name: cleanFolderName(name) });
}

export function recolorFolder(tree: LessonTree, id: string, color: FolderColor): TreeEdit {
  if (!isFolderColor(color)) return fail('Unknown folder colour.');
  return patchFolder(tree, id, { color });
}

export function moveFolder(tree: LessonTree, id: string, parentId: string | null): TreeEdit {
  if (!hasFolder(tree, id)) return fail('That folder no longer exists.');
  if (parentId !== null && !hasFolder(tree, parentId)) return fail('The target folder no longer exists.');
  if (parentId === id || (parentId !== null && descendantFolderIds(tree, id).has(parentId))) return fail('A folder cannot move into itself or one of its subfolders.');
  if (tree.folders[id].parentId === parentId) return done(tree);
  const siblings = childFolders(tree, parentId).filter((folder) => folder.id !== id);
  return patchFolder(tree, id, { parentId, order: lastOrder(siblings) });
}

/** Moves one place up (-1) or down (+1) among siblings; at an end it is a no-op. Renumbers the group 0..n-1. */
function reorderGroup<T extends { id: string; order: number }>(group: T[], id: string, delta: -1 | 1): Map<string, number> | null {
  const index = group.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const target = index + delta;
  const ids = group.map((item) => item.id);
  if (target >= 0 && target < ids.length) [ids[index], ids[target]] = [ids[target], ids[index]];
  return new Map(ids.map((itemId, position) => [itemId, position]));
}

export function reorderFolder(tree: LessonTree, id: string, delta: -1 | 1): TreeEdit {
  if (!hasFolder(tree, id)) return fail('That folder no longer exists.');
  const orders = reorderGroup(childFolders(tree, tree.folders[id].parentId), id, delta);
  if (!orders) return done(tree);
  const folders = { ...tree.folders };
  for (const [folderId, order] of orders) folders[folderId] = { ...folders[folderId], order };
  return done(withFolders(tree, folders));
}

export function deleteFolder(tree: LessonTree, id: string): TreeEdit {
  if (!hasFolder(tree, id)) return fail('That folder no longer exists.');
  const count = lessonCountInSubtree(tree, id);
  if (count > 0) return fail(`This folder still holds ${count} lesson${count === 1 ? '' : 's'}. Move or delete them first.`);
  const gone = descendantFolderIds(tree, id).add(id);
  return done(withFolders(tree, Object.fromEntries(Object.entries(tree.folders).filter(([folderId]) => !gone.has(folderId)))));
}

// ---- Lesson edits -------------------------------------------------------

export function moveLesson(tree: LessonTree, lessonId: string, folderId: string | null): TreeEdit {
  if (!hasLesson(tree, lessonId)) return fail('That lesson is not in the tree.');
  if (folderId !== null && !hasFolder(tree, folderId)) return fail('The target folder no longer exists.');
  if (tree.lessons[lessonId].folderId === folderId) return done(tree);
  const order = lastOrder(folderLessons(tree, folderId));
  return done({ ...tree, lessons: { ...tree.lessons, [lessonId]: { ...tree.lessons[lessonId], folderId, order } } });
}

export function reorderLesson(tree: LessonTree, lessonId: string, delta: -1 | 1): TreeEdit {
  if (!hasLesson(tree, lessonId)) return fail('That lesson is not in the tree.');
  const orders = reorderGroup(folderLessons(tree, tree.lessons[lessonId].folderId), lessonId, delta);
  if (!orders) return done(tree);
  const lessons = { ...tree.lessons };
  for (const [id, order] of orders) lessons[id] = { ...lessons[id], order };
  return done({ ...tree, lessons });
}

/** Adds a Lesson to the index (unfiled and last unless told otherwise) or patches its entry. */
export function upsertLessonEntry(tree: LessonTree, lessonId: string, patch: Partial<LessonEntry>): LessonTree {
  if (RESERVED_IDS.has(lessonId)) return tree;
  if (hasLesson(tree, lessonId)) return { ...tree, lessons: { ...tree.lessons, [lessonId]: { ...tree.lessons[lessonId], ...patch } } };
  const folderId = patch.folderId !== undefined && hasFolder(tree, patch.folderId) ? patch.folderId : null;
  const entry: LessonEntry = {
    folderId,
    order: patch.order ?? lastOrder(folderLessons(tree, folderId)),
    title: patch.title ?? '',
    public: patch.public ?? false,
  };
  return { ...tree, lessons: { ...tree.lessons, [lessonId]: entry } };
}

export function removeLessonEntry(tree: LessonTree, lessonId: string): LessonTree {
  if (!hasLesson(tree, lessonId)) return tree;
  const lessons = { ...tree.lessons };
  delete lessons[lessonId];
  return { ...tree, lessons };
}

/**
 * Brings the index in line with the Lessons that actually exist: a missing
 * Lesson is added as Unfiled, a deleted one dropped, titles and Public
 * flags refreshed. The safety net for every write made outside the app.
 */
export function reconcileLessonTree(tree: LessonTree, lessons: { id: string; title: string; public: boolean }[]): { tree: LessonTree; changed: boolean } {
  let next = tree;
  let changed = false;
  const existing = new Set<string>();
  for (const lesson of lessons) {
    existing.add(lesson.id);
    const entry = hasLesson(next, lesson.id) ? next.lessons[lesson.id] : null;
    if (!entry) {
      next = upsertLessonEntry(next, lesson.id, { title: lesson.title, public: lesson.public });
      changed = true;
    } else if (entry.title !== lesson.title || entry.public !== lesson.public) {
      next = upsertLessonEntry(next, lesson.id, { title: lesson.title, public: lesson.public });
      changed = true;
    }
  }
  for (const id of Object.keys(next.lessons)) {
    if (!existing.has(id)) {
      next = removeLessonEntry(next, id);
      changed = true;
    }
  }
  return { tree: next, changed };
}

// ---- Public copy ----------------------------------------------------------

/** Only Public Lessons in a folder, and only the folders leading to them: never a private title or a private-only folder name. */
export function publicTreeOf(tree: LessonTree, ownerUid: string): PublicLessonTree {
  const lessons = Object.entries(tree.lessons)
    .filter(([, entry]) => entry.public && entry.folderId !== null && hasFolder(tree, entry.folderId))
    .map(([id, entry]) => ({ id, folderId: entry.folderId, order: entry.order, title: entry.title }))
    .sort(byOrder);
  const keep = new Set<string>();
  for (const lesson of lessons) {
    for (let id: string | null = lesson.folderId; id !== null && hasFolder(tree, id) && !keep.has(id); id = tree.folders[id].parentId) keep.add(id);
  }
  const folders = Object.entries(tree.folders)
    .filter(([id]) => keep.has(id))
    .map(([id, folder]) => ({ id, ...folder }))
    .sort(byOrder);
  return { ownerUid, folders, lessons };
}

/** A public copy read back as a (normalised) tree; every entry is Public. */
export function treeFromPublic(pub: unknown): LessonTree {
  const source = isRecord(pub) ? pub : {};
  const folders = Array.isArray(source.folders) ? source.folders : [];
  const lessons = Array.isArray(source.lessons) ? source.lessons : [];
  const raw = {
    folders: Object.fromEntries(folders.filter(isRecord).filter((folder) => typeof folder.id === 'string').map((folder) => [folder.id as string, folder])),
    lessons: Object.fromEntries(lessons.filter(isRecord).filter((lesson) => typeof lesson.id === 'string').map((lesson) => [lesson.id as string, { ...lesson, public: true }])),
  };
  return normalizeLessonTree(raw).tree;
}

// ---- Normalizer -----------------------------------------------------------

/** The gate every stored tree passes: never throws, repairs what it can and lists what it fixed. */
export function normalizeLessonTree(input: unknown): { tree: LessonTree; fixes: string[] } {
  const fixes: string[] = [];
  if (!isRecord(input)) return { tree: emptyLessonTree(), fixes: input === undefined || input === null ? [] : ['Not a lesson tree: started an empty one.'] };

  const rawFolders = isRecord(input.folders) ? input.folders : {};
  if (input.folders !== undefined && !isRecord(input.folders)) fixes.push('folders was not a map.');
  const folders: Record<string, LessonFolder> = {};
  for (const [id, value] of Object.entries(rawFolders)) {
    if (RESERVED_IDS.has(id) || !isRecord(value)) {
      fixes.push(`Dropped folder "${id}".`);
      continue;
    }
    const name = typeof value.name === 'string' ? cleanFolderName(value.name) : UNTITLED_FOLDER;
    if (name !== value.name) fixes.push(`Folder "${id}": name repaired.`);
    const color = isFolderColor(value.color) ? value.color : DEFAULT_FOLDER_COLOR;
    if (color !== value.color) fixes.push(`Folder "${id}": unknown colour, using ${DEFAULT_FOLDER_COLOR}.`);
    const order = typeof value.order === 'number' && Number.isFinite(value.order) ? value.order : 0;
    if (order !== value.order) fixes.push(`Folder "${id}": order reset.`);
    const parentId = typeof value.parentId === 'string' ? value.parentId : null;
    if (parentId === null && value.parentId !== null) fixes.push(`Folder "${id}": parent cleared.`);
    folders[id] = { parentId, name, color, order };
  }
  for (const [id, folder] of Object.entries(folders)) {
    if (folder.parentId !== null && (!Object.hasOwn(folders, folder.parentId) || folder.parentId === id)) {
      fixes.push(`Folder "${id}": parent missing, moved to the top level.`);
      folders[id] = { ...folder, parentId: null };
    }
  }
  // Break cycles: a folder that reaches itself walking up goes to the top level.
  for (const id of Object.keys(folders).sort()) {
    const seen = new Set<string>([id]);
    for (let cur = folders[id].parentId; cur !== null; cur = folders[cur].parentId) {
      if (seen.has(cur)) {
        if (cur === id) {
          fixes.push(`Folder "${id}": parent loop broken.`);
          folders[id] = { ...folders[id], parentId: null };
        }
        break;
      }
      seen.add(cur);
    }
  }

  const rawLessons = isRecord(input.lessons) ? input.lessons : {};
  if (input.lessons !== undefined && !isRecord(input.lessons)) fixes.push('lessons was not a map.');
  const lessons: Record<string, LessonEntry> = {};
  for (const [id, value] of Object.entries(rawLessons)) {
    if (RESERVED_IDS.has(id) || !isRecord(value)) {
      fixes.push(`Dropped lesson entry "${id}".`);
      continue;
    }
    const folderId = typeof value.folderId === 'string' && Object.hasOwn(folders, value.folderId) ? value.folderId : null;
    if (folderId !== value.folderId) fixes.push(`Lesson "${id}": folder missing, now Unfiled.`);
    const order = typeof value.order === 'number' && Number.isFinite(value.order) ? value.order : 0;
    if (order !== value.order) fixes.push(`Lesson "${id}": order reset.`);
    const title = typeof value.title === 'string' ? value.title : '';
    if (title !== value.title) fixes.push(`Lesson "${id}": title reset.`);
    const isPublic = value.public === true;
    if (typeof value.public !== 'boolean') fixes.push(`Lesson "${id}": Public flag reset.`);
    lessons[id] = { folderId, order, title, public: isPublic };
  }

  return { tree: { format: 'x-flow-lesson-tree', version: 1, folders, lessons }, fixes };
}
