// Group nesting. A group is an ordinary node (`type: 'group'`) that other
// nodes point at through `parentId`, so nesting adds one field to the
// document and no new document shape.
//
// Two invariants everything here maintains:
//   1. Positions stay absolute. A group move applies the same delta to
//      every descendant, so edges, ports, SQL export and the viewer keep
//      reading `position` without knowing about groups at all.
//   2. `parentId` never forms a cycle. Every walk up the tree is bounded
//      by a visited set, and the drop test refuses to nest a group inside
//      its own descendant.

import type { FlowNode } from './flowchart-types';
import { GROUP_HEADER_HEIGHT, GROUP_PADDING, resolveNodeStyle } from './node-style';

export interface NodeBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function isGroupNode(node: FlowNode) {
  return node.type === 'group';
}

/** Axis-aligned bounds of a node's resolved box, in canvas coordinates. */
export function nodeBounds(node: FlowNode): NodeBounds {
  const { width, height } = resolveNodeStyle(node);
  return {
    left: node.position.x - width / 2,
    right: node.position.x + width / 2,
    top: node.position.y - height / 2,
    bottom: node.position.y + height / 2,
  };
}

function contains(bounds: NodeBounds, point: { x: number; y: number }) {
  return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom;
}

/** Direct members of a group, in document order. */
export function childrenOf(nodes: FlowNode[], parentId: string): FlowNode[] {
  return nodes.filter((node) => node.parentId === parentId);
}

/**
 * Every node below `rootId`, excluding the root itself. Built by walking
 * down level by level so a corrupted document with a `parentId` cycle
 * terminates instead of hanging.
 */
export function descendantIds(nodes: FlowNode[], rootId: string): Set<string> {
  const found = new Set<string>();
  let frontier = [rootId];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const node of nodes) {
      if (node.parentId === undefined || found.has(node.id) || node.id === rootId) continue;
      if (frontier.includes(node.parentId)) {
        found.add(node.id);
        next.push(node.id);
      }
    }
    frontier = next;
  }
  return found;
}

/** 0 for a top-level node, +1 per enclosing group. */
export function nodeDepth(node: FlowNode, byId: Map<string, FlowNode>): number {
  let depth = 0;
  const seen = new Set<string>([node.id]);
  let current = node.parentId ? byId.get(node.parentId) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return depth;
}

/**
 * Document order rewritten so a group always paints before the nodes
 * inside it. Sorting by depth is enough — a member is deeper than its
 * frame — and the sort is stable, so nodes at the same depth keep the
 * order the document gave them.
 */
export function sortByTreeDepth(nodes: FlowNode[]): FlowNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return nodes
    .map((node, index) => ({ node, index, depth: nodeDepth(node, byId) }))
    .sort((a, b) => a.depth - b.depth || a.index - b.index)
    .map((entry) => entry.node);
}

/**
 * The group a dragged node should join, given where it was dropped:
 * the deepest frame whose box contains `point`. `draggedId` and its own
 * descendants are skipped, so a group can never become its own ancestor.
 * Returns null when the drop lands outside every frame — which is what
 * releases a node from its group.
 */
export function findDropTarget(nodes: FlowNode[], draggedId: string, point: { x: number; y: number }): FlowNode | null {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const excluded = descendantIds(nodes, draggedId);
  let best: FlowNode | null = null;
  let bestDepth = -1;
  for (const node of nodes) {
    if (!isGroupNode(node) || node.id === draggedId || excluded.has(node.id)) continue;
    if (!contains(nodeBounds(node), point)) continue;
    const depth = nodeDepth(node, byId);
    // `>=` so that among equally deep frames the last one in document
    // order — the one painted on top — wins.
    if (depth >= bestDepth) {
      best = node;
      bestDepth = depth;
    }
  }
  return best;
}

/** Union of several nodes' boxes, or null when the list is empty. */
export function boundsOfNodes(nodes: FlowNode[]): NodeBounds | null {
  if (nodes.length === 0) return null;
  const boxes = nodes.map(nodeBounds);
  return {
    left: Math.min(...boxes.map((box) => box.left)),
    right: Math.max(...boxes.map((box) => box.right)),
    top: Math.min(...boxes.map((box) => box.top)),
    bottom: Math.max(...boxes.map((box) => box.bottom)),
  };
}

/**
 * Geometry a frame needs to wrap the given members: padding on every
 * side, plus room for the title bar at the top.
 */
export function groupGeometryFor(members: FlowNode[]): { position: { x: number; y: number }; width: number; height: number } | null {
  const bounds = boundsOfNodes(members);
  if (!bounds) return null;
  const left = bounds.left - GROUP_PADDING;
  const right = bounds.right + GROUP_PADDING;
  const top = bounds.top - GROUP_PADDING - GROUP_HEADER_HEIGHT;
  const bottom = bounds.bottom + GROUP_PADDING;
  return {
    position: { x: (left + right) / 2, y: (top + bottom) / 2 },
    width: right - left,
    height: bottom - top,
  };
}
