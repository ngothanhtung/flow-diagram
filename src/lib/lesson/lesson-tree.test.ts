import { describe, expect, it } from 'vitest';
import {
  addFolder,
  childFolders,
  deleteFolder,
  emptyLessonTree,
  folderLessons,
  folderNumber,
  lessonCountInSubtree,
  moveFolder,
  moveLesson,
  normalizeLessonTree,
  pathTo,
  publicTreeOf,
  readingOrder,
  reconcileLessonTree,
  recolorFolder,
  removeLessonEntry,
  renameFolder,
  reorderFolder,
  reorderLesson,
  treeFromPublic,
  upsertLessonEntry,
  type LessonTree,
  type TreeEdit,
} from './lesson-tree';

function ok(edit: TreeEdit): LessonTree {
  if (!edit.ok) throw new Error(`expected ok, got: ${edit.reason}`);
  return edit.tree;
}

/** { A { A1 { l1 }, l2 }, B { l3 } } plus an unfiled u. */
function sample(): LessonTree {
  let tree = emptyLessonTree();
  tree = ok(addFolder(tree, { id: 'A', parentId: null, name: 'A' }));
  tree = ok(addFolder(tree, { id: 'B', parentId: null, name: 'B', color: 'green' }));
  tree = ok(addFolder(tree, { id: 'A1', parentId: 'A', name: 'A1' }));
  tree = upsertLessonEntry(tree, 'l1', { folderId: 'A1', title: 'L1', public: true });
  tree = upsertLessonEntry(tree, 'l2', { folderId: 'A', title: 'L2', public: false });
  tree = upsertLessonEntry(tree, 'l3', { folderId: 'B', title: 'L3', public: true });
  tree = upsertLessonEntry(tree, 'u', { title: 'U', public: true });
  return tree;
}

describe('folders', () => {
  it('addFolder appends among siblings with the default colour slate', () => {
    const tree = sample();
    expect(childFolders(tree, null).map((f) => f.id)).toEqual(['A', 'B']);
    expect(tree.folders.A.color).toBe('slate');
    expect(tree.folders.B.color).toBe('green');
  });

  it('addFolder refuses a missing parent', () => {
    expect(addFolder(emptyLessonTree(), { parentId: 'nope', name: 'x' }).ok).toBe(false);
  });

  it('renameFolder trims, defaults a blank name and caps it at 80 characters', () => {
    expect(ok(renameFolder(sample(), 'A', '  Scaling  ')).folders.A.name).toBe('Scaling');
    expect(ok(renameFolder(sample(), 'A', '   ')).folders.A.name).toBe('Untitled folder');
    expect(ok(renameFolder(sample(), 'A', 'x'.repeat(100))).folders.A.name).toHaveLength(80);
  });

  it('recolorFolder sets a known colour', () => {
    expect(ok(recolorFolder(sample(), 'A', 'rose')).folders.A.color).toBe('rose');
  });

  it('moveFolder refuses the folder itself or one of its descendants', () => {
    const tree = sample();
    expect(moveFolder(tree, 'A', 'A').ok).toBe(false);
    expect(moveFolder(tree, 'A', 'A1').ok).toBe(false);
    expect(tree.folders.A.parentId).toBeNull();
  });

  it('moveFolder re-parents and appends last', () => {
    const tree = ok(moveFolder(sample(), 'B', 'A'));
    expect(childFolders(tree, 'A').map((f) => f.id)).toEqual(['A1', 'B']);
    expect(childFolders(tree, null).map((f) => f.id)).toEqual(['A']);
  });

  it('reorderFolder swaps with its neighbour and is a no-op at the ends', () => {
    const tree = ok(reorderFolder(sample(), 'B', -1));
    expect(childFolders(tree, null).map((f) => f.id)).toEqual(['B', 'A']);
    expect(childFolders(ok(reorderFolder(tree, 'B', -1)), null).map((f) => f.id)).toEqual(['B', 'A']);
  });

  it('deleteFolder refuses while a lesson sits anywhere in its subtree, even a grandchild folder', () => {
    let tree = sample();
    tree = moveLessonOk(tree, 'l2', 'A1');
    const edit = deleteFolder(tree, 'A');
    expect(edit.ok).toBe(false);
    if (!edit.ok) expect(edit.reason).toMatch(/2 lessons/);
    expect(tree.folders.A).toBeDefined();
  });

  it('deleteFolder removes an empty subtree with every descendant folder', () => {
    let tree = sample();
    tree = moveLessonOk(tree, 'l1', null);
    tree = moveLessonOk(tree, 'l2', null);
    tree = ok(addFolder(tree, { id: 'A2', parentId: 'A1', name: 'A2' }));
    tree = ok(deleteFolder(tree, 'A'));
    expect(Object.keys(tree.folders)).toEqual(['B']);
  });

  it('folderNumber is the two-digit position among siblings', () => {
    const tree = sample();
    expect(folderNumber(tree, 'A')).toBe('01.');
    expect(folderNumber(tree, 'B')).toBe('02.');
    expect(folderNumber(tree, 'A1')).toBe('01.');
  });

  it('lessonCountInSubtree counts nested lessons', () => {
    expect(lessonCountInSubtree(sample(), 'A')).toBe(2);
    expect(lessonCountInSubtree(sample(), 'A1')).toBe(1);
  });
});

function moveLessonOk(tree: LessonTree, id: string, folderId: string | null) {
  return ok(moveLesson(tree, id, folderId));
}

describe('lessons', () => {
  it('moveLesson refuses a missing folder or lesson', () => {
    expect(moveLesson(sample(), 'l1', 'gone').ok).toBe(false);
    expect(moveLesson(sample(), 'gone', 'A').ok).toBe(false);
  });

  it('moveLesson appends to the target folder', () => {
    const tree = moveLessonOk(sample(), 'l3', 'A');
    expect(folderLessons(tree, 'A').map((l) => l.id)).toEqual(['l2', 'l3']);
  });

  it('reorderLesson swaps within its folder', () => {
    const tree = ok(reorderLesson(moveLessonOk(sample(), 'l3', 'A'), 'l3', -1));
    expect(folderLessons(tree, 'A').map((l) => l.id)).toEqual(['l3', 'l2']);
  });

  it('upsertLessonEntry adds unfiled by default and patches an existing entry', () => {
    let tree = upsertLessonEntry(emptyLessonTree(), 'x', { title: 'X' });
    expect(tree.lessons.x).toMatchObject({ folderId: null, title: 'X', public: false });
    tree = upsertLessonEntry(tree, 'x', { public: true });
    expect(tree.lessons.x).toMatchObject({ title: 'X', public: true });
  });

  it('removeLessonEntry drops the entry', () => {
    expect(removeLessonEntry(sample(), 'l1').lessons.l1).toBeUndefined();
  });
});

describe('reading', () => {
  it('readingOrder walks depth-first, subfolders before lessons, unfiled excluded', () => {
    expect(readingOrder(sample())).toEqual(['l1', 'l2', 'l3']);
  });

  it('pathTo lists the folders from the root down', () => {
    expect(pathTo(sample(), 'l1')).toEqual(['A', 'A1']);
    expect(pathTo(sample(), 'u')).toEqual([]);
    expect(pathTo(sample(), 'missing')).toEqual([]);
  });
});

describe('reconcileLessonTree', () => {
  it('adds a missing lesson as unfiled, drops a deleted one and refreshes title and Public', () => {
    const { tree, changed } = reconcileLessonTree(sample(), [
      { id: 'l1', title: 'L1 renamed', public: false },
      { id: 'l2', title: 'L2', public: false },
      { id: 'l3', title: 'L3', public: true },
      { id: 'new', title: 'New', public: false },
    ]);
    expect(changed).toBe(true);
    expect(tree.lessons.u).toBeUndefined();
    expect(tree.lessons.new).toMatchObject({ folderId: null, title: 'New' });
    expect(tree.lessons.l1).toMatchObject({ folderId: 'A1', title: 'L1 renamed', public: false });
  });

  it('reports no change when the index already matches', () => {
    const tree = sample();
    const lessons = Object.entries(tree.lessons).map(([id, entry]) => ({ id, title: entry.title, public: entry.public }));
    expect(reconcileLessonTree(tree, lessons).changed).toBe(false);
  });
});

describe('publicTreeOf', () => {
  it('keeps only Public lessons and the folders that lead to them', () => {
    let tree = emptyLessonTree();
    tree = ok(addFolder(tree, { id: 'F', parentId: null, name: 'F' }));
    tree = ok(addFolder(tree, { id: 'G', parentId: null, name: 'Secret' }));
    tree = upsertLessonEntry(tree, 'p', { folderId: 'F', title: 'Public one', public: true });
    tree = upsertLessonEntry(tree, 'q', { folderId: 'F', title: 'Private one', public: false });
    tree = upsertLessonEntry(tree, 'r', { folderId: 'G', title: 'Private two', public: false });
    tree = upsertLessonEntry(tree, 's', { title: 'Unfiled public', public: true });
    const pub = publicTreeOf(tree, 'owner');
    expect(pub.ownerUid).toBe('owner');
    expect(pub.folders.map((f) => f.id)).toEqual(['F']);
    expect(pub.lessons.map((l) => l.id)).toEqual(['p']);
    expect(JSON.stringify(pub)).not.toMatch(/Private|Secret|Unfiled/);
  });

  it('keeps the ancestors of a folder holding a Public lesson', () => {
    const pub = publicTreeOf(sample(), 'owner');
    expect(pub.folders.map((f) => f.id).sort()).toEqual(['A', 'A1', 'B']);
  });

  it('round-trips through treeFromPublic', () => {
    const back = treeFromPublic(publicTreeOf(sample(), 'owner'));
    expect(readingOrder(back)).toEqual(['l1', 'l3']);
    expect(back.lessons.l1.public).toBe(true);
  });
});

describe('normalizeLessonTree', () => {
  it('turns anything that is not a tree into an empty one', () => {
    for (const input of [null, [], 'x', 3, undefined]) {
      const { tree } = normalizeLessonTree(input);
      expect(tree).toEqual(emptyLessonTree());
    }
  });

  it('breaks cycles, clears dangling parents and folders, and drops reserved ids', () => {
    const input = JSON.parse(`{
      "folders": {
        "a": { "parentId": "b", "name": "A", "color": "purple", "order": 0 },
        "b": { "parentId": "a", "name": "", "order": "x" },
        "c": { "parentId": "gone", "name": "C" },
        "__proto__": { "parentId": null, "name": "evil" }
      },
      "lessons": {
        "x": { "folderId": "gone", "title": "X", "public": "yes" },
        "constructor": { "folderId": null, "title": "evil" }
      }
    }`);
    const { tree, fixes } = normalizeLessonTree(input);
    expect(fixes.length).toBeGreaterThan(0);
    expect(Object.keys(tree.folders).sort()).toEqual(['a', 'b', 'c']);
    expect(tree.folders.a.color).toBe('slate');
    expect(tree.folders.b.name).toBe('Untitled folder');
    expect(tree.folders.c.parentId).toBeNull();
    // No cycle remains: every folder reaches the root.
    for (const id of Object.keys(tree.folders)) expect(pathTo(upsertLessonEntry(tree, 't', { folderId: id }), 't')[0]).toBeDefined();
    expect(childFolders(tree, null).length).toBeGreaterThan(0);
    expect(tree.lessons.x).toMatchObject({ folderId: null, public: false });
    expect(Object.hasOwn(tree.lessons, 'constructor')).toBe(false);
  });

  it('returns no fixes for a clean tree', () => {
    expect(normalizeLessonTree(sample()).fixes).toEqual([]);
  });
});
