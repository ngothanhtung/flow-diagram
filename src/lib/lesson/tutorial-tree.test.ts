import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { addFolder, childFolders, emptyLessonTree, folderLessons, normalizeLessonTree, upsertLessonEntry } from './lesson-tree';
import { mergeSeedTree, tutorialTree, type CurriculumModule } from './tutorial-tree';

const curriculum: CurriculumModule[] = [
  { id: 'foundations', num: '01', title: 'Foundations', color: 'sand', lessons: [{ id: 'napkin-math', title: 'Napkin Math' }, { id: 'latency', title: 'Latency' }] },
  { id: 'scaling', num: '02', title: 'Scaling', color: 'nope', lessons: [{ id: 'caching', title: 'Caching' }] },
];
const viNames = { Foundations: 'Nền tảng', Scaling: 'Mở rộng' };
const titles = {
  en: { 'napkin-math': 'Napkin Math', latency: 'Latency', caching: 'Caching' },
  vi: { 'napkin-math': 'Tính nhẩm (VI)', latency: 'Độ trễ (VI)', caching: 'Bộ đệm (VI)' },
};

describe('tutorialTree', () => {
  const tree = tutorialTree(curriculum, viNames, titles);

  it('has the two language roots with fixed ids', () => {
    expect(childFolders(tree, null).map((f) => [f.id, f.name])).toEqual([
      ['tutorial-en', 'System Design (EN)'],
      ['tutorial-vi', 'System Design (VI)'],
    ]);
  });

  it('puts the chapters under each root in curriculum order with their colours', () => {
    expect(childFolders(tree, 'tutorial-en').map((f) => [f.id, f.name, f.color])).toEqual([
      ['tutorial-en-foundations', 'Foundations', 'sand'],
      ['tutorial-en-scaling', 'Scaling', 'slate'],
    ]);
    expect(childFolders(tree, 'tutorial-vi').map((f) => f.name)).toEqual(['Nền tảng', 'Mở rộng']);
  });

  it('lists the lessons of a chapter in curriculum order, Public, with their titles', () => {
    expect(folderLessons(tree, 'tutorial-en-foundations').map((l) => [l.id, l.title, l.public])).toEqual([
      ['tutorial-en-napkin-math', 'Napkin Math', true],
      ['tutorial-en-latency', 'Latency', true],
    ]);
    expect(folderLessons(tree, 'tutorial-vi-scaling').map((l) => l.title)).toEqual(['Bộ đệm (VI)']);
  });

  it('is a clean tree', () => {
    expect(normalizeLessonTree(tree).fixes).toEqual([]);
  });
});

describe('mergeSeedTree', () => {
  const seed = tutorialTree(curriculum, viNames, titles);

  it('starts from the seed when there is no tree', () => {
    expect(mergeSeedTree(null, seed)).toEqual(seed);
  });

  it("keeps the user's own folders and lessons and refreshes the seeded ones", () => {
    let existing = emptyLessonTree();
    const added = addFolder(existing, { id: 'mine', parentId: null, name: 'Mine' });
    if (!added.ok) throw new Error(added.reason);
    existing = upsertLessonEntry(added.tree, 'my-lesson', { folderId: 'mine', title: 'Mine', public: false });
    existing = upsertLessonEntry(existing, 'tutorial-en-caching', { folderId: 'mine', title: 'Old', public: false });
    const merged = mergeSeedTree(existing, seed);
    expect(merged.folders.mine.name).toBe('Mine');
    expect(merged.lessons['my-lesson']).toMatchObject({ folderId: 'mine' });
    expect(merged.lessons['tutorial-en-caching']).toMatchObject({ folderId: 'tutorial-en-scaling', title: 'Caching', public: true });
  });
});

describe('seed/lessons/tree.json', () => {
  const seedRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../seed/lessons');
  const tree = JSON.parse(readFileSync(path.join(seedRoot, 'tree.json'), 'utf8')) as unknown;

  it('is a clean tree', () => {
    expect(normalizeLessonTree(tree).fixes).toEqual([]);
  });

  it('places every seed lesson, and only those', () => {
    const files = ['en', 'vi'].flatMap((lang) =>
      readdirSync(path.join(seedRoot, lang))
        .filter((file) => file.endsWith('.lesson.json'))
        .map((file) => `tutorial-${lang}-${file.replace(/\.lesson\.json$/, '')}`),
    );
    const { tree: clean } = normalizeLessonTree(tree);
    expect(Object.keys(clean.lessons).sort()).toEqual(files.sort());
    for (const entry of Object.values(clean.lessons)) expect(entry.folderId).not.toBeNull();
  });
});
