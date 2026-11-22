// The Diagram tree reuses the Lesson tree's folders; these pin what is Diagram-specific.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LessonTreePanel } from '@/components/lessons/LessonTreePanel';
import { addFolder, deleteFolder, emptyLessonTree, reconcileLessonTree } from '@/lib/lesson/lesson-tree';
import { DIAGRAM_NOUN, diagramSummary } from './diagram-tree';

describe('diagramSummary', () => {
  it('reads the name and Public flag of a stored Diagram, never trusting the shape', () => {
    expect(diagramSummary({ id: 'd1', name: 'Checkout', public: true })).toEqual({ id: 'd1', title: 'Checkout', public: true });
    expect(diagramSummary({ id: 'd2', name: '', public: 'yes' })).toEqual({ id: 'd2', title: 'Untitled diagram', public: false });
    expect(diagramSummary({ id: 'd3', name: 42 })).toEqual({ id: 'd3', title: 'Untitled diagram', public: false });
  });
});

describe('Diagram folders', () => {
  it('refuse to delete a folder that still holds a Diagram', () => {
    const made = addFolder(emptyLessonTree(), { id: 'f1', parentId: null, name: 'Payments' });
    if (!made.ok) throw new Error(made.reason);
    const tree = reconcileLessonTree(made.tree, [diagramSummary({ id: 'd1', name: 'Checkout' })]).tree;
    const filed = { ...tree, lessons: { ...tree.lessons, d1: { ...tree.lessons.d1, folderId: 'f1' } } };
    const result = deleteFolder(filed, 'f1', DIAGRAM_NOUN);
    expect(result).toEqual({ ok: false, reason: 'This folder still holds 1 diagram. Move or delete them first.' });
  });

  it('render the tree panel in Diagram words', () => {
    const html = renderToStaticMarkup(
      createElement(LessonTreePanel, { tree: emptyLessonTree(), totalCount: 3, selection: { kind: 'all' }, openIds: new Set<string>(), onSelect: () => {}, onToggle: () => {}, onEdit: async () => true, noun: DIAGRAM_NOUN }),
    );
    expect(html).toContain('All diagrams');
    expect(html).toContain('aria-label="Diagram folders"');
    expect(html.toLowerCase()).not.toContain('lesson');
  });
});
