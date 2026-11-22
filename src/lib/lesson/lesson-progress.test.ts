import { describe, expect, it } from 'vitest';
import { addFolder, emptyLessonTree, upsertLessonEntry, type LessonTree } from './lesson-tree';
import { folderProgress, nextLessonId, parseDone } from './lesson-progress';

function tree(): LessonTree {
  let t = emptyLessonTree();
  for (const [id, parentId] of [['A', null], ['A1', 'A'], ['B', null]] as const) {
    const edit = addFolder(t, { id, parentId, name: id });
    if (!edit.ok) throw new Error(edit.reason);
    t = edit.tree;
  }
  t = upsertLessonEntry(t, 'l1', { folderId: 'A1', public: true });
  t = upsertLessonEntry(t, 'l2', { folderId: 'A', public: true });
  t = upsertLessonEntry(t, 'l3', { folderId: 'B', public: true });
  return t;
}

describe('parseDone', () => {
  it('reads a JSON array of ids', () => {
    expect(parseDone('["a","b"]')).toEqual(new Set(['a', 'b']));
  });

  it('ignores anything else', () => {
    for (const raw of [null, '', '{bad', '{"a":1}', '[1,null]', '"x"']) expect(parseDone(raw)).toEqual(new Set());
  });
});

describe('folderProgress', () => {
  it('counts the whole subtree', () => {
    expect(folderProgress(tree(), 'A', new Set(['l1']))).toEqual({ done: 1, total: 2 });
    expect(folderProgress(tree(), 'B', new Set(['l1']))).toEqual({ done: 0, total: 1 });
  });
});

describe('nextLessonId', () => {
  it('follows reading order and stops at the end', () => {
    expect(nextLessonId(tree(), 'l1')).toBe('l2');
    expect(nextLessonId(tree(), 'l2')).toBe('l3');
    expect(nextLessonId(tree(), 'l3')).toBeNull();
    expect(nextLessonId(tree(), 'missing')).toBeNull();
  });
});
