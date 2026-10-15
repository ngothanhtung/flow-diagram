// Structural validation for Diagram JSON that arrives as text — pasted into
// the JSON Playground, or onto the canvas through the clipboard. Pure, no
// React: the playground and `clipboard-fragment.ts` share it so both accept
// exactly the same documents.
//
// It checks what rendering relies on (the rules /guide documents), not
// every optional field: anything else on a node or line is optional by
// design, so older and hand-written documents keep loading.

import type { FlowDocumentJSON } from './flowchart-types';

export interface ValidateDocumentOptions {
  /**
   * The JSON Playground replaces the canvas with the document as-is, so a
   * line pointing at a missing node, or one without an id, is an error
   * there. A paste re-ids every line and drops the ones whose ends aren't
   * part of what was pasted, so it only needs `from`/`to` to be strings.
   */
  lenientEdges?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Returns an error message for the first problem found, or null when
 * `parsed` is a `{ nodes, edges }` document that is safe to render:
 * unique non-empty node ids, every node with a `type`, a string `title`
 * (empty is fine — Icons and Free lines have none) and a numeric
 * `position`, and lines that reference existing nodes.
 */
export function validateDocument(parsed: unknown, options: ValidateDocumentOptions = {}): string | null {
  if (!isRecord(parsed) || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    return 'Document must be an object with "nodes" and "edges" arrays.';
  }
  const nodeIds = new Set<string>();
  for (const node of parsed.nodes as unknown[]) {
    if (!isRecord(node) || typeof node.id !== 'string' || !node.id) return 'Every node needs a non-empty string "id".';
    if (nodeIds.has(node.id)) return `Duplicate node id "${node.id}".`;
    const position = node.position;
    if (typeof node.type !== 'string' || !node.type || typeof node.title !== 'string' || !isRecord(position) || !isFiniteNumber(position.x) || !isFiniteNumber(position.y)) {
      return `Node "${node.id}" is missing "type", "title", or a numeric "position".`;
    }
    nodeIds.add(node.id);
  }
  for (const edge of parsed.edges as unknown[]) {
    if (!isRecord(edge)) return 'Every edge must be an object.';
    if (options.lenientEdges) {
      if (typeof edge.from !== 'string' || typeof edge.to !== 'string') return 'Every edge needs string "from" and "to" node ids.';
      continue;
    }
    if (typeof edge.id !== 'string' || !edge.id) return 'Every edge needs a non-empty string "id".';
    if (typeof edge.from !== 'string' || typeof edge.to !== 'string' || !nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      return `Edge "${edge.id}" references a node id that doesn't exist ("${String(edge.from)}" → "${String(edge.to)}").`;
    }
  }
  return null;
}

/** Narrowing companion to `validateDocument`. */
export function isValidDocument(parsed: unknown, options?: ValidateDocumentOptions): parsed is FlowDocumentJSON {
  return validateDocument(parsed, options) === null;
}
