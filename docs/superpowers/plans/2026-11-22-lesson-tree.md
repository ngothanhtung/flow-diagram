# Lesson tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each user organises their Lessons in a tree of Lesson folders on `/lessons`, and learners browse that tree in a Course sidebar on `/lessons/{id}/view`.

**Architecture:** One Firestore document per user (`users/{uid}/lesson-trees/main`) holds folders and an index of every Lesson; a filtered public copy (`public-lesson-trees/{uid}`) is written in the same transaction. All tree logic is a pure, Vitest-covered module; Firestore code only reads, applies a pure edit and writes. Existing lesson writes (create/save/public/delete) keep the index current in the same transaction, and `/lessons` reconciles on load.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4, shadcn/ui on Base UI, Firebase Auth + Firestore, Vitest, `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-11-22-lesson-tree-design.md`

## Global Constraints

- Tree doc path `users/{uid}/lesson-trees/main`; public copy `public-lesson-trees/{uid}` keyed by uid.
- `format: 'x-flow-lesson-tree'`, `version: 1`.
- Folder colours (fill / stroke): sand `#d5b07a`/`#a4824e`, green `#3fa456`/`#2a7a3d`, violet `#7c63d0`/`#5a43a6`, orange `#e8834d`/`#b8602f`, blue `#2f86ce`/`#1f63a0`, teal `#2a9d8f`/`#1d7066`, rose `#d9577a`/`#a83a58`, olive `#8c9a3c`/`#626d26`, slate `#64728a`/`#434e61`. Default `slate`.
- Folder name 1–80 chars after trim; blank → "Untitled folder". Number label two digits + dot: "01.".
- Inside a folder: subfolders first, then lessons, each by `order`.
- A folder whose subtree holds ≥ 1 lesson can never be deleted. Deleting an empty subtree removes all its folders.
- Public copy contains only `public: true` lessons and only folders with ≥ 1 public lesson in their subtree (plus ancestors). Never a private title or a private-only folder name.
- Reserved ids `__proto__`, `constructor`, `prototype` are dropped by the normalizer.
- Done marks: `localStorage` key `xflow:lessons-done` (JSON array of lesson ids). Open branches on `/lessons`: `xflow:lesson-tree-open:{uid}`.
- Product copy in English; "Lesson", "Lesson step" (never bare "Step"), "Lesson folder", "Unfiled", "All lessons", "Next lesson".
- Admin seed tree: roots "System Design (EN)" / "System Design (VI)" with fixed ids `tutorial-en` / `tutorial-vi`; chapter folder ids `tutorial-en-<chapterId>` / `tutorial-vi-<chapterId>`; VI chapter names from tutorials `i18n/vi.json`.
- Manual testing on emulators only; production is written only for the rules deploy and the admin tree seed (uid `U2Pq3dKmBMQDyHLhy60B2GllxOv1`). No password in repo files.
- Next.js 16: read `node_modules/next/dist/docs/` before touching routing APIs.

## Review Focus

1. A folder whose lessons live only in a grandchild folder → Delete refused (tested in Task 1).
2. Moving a folder into its own descendant → refused, tree unchanged (Task 1).
3. A corrupted/foreign tree doc (cycles, dangling parent, unknown colour, `__proto__` keys) → normalised, never a crash in panel or sidebar (Task 1).
4. Private lesson inside a folder that also holds a public one → public copy lists the folder and the public lesson only (Task 1).
5. Tree read fails or owner has no tree → viewer renders exactly as before, no sidebar (Task 6, manual + guarded code path).

---

### Task 1: Pure tree module

**Files:**
- Create: `src/lib/lesson/lesson-tree.ts`
- Test: `src/lib/lesson/lesson-tree.test.ts`

**Interfaces — Produces:**
```ts
export const FOLDER_COLORS: readonly FolderColor[]; // order as in Global Constraints
export type FolderColor = 'sand'|'green'|'violet'|'orange'|'blue'|'teal'|'rose'|'olive'|'slate';
export const FOLDER_PAINT: Record<FolderColor, { fill: string; stroke: string }>;
export interface LessonFolder { parentId: string | null; name: string; color: FolderColor; order: number }
export interface LessonEntry { folderId: string | null; order: number; title: string; public: boolean }
export interface LessonTree { format: 'x-flow-lesson-tree'; version: 1; folders: Record<string, LessonFolder>; lessons: Record<string, LessonEntry> }
export interface PublicLessonTree { ownerUid: string; folders: ({ id: string } & LessonFolder)[]; lessons: ({ id: string; folderId: string | null; order: number; title: string })[] }
export type TreeEdit = { ok: true; tree: LessonTree } | { ok: false; reason: string };
export function emptyLessonTree(): LessonTree;
export function normalizeLessonTree(input: unknown): { tree: LessonTree; fixes: string[] };
export function newFolderId(): string;
export function addFolder(tree, input: { id?: string; parentId: string | null; name: string; color?: FolderColor }): TreeEdit; // appended last among siblings
export function renameFolder(tree, id: string, name: string): TreeEdit;
export function recolorFolder(tree, id: string, color: FolderColor): TreeEdit;
export function moveFolder(tree, id: string, parentId: string | null): TreeEdit; // refuse self/descendant; appended last
export function reorderFolder(tree, id: string, delta: -1 | 1): TreeEdit;
export function deleteFolder(tree, id: string): TreeEdit; // refuse when lessonCountInSubtree > 0
export function moveLesson(tree, lessonId: string, folderId: string | null): TreeEdit;
export function reorderLesson(tree, lessonId: string, delta: -1 | 1): TreeEdit;
export function upsertLessonEntry(tree, lessonId: string, patch: Partial<LessonEntry>): LessonTree; // new entry: folderId null unless given, last
export function removeLessonEntry(tree, lessonId: string): LessonTree;
export function childFolders(tree, parentId: string | null): ({ id: string } & LessonFolder)[]; // sorted
export function folderLessons(tree, folderId: string | null): ({ id: string } & LessonEntry)[]; // sorted
export function descendantFolderIds(tree, id: string): Set<string>;
export function lessonCountInSubtree(tree, id: string): number;
export function folderNumber(tree, id: string): string; // "01."
export function readingOrder(tree): string[]; // depth-first, subfolders before lessons, root lessons (folderId null) excluded
export function pathTo(tree, lessonId: string): string[]; // folder ids root→leaf, [] when unfiled/unknown
export function reconcileLessonTree(tree, lessons: { id: string; title: string; public: boolean }[]): { tree: LessonTree; changed: boolean };
export function publicTreeOf(tree, ownerUid: string): PublicLessonTree;
export function treeFromPublic(pub: unknown): LessonTree; // normalised; all entries public: true
```

- [ ] **Step 1: Write failing tests** covering: `addFolder` appends with increasing order and default colour `slate`; `renameFolder` trims, blank → "Untitled folder", > 80 chars truncated to 80; `moveFolder(tree, a, child-of-a)` → `{ ok: false }`; `deleteFolder` refused when a lesson sits in a grandchild (`reason` mentions the count), allowed on an empty subtree and removes every descendant folder; `reorderFolder` swaps with neighbour and is a no-op `ok` at the ends; `moveLesson` to a missing folder → `{ ok: false }`; `folderNumber` → `'01.'`, `'02.'` by sibling order; `readingOrder` on `{A{A1{l1}, l2}, B{l3}}` = `['l1','l2','l3']`; `pathTo('l1')` = `['A','A1']`; `reconcileLessonTree` adds a missing lesson as unfiled, drops a deleted one, updates title/public, `changed:false` when identical; `publicTreeOf` on folder F{public p, private q} + folder G{private r} → folders `[F]`, lessons `[p]`; `normalizeLessonTree` on `{folders:{a:{parentId:'b'},b:{parentId:'a'}, __proto__…}, lessons:{x:{folderId:'gone'}}}` returns no cycle (both reach root), unknown colour → slate, `x.folderId === null`, non-empty `fixes`, and returns valid empty tree for `null`, `[]`, `'x'`.
- [ ] **Step 2:** `npx vitest run src/lib/lesson/lesson-tree.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** in `src/lib/lesson/lesson-tree.ts`. Plain objects, never mutate input; read maps with `Object.hasOwn`; reorder renumbers the sibling group 0..n-1.
- [ ] **Step 4:** same command → PASS.
- [ ] **Step 5: Commit** `feat(lessons): pure Lesson tree module`.

### Task 2: Firestore rules

**Files:**
- Modify: `firestore.rules` (after the `public-lessons` block)
- Test: `tests/rules/lesson-trees.test.ts`

- [ ] **Step 1: Write failing tests** (`useRulesTestEnvironment`, `seed`, `ALICE`, `BOB`, `ADMIN`): owner get/set/delete `users/alice/lesson-trees/main` succeed; owner set `users/alice/lesson-trees/other` fails; BOB and unauthenticated get fail; ADMIN get succeeds, ADMIN set fails; `public-lesson-trees/alice` get by unauthenticated succeeds; list of `public-lesson-trees` fails for everyone; ALICE set with `ownerUid: 'alice'` succeeds, with `ownerUid: 'bob'` fails; BOB set/delete `public-lesson-trees/alice` fails; ALICE off a configured Access list (`OFF_LIST`, `config/access`) set fails.
- [ ] **Step 2:** `npm run test:rules -- tests/rules/lesson-trees.test.ts` → FAIL.
- [ ] **Step 3:** add the two `match` blocks exactly as spec §6.4.
- [ ] **Step 4:** `npm run test:rules` → all PASS (existing suites stay green).
- [ ] **Step 5: Commit** `feat(lessons): rules for Lesson trees and their public copy`.

### Task 3: Firestore access + index upkeep

**Files:**
- Create: `src/lib/firebase/lesson-tree.ts`
- Modify: `src/lib/firebase/lessons.ts` (`createLesson`, `saveLesson`, `setLessonPublic`, `deleteLesson`)

**Interfaces — Produces:**
```ts
export async function loadLessonTree(uid: string): Promise<LessonTree | null>; // null = no tree doc
export async function loadPublicLessonTree(ownerUid: string): Promise<LessonTree | null>; // via treeFromPublic
export async function updateLessonTree(uid: string, edit: (tree: LessonTree) => TreeEdit, options?: { create?: boolean }): Promise<TreeEdit>;
// transaction: read tree (missing → empty only when create !== false), apply edit, write tree + publicTreeOf in one go
export async function reconcileStoredTree(uid: string, lessons: StoredLesson[]): Promise<LessonTree | null>; // no-op (null) without a tree
export function treeRefs(uid: string): { tree: DocumentReference; mirror: DocumentReference }; // shared with lessons.ts
export function lessonTreeWrite(tree: LessonTree, uid: string): { tree: object; mirror: object }; // data for both docs, updatedAt serverTimestamp
// lessons.ts:
export async function createLesson(userId: string, document: LessonDocumentJSON, folderId?: string | null): Promise<string>;
```
- `createLesson`/`saveLesson`/`setLessonPublic`/`deleteLesson` become transactions that also `get` the tree doc; when it exists they write the updated tree + mirror (`upsertLessonEntry`/`removeLessonEntry`) in the same transaction; when it does not exist and `folderId` is null/undefined, nothing extra is written; `createLesson` with a `folderId` creates the tree. `saveLesson` writes the tree only when title or public differ from the entry. All reads before writes (Firestore transaction rule).
- Verification is by `tsc`, the unit suite, and the manual emulator pass in Task 7 (there is no client-SDK integration suite in this repo).
- [ ] **Step 1:** implement; `npx tsc --noEmit -p .` clean; `npm test` green.
- [ ] **Step 2: Commit** `feat(lessons): store the Lesson tree and keep its index current`.

### Task 4: Admin seed tree

**Files:**
- Create: `src/lib/lesson/tutorial-tree.ts`, `src/lib/lesson/tutorial-tree.test.ts`, `seed/lessons/tree.json`
- Modify: `scripts/convert-tutorials.ts`, `scripts/seed-lessons-shared.ts`, `scripts/seed-emulator-lessons.ts`, `scripts/import-lessons.ts`, `seed/lessons/README.md`

**Interfaces — Produces:**
```ts
export interface CurriculumModule { id: string; num: string; title: string; color: string; lessons: { id: string; title: string }[] }
export function tutorialTree(curriculum: CurriculumModule[], viNames: Record<string, string>, titles: { en: Record<string, string>; vi: Record<string, string> }): LessonTree; // lesson entries public: true
export function mergeSeedTree(existing: LessonTree | null, seed: LessonTree): LessonTree; // seed folders/entries overwrite by id; user folders and other entries kept
```
- `convert-tutorials.ts` writes `seed/lessons/tree.json` from `curriculum.json`, `i18n/vi.json` and the converted titles (VI titles carry " (VI)" like the seeder).
- Seed scripts read `tree.json`, read the account's existing tree over REST (emulator: `Bearer owner`; import script: the same token it writes with), `mergeSeedTree`, then write the merged tree + `publicTreeOf` after the lessons. Other lessons of the account (not in the seed) are indexed as Unfiled by `/lessons`' reconcile the next time the owner opens it.
- REST decoding of the existing tree goes in `scripts/seed-lessons-shared.ts` as `fromValue(value): unknown` (inverse of `toValue`).
- Tests: `tutorialTree` on a 2-module fixture gives roots `tutorial-en`/`tutorial-vi`, chapter ids, VI chapter names, colours, order; `mergeSeedTree` keeps a user folder and a user lesson entry; `seed/lessons/tree.json` normalises with no fixes, every entry id has a seed file (`tutorial-<lang>-<file>`) and every seed file is in the tree.
- [ ] **Step 1:** failing tests → **Step 2:** implement + regenerate `tree.json` with `npx vite-node scripts/convert-tutorials.ts` → **Step 3:** tests pass, `git diff --stat seed/lessons/{en,vi}` empty (lessons unchanged) → **Step 4: Commit** `feat(lessons): seed tree from the tutorials curriculum`.

### Task 5: `/lessons` tree panel

**Files:**
- Create: `src/components/lessons/LessonTreePanel.tsx`, `src/components/lessons/FolderIcon.tsx`, `src/components/lessons/lesson-tree-dialogs.tsx` (MoveToFolderDialog, DeleteFolderDialog, FolderNameDialog)
- Modify: `src/components/lessons/LessonsHome.tsx`

- Two columns (`md:` and up; stacked below). Left: "All lessons (n)", tree (chevron, `FolderIcon` coloured, `folderNumber` + name, ⋯ menu), "Unfiled (n)", "New folder" button. Right: existing table filtered by selection; "Folder" column on All lessons; row ⋯ gains "Move to folder…", "Move up/down" (folder view only).
- Every tree mutation goes through `updateLessonTree(uid, edit)`; on `{ ok:false }` show `toast.error(reason)`; panel state = returned tree.
- On load: `listLessons` then `reconcileStoredTree`; tree state from its result (or `loadLessonTree` when it returns null).
- New lesson passes the selected folder id (null for All/Unfiled).
- Open branches persisted under `xflow:lesson-tree-open:{uid}`.
- [ ] **Step 1:** implement; `tsc`, lint 0 errors.
- [ ] **Step 2:** manual emulator check (Task 7 list, /lessons part).
- [ ] **Step 3: Commit** `feat(lessons): organise Lessons in a tree on /lessons`.

### Task 6: Course sidebar

**Files:**
- Create: `src/components/lessons/CourseSidebar.tsx`, `src/lib/lesson/lesson-progress.ts` (+ test)
- Modify: `src/components/lessons/LessonViewer.tsx`, `src/components/lessons/LessonPlayer.tsx`

**Interfaces — Produces:**
```ts
// lesson-progress.ts (pure parse + storage helpers)
export const DONE_KEY = 'xflow:lessons-done';
export function parseDone(raw: string | null): Set<string>; // garbage → empty
export function loadDone(): Set<string>; export function markDone(id: string): Set<string>;
export function folderProgress(tree: LessonTree, folderId: string, done: Set<string>): { done: number; total: number };
// LessonPlayer new optional props:
sidebar?: ReactNode; nextLessonHref?: string; onReachEnd?: () => void;
```
- `LessonViewer` resolves owner (own lesson → `loadLessonTree(user.uid)`; public → `loadPublicLessonTree(ownerUid)`), errors swallowed to "no tree". Sidebar only when the lesson id is in the tree. Next = following id in `readingOrder`.
- Sidebar: auto-opens `pathTo(current)`; current row highlighted; ✓ for done; "Private" tag when owner sees a non-public entry; progress per folder; `md:` docked column, below that a drawer toggled from the header (`headerEnd`).
- Reaching the last Lesson step calls `onReachEnd` → `markDone`.
- Tests: `parseDone('{bad')` → empty, `parseDone('["a"]')` → {a}; `folderProgress` counts the whole subtree.
- [ ] **Step 1:** tests fail → **Step 2:** implement → **Step 3:** `npm test`, `tsc`, lint → **Step 4: Commit** `feat(lessons): Course sidebar, done marks and Next lesson`.

### Task 7: Docs, verification, deploy

**Files:** `GLOSSARY.md`, `CLAUDE.md` (Lessons section + routes), `src/app/help/page.tsx`, `src/app/help/vi/page.tsx`, `README.md`.

- [ ] Docs: glossary terms from spec §9; CLAUDE.md paragraph (data model, transaction upkeep, reconcile, public copy, known gap from spec §6.4); help EN/VI section "Organise lessons in folders" + learner sidebar.
- [ ] Gates: `npx tsc --noEmit -p .`, `npm run lint` (0 errors), `npm test`, `npm run test:rules`, `npm run build` (placeholder env OK).
- [ ] Emulator pass (browser): create/rename/recolour/reorder/move folder; move into own descendant refused; delete with lessons refused (message), empty subtree deleted; New lesson in a folder lands there; Public toggle updates the signed-out sidebar; viewer as owner shows Private tag; viewer signed out shows only public; ✓ after last step, progress count, Next lesson navigates; narrow viewport drawer.
- [ ] Seed: emulator via `seed-emulator-lessons.ts`; production: `firebase deploy --only firestore`, then `import-lessons.ts --project codex-flow-diagram --uid U2Pq3dKmBMQDyHLhy60B2GllxOv1` (owner token) — verify by reading `public-lesson-trees/U2Pq…` anonymously and opening a lesson on Vercel after deploy.
- [ ] Merge `feature/lesson-tree` into `main` (fast-forward), re-run `npm test` on main, `git push origin main`.
