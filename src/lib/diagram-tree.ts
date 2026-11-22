// The Diagram tree: the Lesson tree's folders (lib/lesson/lesson-tree.ts) over
// a user's own Diagrams. Stored at `users/{uid}/diagram-trees/main`; its
// `lessons` map is, here, the index of their Diagrams. No public copy.
import type { TreeNoun } from './lesson/lesson-tree';

export const DIAGRAM_NOUN: TreeNoun = { one: 'diagram', many: 'diagrams', title: 'Diagram' };

/** What the index records about a stored Diagram; raw Firestore data, so never trust the shape. */
export function diagramSummary(diagram: { id: string; name?: unknown; public?: unknown }): { id: string; title: string; public: boolean } {
  return { id: diagram.id, title: typeof diagram.name === 'string' && diagram.name ? diagram.name : 'Untitled diagram', public: diagram.public === true };
}
